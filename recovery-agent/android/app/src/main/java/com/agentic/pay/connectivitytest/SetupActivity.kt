package com.agentic.pay.connectivitytest

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import android.widget.*
import com.google.gson.JsonParser

class SetupActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var esimStatusText: TextView
    private lateinit var statusText: TextView
    private lateinit var loginButton: Button
    private lateinit var registerButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        try {
            if (RootUtil.isRooted(this)) {
                showErrorScreen("Security: Rooted devices are not allowed.")
                return
            }
            credentialStore = CredentialStore.init(this)
            DeviceConfig.init(this)
            buildUI()
            checkEsimStatus()
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
            text = "DISHA Device Setup"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hint = TextView(this).apply {
            text = "One-time device setup. Login with email/password, verify eSIM, then register UPIs."
            textSize = 14f
        }
        layout.addView(hint)

        emailInput = EditText(this).apply {
            hint = "Email address"
            textSize = 18f
            maxLines = 1
            inputType = android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        layout.addView(emailInput)

        passwordInput = EditText(this).apply {
            hint = "Password"
            textSize = 18f
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        layout.addView(passwordInput)

        esimStatusText = TextView(this).apply {
            text = "eSIM status: checking…"
            textSize = 14f
        }
        layout.addView(esimStatusText)

        statusText = TextView(this).apply {
            text = ""
            textSize = 14f
        }
        layout.addView(statusText)

        loginButton = Button(this).apply { text = "Login & Register Device" }
        layout.addView(loginButton)

        registerButton = Button(this).apply {
            text = "Register UPIs (after login)"
            isEnabled = false
        }
        layout.addView(registerButton)

        val backButton = Button(this).apply { text = "Back" }
        layout.addView(backButton)

        setContentView(layout)

        loginButton.setOnClickListener { attemptLogin() }
        registerButton.setOnClickListener {
            val intent = Intent(this, RegisterUpiActivity::class.java)
            startActivity(intent)
        }
        backButton.setOnClickListener { finish() }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Setup Error"
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

    private fun checkEsimStatus() {
        // eSIM status check via TelephonyManager
        val telephonyManager = getSystemService(android.content.Context.TELEPHONY_SERVICE) as android.telephony.TelephonyManager
        val simState = telephonyManager.simState
        val isEsimReady = simState == android.telephony.TelephonyManager.SIM_STATE_READY
        val simOperator = telephonyManager.simOperatorName

        runOnUiThread {
            if (isEsimReady) {
                esimStatusText.text = "eSIM: Active ($simOperator)"
                esimStatusText.setTextColor(0xFF065F46.toInt())
            } else {
                esimStatusText.text = "eSIM: Not configured — insert/activate eSIM first"
                esimStatusText.setTextColor(0xFFDC2626.toInt())
            }
        }
    }

    private fun attemptLogin() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString().trim()

        if (email.isEmpty() || password.isEmpty()) {
            statusText.text = "Email and password are required."
            return
        }

        loginButton.isEnabled = false
        statusText.text = "Logging in…"

        // Simulate Clerk OAuth login — in production, this calls Clerk SDK
        // For now, store credentials locally and mark device as enrolled
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            credentialStore.saveCredential("dev-token-${email.hashCode()}")
            credentialStore.saveAccountId("acct_${email.hashCode().toString()}")
            DeviceConfig.saveUpiRegistration(email, email) // placeholder
            runOnUiThread {
                statusText.text = "Login successful. Device enrolled."
                loginButton.isEnabled = false
                registerButton.isEnabled = true
                emailInput.isEnabled = false
                passwordInput.isEnabled = false
            }
        }, 1000)
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
