package com.agentic.pay.connectivitytest

import android.app.Activity
import android.os.Bundle
import android.widget.*
import com.google.gson.JsonParser

class ObservationActivity : Activity() {

    private lateinit var credentialStore: CredentialStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        try {
            credentialStore = CredentialStore.init(this)
            buildUI()
        } catch (e: Exception) {
            showErrorScreen("Initialization failed: ${e.message}")
        }
    }

    private fun buildUI() {
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
            text = "Credit Observation"
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hint = TextView(this).apply {
            text = "Incoming UPI credits are observed automatically. No manual submission required."
            textSize = 14f
        }
        layout.addView(hint)

        val statusText = TextView(this).apply {
            text = "Observation status: Automatic"
            textSize = 16f
        }
        layout.addView(statusText)

        val lastEventText = TextView(this).apply {
            text = "Last event: —"
            textSize = 14f
        }
        layout.addView(lastEventText)

        val checkoutWindowText = TextView(this).apply {
            text = "Checkout window: ${DeviceConfig.CHECKOUT_WINDOW_SECONDS} seconds"
            textSize = 14f
        }
        layout.addView(checkoutWindowText)

        val note = TextView(this).apply {
            text = "Matched observations update the checkout automatically. " +
                "Device observations are not financial settlement confirmation."
            textSize = 12f
        }
        layout.addView(note)

        val backButton = Button(this).apply { text = "Back to Dashboard" }
        layout.addView(backButton)

        setContentView(layout)

        backButton.setOnClickListener { finish() }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Credit Observation Error"
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
}
