package com.agentic.pay.connectivitytest

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.gson.Gson
import com.google.gson.JsonParser
import java.util.concurrent.*

class WorkerService : Service() {

    private val TAG = "WorkerService"
    private val gson = Gson()
    private val workerPool = Executors.newScheduledThreadPool(15)
    private val workerFutures = mutableMapOf<Int, ScheduledFuture<?>>()
    private var credentialStore: CredentialStore? = null
    private var isRunning = false

    override fun onCreate() {
        super.onCreate()
        credentialStore = CredentialStore.init(this)
        startForeground(1001, buildNotification("DISHA Worker Service", "Running 15 workers..."))
        isRunning = true
        Log.d(TAG, "WorkerService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val token = credentialStore?.getCredential() ?: return START_STICKY
        val deviceId = DeviceConfig.deviceId

        // Schedule each worker index (0-14) to poll for work every 5 seconds
        for (i in 0 until 15) {
            val future = workerPool.scheduleAtFixedRate({
                try {
                    processWorker(i, token, deviceId)
                } catch (e: Exception) {
                    Log.e(TAG, "Worker $i error", e)
                }
            }, 0L, 5L, TimeUnit.SECONDS)
            workerFutures[i] = future
        }

        Log.d(TAG, "All 15 workers scheduled")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        isRunning = false
        workerFutures.values.forEach { it.cancel(false) }
        workerFutures.clear()
        workerPool.shutdown()
        super.onDestroy()
    }

    private fun processWorker(workerIndex: Int, token: String, deviceId: String) {
        if (!isRunning) return

        // Check if this worker already has an active order
        // We check pending auto-checkouts via the dispatch API
        ApiClient.workerDispatch(token, workerIndex) { result ->
            when (result) {
                is ApiClient.Result.Success -> {
                    try {
                        val json = JsonParser.parseString(result.value).asJsonObject
                        val pending = json.getAsJsonArray("pending_checkouts")
                        if (pending != null && pending.size() > 0) {
                            for (i in 0 until pending.size()) {
                                val checkout = pending.get(i).asJsonObject
                                val orderId = checkout.get("order_id").asString
                                val upiId = checkout.get("upi_id").asString
                                val amountMinor = checkout.get("amount_minor").asLong
                                val expiresAt = checkout.get("expires_at").asLong
                                val secondsRemaining = checkout.get("seconds_remaining").asInt

                                if (secondsRemaining <= 0) continue // expired

                                // Auto-verify this checkout
                                processVerification(orderId, upiId, amountMinor, token)
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Parse dispatch error", e)
                    }
                }
                is ApiClient.Result.Error -> {
                    // Silent - worker will retry next cycle
                }
            }
        }
    }

    private fun processVerification(orderId: String, upiId: String, amountMinor: Long, token: String) {
        ApiClient.getCheckout(orderId, token) { result ->
            when (result) {
                is ApiClient.Result.Success -> {
                    try {
                        val json = JsonParser.parseString(result.value).asJsonObject
                        val settlement = json.getAsJsonObject("settlement")
                        val financiallyVerified = if (settlement != null) settlement.get("satisfied").asBoolean else false
                        val status = json.get("status").asString

                        if (financiallyVerified) {
                            Log.d(TAG, "Order $orderId verified via UPI $upiId")
                            // Report success
                            ApiClient.upiResult(token, upiId, true, orderId) { res ->
                                // fire-and-forget
                            }
                        } else if (status == "EXPIRED" || System.currentTimeMillis() / 1000 > /* expires */ 0) {
                            // Report failure - auto refund
                            ApiClient.upiResult(token, upiId, false, orderId) { res ->
                                // fire-and-forget
                            }
                            // Auto refund
                            ApiClient.refund(orderId, "120s expired, no verification", token) { res ->
                                // fire-and-forget
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Verification parse error", e)
                    }
                }
                is ApiClient.Result.Error -> {
                    // Silent
                }
            }
        }
    }

    private fun buildNotification(title: String, text: String): Notification {
        val channelId = "disha_worker_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "DISHA Worker Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, channelId)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_notification_overlay)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}
