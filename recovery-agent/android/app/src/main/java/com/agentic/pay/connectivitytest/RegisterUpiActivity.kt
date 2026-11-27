package com.agentic.pay.connectivitytest

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.*
import com.google.gson.JsonParser

class RegisterUpiActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var upiInput: EditText
    private lateinit var mobileInput: EditText
    private lateinit var holderInput: EditText
    private lateinit var bankInput: EditText
    private lateinit var accountInput: EditText
    private lateinit var statusText: TextView
    private lateinit var submitButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        try {
            credentialStore = CredentialStore.init(this)
            DeviceConfig.init(this)
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
            text = "Register Your UPI"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hintText = TextView(this).apply {
            text = "Enter your own UPI ID and mobile number. This account will receive customer payments."
            textSize = 14f
        }
        layout.addView(hintText)

        upiInput = EditText(this).apply {
            hint = "UPI ID (e.g. agent@upi)"
            textSize = 18f
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        layout.addView(upiInput)

        mobileInput = EditText(this).apply {
            hint = "Mobile number (10 digits)"
            textSize = 18f
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_PHONE
        }
        layout.addView(mobileInput)

        holderInput = EditText(this).apply {
            hint = "Account holder name"
            textSize = 18f
            maxLines = 1
        }
        layout.addView(holderInput)

        bankInput = EditText(this).apply {
            hint = "Bank name"
            textSize = 18f
            maxLines = 1
        }
        layout.addView(bankInput)

        accountInput = EditText(this).apply {
            hint = "Bank account number"
            textSize = 18f
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_PHONE
        }
        layout.addView(accountInput)

        statusText = TextView(this).apply {
            text = ""
            textSize = 14f
        }
        layout.addView(statusText)

        submitButton = Button(this).apply { text = "Register UPI Account" }
        layout.addView(submitButton)

        val backButton = Button(this).apply { text = "Back to Dashboard" }
        layout.addView(backButton)

        setContentView(layout)

        submitButton.setOnClickListener { attemptRegister() }
        backButton.setOnClickListener { finish() }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Registration Error"
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

    private fun attemptRegister() {
        val upi = upiInput.text.toString().trim()
        val mobile = mobileInput.text.toString().trim()
        val holder = holderInput.text.toString().trim()
        val bank = bankInput.text.toString().trim()
        val account = accountInput.text.toString().trim()

        if (upi.isEmpty() || mobile.isEmpty() || holder.isEmpty() || bank.isEmpty() || account.isEmpty()) {
            statusText.text = "All fields are required."
            return
        }
        if (mobile.length != 10) {
            statusText.text = "Mobile number must be 10 digits."
            return
        }

        submitButton.isEnabled = false
        statusText.text = "Registering UPI account…"

        val token = credentialStore.getCredential()
        if (token == null) {
            statusText.text = "Device not enrolled. Please pair first."
            submitButton.isEnabled = true
            return
        }

        ApiClient.registerUpi(token, upi, mobile, holder, bank, account) { result ->
            runOnUiThread {
                submitButton.isEnabled = true
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val registered = json.get("registered").asBoolean
                            val accountId = json.get("account_id").asString
                            credentialStore.saveAccountId(accountId)
                            DeviceConfig.saveUpiRegistration(upi, mobile)
                            statusText.text = "UPI registered successfully. Account: $accountId"
                            setResult(Activity.RESULT_OK)
                            // Auto-advance after short delay
                            android.os.Handler(Looper.getMainLooper()).postDelayed({
                                val intent = Intent(this, CheckoutActivity::class.java)
                                startActivity(intent)
                                finish()
                            }, 1500)
                        } catch (e: Exception) {
                            statusText.text = "Registration response parse error: ${e.message}"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        statusText.text = "Registration failed: ${result.message}"
                    }
                }
            }
        }
    }
}
