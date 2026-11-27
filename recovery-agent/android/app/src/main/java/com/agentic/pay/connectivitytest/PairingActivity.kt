package com.agentic.pay.connectivitytest

import android.app.Activity
import android.os.Bundle
import android.widget.*
import com.google.gson.JsonParser
import java.security.KeyPair

class PairingActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var keyPair: KeyPair
    private lateinit var codeInput: EditText
    private lateinit var statusText: TextView
    private lateinit var submitButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            credentialStore = CredentialStore.init(this)
            keyPair = DeviceKeyStore.getOrCreateKeyPair(this)
            buildUI()
        } catch (e: Exception) {
            showErrorScreen("Initialization failed: ${e.message}")
        }
    }

    private fun buildUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Device Enrollment"
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hint = TextView(this).apply {
            text = "Enter the pairing code from the owner dashboard (Disha workspace). Code expires in 10 minutes."
            textSize = 14f
        }
        layout.addView(hint)

        codeInput = EditText(this).apply {
            this.hint = "Pairing code (8 chars)"
            setAllCaps(true)
            textSize = 18f
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
        }
        layout.addView(codeInput)

        statusText = TextView(this).apply {
            text = ""
            textSize = 14f
        }
        layout.addView(statusText)

        submitButton = Button(this).apply { text = "Pair Device" }
        layout.addView(submitButton)

        val backButton = Button(this).apply { text = "Back to Dashboard" }
        layout.addView(backButton)

        setContentView(layout)

        submitButton.setOnClickListener { attemptPair() }
        backButton.setOnClickListener { finish() }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Enrollment Error"
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val errorText = TextView(this).apply {
            text = message
            textSize = 16f
        }
        layout.addView(errorText)

        val retryButton = Button(this).apply { text = "Retry" }
        layout.addView(retryButton)

        setContentView(layout)

        retryButton.setOnClickListener {
            recreate()
        }
    }

    private fun attemptPair() {
        val code = codeInput.text.toString().trim()
        if (code.isNotEmpty() && code.length != 8) {
            statusText.text = "Pairing code must be 8 characters."
            return
        }
        if (code.isEmpty()) {
            statusText.text = "Enter a pairing code."
            return
        }
        submitButton.isEnabled = false
        statusText.text = "Pairing…"

        val publicKeyPem = DeviceKeyStore.getPublicKeyPem(keyPair)
        val appVersion = DeviceConfig.APP_VERSION_NAME

        ApiClient.pairDevice(code, DeviceConfig.DEVICE_ID, publicKeyPem, appVersion) { result ->
            runOnUiThread {
                submitButton.isEnabled = true
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val credential = json.get("credential").asString
                            val expiresIn = json.get("expires_in_seconds").asLong
                            val expiresAt = (System.currentTimeMillis() / 1000) + expiresIn
                            credentialStore.saveCredential(credential, expiresAt)
                            credentialStore.saveEnrolled(true)
                            credentialStore.saveAppVersion(appVersion)
                            statusText.text = "Device enrolled successfully."
                            setResult(Activity.RESULT_OK)
                            finish()
                        } catch (e: Exception) {
                            statusText.text = "Pairing response parse error: ${e.message}"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        statusText.text = "Pairing failed: ${result.message}"
                    }
                }
            }
        }
    }
}
