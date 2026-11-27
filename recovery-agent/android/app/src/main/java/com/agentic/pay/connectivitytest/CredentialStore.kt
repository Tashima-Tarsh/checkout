package com.agentic.pay.connectivitytest

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class CredentialStore private constructor(private val prefs: android.content.SharedPreferences) {

    companion object {
        @Volatile private var instance: CredentialStore? = null

        fun init(context: Context): CredentialStore {
            return instance ?: synchronized(this) {
                instance ?: CredentialStore(createPrefs(context)).also { instance = it }
            }
        }

        private fun createPrefs(context: Context): android.content.SharedPreferences {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            return EncryptedSharedPreferences.create(
                context,
                DeviceConfig.PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }

    fun saveCredential(token: String, expiresAt: Long) {
        prefs.edit()
            .putString(DeviceConfig.KEY_DEVICE_CREDENTIAL, token)
            .putLong(DeviceConfig.KEY_DEVICE_CREDENTIAL_EXPIRES, expiresAt)
            .apply()
    }

    fun getCredential(): String? = prefs.getString(DeviceConfig.KEY_DEVICE_CREDENTIAL, null)

    fun getCredentialExpiresAt(): Long = prefs.getLong(DeviceConfig.KEY_DEVICE_CREDENTIAL_EXPIRES, 0)

    fun saveEnrolled(enrolled: Boolean) {
        prefs.edit().putBoolean(DeviceConfig.KEY_ENROLLED, enrolled).apply()
    }

    fun isEnrolled(): Boolean = prefs.getBoolean(DeviceConfig.KEY_ENROLLED, false)

    fun saveAppVersion(version: String) {
        prefs.edit().putString(DeviceConfig.KEY_APP_VERSION, version).apply()
    }

    fun getAppVersion(): String? = prefs.getString(DeviceConfig.KEY_APP_VERSION, null)

    fun saveAccountId(accountId: String) {
        prefs.edit().putString(DeviceConfig.KEY_ACCOUNT_ID, accountId).apply()
    }

    fun getAccountId(): String? = prefs.getString(DeviceConfig.KEY_ACCOUNT_ID, null)

    fun clear() {
        prefs.edit().clear().apply()
    }
}
