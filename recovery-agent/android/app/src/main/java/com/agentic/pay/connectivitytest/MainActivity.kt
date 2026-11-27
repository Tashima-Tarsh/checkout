package com.agentic.pay.connectivitytest

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.widget.*
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.google.gson.reflect.TypeToken
import java.lang.reflect.Type

class MainActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var statusText: TextView
    private lateinit var heartbeatText: TextView
    private lateinit var versionText: TextView
    private lateinit var pairButton: Button
    private lateinit var observeButton: Button
    private lateinit var refreshButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            credentialStore = CredentialStore.init(this)
        } catch (e: Exception) {
            showErrorScreen("Initialization failed: ${e.message}")
            return
        }

        try {
            buildUI()
            updateButtons()
            refreshStatus()
        } catch (e: Exception) {
            showErrorScreen("UI setup failed: ${e.message}")
        }
    }

    private fun buildUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "G Shop App"
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val deviceId = TextView(this).apply {
            text = "Disha"
            textSize = 16f
        }
        layout.addView(deviceId)

        statusText = TextView(this).apply {
            text = "Status: Checking…"
            textSize = 18f
        }
        layout.addView(statusText)

        heartbeatText = TextView(this).apply {
            text = "Last heartbeat: —"
            textSize = 16f
        }
        layout.addView(heartbeatText)

        versionText = TextView(this).apply {
            text = "App version: 2.3"
            textSize = 16f
        }
        layout.addView(versionText)

        val divider = View(this).apply { layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 2); setBackgroundColor(0xFF283344.toInt()) }
        layout.addView(divider)

        pairButton = Button(this).apply { text = "Enroll Device (Pairing Code)" }
        layout.addView(pairButton)

        observeButton = Button(this).apply {
            text = "Submit Payment Evidence"
            isEnabled = false
        }
        layout.addView(observeButton)

        refreshButton = Button(this).apply { text = "Refresh Status" }
        layout.addView(refreshButton)

        val msg = TextView(this).apply {
            text = "Checkout window: 120 seconds. Connection refreshes while open. Automatic payment source not configured."
            textSize = 12f
        }
        layout.addView(msg)

        setContentView(layout)

        pairButton.setOnClickListener {
            val intent = android.content.Intent(this, PairingActivity::class.java)
            startActivity(intent)
        }

        observeButton.setOnClickListener {
            val intent = android.content.Intent(this, ObservationActivity::class.java)
            startActivity(intent)
        }

        refreshButton.setOnClickListener { refreshStatus() }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Application Error"
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

    private val heartbeatHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val heartbeatTick = object : Runnable {
        override fun run() {
            if (::credentialStore.isInitialized) {
                credentialStore.getCredential()?.let { token ->
                    ApiClient.heartbeat(token) { result ->
                        if (result is ApiClient.Result.Success) runOnUiThread { if (!isFinishing && !isDestroyed) refreshStatus() }
                    }
                }
            }
            heartbeatHandler.postDelayed(this, 30000L)
        }
    }

    override fun onPause() {
        heartbeatHandler.removeCallbacks(heartbeatTick)
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        heartbeatHandler.removeCallbacks(heartbeatTick)
        heartbeatHandler.post(heartbeatTick)
        try {
            updateButtons()
            refreshStatus()
        } catch (e: Exception) {
            showErrorScreen("Resume failed: ${e.message}")
        }
    }

    private fun updateButtons() {
        val enrolled = credentialStore.isEnrolled()
        observeButton.visibility = View.GONE
        observeButton.isEnabled = false
        pairButton.text = if (enrolled) "Re-enroll Device" else "Enroll Device (Pairing Code)"
    }

    private fun refreshStatus() {
        val token = credentialStore.getCredential()
        if (token == null) {
            statusText.text = "Status: Not enrolled"
            heartbeatText.text = "Last heartbeat: —"
            versionText.text = "App version: 2.3"
            return
        }
        val expiresAt = credentialStore.getCredentialExpiresAt()
        if (System.currentTimeMillis() / 1000 > expiresAt) {
            statusText.text = "Status: Credential expired"
            credentialStore.clear()
            updateButtons()
            return
        }
        ApiClient.fetchDeviceStatus(token) { result ->
            when (result) {
                is ApiClient.Result.Success -> {
                    runOnUiThread {
                        try {
                            val json = com.google.gson.JsonParser.parseString(result.value).asJsonObject
                            val state = json.get("state").asString
                            val connected = json.get("connected").asBoolean
                            statusText.text = "Status: $state (${if (connected) "ONLINE" else "OFFLINE"})"
                            heartbeatText.text = "Last heartbeat: ${(json.get("last_heartbeat")?.takeUnless { it.isJsonNull }?.asString ?: "—")}"
                            versionText.text = "App version: 2.3"
                        } catch (e: Exception) {
                            statusText.text = "Status: Parse error"
                        }
                    }
                }
                is ApiClient.Result.Error -> {
                    runOnUiThread { statusText.text = "Status: ${result.message}" }
                }
            }
        }
    }
}
