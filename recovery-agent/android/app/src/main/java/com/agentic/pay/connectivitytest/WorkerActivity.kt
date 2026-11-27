package com.agentic.pay.connectivitytest

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.widget.*
import com.google.gson.JsonParser

class WorkerActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var workerRows: MutableList<TextView> = mutableListOf()
    private lateinit var statusText: TextView
    private lateinit var startWorkersButton: Button
    private lateinit var stopWorkersButton: Button
    private lateinit var backButton: Button

    private var isAutoRunning = false
    private var pollHandler: Handler? = null
    private var pollRunnable: Runnable? = null

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
            loadWorkerStatus()
        } catch (e: Exception) {
            showErrorScreen("Initialization failed: ${e.message}")
        }
    }

    private fun buildUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16, 16, 16, 16)
        }

        val title = TextView(this).apply {
            text = "DISHA Worker Fleet - 15 Workers"
            textSize = 20f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hint = TextView(this).apply {
            text = "Each worker monitors one UPI ID for incoming payments. Auto-verifies within 120s."
            textSize = 12f
        }
        layout.addView(hint)

        statusText = TextView(this).apply {
            text = "Workers: loading…"
            textSize = 14f
        }
        layout.addView(statusText)

        // Worker rows (15)
        for (i in 0 until 15) {
            val row = TextView(this).apply {
                text = "Worker $i: UPI not assigned"
                textSize = 12f
                setPadding(4, 2, 4, 2)
            }
            workerRows.add(row)
            layout.addView(row)
        }

        startWorkersButton = Button(this).apply { text = "Start All Workers" }
        layout.addView(startWorkersButton)

        stopWorkersButton = Button(this).apply { text = "Stop All Workers"; isEnabled = false }
        layout.addView(stopWorkersButton)

        backButton = Button(this).apply { text = "Back to Dashboard" }
        layout.addView(backButton)

        setContentView(layout)

        startWorkersButton.setOnClickListener {
            startWorkerService()
        }

        stopWorkersButton.setOnClickListener {
            stopWorkerService()
        }

        backButton.setOnClickListener {
            stopPolling()
            finish()
        }
    }

    private fun showErrorScreen(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Worker Error"
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

    private fun loadWorkerStatus() {
        val token = credentialStore.getCredential() ?: return
        statusText.text = "Loading worker status…"

        ApiClient.workerDispatch(token, 0) { result ->
            runOnUiThread {
                when (result) {
                    is ApiClient.Result.Success -> {
                        try {
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val workerCount = json.get("worker_count").asInt
                            val pending = json.getAsJsonArray("pending_checkouts")

                            statusText.text = "Workers: $workerCount active | Pending: ${pending?.size() ?: 0}"

                            // Update each worker row
                            for (i in 0 until 15) {
                                val row = workerRows[i]
                                row.text = "Worker $i: UPI pending assignment"
                            }

                            // Map pending checkouts to workers
                            if (pending != null) {
                                for (i in 0 until pending.size()) {
                                    val checkout = pending.get(i).asJsonObject
                                    val wi = checkout.get("worker_index").asInt
                                    val upiId = checkout.get("upi_id").asString
                                    val amt = checkout.get("amount_minor").asLong / 100.0
                                    if (wi >= 0 && wi < 15) {
                                        workerRows[wi].text = "Worker $wi: UPI $upiId | ₹${"%.2f".format(amt)} | Auto-verifying…"
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            statusText.text = "Parse error: ${e.message}"
                        }
                    }
                    is ApiClient.Result.Error -> {
                        statusText.text = "Load failed: ${result.message}"
                    }
                }
            }
        }
    }

    private fun startWorkerService() {
        val intent = Intent(this, WorkerService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        isAutoRunning = true
        startWorkersButton.isEnabled = false
        stopWorkersButton.isEnabled = true
        statusText.text = "Workers: RUNNING (auto-checkout + auto-verify active)"
        startPolling()
    }

    private fun stopWorkerService() {
        val intent = Intent(this, WorkerService::class.java)
        stopService(intent)
        isAutoRunning = false
        startWorkersButton.isEnabled = true
        stopWorkersButton.isEnabled = false
        statusText.text = "Workers: STOPPED"
        stopPolling()
    }

    private fun startPolling() {
        stopPolling()
        pollHandler = Handler(Looper.getMainLooper())
        pollRunnable = object : Runnable {
            override fun run() {
                loadWorkerStatus()
                pollHandler?.postDelayed(this, 5000)
            }
        }
        pollHandler?.post(pollRunnable!!)
    }

    private fun stopPolling() {
        pollRunnable?.let { pollHandler?.removeCallbacks(it) }
        pollHandler = null
        pollRunnable = null
    }

    override fun onDestroy() {
        stopPolling()
        super.onDestroy()
    }
}
