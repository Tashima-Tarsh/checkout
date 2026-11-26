package com.checkout.upipayment

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import java.net.URL

class UpiPaymentActivity : ComponentActivity() {

    private val upiResultLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val intent = result.data
        val resultCode = result.resultCode

        val tr = intent.getStringExtra("tr") ?: return

        // Extract UTR from UPI app return intent. RESULT_OK alone is NOT
        // proof of debit — we report what the device observed and let the
        // server match VPA+amount before setting financially_verified.
        val upiRef = intent.getStringExtra("upi_ref")
        val status = intent.getStringExtra("status") ?: "pending"

        // Report device evidence to server (auto, no user action required).
        reportDeviceEvidence(tr, upiRef, status)

        // Return to checkout page using server_url from intent (not hardcoded).
        val returnUrl = buildReturnUrl(tr, upiRef ?: "", status)
        val returnIntent = Intent(Intent.ACTION_VIEW, Uri.parse(returnUrl))
        returnIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(returnIntent)
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val intent = intent
        val upiUri = intent.data?.toString() ?: ""

        if (upiUri.isBlank()) {
            Log.e("UpiPayment", "No UPI URI provided")
            finish()
            return
        }

        val uri = Uri.parse(upiUri)
        val pa = uri.getQueryParameter("pa")
        val am = uri.getQueryParameter("am")
        val tr = uri.getQueryParameter("tr")
        val pn = uri.getQueryParameter("pn")
        val sessionId = uri.getQueryParameter("session_id")
        val token = uri.getQueryParameter("token")
        val serverUrl = uri.getQueryParameter("server_url")

        if (pa.isNullOrBlank() || am.isNullOrBlank() || tr.isNullOrBlank()) {
            Log.e("UpiPayment", "Missing required UPI parameters")
            finish()
            return
        }

        // Build UPI intent for the payer's UPI app
        val upiIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("upi://pay?pa=${Uri.encode(pa)}&am=${Uri.encode(am)}&tr=${Uri.encode(tr)}&pn=${Uri.encode(pn ?: "")}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        upiIntent.putExtra("tr", tr)

        if (upiIntent.resolveActivity(packageManager) != null) {
            upiResultLauncher.launch(upiIntent)
        } else {
            Log.e("UpiPayment", "No UPI app found")
            finish()
        }
    }

    private fun buildReturnUrl(tr: String?, upiRef: String, status: String): String {
        val intent = this.intent
        val serverUrl = intent.data?.getQueryParameter("server_url") ?: "https://disha8-2.thenitishkr.in"
        return "$serverUrl/upi-return?tr=$tr&upi_ref=$upiRef&status=$status"
    }

    private fun reportDeviceEvidence(transactionRef: String?, upiRef: String?, status: String?) {
        val utr = upiRef ?: transactionRef
        if (utr == null || utr.length != 12 || !utr.all { it.isDigit() }) {
            Log.d("UpiPayment", "No valid 12-digit UTR found — not reporting device evidence")
            return
        }

        val intent = this.intent
        val uri = Uri.parse(intent.data?.toString() ?: "")
        val sessionId = uri.getQueryParameter("session_id")
        val token = uri.getQueryParameter("token")
        val serverUrl = uri.getQueryParameter("server_url") ?: "https://disha8-2.thenitishkr.in"
        val pa = uri.getQueryParameter("pa") ?: ""
        val am = uri.getQueryParameter("am") ?: ""

        if (sessionId.isNullOrBlank()) {
            Log.d("UpiPayment", "No session context — cannot report device evidence")
            return
        }

        val amountMinor: Int
        try {
            val parts = am.split(".")
            val rupees = parts[0].toInt()
            val paise = if (parts.size > 1) parts[1].padEnd(2, '0').take(2).toInt() else 0
            amountMinor = rupees * 100 + paise
        } catch (_: Exception) {
            Log.e("UpiPayment", "Invalid amount format")
            return
        }

        val payload = """{
            "utr": "$utr",
            "amount_paise": $amountMinor,
            "payee_vpa": "$pa",
            "claimed_paid_at": ${System.currentTimeMillis() / 1000},
            "source": "upi_intent_return"
        }""".trimIndent()

        Thread {
            try {
                val url = URL("$serverUrl/api/sessions/$sessionId/device-evidence")
                val connection = url.openConnection() as java.net.HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                if (token.isNotBlank()) {
                    connection.setRequestProperty("Authorization", "Bearer $token")
                }
                connection.doOutput = true
                connection.outputStream.write(payload.toByteArray())
                val responseCode = connection.responseCode
                Log.d("UpiPayment", "Device evidence reported: $responseCode")
                connection.disconnect()
            } catch (e: Exception) {
                Log.e("UpiPayment", "Failed to report device evidence", e)
            }
        }.start()
    }
}
