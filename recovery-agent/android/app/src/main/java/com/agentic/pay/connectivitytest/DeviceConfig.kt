package com.agentic.pay.connectivitytest

object DeviceConfig {
    // Backend base URL (Railway production). No credentials are embedded here.
    const val BACKEND_URL = "https://agenticpay.thenitishkr.in"
    const val DEVICE_ID = "AgenticMobile0001"
    const val MERCHANT = "Disha 8.2"
    const val SHOP_ID = "SHOP-0001"

    // Shared preferences keys (credential values are encrypted)
    const val PREFS_NAME = "agentic_pay_receiver"
    const val KEY_DEVICE_CREDENTIAL = "device_credential"
    const val KEY_DEVICE_CREDENTIAL_EXPIRES = "device_credential_expires"
    const val KEY_DEVICE_PUBLIC_KEY = "device_public_key_pem"
    const val KEY_ENROLLED = "device_enrolled"
    const val KEY_APP_VERSION = "app_version"

    // Heartbeat interval in seconds
    const val HEARTBEAT_INTERVAL_SECONDS = 30
    // Offline timeout on server (seconds)
    const val OFFLINE_TIMEOUT_SECONDS = 90

    const val AUTH_HEADER = "Authorization"
    const val BEARER_PREFIX = "Bearer "

    // Observation states
    const val OBS_STATE_RECEIVED = "OBSERVATION_RECEIVED"
    const val OBS_STATE_MATCHED = "OBSERVATION_MATCHED"
    const val OBS_STATE_AMBIGUOUS = "AMBIGUOUS_OBSERVATION"
    const val OBS_STATE_REJECTED = "OBSERVATION_REJECTED"
}
