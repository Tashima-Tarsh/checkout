package com.agentic.pay.connectivitytest

object DeviceConfig {
    // Backend base URL (Railway production). No credentials are embedded here.
    const val BACKEND_URL = "https://agenticpay.thenitishkr.in"
    const val DEVICE_ID = "AgenticMobile0001"
    const val MERCHANT = "Disha"
    const val SHOP_ID = "SHOP-0001"
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

    // Heartbeat interval in seconds
    const val HEARTBEAT_INTERVAL_SECONDS = 30
    // Offline timeout on server (seconds)
    const val OFFLINE_TIMEOUT_SECONDS = 90

    // Checkout window in seconds (matches backend CHECKOUT_TTL_SECONDS = 120)
    const val CHECKOUT_WINDOW_SECONDS = 120

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
}
