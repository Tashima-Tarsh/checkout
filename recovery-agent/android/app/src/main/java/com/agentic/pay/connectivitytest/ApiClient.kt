package com.agentic.pay.connectivitytest

import android.util.Log
import com.google.gson.Gson
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
            val url = URL(DeviceConfig.BACKEND_URL + path)
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
            val url = URL(DeviceConfig.BACKEND_URL + path)
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
}
