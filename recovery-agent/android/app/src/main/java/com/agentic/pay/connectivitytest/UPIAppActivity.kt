package com.agentic.pay.connectivitytest

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.WindowManager
import android.widget.*
import com.google.gson.JsonParser

class UPIAppActivity : Activity() {

    private lateinit var credentialStore: CredentialStore
    private lateinit var appContainer: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var backButton: Button

    // Supported UPI apps for merchant Android device
    private val upiApps = listOf(
        Pair("GPay", "com.google.android.apps.nbu.paisa.user"),
        Pair("PhonePe", "com.phonepe.app"),
        Pair("BHIM", "in.org.npci.upiapp"),
        Pair("WhatsApp Pay", "com.whatsapp"),
        Pair("Cred", "com.cred.club"),
        Pair("Mi Pay", "com.xiaomi.payment"),
        Pair("Paytm", "net.one97.paytm"),
        Pair("Amazon Pay", "in.amazon.mShop.android.shopping"),
        Pair("Airtel Pay", "com.bairtel.myairtel"),
        Pair("JioPay", "com.jio.payment"),
        Pair("BharatPe", "com.bharatpe.app"),
    )

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
            loadUPIApps()
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
            text = "UPI App Switcher"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(title)

        val hint = TextView(this).apply {
            text = "Pre-installed UPI apps on merchant Android device. Workers switch between apps to distribute volume."
            textSize = 14f
        }
        layout.addView(hint)

        statusText = TextView(this).apply {
            text = "Loading UPI apps…"
            textSize = 14f
        }
        layout.addView(statusText)

        appContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        layout.addView(appContainer)

        backButton = Button(this).apply { text = "Back" }
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
            text = "UPI App Error"
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

    private fun loadUPIApps() {
        val pm = packageManager
        appContainer.removeAllViews()

        for ((appName, packageName) in upiApps) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(8, 4, 8, 4)
            }

            val installed = isAppInstalled(pm, packageName)

            val dot = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(12, 12)
                setBackgroundColor(if (installed) 0xFF065F46.toInt() else 0xFFDC2626.toInt())
            }
            row.addView(dot)

            val info = TextView(this).apply {
                text = "$appName ($packageName) - ${if (installed) "INSTALLED" else "NOT INSTALLED"}"
                textSize = 12f
                setPadding(8, 0, 0, 0)
            }
            row.addView(info)

            val launchBtn = Button(this).apply {
                text = "Launch"
                isEnabled = installed
                textSize = 10f
                setPadding(8, 4, 8, 4)
            }
            launchBtn.setOnClickListener {
                launchUPIApp(packageName)
            }
            row.addView(launchBtn)

            appContainer.addView(row)
        }

        val installedCount = upiApps.count { (_, pkg) -> isAppInstalled(pm, pkg) }
        statusText.text = "UPI Apps: $installedCount/${upiApps.size} installed"
    }

    private fun isAppInstalled(pm: PackageManager, packageName: String): Boolean {
        try {
            pm.getPackageInfo(packageName, PackageManager.GET_ACTIVITIES)
            return true
        } catch (e: PackageManager.NameNotFoundException) {
            return false
        }
    }

    private fun launchUPIApp(packageName: String) {
        val pm = packageManager
        val intent = pm.getLaunchIntentForPackage(packageName)
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } else {
            Toast.makeText(this, "Cannot launch $packageName", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
