package com.agentic.pay.connectivitytest

import android.app.Activity
import android.os.Bundle
import android.widget.*
import com.google.gson.JsonParser

class ObservationActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var orderIdInput: EditText
    private lateinit var amountInput: EditText
    private lateinit var utrInput: EditText
    private lateinit var statusText: TextView
    private lateinit var submitButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        credentialStore = CredentialStore.init(this)

        if (!credentialStore.isEnrolled()) {
            val layout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(32, 32, 32, 32)
            }
            val msg = TextView(this).apply {
                text = "Device not enrolled. Please enroll first."
                textSize = 18f
            }
            layout.addView(msg)
            val back = Button(this).apply { text = "Back" }
            layout.addView(back)
            back.setOnClickListener { finish() }
            setContentView(layout)
            return
        }

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Submit Payment Evidence"
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hint = TextView(this).apply {
            text = "Authorized transaction evidence only. Submit one observation per checkout."
            textSize = 14f
        }
        layout.addView(hint)

        orderIdInput = EditText(this).apply {
            this.hint = "Checkout ID"
            textSize = 16f
            maxLines = 1
        }
        layout.addView(orderIdInput)

        amountInput = EditText(this).apply {
            this.hint = "Amount (paise, e.g. 100 for ₹1)"
            textSize = 16f
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }
        layout.addView(amountInput)

        utrInput = EditText(this).apply {
            this.hint = "Transaction reference / UTR (12 digits, optional)"
            textSize = 16f
            maxLines = 1
        }
        layout.addView(utrInput)

        statusText = TextView(this).apply {
            text = ""
            textSize = 14f
        }
        layout.addView(statusText)

        submitButton = Button(this).apply { text = "Submit Evidence" }
        layout.addView(submitButton)

        val backButton = Button(this).apply { text = "Back to Dashboard" }
        layout.addView(backButton)

        setContentView(layout)

        submitButton.setOnClickListener { submit() }
        backButton.setOnClickListener { finish() }
    }

    private fun submit() {
        val orderId = orderIdInput.text.toString().trim()
        val amountStr = amountInput.text.toString().trim()
        val utr = utrInput.text.toString().trim()

        if (orderId.isEmpty()) {
            statusText.text = "Enter a checkout ID."
            return
        }
        if (orderId.length != 48) {
            statusText.text = "Checkout ID must be 48 hex characters."
            return
        }
        val amount = amountStr.toIntOrNull()
        if (amount == null || amount < 100) {
            statusText.text = "Enter a valid amount in paise (≥100)."
            return
        }
        val utrFinal = if (utr.isNotEmpty()) utr else null

        submitButton.isEnabled = false
        statusText.text = "Submitting evidence…"

        val token = credentialStore.getCredential() ?: return
        val obs = ApiClient.DeviceObservation(
            orderId = orderId,
            amountPaise = amount,
            currency = "INR",
            transactionReference = utrFinal,
            observationDirection = "incoming",
            evidenceProvenance = "user_authorized",
            observationTimestamp = System.currentTimeMillis() / 1000,
            checkoutCreated = 0,
            checkoutExpires = 0,
        )
        ApiClient.submitObservation(token, obs) { result ->
            runOnUiThread {
                submitButton.isEnabled = true
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val state = json.get("state").asString
                            val decision = json.get("decision").asString
                            val reason = json.get("reason").asString
                            statusText.text = "Result: $state / $decision\n$reason"
                            if (state == "OBSERVATION_RECEIVED" || state == "OBSERVATION_MATCHED") {
                                amountInput.text.clear()
                                utrInput.text.clear()
                                orderIdInput.text.clear()
                            }
                        } catch (e: Exception) {
                            statusText.text = "Submission accepted. Parse error: ${e.message}"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        statusText.text = "Submission failed: ${result.message}"
                    }
                }
            }
        }
    }
}
