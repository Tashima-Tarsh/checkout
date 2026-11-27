package com.agentic.pay.connectivitytest

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature

object DeviceKeyStore {
    private const val KEY_ALIAS = "agentic_pay_device_key"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"

    fun getOrCreateKeyPair(context: Context): KeyPair {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)

        if (keyStore.containsAlias(KEY_ALIAS)) {
            val privateKey = keyStore.getKey(KEY_ALIAS, null) as java.security.PrivateKey
            val cert = keyStore.getCertificate(KEY_ALIAS)
            return KeyPair(cert!!.publicKey, privateKey)
        }

        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE_PROVIDER)
        generator.initialize(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                .setIsStrongBoxBacked(false)
                .build()
        )
        return generator.generateKeyPair()
    }

    fun signMessage(message: String, keyPair: KeyPair): String {
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(keyPair.private as java.security.PrivateKey)
        signature.update(message.toByteArray(Charsets.UTF_8))
        return signature.sign().joinToString("") { "%02x".format(it) }
    }

    fun getPublicKeyPem(keyPair: KeyPair): String {
        val pub = keyPair.public.encoded
        return "-----BEGIN PUBLIC KEY-----\n" +
            android.util.Base64.encodeToString(pub, android.util.Base64.NO_WRAP) +
            "\n-----END PUBLIC KEY-----"
    }
}
