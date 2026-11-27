package com.agentic.pay.connectivitytest

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.method.LinkMovementMethod
import android.widget.*
import com.google.gson.JsonParser

class CheckoutActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var amountInput: EditText
    private lateinit var statusText: TextView
    private lateinit var timerText: TextView
    private lateinit var linkText: TextView
    private lateinit var createButton: Button
    private lateinit var verifyButton: Button
    private lateinit var dailyLimitText: TextView
    private lateinit var backButton: Button

    private var orderId: String? = null
    private var checkoutUrl: String? = null
    private var orderExpiresAt: Long = 0
    private var pollHandler: Handler? = null
    private var pollRunnable: Runnable? = null
    private var secondsRemaining: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        try {
            // Security: refuse to run on rooted devices
            if (RootUtil.isRooted(this)) {
                showErrorScreen("Security: Rooted devices are not allowed.")
                return
            }
            credentialStore = CredentialStore.init(this)
            DeviceConfig.init(this)
            buildUI()
            loadDailyLimit()
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
            text = "Create Payment Link"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hintText = TextView(this).apply {
            text = "Create a checkout. Customer pays via UPI. Verification completes within 120 seconds."
            textSize = 14f
        }
        layout.addView(hintText)

        dailyLimitText = TextView(this).apply {
            text = "Daily limit: checking…"
            textSize = 14f
        }
        layout.addView(dailyLimitText)

        amountInput = EditText(this).apply {
            hint = "Amount (₹)"
            textSize = 18f
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
        }
        layout.addView(amountInput)

        statusText = TextView(this).apply {
            text = ""
            textSize = 14f
        }
        layout.addView(statusText)

        timerText = TextView(this).apply {
            text = "Time remaining: —"
            textSize = 16f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(timerText)

        linkText = TextView(this).apply {
            text = ""
            textSize = 14f
            movementMethod = LinkMovementMethod.getInstance()
        }
        layout.addView(linkText)

        createButton = Button(this).apply { text = "Create Checkout" }
        layout.addView(createButton)

        verifyButton = Button(this).apply {
            text = "Verify Payment"
            isEnabled = false
        }
        layout.addView(verifyButton)

        backButton = Button(this).apply { text = "Back to Dashboard" }
        layout.addView(backButton)

        setContentView(layout)

        createButton.setOnClickListener { attemptCreateOrder() }
        verifyButton.setOnClickListener { attemptVerifyPayment() }
        backButton.setOnClickListener { stopPolling(); finish() }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Checkout Error"
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

    private fun loadDailyLimit() {
        val token = credentialStore.getCredential() ?: return
        ApiClient.dailyLimit(token) { result ->
            runOnUiThread {
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val collected = json.get("collected_today_rupees").asDouble
                            val limit = json.get("daily_limit_rupees").asDouble
                            val remaining = json.get("remaining_rupees").asDouble
                            val canCollect = json.get("can_collect").asBoolean
                            dailyLimitText.text = "Daily collected: ₹${"%.2f".format(collected)} / ₹${"%.2f".format(limit)} (remaining: ₹${"%.2f".format(remaining)})"
                            if (!canCollect) {
                                createButton.isEnabled = false
                                createButton.text = "Daily limit reached — shop closed"
                                statusText.text = "₹70,000 daily limit reached. No more checkouts today."
                            }
                        } catch (e: Exception) {
                            dailyLimitText.text = "Daily limit: parse error"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        dailyLimitText.text = "Daily limit: ${result.message}"
                    }
                }
            }
        }
    }

    private fun attemptCreateOrder() {
        val amountStr = amountInput.text.toString().trim()
        if (amountStr.isEmpty()) {
            statusText.text = "Enter an amount."
            return
        }
        val amountRupees = amountStr.toDoubleOrNull() ?: return
        val amountPaise = (amountRupees * 100).toLong()
        if (amountPaise < 100) {
            statusText.text = "Minimum amount is ₹1.00."
            return
        }

        val accountId = credentialStore.getAccountId()
        if (accountId == null) {
            statusText.text = "UPI not registered. Please register your UPI first."
            return
        }

        val token = credentialStore.getCredential()
        if (token == null) {
            statusText.text = "Device not enrolled. Please pair first."
            return
        }

        createButton.isEnabled = false
        statusText.text = "Creating checkout…"

        ApiClient.createOrder(token, amountPaise, accountId) { result ->
            runOnUiThread {
                createButton.isEnabled = true
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            orderId = json.get("id").asString
                            val path = json.get("checkout_path").asString
                            checkoutUrl = path
                            orderExpiresAt = (System.currentTimeMillis() / 1000) + DeviceConfig.CHECKOUT_WINDOW_SECONDS
                            secondsRemaining = DeviceConfig.CHECKOUT_WINDOW_SECONDS
                            linkText.text = "Payment link: $path"
                            statusText.text = "Checkout created. Share this link with the customer."
                            timerText.text = "Time remaining: $secondsRemaining s"
                            verifyButton.isEnabled = true
                            startPolling()
                        } catch (e: Exception) {
                            statusText.text = "Checkout response parse error: ${e.message}"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        statusText.text = "Checkout failed: ${result.message}"
                    }
                }
            }
        }
    }

    private fun attemptVerifyPayment() {
        val orderIdVal = orderId ?: return
        val token = credentialStore.getCredential() ?: return

        statusText.text = "Verifying payment…"
        verifyButton.isEnabled = false

        ApiClient.getCheckout(orderIdVal, token) { result ->
            runOnUiThread {
                verifyButton.isEnabled = true
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val status = json.get("status").asString
                            val settlement = json.getAsJsonObject("settlement")
                            val settlementState = if (settlement != null) settlement.get("state").asString else "NONE"
                            val financiallyVerified = settlement.get("satisfied").asBoolean

                            statusText.text = "Order status: $status · Settlement: $settlementState"
                            timerText.text = ""

                            if (financiallyVerified) {
                                statusText.text = "PAYMENT VERIFIED — Debit confirmed ✓"
                                linkText.text = ""
                                stopPolling()
                                // Send email notification
                                sendPaymentEmail(orderIdVal!!, "VERIFIED")
                            } else if (status == "PAID" || settlementState == "SETTLED") {
                                statusText.text = "Payment received — awaiting final confirmation"
                            } else {
                                statusText.text = "Payment not yet verified. Waiting for customer…"
                            }
                        } catch (e: Exception) {
                            statusText.text = "Verification response parse error: ${e.message}"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        statusText.text = "Verification failed: ${result.message}"
                    }
                }
            }
        }
    }

    private fun startPolling() {
        stopPolling()
        pollHandler = Handler(Looper.getMainLooper())
        val runnable = object : Runnable {
            override fun run() {
                val now = System.currentTimeMillis() / 1000
                if (now >= orderExpiresAt || secondsRemaining <= 0) {
                    timerText.text = "Time expired — checkout closed"
                    statusText.text = "Checkout expired after 120 seconds. No debit verified."
                    createButton.isEnabled = true
                    verifyButton.isEnabled = false
                    stopPolling()
                    return
                }
                secondsRemaining--
                timerText.text = "Time remaining: $secondsRemaining s"
                attemptVerifyPayment()
                pollHandler?.postDelayed(this, 5000)
            }
        }
        pollRunnable = runnable
        pollHandler?.post(runnable)
    }

    private fun stopPolling() {
        pollRunnable?.let { pollHandler?.removeCallbacks(it) }
        pollHandler = null
        pollRunnable = null
    }
    private fun sendPaymentEmail(orderId: String, status: String) {
        val token = credentialStore.getCredential() ?: return
        ApiClient.emailNotify(orderId, status, token) { result ->
            runOnUiThread {
                when (result) {
                    is ApiClient.Result.Success -> {
                        statusText.append("\nEmail notification queued for order $orderId ($status).")
                    }
                    is ApiClient.Result.Error -> {
                        // Email is non-fatal; don't block the verified state.
                        statusText.append("\nEmail notification: ${result.message}")
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        stopPolling()
        super.onDestroy()
    }
}
