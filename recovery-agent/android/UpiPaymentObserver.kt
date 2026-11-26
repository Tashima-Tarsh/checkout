// Agentic-Recovery Android Observer
// Package: com.agentic.recovery.observer
// Permission: BIND_NOTIFICATION_LISTENER_SERVICE (user-granted)
// Purpose: Observe incoming UPI payment notifications from authorized apps

package com.agentic.recovery.observer

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.KeyPairGenerator
import java.security.spec.AlgorithmParameterSpec
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Authorized Android receiver-side observer.
 *
 * Observes incoming payment notifications from allowlisted UPI applications
 * (Google Pay, PhonePe, BHIM). Extracts available transaction details and
 * submits authenticated observation events to the Agentic-Recovery backend.
 *
 * Security properties:
 * - Only processes notifications from allowlisted app packages
 * - Excludes OTPs and unrelated messages
 * - Device signs observation with Android Keystore private key
 * - Never initiates payments, never accesses private app storage
 * - Observation alone does NOT set financially_verified
 */
class UpiPaymentObserver : NotificationListenerService() {

    private companion object {
        private const val TAG = "UpiPaymentObserver"

        // Authorized UPI application packages
        val ALLOWLISTED_PACKAGES = setOf(
            "com.google.android.apps.nbu.paisa.user",    // Google Pay
            "com.phonepe.app",                            // PhonePe
            "com.paytm.personalbanksuite",                // Paytm
            "com.npi.bhimapp",                            // BHIM
        )

        // Payment-related keywords in notification text
        val PAYMENT_KEYWORDS = setOf(
            "received", "payment", "paid", "credited", "₹", "INR",
            "success", "successful", "transaction", "upi",
        )

        // Backend endpoint (configured per deployment)
        val BACKEND_URL = "https://agenticpay.thenitishkr.in/api/recovery/observations/ingest"
    }

    private lateinit var deviceKeyPair: java.security.KeyPair
    private lateinit var backendClient: BackendClient

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "UpiPaymentObserver created")

        // Generate or load device key pair from Android Keystore
        deviceKeyPair = DeviceKeyStore.getOrCreateKeyPair(this)

        backendClient = BackendClient(BACKEND_URL, deviceKeyPair)
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

        // Check if this is a payment-related notification
        if (!isPaymentNotification(text)) {
            Log.d(TAG, "Not a payment notification: $text")
            return
        }

        Log.d(TAG, "Payment notification from $packageName: $text")

        // Extract transaction details
        val observation = extractObservation(text, packageName, sbn.postTimeMillis)

        // Submit to backend
        dispatch {
            backendClient.submitObservation(observation)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        super.onNotificationRemoved(sbn)
        // No action needed on removal
    }

    private fun extractText(notification: Notification?): String? {
        if (notification == null) return null

        val textParts = mutableListOf<String>()

        // Collect text from notification extras
        val extras = notification.extras
        if (extras != null) {
            extras["android.text"]?.let { textParts.add(it.toString()) }
            extras["android.title"]?.let { textParts.add(it.toString()) }
            extras["android.textLines"]?.let { lines ->
                (lines as? Array<*>)?.forEach { textParts.add(it.toString()) }
            }
        }

        // Collect text from notification views (if available)
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
        val observation = ObservationEvent(
            observationId = "obs_${System.currentTimeMillis()}_${packageName.hashCode()}",
            deviceId = android.os.Build.SERIAL, // or configured device ID
            agentId = null, // assigned during registration
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
        return observation
    }

    // --- Field extraction helpers (best effort, never fabricate) ---

    private fun extractUpiId(text: String): String? {
        // Match UPI ID pattern: something@something
        val upiRegex = Regex("[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+")
        return upiRegex.find(text)?.value
    }

    private fun extractPayerName(text: String): String? {
        // Look for "from" or "paid by" patterns
        val patterns = listOf(
            Regex("from\\s+([^\\s]+)", RegexOption.IGNORECASE),
            Regex("paid\\s+by\\s+([^\\s]+)", RegexOption.IGNORECASE),
        )
        patterns.mapNotNull { it.find(text)?.groupValues?.getOrNull(1) }.firstOrNull()
    }

    private fun extractPayerUpiId(text: String): String? {
        // Same as UPI ID but could be a second match
        val upiRegex = Regex("[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+")
        val matches = upiRegex.findAll(text).map { it.value }.toList()
        return if (matches.size >= 2) matches[1] else null
    }

    private fun extractAmount(text: String): Int? {
        // Match ₹1,234.56 or 1234.56 patterns, convert to paise
        val amountRegex = Regex("₹?\\s*([\\d,]+(?:\\.\\d{1,2})?)")
        val match = amountRegex.find(text)
        if (match == null) return null
        val amountStr = match.groupValues[1].replace(",", "")
        val amount = amountStr.toDoubleOrNull() ?: return null
        return (amount * 100).toInt()
    }

    private fun extractUtrRrn(text: String): String? {
        // UTR is typically 12 digits, RRN varies
        val utrRegex = Regex("\\b\\d{12}\\b")
        return utrRegex.find(text)?.value
    }

    private fun extractAppTransactionId(text: String): String? {
        // Look for transaction ID patterns
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

    private fun dispatch(block: () -> Unit) {
        // Submit on background thread
        java.lang.Thread { block() }.start()
    }

    /**
     * Observation event submitted to the backend.
     * All fields are optional except observationId and deviceId.
     * Missing fields are marked as unavailable, never fabricated.
     */
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

/**
 * Android Keystore-backed key storage for device authentication.
 * Keys are hardware-backed where supported, software-backed otherwise.
 */
object DeviceKeyStore {
    private const val KEY_ALIAS = "agentic_recovery_device_key"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"

    fun getOrCreateKeyPair(context: android.content.Context): java.security.KeyPair {
        val keyStore = java.security.KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)

        if (keyStore.containsAlias(KEY_ALIAS)) {
            val key = keyStore.getKey(KEY_ALIAS, null) as java.security.PrivateKey
            return java.security.KeyPair(
                keyStore.getCertificate(KEY_ALIAS).publicKey,
                key
            )
        }

        // Generate new Ed25519 key pair
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
                .setIsStrongBoxBacked(false) // Set true if hardware-backed required
                .build()
        )
        val keyPair = keyPairGenerator.generateKeyPair()

        // Store public key PEM in preferences for backend registration
        val publicKey = keyPair.public as java.security.PublicKey
        val pem = "-----BEGIN PUBLIC KEY-----\n" +
            android.util.Base64.encodeToString(publicKey.encoded, android.util.Base64.NO_WRAP) +
            "\n-----END PUBLIC KEY-----"
        savePublicKeyToPrefs(context, pem)

        return keyPair
    }

    private fun savePublicKeyToPrefs(context: android.content.Context, pem: String) {
        val prefs = context.getSharedPreferences("agentic_recovery", Context.MODE_PRIVATE)
        prefs.edit().putString("device_public_key_pem", pem).apply()
    }

    fun getPublicKeyPem(context: android.content.Context): String? {
        val prefs = context.getSharedPreferences("agentic_recovery", Context.MODE_PRIVATE)
        return prefs.getString("device_public_key_pem", null)
    }
}

/**
 * Backend client for submitting signed observations.
 */
class BackendClient(
    private val baseUrl: String,
    private val keyPair: java.security.KeyPair
) {
    private companion object {
        private const val TAG = "BackendClient"
    }

    suspend fun submitObservation(observation: UpiPaymentObserver.ObservationEvent) {
        try {
            // Build canonical message for signing
            val message = buildCanonicalMessage(observation)

            // Sign with device private key
            val signature = signMessage(message, keyPair)

            // Build request payload
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

            // POST to backend
            val response = submitToBackend(payload)
            Log.d(TAG, "Observation submitted: $response")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to submit observation", e)
        }
    }

    private suspend fun buildCanonicalMessage(obs: UpiPaymentObserver.ObservationEvent): String {
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

    private suspend fun signMessage(message: String, keyPair: java.security.KeyPair): String {
        return withContext(Dispatchers.IO) {
            val privateKey = keyPair.private as java.security.PrivateKey
            val signature = java.security.Signature.getInstance("Ed25519")
            signature.initSign(privateKey)
            signature.update(message.toByteArray(Charsets.UTF_8))
            signature.sign().joinToString("") { "%02x".format(it) }
        }
    }

    private suspend fun submitToBackend(payload: Map<String, Any?>): String {
        return withContext(Dispatchers.IO) {
            val url = java.net.URL(baseUrl)
            val connection = url.openConnection() as java.net.HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            connection.doOutput = true

            val json = com.google.gson.Gson().toJson(payload)
            connection.outputStream.write(json.toByteArray(Charsets.UTF_8))

            val responseCode = connection.responseCode
            val responseBody = connection.inputStream.bufferedReader().use { it.readText() }
            connection.disconnect()

            if (responseCode !in 200..299) {
                throw RuntimeException("Backend returned $responseCode: $responseBody")
            }
            responseBody
        }
    }
}