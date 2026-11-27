package com.agentic.pay.connectivitytest

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager
import android.widget.*
import com.google.gson.JsonParser

class UpiPoolActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var poolContainer: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var refreshButton: Button
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
            loadPool()
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
            text = "UPI Pool Health"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hint = TextView(this).apply {
            text = "Weighted Intelligent Rotation — up to 15 UPI IDs per agent device"
            textSize = 14f
        }
        layout.addView(hint)

        statusText = TextView(this).apply {
            text = "Loading pool…"
            textSize = 14f
        }
        layout.addView(statusText)

        poolContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        layout.addView(poolContainer)

        refreshButton = Button(this).apply { text = "Refresh Pool" }
        layout.addView(refreshButton)

        backButton = Button(this).apply { text = "Back" }
        layout.addView(backButton)

        setContentView(layout)

        refreshButton.setOnClickListener { loadPool() }
        backButton.setOnClickListener { finish() }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Pool Error"
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

    private fun loadPool() {
        val token = credentialStore.getCredential() ?: return
        statusText.text = "Loading UPI pool…"

        ApiClient.upiPool(token) { result ->
            runOnUiThread {
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val poolSize = json.get("pool_size").asInt
                            statusText.text = "UPI Pool: $poolSize registered IDs"
                            poolContainer.removeAllViews()

                            val arr = json.getAsJsonArray("upi_pool")
                            if (arr == null || arr.size() == 0) {
                                val empty = TextView(this).apply {
                                    text = "No UPI IDs registered yet."
                                    textSize = 14f
                                }
                                poolContainer.addView(empty)
                                return
                            }

                            for (i in 0 until arr.size()) {
                                val upi = arr.get(i).asJsonObject
                                val upiId = upi.get("upi_id").asString
                                val available = upi.get("available").asBoolean
                                val dailyCount = upi.get("daily_count").asInt
                                val dailyVolume = upi.get("daily_volume").asLong
                                val successRate = upi.get("success_rate").asDouble
                                val blacklisted = upi.get("blacklisted").asBoolean

                                val row = LinearLayout(this).apply {
                                    orientation = LinearLayout.HORIZONTAL
                                    setPadding(8, 8, 8, 8)
                                }
                                val color = if (available) 0xFF065F46.toInt() else 0xFFDC2626.toInt()
                                val dot = View(this).apply {
                                    layoutParams = LinearLayout.LayoutParams(12, 12)
                                    setBackgroundColor(color)
                                }
                                row.addView(dot)

                                val info = TextView(this).apply {
                                    text = "$upiId  |  Daily: $dailyCount txns / ₹${"%.2f".format(dailyVolume / 100.0)}  |  Success: ${"%.0f".format(successRate * 100)}%  |  ${if (available) "AVAILABLE" else "UNAVAILABLE"}  |  ${if (blacklisted) "BLACKLISTED" else ""}"
                                    textSize = 12f
                                    setPadding(8, 0, 0, 0)
                                }
                                row.addView(info)
                                poolContainer.addView(row)
                            }
                        } catch (e: Exception) {
                            statusText.text = "Pool parse error: ${e.message}"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        statusText.text = "Pool load failed: ${result.message}"
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
