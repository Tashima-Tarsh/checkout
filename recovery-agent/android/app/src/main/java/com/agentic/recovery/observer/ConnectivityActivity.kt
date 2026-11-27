package com.agentic.recovery.observer
import android.app.Activity
import android.os.Bundle
import android.widget.*
import java.net.URL
import javax.net.ssl.HttpsURLConnection

class ConnectivityActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32,32,32,32) }
        val status = TextView(this).apply { text = "Agentic Pay connectivity test. No payment data is collected."; textSize = 18f }
        val button = Button(this).apply { text = "Test Railway connection" }
        layout.addView(status); layout.addView(button); setContentView(layout)
        button.setOnClickListener {
            button.isEnabled = false
            Thread {
                val result = try {
                    val conn = URL("https://agenticpay.thenitishkr.in/healthz").openConnection() as HttpsURLConnection
                    conn.connectTimeout = 8000; conn.readTimeout = 8000; conn.instanceFollowRedirects = false
                    try { if (conn.responseCode == 200) "Railway API reachable. Device enrollment and payment observation are not enabled." else "Server returned HTTP " + conn.responseCode } finally { conn.disconnect() }
                } catch (e: Exception) { "Connection failed: " + e.javaClass.simpleName }
                runOnUiThread { status.text = result; button.isEnabled = true }
            }.start()
        }
    }
}