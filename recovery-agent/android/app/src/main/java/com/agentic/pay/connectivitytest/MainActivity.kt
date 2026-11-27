package com.agentic.pay.connectivitytest

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.*
import com.google.gson.JsonParser

class MainActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var statusText: TextView
    private lateinit var heartbeatText: TextView
    private lateinit var versionText: TextView
    private lateinit var permissionText: TextView
    private lateinit var eventText: TextView
    private lateinit var dailyLimitText: TextView
    private lateinit var pairButton: Button
    private lateinit var permissionButton: Button
    private lateinit var refreshButton: Button
    private lateinit var upiButton: Button
    private lateinit var checkoutButton: Button
    private lateinit var refundButton: Button
    private lateinit var upiPoolButton: Button
    private lateinit var dailyReportButton: Button
    private lateinit var workerFleetButton: Button
    private lateinit var upiAppButton: Button
    private lateinit var superAdminButton: Button

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
            updateButtons()
            refreshStatus()
            loadDailyLimit()
        } catch (e: Exception) {
            showErrorScreen("Initialization failed: ${e.message}")
            return
        }
    }

    private fun buildUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "G Shop App"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val workspace = TextView(this).apply {
            text = "Merchant: ${DeviceConfig.merchant}"
            textSize = 16f
        }
        layout.addView(workspace)

        val deviceId = TextView(this).apply {
            text = "Device ID: ${DeviceConfig.deviceId}"
            textSize = 14f
        }
        layout.addView(deviceId)

        val version = TextView(this).apply {
            text = "Version: ${DeviceConfig.APP_VERSION_NAME} (${DeviceConfig.APP_VERSION_CODE})"
            textSize = 14f
        }
        layout.addView(version)

        statusText = TextView(this).apply {
            text = "Status: Checking…"
            textSize = 18f
        }
        layout.addView(statusText)

        heartbeatText = TextView(this).apply {
            text = "Last heartbeat: —"
            textSize = 14f
        }
        layout.addView(heartbeatText)

        dailyLimitText = TextView(this).apply {
            text = "Daily limit: —"
            textSize = 14f
        }
        layout.addView(dailyLimitText)

        val divider1 = View(this).apply { layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 2); setBackgroundColor(0xFF283344.toInt()) }
        layout.addView(divider1)

        permissionText = TextView(this).apply {
            text = "Credit observation permission: Checking…"
            textSize = 16f
        }
        layout.addView(permissionText)

        permissionButton = Button(this).apply {
            text = "Enable Notification Access"
            isEnabled = false
        }
        layout.addView(permissionButton)

        eventText = TextView(this).apply {
            text = "Pending events: —  |  Last observation: —"
            textSize = 14f
        }
        layout.addView(eventText)

        val checkoutWindow = TextView(this).apply {
            text = "Checkout window: ${DeviceConfig.CHECKOUT_WINDOW_SECONDS} seconds"
            textSize = 14f
        }
        layout.addView(checkoutWindow)

        val divider2 = View(this).apply { layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 2); setBackgroundColor(0xFF283344.toInt()) }
        layout.addView(divider2)

        pairButton = Button(this).apply { text = "Enroll Device (Pairing Code)" }
        layout.addView(pairButton)

        upiButton = Button(this).apply {
            text = "Register My UPI"
            isEnabled = false
        }
        layout.addView(upiButton)

        checkoutButton = Button(this).apply {
            text = "Create Payment Link"
            isEnabled = false
        }
        layout.addView(checkoutButton)

        refundButton = Button(this).apply {
            text = "Refund Payment"
            isEnabled = false
        }
        layout.addView(refundButton)

        upiPoolButton = Button(this).apply {
            text = "UPI Pool Health"
            isEnabled = false
        }
        layout.addView(upiPoolButton)

        dailyReportButton = Button(this).apply {
            text = "Daily Report"
            isEnabled = false
        }
        layout.addView(dailyReportButton)

        workerFleetButton = Button(this).apply {
            text = "Worker Fleet (15 Workers)"
            isEnabled = false
        }
        layout.addView(workerFleetButton)

        upiAppButton = Button(this).apply {
            text = "UPI App Switcher (11 Apps)"
            isEnabled = false
        }
        layout.addView(upiAppButton)

        superAdminButton = Button(this).apply {
            text = "Super Admin Console"
            isEnabled = false
        }
        layout.addView(superAdminButton)

        refreshButton = Button(this).apply { text = "Refresh Status" }
        layout.addView(refreshButton)

        val msg = TextView(this).apply {
            text = "No payment data is collected without explicit user authorization."
            textSize = 12f
        }
        layout.addView(msg)

        setContentView(layout)

        pairButton.setOnClickListener {
            val intent = android.content.Intent(this, PairingActivity::class.java)
            startActivity(intent)
        }

        upiButton.setOnClickListener {
            val intent = Intent(this, RegisterUpiActivity::class.java)
            startActivity(intent)
        }

        checkoutButton.setOnClickListener {
            val intent = Intent(this, CheckoutActivity::class.java)
            startActivity(intent)
        }

        refundButton.setOnClickListener {
            val intent = Intent(this, RefundActivity::class.java)
            startActivity(intent)
        }

        upiPoolButton.setOnClickListener {
            val intent = Intent(this, UpiPoolActivity::class.java)
            startActivity(intent)
        }

        dailyReportButton.setOnClickListener {
            val intent = Intent(this, DailyReportActivity::class.java)
            startActivity(intent)
        }

        workerFleetButton.setOnClickListener {
            val intent = Intent(this, WorkerActivity::class.java)
            startActivity(intent)
        }

        upiAppButton.setOnClickListener {
            val intent = Intent(this, UPIAppActivity::class.java)
            startActivity(intent)
        }

        superAdminButton.setOnClickListener {
            // Super Admin console - shows fleet management
            val intent = Intent(this, WorkerActivity::class.java)
            startActivity(intent)
        }

        permissionButton.setOnClickListener {
            openNotificationSettings()
        }

        refreshButton.setOnClickListener {
            refreshStatus()
            loadDailyLimit()
        }
    }

    private fun openNotificationSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        startActivity(intent)
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

    override fun onResume() {
        super.onResume()
        try {
            // If not enrolled, route to SetupActivity first
            if (!credentialStore.isEnrolled()) {
                val intent = Intent(this, SetupActivity::class.java)
                startActivity(intent)
                return
            }
            updateButtons()
            refreshStatus()
            loadDailyLimit()
            checkNotificationPermission()
        } catch (e: Exception) {
            showErrorScreen("Resume failed: ${e.message}")
        }
    }

    private fun updateButtons() {
        val enrolled = credentialStore.isEnrolled()
        val upiRegistered = DeviceConfig.upiRegistered
        pairButton.text = if (enrolled) "Re-enroll Device" else "Enroll Device (Pairing Code)"
        upiButton.isEnabled = enrolled
        checkoutButton.isEnabled = enrolled && upiRegistered
        refundButton.isEnabled = enrolled && upiRegistered
        upiPoolButton.isEnabled = enrolled && upiRegistered
        dailyReportButton.isEnabled = enrolled && upiRegistered
        workerFleetButton.isEnabled = enrolled && upiRegistered
        upiAppButton.isEnabled = enrolled && upiRegistered
        superAdminButton.isEnabled = enrolled
    }

    private fun observeButtonState(enrolled: Boolean) {
        // Enrollment state is reflected in the UI text only.
    }

    private fun checkNotificationPermission() {
        val granted = isNotificationListenerGranted()
        permissionText.text = if (granted) {
            "Credit observation permission: GRANTED"
        } else {
            "Credit observation permission: NOT GRANTED"
        }
        permissionButton.isEnabled = !granted
    }

    private fun isNotificationListenerGranted(): Boolean {
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        if (flat == null) return false
        val pkg = packageName
        val service = "$pkg/.UpiPaymentObserver"
        return flat.split(":").any { it.contains(service) }
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
                            dailyLimitText.text = "Daily: ₹${"%.2f".format(collected)} / ₹${"%.2f".format(limit)} (left: ₹${"%.2f".format(remaining)})"
                            if (!canCollect) {
                                checkoutButton.isEnabled = false
                                checkoutButton.text = "Daily limit reached — shop closed"
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

    private fun refreshStatus() {
        val token = credentialStore.getCredential()
        if (token == null) {
            statusText.text = "Status: Not enrolled"
            heartbeatText.text = "Last heartbeat: —"
            versionText.text = "App version: ${credentialStore.getAppVersion() ?: "—"}"
            eventText.text = "Pending events: —  |  Last observation: —"
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
                            val json = JsonParser.parseString(result.value).asJsonObject
                            val state = json.get("state").asString
                            val connected = json.get("connected").asBoolean
                            statusText.text = "Status: $state (${if (connected) "ONLINE" else "OFFLINE"})"
                            heartbeatText.text = "Last heartbeat: ${json.get("last_heartbeat").asString}"
                            versionText.text = "App version: ${json.get("app_version").asString}"
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
