package com.agentic.pay.connectivitytest

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
    private lateinit var setupCompleteText: TextView

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
            checkSetupState()
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
            text = "One-time setup: login with email/password, verify eSIM, register your UPIs."
            textSize = 14f
        }
        layout.addView(hint)

        setupCompleteText = TextView(this).apply {
            text = ""
            textSize = 14f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(setupCompleteText)

        emailInput = EditText(this).apply {
            hint = "Email address (Clerk account)"
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

        loginButton = Button(this).apply { text = "Login & Enroll Device" }
        layout.addView(loginButton)

        registerButton = Button(this).apply {
            text = "Register UPI IDs (up to 15)"
            isEnabled = false
        }
        layout.addView(registerButton)

        val backButton = Button(this).apply { text = "Skip & Go to Dashboard" }
        layout.addView(backButton)

        setContentView(layout)

        loginButton.setOnClickListener { attemptLogin() }
        registerButton.setOnClickListener {
            val intent = Intent(this, RegisterUpiActivity::class.java)
            startActivity(intent)
        }
        backButton.setOnClickListener {
            val intent = Intent(this, MainActivity::class.java)
            startActivity(intent)
            finish()
        }
    }

    private fun checkSetupState() {
        val enrolled = credentialStore.isEnrolled()
        val upiRegistered = DeviceConfig.upiRegistered

        runOnUiThread {
            if (enrolled && upiRegistered) {
                setupCompleteText.text = "✓ Setup complete. Device enrolled and UPI registered."
                setupCompleteText.setTextColor(0xFF065F46.toInt())
                emailInput.isEnabled = false
                passwordInput.isEnabled = false
                loginButton.isEnabled = false
                registerButton.isEnabled = false
                backButton.text = "Go to Dashboard"
            } else if (enrolled) {
                setupCompleteText.text = "Device enrolled. Register your UPI IDs to complete setup."
                setupCompleteText.setTextColor(0xFF0F172A.toInt())
                emailInput.isEnabled = false
                passwordInput.isEnabled = false
                loginButton.isEnabled = false
                registerButton.isEnabled = true
            } else {
                setupCompleteText.text = "Not enrolled. Login with email/password to begin."
                setupCompleteText.setTextColor(0xFF64748B.toInt())
                emailInput.isEnabled = true
                passwordInput.isEnabled = true
                loginButton.isEnabled = true
                registerButton.isEnabled = false
            }
        }
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
        val telephonyManager = getSystemService(android.content.Context.TELEPHONY_SERVICE) as android.telephony.TelephonyManager
        val simState = telephonyManager.simState
        val isEsimReady = simState == android.telephony.TelephonyManager.SIM_STATE_READY
        val simOperator = telephonyManager.simOperatorName

        runOnUiThread {
            if (isEsimReady) {
                esimStatusText.text = "eSIM: Active ($simOperator)"
                esimStatusText.setTextColor(0xFF065F46.toInt())
            } else {
                esimStatusText.text = "eSIM: Not configured — configure eSIM in device Settings first"
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

        // Clerk OAuth integration point — replace with Clerk SDK signIn flow
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            // Simulate successful Clerk OAuth login
            val deviceToken = "clerk_device_" + email.hashCode().toString().removePrefix("-")
            credentialStore.saveCredential(deviceToken)
            credentialStore.saveAccountId("acct_${email.hashCode().toString().removePrefix("-")}")
            DeviceConfig.saveUpiRegistration(email, email) // placeholder mobile
            runOnUiThread {
                statusText.text = "Login successful. Device enrolled."
                loginButton.isEnabled = false
                registerButton.isEnabled = true
                emailInput.isEnabled = false
                passwordInput.isEnabled = false
                setupCompleteText.text = "Device enrolled. Register your UPI IDs to complete setup."
                setupCompleteText.setTextColor(0xFF0F172A.toInt())
            }
        }, 1000)
    }

    private fun checkEsimStatusPublic() {
        checkEsimStatus()
    }

    override fun onResume() {
        super.onResume()
        checkSetupState()
        checkEsimStatus()
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
