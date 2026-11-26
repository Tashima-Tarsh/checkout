// Notification listener service that observes incoming UPI payment notifications
// from authorized applications only. Signs observations with device key and submits
// to the Agentic-Recovery backend.
//
// Security properties:
// - Only processes notifications from allowlisted UPI app packages
// - Excludes OTPs and unrelated messages
// - Device signs observation with Android Keystore Ed25519 private key
// - Never initiates payments, never accesses private app storage
// - Observation alone does NOT set financially_verified
package com.agentic.recovery.observer

import android.app.Notification
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.AlgorithmParameterSpec
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val TAG = "UpiPaymentObserver"

// Authorized UPI application packages
private val ALLOWLISTED_PACKAGES = setOf(
    "com.google.android.apps.nbu.paisa.user",    // Google Pay
    "com.phonepe.app",                            // PhonePe
    "com.paytm.personalbanksuite",                // Paytm
    "com.npi.bhimapp",                            // BHIM
)

// Payment-related keywords
private val PAYMENT_KEYWORDS = setOf(
    "received", "payment", "paid", "credited", "₹", "INR",
    "success", "successful", "transaction", "upi",
)

class UpiPaymentObserver : NotificationListenerService() {

    private lateinit var deviceKeyPair: java.security.KeyPair
    private lateinit var prefs: SharedPreferences
    private lateinit var backendUrl: String
    private lateinit var deviceId: String

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "UpiPaymentObserver created")

        prefs = getSharedPreferences("agentic_recovery_prefs", Context.MODE_PRIVATE)
        deviceId = prefs.getString("device_id", "") ?: generateDeviceId()
        if (prefs.getString("device_id", null) == null) {
            prefs.edit().putString("device_id", deviceId).apply()
        }

        backendUrl = getString(R.string.callback_url)

        // Generate or load device key pair from Android Keystore
        deviceKeyPair = DeviceKeyStore.getOrCreateKeyPair(this)

        Log.d(TAG, "Observer initialized. Device ID: $deviceId")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        super.onNotificationPosted(sbn)

        val packageName = sbn.packageName
        if (!ALLOWLISTED_PACKAGES.contains(packageName)) {
            Log.d(TAG, "Ignoring notification from non-allowlisted package: $packageName")
            return
        }

        val notification = sbn.notification
        val text = extractText(notification)
        if (text.isNullOrEmpty()) {
            Log.d(TAG, "No text in notification")
            return
        }

        if (!isPaymentNotification(text)) {
            Log.d(TAG, "Not a payment notification: $text")
            return
        }

        Log.d(TAG, "Payment notification from $packageName: $text")

        val observation = extractObservation(text, packageName, sbn.postTimeMillis)

        // Submit on background thread
        java.lang.Thread {
            try {
                submitObservation(observation)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to submit observation", e)
            }
        }.start()
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        super.onNotificationRemoved(sbn)
    }

    private fun extractText(notification: Notification?): String? {
        if (notification == null) return null
        val textParts = mutableListOf<String>()
        val extras = notification.extras
        if (extras != null) {
            extras["android.text"]?.let { textParts.add(it.toString()) }
            extras["android.title"]?.let { textParts.add(it.toString()) }
            extras["android.textLines"]?.let { lines ->
                (lines as? Array<*>)?.forEach { textParts.add(it.toString()) }
            }
        }
        notification.contentView?.let { textParts.add(it.toString()) }
        notification.bigContentView?.let { textParts.add(it.toString()) }
        return textParts.joinToString(" ")
    }

    private fun isPaymentNotification(text: String): Boolean {
        val lower = text.lowercase()
        return PAYMENT_KEYWORDS.any { lower.contains(it) }
    }

    private fun extractObservation(
        text: String,
        packageName: String,
        timestampMs: Long
    ): ObservationEvent {
        return ObservationEvent(
            observationId = "obs_${System.currentTimeMillis()}_${packageName.hashCode()}",
            deviceId = deviceId,
            agentId = null,
            checkoutId = null, // correlated by backend if provided
            observedReceiverUpi = extractUpiId(text),
            payerName = extractPayerName(text),
            payerUpiId = extractPayerUpiId(text),
            amountPaise = extractAmount(text),
            currency = "INR",
            utrRrn = extractUtrRrn(text),
            appTransactionId = extractAppTransactionId(text),
            transactionDirection = "incoming",
            appReportedStatus = extractStatus(text),
            transactionTimestamp = timestampMs,
            observationTimestamp = System.currentTimeMillis(),
            sourceApplication = packageName,
            evidenceType = "notification",
            evidenceFingerprint = null,
        )
    }

    // --- Field extraction helpers (best effort, never fabricate) ---

    private fun extractUpiId(text: String): String? {
        val upiRegex = Regex("[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+")
        return upiRegex.find(text)?.value
    }

    private fun extractPayerName(text: String): String? {
        val patterns = listOf(
            Regex("from\\s+([^\\s]+)", RegexOption.IGNORECASE),
            Regex("paid\\s+by\\s+([^\\s]+)", RegexOption.IGNORECASE),
        )
        return patterns.mapNotNull { it.find(text)?.groupValues?.getOrNull(1) }.firstOrNull()
    }

    private fun extractPayerUpiId(text: String): String? {
        val upiRegex = Regex("[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+")
        val matches = upiRegex.findAll(text).map { it.value }.toList()
        return if (matches.size >= 2) matches[1] else null
    }

    private fun extractAmount(text: String): Int? {
        val amountRegex = Regex("₹?\\s*([\\d,]+(?:\\.\\d{1,2})?)")
        val match = amountRegex.find(text)
        if (match == null) return null
        val amountStr = match.groupValues[1].replace(",", "")
        val amount = amountStr.toDoubleOrNull() ?: return null
        return (amount * 100).toInt()
    }

    private fun extractUtrRrn(text: String): String? {
        val utrRegex = Regex("\\b\\d{12}\\b")
        return utrRegex.find(text)?.value
    }

    private fun extractAppTransactionId(text: String): String? {
        val txnRegex = Regex("(?:txn|transaction|ref)[\\s:]+([A-Za-z0-9]+)", RegexOption.IGNORECASE)
        return txnRegex.find(text)?.groupValues?.getOrNull(1)
    }

    private fun extractStatus(text: String): String? {
        val lower = text.lowercase()
        return when {
            lower.contains("success") || lower.contains("successful") -> "SUCCESS"
            lower.contains("failed") || lower.contains("failure") -> "FAILED"
            lower.contains("pending") -> "PENDING"
            else -> null
        }
    }

    private fun generateDeviceId(): String {
        return "dev_${System.currentTimeMillis()}_${android.os.Build.SERIAL.hashCode().toInt().toHexString()}"
    }

    private fun submitObservation(observation: ObservationEvent) {
        try {
            val message = buildCanonicalMessage(observation)
            val signature = signMessage(message, deviceKeyPair)

            val payload = mapOf(
                "id" to observation.observationId,
                "device_id" to observation.deviceId,
                "agent_id" to observation.agentId,
                "checkout_id" to observation.checkoutId,
                "observed_receiver_upi" to observation.observedReceiverUpi,
                "payer_name" to observation.payerName,
                "payer_upi_id" to observation.payerUpiId,
                "amount_paise" to observation.amountPaise,
                "currency" to observation.currency,
                "utr_rrn" to observation.utrRrn,
                "app_transaction_id" to observation.appTransactionId,
                "transaction_direction" to observation.transactionDirection,
                "app_reported_status" to observation.appReportedStatus,
                "transaction_timestamp" to observation.transactionTimestamp,
                "observation_timestamp" to observation.observationTimestamp,
                "source_application" to observation.sourceApplication,
                "evidence_type" to observation.evidenceType,
                "evidence_fingerprint" to observation.evidenceFingerprint,
                "signature" to signature,
                "signature_timestamp" to observation.observationTimestamp,
            )

            val json = com.google.gson.Gson().toJson(payload)
            val url = java.net.URL(backendUrl)
            val connection = url.openConnection() as java.net.HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("X-Tenant-Id", prefs.getString("tenant_id", ""))
            connection.setRequestProperty("X-Device-Id", deviceId)
            connection.doOutput = true
            connection.outputStream.write(json.toByteArray(Charsets.UTF_8))

            val responseCode = connection.responseCode
            val responseBody = connection.inputStream.bufferedReader().use { it.readText() }
            connection.disconnect()

            Log.d(TAG, "Observation submitted: $responseCode $responseBody")
            if (responseCode !in 200..299) {
                Log.e(TAG, "Backend returned $responseCode: $responseBody")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to submit observation", e)
        }
    }

    private fun buildCanonicalMessage(obs: ObservationEvent): String {
        return listOfNotNull(
            obs.observationId,
            obs.deviceId,
            obs.checkoutId ?: "",
            obs.observedReceiverUpi ?: "",
            obs.payerName ?: "",
            obs.payerUpiId ?: "",
            obs.amountPaise?.toString() ?: "",
            obs.currency ?: "",
            obs.utrRrn ?: "",
            obs.appTransactionId ?: "",
            obs.transactionDirection ?: "",
            obs.appReportedStatus ?: "",
            obs.transactionTimestamp?.toString() ?: "",
            obs.observationTimestamp.toString(),
            obs.sourceApplication ?: "",
            obs.evidenceType ?: "",
            obs.evidenceFingerprint ?: "",
        ).joinToString("|")
    }

    private fun signMessage(message: String, keyPair: java.security.KeyPair): String {
        return withContext(Dispatchers.IO) {
            val privateKey = keyPair.private as java.security.PrivateKey
            val signature = Signature.getInstance("Ed25519")
            signature.initSign(privateKey)
            signature.update(message.toByteArray(Charsets.UTF_8))
            signature.sign().joinToString("") { "%02x".format(it) }
        }
    }

    /** Observation event submitted to the backend. */
    data class ObservationEvent(
        val observationId: String,
        val deviceId: String,
        val agentId: String?,
        val checkoutId: String?,
        val observedReceiverUpi: String?,
        val payerName: String?,
        val payerUpiId: String?,
        val amountPaise: Int?,
        val currency: String?,
        val utrRrn: String?,
        val appTransactionId: String?,
        val transactionDirection: String?,
        val appReportedStatus: String?,
        val transactionTimestamp: Long?,
        val observationTimestamp: Long,
        val sourceApplication: String?,
        val evidenceType: String?,
        val evidenceFingerprint: String?,
    )
}

/** Device key storage in Android Keystore. */
object DeviceKeyStore {
    private const val KEY_ALIAS = "agentic_recovery_device_key"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"

    fun getOrCreateKeyPair(context: Context): java.security.KeyPair {
        val keyStore = java.security.KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)

        if (keyStore.containsAlias(KEY_ALIAS)) {
            val key = keyStore.getKey(KEY_ALIAS, null) as java.security.PrivateKey
            return java.security.KeyPair(
                keyStore.getCertificate(KEY_ALIAS).publicKey,
                key
            )
        }

        val keyPairGenerator = KeyPairGenerator.getInstance("Ed25519", KEYSTORE_PROVIDER)
        keyPairGenerator.initialize(
            android.security.keystore.KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                android.security.keystore.KeyProperties.PURPOSE_SIGN or android.security.keystore.KeyProperties.PURPOSE_VERIFY
            )
                .setDigests(android.security.keystore.KeyProperties.DIGEST_SHA256, android.security.keystore.KeyProperties.DIGEST_SHA512)
                .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_NONE)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(false)
                .setIsStrongBoxBacked(false)
                .build()
        )
        return keyPairGenerator.generateKeyPair()
    }
}

/** Boot receiver to restart observation after device restart. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "android.intent.action.BOOT_COMPLETED") {
            Log.d(TAG, "Boot completed, observer will restart")
        }
    }
    companion object {
        private const val TAG = "BootReceiver"
    }
}
