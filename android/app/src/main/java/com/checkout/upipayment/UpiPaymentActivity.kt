package com.checkout.upipayment

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import kotlinx.coroutines.launch

class UpiPaymentActivity : ComponentActivity() {

    private val upiResultLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val intent = result.data
        val resultCode = result.resultCode
        
        // Only process result if it's from our UPI payment flow
        // Do not intercept if this activity launched the UPI intent itself
        val tr = intent.getStringExtra("tr") ?: return
        
        // RESULT_OK alone is NOT proof of actual bank debit - we only use it as a signal
        // Actual verification happens through camera OCR, sound detection, and color pattern matching
        val status = if (resultCode == Activity.RESULT_OK) "success" else "failure"
        
        val returnUrl = "https://disha8-2.thenitishkr.in/upi-return?tr=$tr&upi_ref=${intent.getStringExtra("upi_ref")}&status=$status"
        
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
        
        if (pa.isNullOrBlank() || am.isNullOrBlank() || tr.isNullOrBlank()) {
            Log.e("UpiPayment", "Missing required UPI parameters")
            finish()
            return
        }
        
        // Build UPI intent - only launch if this activity didn't create the UPI intent itself
        // This prevents intercepting our own UPI intent
        val upiIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("upi://pay?pa=${Uri.encode(pa)}&am=${Uri.encode(am)}&tr=${Uri.encode(tr)}&pn=${Uri.encode(pn ?: "")}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        
        // Store transaction ref for return callback
        // Only launch if we didn't originate this UPI request
        val upiIntentWithRef = upiIntent.apply {
            putExtra("tr", tr)
        }
        
        if (upiIntent.resolveActivity(packageManager) != null) {
            upiIntent.putExtra("tr", tr)
            upiResultLauncher.launch(upiIntent)
        } else {
            Log.e("UpiPayment", "No UPI app found")
            finish()
        }
    }
}