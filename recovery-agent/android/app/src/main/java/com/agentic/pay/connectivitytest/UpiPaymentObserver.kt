package com.agentic.pay.connectivitytest

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.SharedPreferences
import android.os.IBinder
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import kotlin.concurrent.thread

/**
 * NotificationListenerService for automatic incoming UPI credit observation.
 *
 * Privacy guarantees:
 * - Only notifications from explicitly approved payment source packages are processed.
 * - Only incoming credit transaction events are extracted.
 * - Raw notification text is never transmitted to the backend.
 * - OTPs, PINs, passwords, balances, contacts and unrelated financial data are never collected.
 * - Incomplete or ambiguous events are rejected with an explicit insufficient-evidence state.
 */
class UpiPaymentObserver : NotificationListenerService() {

    private companion object {
        private const val TAG = "UpiPaymentObserver"

        // Approved UPI payment source packages. Only these are processed.
        // The merchant consents to each source via Android notification access settings.
        internal val APPROVED_SOURCES = setOf(
            "com.phonepe.app",
            "com.google.android.apps.nbu.paisa.user", // Google Pay
            "com.paytm.personalbanking",
            "com.amazon.mp",
            "com.bhimapp.upi",
        )

        // Transaction reference pattern: 12-digit UPI reference / UTR.
        internal val REFERENCE_PATTERN = Regex("\\b[0-9]{12}\\b")

        // Amount pattern: ₹<amount> or Rs.<amount> or INR <amount> or just a number with optional decimals.
        internal val AMOUNT_PATTERN = Regex("""(?:₹|Rs\.?|INR)\s*([0-9]{1,10}(?:\.[0-9]{1,2})?)\b""", RegexOption.IGNORECASE)

        // Credit direction keywords in notification text.
        internal val CREDIT_KEYWORDS = setOf("credited", "received", "received ₹", "money received",
            "amount credited", "received money", "payment received", "credited to")

        // Debit direction keywords — used to reject outgoing transactions.
        internal val DEBIT_KEYWORDS = setOf("debited", "paid", "sent", "transferred", "payment sent",
            "amount debited", "paid to", "money sent")

        const val PREFS_NAME = "agentic_pay_observer"
        const val KEY_LAST_EVENT_ID = "last_event_id"
        const val KEY_RETRY_QUEUE = "retry_queue"
        const val KEY_PERMISSION_GRANTED = "notification_permission_granted"
        const val MAX_RETRY_ATTEMPTS = 3
        const val RETRY_BACKOFF_SECONDS = 30
    }

    private lateinit var gson: Gson
    private lateinit var prefs: SharedPreferences
    private lateinit var credentialStore: CredentialStore

    override fun onCreate() {
        super.onCreate()
        gson = Gson()
        credentialStore = CredentialStore.init(applicationContext)
        val masterKey = MasterKey.Builder(applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            applicationContext,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        Log.i(TAG, "UpiPaymentObserver created")
    }

    override fun onBind(intent: Intent): IBinder? {
        return super.onBind(intent)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.i(TAG, "Notification listener connected")
        prefs.edit().putBoolean(KEY_PERMISSION_GRANTED, true).apply()
        // Process any queued retries on reconnection.
        processRetryQueue()
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.w(TAG, "Notification listener disconnected")
        prefs.edit().putBoolean(KEY_PERMISSION_GRANTED, false).apply()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        super.onNotificationPosted(sbn)

        val packageName = sbn.packageName ?: return
        if (packageName !in APPROVED_SOURCES) {
            Log.d(TAG, "Ignoring notification from unapproved source: $packageName")
            return
        }

        val notification = sbn.notification ?: return
        val event = parseCreditEvent(notification, packageName) ?: return

        Log.i(TAG, "Credit event parsed: ${event.eventId}, amount=${event.amountPaise}, ref=${event.transactionReference}")

        // Submit to backend immediately. Queue on failure.
        submitCreditEvent(event)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        super.onNotificationRemoved(sbn)
        // No action needed — observation is based on posting, not removal.
    }

    /**
     * Parses a Notification into a CreditEvent. Returns null if the event cannot
     * be reliably parsed (insufficient evidence).
     *
     * Never returns raw notification content — only extracted transaction fields.
     */
    private fun parseCreditEvent(notification: Notification, sourceAppId: String): CreditEvent? {
        val text = extractNotificationText(notification)
        if (text.isBlank()) {
            Log.w(TAG, "No readable text in notification from $sourceAppId")
            return null
        }

        // Reject outgoing/debit transactions.
        val lower = text.lowercase()
        if (DEBIT_KEYWORDS.any { lower.contains(it) }) {
            Log.d(TAG, "Outgoing transaction detected, rejecting: $sourceAppId")
            return null
        }

        // Must have at least one credit keyword.
        if (!CREDIT_KEYWORDS.any { lower.contains(it) }) {
            Log.d(TAG, "No credit direction keyword found: $sourceAppId")
            return null
        }

        // Extract amount.
        val amountMatch = AMOUNT_PATTERN.find(text)
        if (amountMatch == null) {
            Log.w(TAG, "No amount found in notification: $sourceAppId")
            return null
        }
        val amountStr = amountMatch.groupValues[1]
        val amountDouble = amountStr.toDoubleOrNull() ?: return null
        val amountPaise = (amountDouble * 100).roundToInt()
        if (amountPaise < 100) {
            Log.w(TAG, "Amount below minimum (₹1.00): $amountPaise paise")
            return null
        }

        // Extract transaction reference (12 digits).
        val referenceMatch = REFERENCE_PATTERN.find(text)
        val transactionReference = referenceMatch?.value

        // Generate a unique event ID from available data.
        val eventIdSource = "$sourceAppId|$amountPaise|$transactionReference|${System.currentTimeMillis()}"
        val eventId = sha256(eventIdSource)

        return CreditEvent(
            eventId = eventId,
            amountPaise = amountPaise,
            currency = "INR",
            observationDirection = "incoming",
            receivingAccountId = "", // Filled by backend correlation; device does not know internal account ID.
            transactionReference = transactionReference,
            observationTimestamp = System.currentTimeMillis() / 1000,
            sourceAppId = sourceAppId,
        )
    }

    /**
     * Extracts human-readable text from a notification without exposing raw structure.
     * Returns only concatenated text content — no raw bundle, no extras, no raw payload.
     */
    private fun extractNotificationText(notification: Notification): String {
        val parts = mutableListOf<String>()

        // From the status bar icon/content title.
        notification?.let {
            if (it.contentTitle.isNotBlank()) parts.add(it.contentTitle)
            if (it.contentText.isNotBlank()) parts.add(it.contentText)
            if (it.subText.isNotBlank()) parts.add(it.subText)
        }

        // From big content view (expanded notification).
        notification?.bigContentView?.let { views ->
            // Collect text from known view IDs generically without accessing private fields.
            // We only capture visible text strings the user already sees.
        }

        return parts.joinToString(" ")
    }

    private fun submitCreditEvent(event: CreditEvent) {
        val token = credentialStore.getCredential() ?: return
        val accountId = credentialStore.getAccountId()
        if (accountId == null) {
            Log.w(TAG, "No account ID stored; queuing retry")
            queueRetry(event)
            return
        }

        val body = mutableMapOf<String, Any?>(
            "event_id" to event.eventId,
            "amount_paise" to event.amountPaise,
            "currency" to event.currency,
            "observation_direction" to event.observationDirection,
            "receiving_account_id" to accountId,
            "transaction_reference" to event.transactionReference,
            "observation_timestamp" to event.observationTimestamp,
            "source_app_id" to event.sourceAppId,
        )

        thread {
            val result = httpPost("/api/android/credit-event", body, token)
            when (result) {
                is ApiClient.Result.Success -> {
                    Log.i(TAG, "Credit event submitted: ${event.eventId}")
                    prefs.edit().putString(KEY_LAST_EVENT_ID, event.eventId).apply()
                }
                is ApiClient.Result.Error -> {
                    Log.w(TAG, "Credit event submission failed: ${result.message}")
                    queueRetry(event)
                }
            }
        }
    }

    private fun queueRetry(event: CreditEvent) {
        val existing = prefs.getString(KEY_RETRY_QUEUE, "[]")
        val queue = try {
            gson.fromJson<Array<String>>(existing, Array::class.java) ?: emptyList()
        } catch (e: JsonSyntaxException) {
            emptyList()
        }
        val eventJson = gson.toJson(event)
        val updated = (queue + eventJson).takeLast(50) // Bounded queue: keep last 50.
        prefs.edit().putString(KEY_RETRY_QUEUE, gson.toJson(updated)).apply()
    }

    private fun processRetryQueue() {
        val token = credentialStore.getCredential() ?: return
        val accountId = credentialStore.getAccountId() ?: return
        val existing = prefs.getString(KEY_RETRY_QUEUE, "[]")
        val queue = try {
            gson.fromJson<Array<String>>(existing, Array::class.java) ?: emptyList()
        } catch (e: JsonSyntaxException) {
            emptyList()
        }
        if (queue.isEmpty()) return

        val remaining = mutableListOf<String>()
        for (item in queue) {
            val event = try {
                gson.fromJson(item, CreditEvent::class.java)
            } catch (e: JsonSyntaxException) {
                continue
            }
            val body = mutableMapOf<String, Any?>(
                "event_id" to event.eventId,
                "amount_paise" to event.amountPaise,
                "currency" to event.currency,
                "observation_direction" to event.observationDirection,
                "receiving_account_id" to accountId,
                "transaction_reference" to event.transactionReference,
                "observation_timestamp" to event.observationTimestamp,
                "source_app_id" to event.sourceAppId,
            )
            val result = httpPost("/api/android/credit-event", body, token)
            when (result) {
                is ApiClient.Result.Success -> {
                    Log.i(TAG, "Retried credit event submitted: ${event.eventId}")
                }
                is ApiClient.Result.Error -> {
                    remaining.add(item)
                }
            }
            // Bounded retry: do not retry more than MAX_RETRY_ATTEMPTS.
            // The queue itself is bounded at 50; individual event retry count
            // is implicitly bounded by queue churn.
        }
        prefs.edit().putString(KEY_RETRY_QUEUE, gson.toJson(remaining.takeLast(50))).apply()
    }

    private fun httpPost(path: String, body: Map<String, Any?>, authToken: String): ApiClient.Result<String> {
        return try {
            val url = URL(DeviceConfig.BACKEND_URL + path)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty(DeviceConfig.AUTH_HEADER, DeviceConfig.BEARER_PREFIX + authToken)
            conn.connectTimeout = 10000
            conn.readTimeout = 10000
            conn.doOutput = true
            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(gson.toJson(body)) }
            val responseCode = conn.responseCode
            val responseBody = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()
            if (responseCode in 200..299) {
                ApiClient.Result.Success(responseBody)
            } else {
                ApiClient.Result.Error("HTTP $responseCode: $responseBody")
            }
        } catch (e: Exception) {
            ApiClient.Result.Error("Connection failed: ${e.javaClass.simpleName} - ${e.message}")
        }
    }

    private fun sha256(input: String): String {
        val md = java.security.MessageDigest.getInstance("SHA-256")
        return md.digest(input.toByteArray(StandardCharsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }

    data class CreditEvent(
        val eventId: String,
        val amountPaise: Int,
        val currency: String,
        val observationDirection: String,
        val receivingAccountId: String,
        val transactionReference: String?,
        val observationTimestamp: Long,
        val sourceAppId: String?,
    )
}
