package com.agentic.pay.connectivitytest

import android.content.Context
import androidx.work.*
import java.net.HttpURLConnection
import java.net.URL

class HeartbeatWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val credentialStore = CredentialStore.init(applicationContext)
        val token = credentialStore.getCredential() ?: return Result.failure()
        val expiresAt = credentialStore.getCredentialExpiresAt()
        if (System.currentTimeMillis() / 1000 > expiresAt) {
            credentialStore.clear()
            return Result.failure()
        }
        return try {
            val url = URL(DeviceConfig.BACKEND_URL + "/api/android/heartbeat")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000
            conn.doOutput = true
            conn.outputStream.write("{}".toByteArray())
            val responseCode = conn.responseCode
            conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()
            if (responseCode in 200..299) Result.success() else Result.failure()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val WORKER_TAG = "agentic_pay_heartbeat"
        const val INTERVAL_SECONDS = 30L

        fun schedule(context: Context) {
            val credentialStore = CredentialStore.init(context)
            if (!credentialStore.isEnrolled()) return
            val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(
                INTERVAL_SECONDS, java.util.concurrent.TimeUnit.SECONDS
            )
                .addTag(WORKER_TAG)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORKER_TAG,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelAllWorkByTag(WORKER_TAG)
        }
    }
}
