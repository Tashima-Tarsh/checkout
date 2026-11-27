package com.agentic.pay.connectivitytest

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager
import android.widget.*
import com.google.gson.JsonParser

class DailyReportActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var reportContainer: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var generateButton: Button
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
            text = "Daily Report"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hint = TextView(this).apply {
            text = "Daily P2P/P2M report emailed to merchant owner"
            textSize = 14f
        }
        layout.addView(hint)

        statusText = TextView(this).apply {
            text = "Tap Generate to create today's report"
            textSize = 14f
        }
        layout.addView(statusText)

        reportContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        layout.addView(reportContainer)

        generateButton = Button(this).apply { text = "Generate Daily Report" }
        layout.addView(generateButton)

        backButton = Button(this).apply { text = "Back" }
        layout.addView(backButton)

        setContentView(layout)

        generateButton.setOnClickListener { generateReport() }
        backButton.setOnClickListener { finish() }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Report Error"
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

    private fun generateReport() {
        val token = credentialStore.getCredential() ?: return
        statusText.text = "Generating report…"

        ApiClient.dailyReport(token) { result ->
            runOnUiThread {
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val businessName = json.get("business_name").asString
                            val email = json.get("email").asString
                            val emailQueued = json.get("email_queued").asBoolean

                            val p2p = json.getAsJsonObject("p2p")
                            val p2m = json.getAsJsonObject("p2m")

                            reportContainer.removeAllViews()

                            val header = TextView(this).apply {
                                text = "$businessName — Daily Report"
                                textSize = 18f
                                setTypeface(null, android.graphics.Typeface.BOLD)
                            }
                            reportContainer.addView(header)

                            val emailLine = TextView(this).apply {
                                text = "Report emailed to: $email (queued: $emailQueued)"
                                textSize = 14f
                            }
                            reportContainer.addView(emailLine)

                            val divider = View(this).apply {
                                layoutParams = LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.MATCH_PARENT, 2)
                                setBackgroundColor(0xFF283344.toInt())
                            }
                            reportContainer.addView(divider)

                            // P2P section
                            val p2pLabel = TextView(this).apply {
                                text = "P2P (Person-to-Person)"
                                textSize = 16f
                                setTypeface(null, android.graphics.Typeface.BOLD)
                            }
                            reportContainer.addView(p2pLabel)

                            val p2pCollected = TextView(this).apply {
                                text = "Collected: ₹${"%.2f".format(p2p.get("collected_rupees").asDouble)} / ₹${"%.2f".format(p2p.get("daily_limit_rupees").asDouble)} limit"
                                textSize = 14f
                            }
                            reportContainer.addView(p2pCollected)

                            val p2pTxns = TextView(this).apply {
                                text = "Transactions: ${p2p.get("txn_count").asInt}  |  Limit reached: ${p2p.get("limit_reached").asBoolean}"
                                textSize = 14f
                            }
                            reportContainer.addView(p2pTxns)

                            // P2M section
                            val p2mLabel = TextView(this).apply {
                                text = "P2M (Person-to-Merchant)"
                                textSize = 16f
                                setTypeface(null, android.graphics.Typeface.BOLD)
                            }
                            reportContainer.addView(p2mLabel)

                            val p2mCollected = TextView(this).apply {
                                text = "Collected: ₹${"%.2f".format(p2m.get("collected_rupees").asDouble)} (unlimited)"
                                textSize = 14f
                            }
                            reportContainer.addView(p2mCollected)

                            val p2mTxns = TextView(this).apply {
                                text = "Transactions: ${p2m.get("txn_count").asInt}"
                                textSize = 14f
                            }
                            reportContainer.addView(p2mTxns)

                            // UPI pool summary
                            val upiLabel = TextView(this).apply {
                                text = "UPI Pool Summary"
                                textSize = 16f
                                setTypeface(null, android.graphics.Typeface.BOLD)
                            }
                            reportContainer.addView(upiLabel)

                            val arr = json.getAsJsonArray("upi_summary")
                            if (arr != null) {
                                for (i in 0 until arr.size()) {
                                    val upi = arr.get(i).asJsonObject
                                    val line = TextView(this).apply {
                                        text = "${upi.get("upi_id").asString}  |  ${upi.get("daily_count").asInt} txns / ₹${"%.2f".format(upi.get("daily_volume").asLong / 100.0)}  |  Success: ${"%.0f".format(upi.get("success_rate").asDouble * 100)}%"
                                        textSize = 12f
                                    }
                                    reportContainer.addView(line)
                                }
                            }

                            statusText.text = "Report generated for $businessName"
                        } catch (e: Exception) {
                            statusText.text = "Report parse error: ${e.message}"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        statusText.text = "Report failed: ${result.message}"
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
