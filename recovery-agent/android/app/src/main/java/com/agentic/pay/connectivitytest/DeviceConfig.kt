package com.agentic.pay.connectivitytest

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID

object DeviceConfig {
    // Backend base URL (Railway production). Configurable per merchant via EncryptedSharedPreferences.
    const val DEFAULT_BACKEND_URL = "https://agenticpay.thenitishkr.in"
    const val DEFAULT_MERCHANT = "Disha"
    const val DEFAULT_SHOP_ID = "SHOP-0001"
    const val APP_LABEL = "G Shop"
    const val APP_VERSION_NAME = "2.4"
    const val APP_VERSION_CODE = 4

    // Shared preferences keys (credential values are encrypted)
    const val PREFS_NAME = "agentic_pay_receiver"
    const val KEY_DEVICE_CREDENTIAL = "device_credential"
    const val KEY_DEVICE_CREDENTIAL_EXPIRES = "device_credential_expires"
    const val KEY_DEVICE_PUBLIC_KEY = "device_public_key_pem"
    const val KEY_ENROLLED = "device_enrolled"
    const val KEY_APP_VERSION = "app_version"
    const val KEY_ACCOUNT_ID = "device_account_id"
    const val KEY_DEVICE_ID = "device_unique_id"
    const val KEY_MERCHANT_ID = "device_merchant_id"
    const val KEY_MERCHANT_NAME = "device_merchant_name"
    const val KEY_SHOP_ID = "device_shop_id"
    const val KEY_BACKEND_URL = "device_backend_url"
    const val KEY_UPI_ID = "device_upi_id"
    const val KEY_MOBILE_NUMBER = "device_mobile_number"
    const val KEY_UPI_REGISTERED = "device_upi_registered"

    // Heartbeat interval in seconds
    const val HEARTBEAT_INTERVAL_SECONDS = 30
    // Offline timeout on server (seconds)
    const val OFFLINE_TIMEOUT_SECONDS = 90

    // Checkout window in seconds (matches backend CHECKOUT_TTL_SECONDS = 120)
    const val CHECKOUT_WINDOW_SECONDS = 120

    // Daily collection limit in paise (₹70,000)
    const val DAILY_COLLECTION_LIMIT_PAISE = 7000000

    const val AUTH_HEADER = "Authorization"
    const val BEARER_PREFIX = "Bearer "

    // Observation states
    const val OBS_STATE_RECEIVED = "OBSERVATION_RECEIVED"
    const val OBS_STATE_MATCHED = "OBSERVATION_MATCHED"
    const val OBS_STATE_AMBIGUOUS = "AMBIGUOUS_OBSERVATION"
    const val OBS_STATE_REJECTED = "OBSERVATION_REJECTED"
    const val OBS_STATE_EXPIRED = "EXPIRED"
    const val OBS_STATE_SETTLED = "SETTLED"
    const val OBS_STATE_AWAITING = "AWAITING_PAYMENT"

    // Encrypted preferences for device-specific config
    private lateinit var prefs: android.content.SharedPreferences

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        // Ensure a unique device ID exists for this install
        if (prefs.getString(KEY_DEVICE_ID, null) == null) {
            prefs.edit().putString(KEY_DEVICE_ID, UUID.randomUUID().toString()).apply()
        }
    }

    val deviceId: String
        get() = prefs.getString(KEY_DEVICE_ID, "AgenticMobile0001") ?: "AgenticMobile0001"

    val backendUrl: String
        get() = prefs.getString(KEY_BACKEND_URL, DEFAULT_BACKEND_URL) ?: DEFAULT_BACKEND_URL

    val merchant: String
        get() = prefs.getString(KEY_MERCHANT_NAME, DEFAULT_MERCHANT) ?: DEFAULT_MERCHANT

    val shopId: String
        get() = prefs.getString(KEY_SHOP_ID, DEFAULT_SHOP_ID) ?: DEFAULT_SHOP_ID

    val merchantId: String?
        get() = prefs.getString(KEY_MERCHANT_ID, null)

    val upiId: String?
        get() = prefs.getString(KEY_UPI_ID, null)

    val mobileNumber: String?
        get() = prefs.getString(KEY_MOBILE_NUMBER, null)

    val upiRegistered: Boolean
        get() = prefs.getBoolean(KEY_UPI_REGISTERED, false)

    fun saveMerchantConfig(merchantId: String, merchantName: String, shopId: String, backendUrl: String) {
        prefs.edit()
            .putString(KEY_MERCHANT_ID, merchantId)
            .putString(KEY_MERCHANT_NAME, merchantName)
            .putString(KEY_SHOP_ID, shopId)
            .putString(KEY_BACKEND_URL, backendUrl)
            .apply()
    }

    fun saveUpiRegistration(upiId: String, mobileNumber: String) {
        prefs.edit()
            .putString(KEY_UPI_ID, upiId)
            .putString(KEY_MOBILE_NUMBER, mobileNumber)
            .putBoolean(KEY_UPI_REGISTERED, true)
            .apply()
    }
}
