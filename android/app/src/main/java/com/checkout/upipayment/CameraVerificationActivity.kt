package com.checkout.upipayment

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.ImageReader
import android.os.Bundle
import android.util.Log
import android.util.Size
import android.view.Surface
import android.view.TextureView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.Lifecycle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraVerificationActivity : ComponentActivity() {

    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    private var preview: Preview? = null
    private var imageAnalyzer: ImageAnalysis? = null
    private var cameraSelector: CameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var textureView: TextureView? = null
    private var barcodeScanner: BarcodeScanner? = null
    private var textRecognizer: TextRecognizer? = null
    private var isProcessing = false
    private var verificationResult: VerificationResult? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(com.checkout.upipayment.R.layout.activity_camera_verification)
        
        // Initialize ML Kit components
        barcodeScanner = BarcodeScanning.getClient()
        textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        
        // Initialize camera
        startCamera()
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            cameraProvider = cameraProviderFuture.get()
            bindCameraUseCases()
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCameraUseCases() {
        val cameraProvider = cameraProvider ?: return
        
        // Preview
        val preview = Preview.Builder().build()
        textureView = findViewById(R.id.textureView)
        preview.setSurfaceProvider(textureView?.surfaceProvider)
        
        // Image Analysis for OCR/Barcode
        val imageAnalyzer = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setTargetResolution(Size(1280, 720))
            .build()
        
        imageAnalyzer = imageAnalyzer
        imageAnalyzer.setAnalyzer(cameraExecutor) { imageProxy ->
            analyzeImage(imageProxy)
            imageProxy.close()
        }
        
        // Camera Selector
        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
        
        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, Preview.Builder().build(), ImageAnalysis.Builder().build().also {
                it.setAnalyzer(cameraExecutor) { imageProxy ->
                    analyzeImage(imageProxy)
                    imageProxy.close()
                })
        } catch (e: Exception) {
            Log.e("CameraVerification", "Camera bind failed", e)
        }
    }

    private fun analyzeImage(imageProxy: ImageProxy) {
        if (isProcessing) return
        isProcessing = true
        
        val mediaImage = imageProxy.image ?: return
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        
        // Barcode scanning for UTR/Reference
        barcodeScanner?.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    val rawValue = barcode.rawValue ?: continue
                    if (rawValue.length == 12 && rawValue.all { it.isDigit() }) {
                        // Found UTR - 12 digit reference
                        Log.d("CameraVerification", "Found UTR: $rawValue")
                        // This is evidence for verification, NOT proof of payment by itself
                    }
                }
            }
            .addOnFailureListener { e ->
                Log.e("CameraVerification", "Barcode scanning failed", e)
            }
            .addOnCompleteListener {
                isProcessing = false
            }
        
        // Text recognition for amount and VPA
        textRecognizer?.process(image)
            .addOnSuccessListener { text ->
                for (element in text.textBlocks) {
                    val text = element.text
                    // Extract amount, VPA, etc. - this is evidence for verification
                }
            }
            .addOnFailureListener { e ->
                Log.e("CameraVerification", "Text recognition failed", e)
            }
    }

    /**
     * Called when user returns from UPI app - RESULT_OK is NOT proof of actual bank debit
     * This is called when user returns from UPI app, but we need actual evidence
     * from OCR/barcode/sound/color detection to verify payment
     */
    fun onUpiReturn(resultCode: Int, data: Intent?) {
        val verificationResult = VerificationResult(
            resultCode = resultCode,
            hasOcrEvidence = false,
            hasBarcodeEvidence = false,
            hasSoundEvidence = false,
            hasColorPatternEvidence = false
        )
        
        // RESULT_OK alone is NOT proof of payment - we need actual evidence
        // The verification engine will evaluate all evidence together
        this.verificationResult = verificationResult
        
        // Continue with camera/sound/color verification
        startCamera()
        startSoundDetection()
        startColorPatternDetection()
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            cameraProvider = cameraProviderFuture.get()
            bindCameraUseCases()
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCameraUseCases() {
        val cameraProvider = cameraProvider ?: return
        
        // Preview
        val preview = Preview.Builder().build()
        textureView = findViewById(R.id.textureView)
        preview.setSurfaceProvider(textureView?.surfaceProvider)
        
        // Image Analysis for OCR/Barcode
        val imageAnalyzer = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setTargetResolution(Size(1280, 720))
            .build()
        
        imageAnalyzer = imageAnalyzer
        imageAnalyzer.setAnalyzer(cameraExecutor) { imageProxy ->
            analyzeImage(imageProxy)
            imageProxy.close()
        }
        
        // Camera Selector
        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
        
        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, Preview.Builder().build(), ImageAnalysis.Builder().build().also {
                it.setAnalyzer(cameraExecutor) { imageProxy ->
                    analyzeImage(imageProxy)
                    imageProxy.close()
                })
        } catch (e: Exception) {
            Log.e("CameraVerification", "Camera bind failed", e)
        }
    }

    private fun analyzeImage(imageProxy: ImageProxy) {
        if (isProcessing) return
        isProcessing = true
        
        val mediaImage = imageProxy.image ?: return
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        
        // Barcode scanning for UTR/Reference
        barcodeScanner?.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    val rawValue = barcode.rawValue ?: continue
                    if (rawValue.length == 12 && rawValue.all { it.isDigit() }) {
                        // Found UTR - 12 digit reference
                        Log.d("CameraVerification", "Found UTR: $rawValue")
                        // This is evidence for verification, NOT proof of payment by itself
                    }
                }
            }
            .addOnFailureListener { e ->
                Log.e("CameraVerification", "Barcode scanning failed", e)
            }
            .addOnCompleteListener {
                isProcessing = false
            }
        
        // Text recognition for amount and VPA
        textRecognizer?.process(image)
            .addOnSuccessListener { text ->
                for (element in text.textBlocks) {
                    val text = element.text
                    // Extract amount, VPA, etc. - evidence for verification
                }
            }
            .addOnFailureListener { e ->
                Log.e("CameraVerification", "Text recognition failed", e)
            }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}