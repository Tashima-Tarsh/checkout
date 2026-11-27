package com.agentic.pay.connectivitytest

import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import kotlin.concurrent.thread

object ApiClient {
    private const val TAG = "ApiClient"
    private val gson = Gson()

    sealed class Result<out T> {
        data class Success<T>(val value: T) : Result<T>()
        data class Error(val message: String) : Result<Nothing>()
    }

    private fun httpPost(path: String, body: Map<String, Any?>, authToken: String? = null): Result<String> {
        return try {
            val url = URL(DeviceConfig.backendUrl + path)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000
            conn.instanceFollowRedirects = false
            conn.doOutput = true
            authToken?.let { conn.setRequestProperty(DeviceConfig.AUTH_HEADER, DeviceConfig.BEARER_PREFIX + it) }
            val json = gson.toJson(body)
            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(json) }
            val responseCode = conn.responseCode
            val responseBody = (if (responseCode in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            if (responseCode in 200..299) {
                Result.Success(responseBody)
            } else {
                Result.Error("HTTP $responseCode")
            }
        } catch (e: Exception) {
            Result.Error("Connection failed: ${e.javaClass.simpleName} - ${e.message}")
        }
    }

    private fun httpGet(path: String, authToken: String? = null): Result<String> {
        return try {
            val url = URL(DeviceConfig.backendUrl + path)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Accept", "application/json")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000
            conn.instanceFollowRedirects = false
            authToken?.let { conn.setRequestProperty(DeviceConfig.AUTH_HEADER, DeviceConfig.BEARER_PREFIX + it) }
            val responseCode = conn.responseCode
            val responseBody = (if (responseCode in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            if (responseCode in 200..299) {
                Result.Success(responseBody)
            } else {
                Result.Error("HTTP $responseCode")
            }
        } catch (e: Exception) {
            Result.Error("Connection failed: ${e.javaClass.simpleName} - ${e.message}")
        }
    }

    fun generatePairingCode(agentId: String, callback: (Result<String>) -> Unit) {
        thread {
            val result = httpPost("/api/android/devices/pairing", mapOf("agent_id" to agentId))
            callback(result)
        }
    }

    fun pairDevice(code: String, deviceId: String, publicKeyPem: String, appVersion: String?, callback: (Result<String>) -> Unit) {
        thread {
            val body = mutableMapOf<String, Any?>(
                "code" to code,
                "device_id" to deviceId,
                "public_key_pem" to publicKeyPem,
            )
            if (appVersion != null) body["app_version"] = appVersion
            val result = httpPost("/api/android/pair", body)
            callback(result)
        }
    }

    fun heartbeat(credential: String, callback: (Result<String>) -> Unit) {
        thread {
            val result = httpPost("/api/android/heartbeat", emptyMap(), credential)
            callback(result)
        }
    }

    fun submitObservation(credential: String, observation: DeviceObservation, callback: (Result<String>) -> Unit) {
        thread {
            val body = mapOf(
                "order_id" to observation.orderId,
                "account_id" to observation.accountId,
                "amount_paise" to observation.amountPaise,
                "currency" to observation.currency,
                "transaction_reference" to observation.transactionReference,
                "observation_direction" to observation.observationDirection,
                "evidence_provenance" to observation.evidenceProvenance,
                "observation_timestamp" to observation.observationTimestamp,
                "checkout_created" to observation.checkoutCreated,
                "checkout_expires" to observation.checkoutExpires,
            )
            val result = httpPost("/api/android/observations", body, credential)
            callback(result)
        }
    }

    fun fetchDeviceStatus(credential: String, callback: (Result<String>) -> Unit) {
        thread {
            val result = httpGet("/api/android/device/status", credential)
            callback(result)
        }
    }

    /** Register the agent's UPI + mobile number as a receiving account. */
    fun registerUpi(credential: String, upiId: String, mobileNumber: String,
                    accountHolder: String, bankName: String, accountNumber: String,
                    callback: (Result<String>) -> Unit) {
        thread {
            val body = mapOf(
                "upi_id" to upiId,
                "mobile_number" to mobileNumber,
                "account_holder" to accountHolder,
                "bank_name" to bankName,
                "account_number" to accountNumber,
            )
            val result = httpPost("/api/android/register-upi", body, credential)
            callback(result)
        }
    }

    /** Fetch daily collection limit status for the device's merchant. */
    fun dailyLimit(credential: String, callback: (Result<String>) -> Unit) {
        thread {
            val result = httpGet("/api/android/daily-limit", credential)
            callback(result)
        }
    }

    /** Create a checkout order. Returns order id and checkout path. */
    fun createOrder(credential: String, amountPaise: Long, accountId: String, mode: String = "P2P",
                    callback: (Result<String>) -> Unit) {
        thread {
            val body = mapOf(
                "account_id" to accountId,
                "amount_minor" to amountPaise,
                "shared_amount" to false,
                "mode" to mode,
            )
            val result = httpPost("/api/orders", body, credential)
            callback(result)
        }
    }

    /** Agent-initiated refund for a failed or disputed payment. */
    fun refund(orderId: String, reason: String, credential: String, callback: (Result<String>) -> Unit) {
        thread {
            val body = mapOf(
                "order_id" to orderId,
                "reason" to reason,
            )
            val result = httpPost("/api/android/refund", body, credential)
            callback(result)
        }
    }

    /** Fetch checkout / order status by order id. */
    fun getCheckout(orderId: String, credential: String, callback: (Result<String>) -> Unit) {
        thread {
            val result = httpGet("/api/checkout/$orderId", credential)
            callback(result)
        }
    }

    /** Queue a payment email notification for the device's merchant. */
    fun emailNotify(orderId: String, status: String, credential: String, callback: (Result<String>) -> Unit) {
        thread {
            val body = mapOf(
                "order_id" to orderId,
                "status" to status,
            )
            val result = httpPost("/api/android/email-notify", body, credential)
            callback(result)
        }
    }

    /** Intelligent UPI routing: returns the best UPI ID for a transaction. */
    fun upiRoute(credential: String, amountPaise: Long, mode: String = "P2P",
                 callback: (Result<String>) -> Unit) {
        thread {
            val body = mapOf(
                "amount_minor" to amountPaise,
                "mode" to mode,
            )
            val result = httpPost("/api/android/upi-route", body, credential)
            callback(result)
        }
    }

    /** Report transaction result for a routed UPI (success/failure). */
    fun upiResult(credential: String, upiId: String, success: Boolean,
                  orderId: String?, callback: (Result<String>) -> Unit) {
        thread {
            val body = mutableMapOf<String, Any?>(
                "upi_id" to upiId,
                "success" to success,
            )
            if (orderId != null) body["order_id"] = orderId
            val result = httpPost("/api/android/upi-result", body, credential)
            callback(result)
        }
    }

    /** Return all registered UPI IDs with their current health status. */
    fun upiPool(credential: String, callback: (Result<String>) -> Unit) {
        thread {
            val result = httpGet("/api/android/upi-pool", credential)
            callback(result)
        }
    }

    /** Generate and email daily P2P/P2M report to merchant owner. */
    fun dailyReport(credential: String, callback: (Result<String>) -> Unit) {
        thread {
            val result = httpPost("/api/android/daily-report", emptyMap(), credential)
            callback(result)
        }
    }

    data class DeviceObservation(
        val orderId: String,
        val accountId: String,
        val amountPaise: Int,
        val currency: String = "INR",
        val transactionReference: String? = null,
        val observationDirection: String = "incoming",
        val evidenceProvenance: String = "user_authorized",
        val observationTimestamp: Long = System.currentTimeMillis() / 1000,
        val checkoutCreated: Long = 0,
        val checkoutExpires: Long = 0,
    )

    data class OrderResult(
        val id: String,
        val checkoutPath: String,
        val payableMinor: Long,
        val upiId: String? = null,
        val mode: String? = null,
    )

    data class DailyLimit(
        val merchantId: String,
        val collectedTodayPaise: Long,
        val collectedTodayRupees: Double,
        val dailyLimitPaise: Long,
        val dailyLimitRupees: Double,
        val remainingPaise: Long,
        val canCollect: Boolean,
    )

    data class UpiRouteResult(
        val upiId: String,
        val merchantId: String,
        val amountMinor: Long,
        val cooldownSeconds: Long,
        val cooldownUntil: Long,
        val correlationId: String,
        val dailyCount: Long,
        val dailyVolume: Long,
    )

    data class UpiPoolEntry(
        val upiId: String,
        val dailyCount: Int,
        val dailyVolume: Long,
        val dailyVolumeLimit: Long,
        val dailyTxnLimit: Int,
        val cooldownUntil: Long,
        val penaltyUntil: Long,
        val blacklisted: Boolean,
        val successRate: Double,
        val lastTransaction: Long,
        val available: Boolean,
    )

    data class DailyReport(
        val merchantId: String,
        val businessName: String?,
        val email: String?,
        val date: Long,
        val p2pCollectedRupees: Double,
        val p2pTxnCount: Int,
        val p2pLimitRupees: Double,
        val p2pLimitReached: Boolean,
        val p2mCollectedRupees: Double,
        val p2mTxnCount: Int,
        val upiSummary: List<Map<String, Any?>>,
        val emailQueued: Boolean,
        val emailTo: String?,
        val generatedAt: Long,
    )
}
