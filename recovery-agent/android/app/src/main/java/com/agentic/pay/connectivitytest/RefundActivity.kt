package com.agentic.pay.connectivitytest

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager
import android.widget.*
import com.google.gson.JsonParser

class RefundActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var orderIdInput: EditText
    private lateinit var reasonInput: EditText
    private lateinit var statusText: TextView
    private lateinit var refundButton: Button
    private lateinit var backButton: Button

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
            text = "Refund Payment"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hint = TextView(this).apply {
            text = "Refund a failed or disputed payment. 120-second window applies."
            textSize = 14f
        }
        layout.addView(hint)

        orderIdInput = EditText(this).apply {
            hint = "Order ID"
            textSize = 18f
            maxLines = 1
        }
        layout.addView(orderIdInput)

        reasonInput = EditText(this).apply {
            hint = "Reason (failed payment, duplicate, technical error)"
            textSize = 18f
            maxLines = 2
        }
        layout.addView(reasonInput)

        statusText = TextView(this).apply {
            text = ""
            textSize = 14f
        }
        layout.addView(statusText)

        refundButton = Button(this).apply { text = "Issue Refund" }
        layout.addView(refundButton)

        backButton = Button(this).apply { text = "Back" }
        layout.addView(backButton)

        setContentView(layout)

        refundButton.setOnClickListener { attemptRefund() }
        backButton.setOnClickListener { finish() }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Refund Error"
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

    private fun attemptRefund() {
        val orderId = orderIdInput.text.toString().trim()
        val reason = reasonInput.text.toString().trim()

        if (orderId.isEmpty()) {
            statusText.text = "Order ID is required."
            return
        }
        if (reason.isEmpty()) {
            statusText.text = "Reason is required."
            return
        }

        val token = credentialStore.getCredential()
        if (token == null) {
            statusText.text = "Device not enrolled. Please pair first."
            return
        }

        refundButton.isEnabled = false
        statusText.text = "Processing refund…"

        ApiClient.refund(orderId, reason, token) { result ->
            runOnUiThread {
                refundButton.isEnabled = true
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val refundStatus = json.get("status").asString
                            val refundedAt = json.get("refunded_at").asString
                            statusText.text = "Refund issued: $refundStatus at $refundedAt"
                            orderIdInput.text.clear()
                            reasonInput.text.clear()
                        } catch (e: Exception) {
                            statusText.text = "Refund response parse error: ${e.message}"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        statusText.text = "Refund failed: ${result.message}"
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
