package com.sonora.music

import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity
import org.json.JSONObject

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Configure Edge-to-Edge display with SONORA pure black (#000000) styling
        configureSystemBars()

        // 2. Hardware Back Button Routing for Single-Page Navigation
        configureBackPressNavigation()

        // 3. Optimize WebView for Smooth Audio Streaming and Zero-Delay Playback
        configureWebView()

        // 4. Inject Kotlin Native Bridge into the Web Layer
        bridge?.webView?.addJavascriptInterface(SonoraNativeBridge(this), "SonoraNative")
    }

    private fun configureSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        val controller = WindowCompat.getInsetsController(window, window.decorView)
        // False = white/light text and icons on the dark/black status bar
        controller.isAppearanceLightStatusBars = false
        controller.isAppearanceLightNavigationBars = false
    }

    private fun configureBackPressNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val webView = bridge?.webView
                if (webView != null && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun configureWebView() {
        bridge?.webView?.settings?.apply {
            domStorageEnabled = true
            databaseEnabled = true
            // Allows track transitions without requiring manual user touch per song
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        bridge?.webView?.setBackgroundColor(Color.BLACK)
    }

    /**
     * Native Kotlin Bridge accessible in JavaScript via `window.SonoraNative`
     */
    inner class SonoraNativeBridge(private val context: Context) {

        @JavascriptInterface
        fun isNativeAndroid(): Boolean = true

        @JavascriptInterface
        fun getDeviceInfo(): String {
            val json = JSONObject()
            json.put("platform", "Android")
            json.put("osVersion", Build.VERSION.RELEASE)
            json.put("sdkInt", Build.VERSION.SDK_INT)
            json.put("device", Build.DEVICE)
            json.put("model", Build.MODEL)
            json.put("manufacturer", Build.MANUFACTURER)
            return json.toString()
        }

        @JavascriptInterface
        fun triggerHaptic(style: String?) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                    val vibrator = vibratorManager?.defaultVibrator
                    val effect = when (style) {
                        "heavy" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                        "double" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)
                        else -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                    }
                    vibrator?.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(25)
                }
            } catch (_: Exception) {
                // Silently fallback if device lacks vibrator
            }
        }

        @JavascriptInterface
        fun showNativeToast(message: String) {
            runOnUiThread {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }
    }
}
