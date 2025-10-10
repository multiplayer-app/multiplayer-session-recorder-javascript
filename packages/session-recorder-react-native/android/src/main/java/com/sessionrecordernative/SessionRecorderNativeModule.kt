package com.sessionrecordernative

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.*
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.view.PixelCopy
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.webkit.WebView
import android.widget.*
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.sessionrecordernative.util.ViewUtils
import java.io.ByteArrayOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = SessionRecorderNativeModule.NAME)
class SessionRecorderNativeModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return NAME
    }

    companion object {
        const val NAME = "SessionRecorderNative"
    }

    private val reactContext: ReactApplicationContext = reactContext

    // Configuration object for masking behavior
    private var config: SessionRecorderNativeConfig = SessionRecorderNativeConfig()

    // Gesture recording state
    private var isRecording = false
    private var rootView: ViewGroup? = null
    private var gestureCallback: Callback? = null
    private var originalWindowCallback: android.view.Window.Callback? = null
    private var initialTouchTime = 0L
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var isPanning = false
    private var isLongPressTriggered = false
    private var longPressRunnable: Runnable? = null
    private var handler: android.os.Handler? = null


    @ReactMethod
    fun captureAndMask(promise: Promise) {
        val activity =
                reactContext.currentActivity
                        ?: return promise.reject("NO_ACTIVITY", "No activity found")

        try {
            val maskedImage = captureAndMaskScreen(activity, null)
            promise.resolve(maskedImage)
        } catch (e: Exception) {
            promise.reject("CAPTURE_FAILED", "Failed to capture and mask screen", e)
        }
    }

    @ReactMethod
    fun captureAndMaskWithOptions(options: ReadableMap, promise: Promise) {
        val activity =
                reactContext.currentActivity
                        ?: return promise.reject("NO_ACTIVITY", "No activity found")

        try {
            val maskedImage = captureAndMaskScreen(activity, options)
            promise.resolve(maskedImage)
        } catch (e: Exception) {
            promise.reject("CAPTURE_FAILED", "Failed to capture and mask screen", e)
        }
    }

    // --- Gesture recording API (merged from GestureRecorderModule) ---
    @ReactMethod
    fun startGestureRecording(promise: Promise) {
        val activity =
                reactContext.currentActivity
                        ?: return promise.reject("NO_ACTIVITY", "No activity found")

        try {
            if (isRecording) {
                promise.resolve(null)
                return
            }

            setupGestureListener(activity)
            isRecording = true
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SETUP_FAILED", "Failed to setup gesture recording", e)
        }
    }

    @ReactMethod
    fun stopGestureRecording(promise: Promise) {
        try {
            if (!isRecording) {
                promise.resolve(null)
                return
            }

            removeGestureListener()
            isRecording = false
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("CLEANUP_FAILED", "Failed to cleanup gesture recording", e)
        }
    }

    @ReactMethod
    fun isGestureRecordingActive(promise: Promise) {
        promise.resolve(isRecording)
    }

    @ReactMethod
    fun setGestureCallback(callback: Callback) {
        this.gestureCallback = callback
    }

    @ReactMethod
    fun recordGesture(
            gestureType: String,
            x: Double,
            y: Double,
            target: String?,
            metadata: ReadableMap?
    ) {
        val gestureEvent =
                Arguments.createMap().apply {
                    putString("type", gestureType)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                    putDouble("x", x)
                    putDouble("y", y)
                    putString("target", target ?: "")
                    putMap("metadata", metadata ?: Arguments.createMap())
                }

        sendEvent("onGestureDetected", gestureEvent)
        gestureCallback?.invoke(gestureEvent)
    }

    private fun setupGestureListener(activity: Activity) {
        // Resolve content view for target detection
        rootView =
                activity.findViewById<ViewGroup>(android.R.id.content)
                        ?: throw RuntimeException("Could not get content view")

        handler = android.os.Handler(android.os.Looper.getMainLooper())

        // Intercept MotionEvents at the Window level to observe all touches
        val window = activity.window
        val delegate = window.callback ?: throw RuntimeException("Window callback is null")
        originalWindowCallback = delegate

        window.callback =
                object : android.view.Window.Callback by delegate {
                    override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
                        if (isRecording) {
                            // Use screen pixel coordinates for hit-testing target
                            val screenPointPx = android.graphics.PointF(event.rawX, event.rawY)
                            val target = ViewUtils.findTargetView(screenPointPx, rootView)
                            when (event.action) {
                                android.view.MotionEvent.ACTION_DOWN -> handleTouchDown(event, target)
                                android.view.MotionEvent.ACTION_MOVE -> handleTouchMove(event, target)
                                android.view.MotionEvent.ACTION_UP -> handleTouchUp(event, target)
                                android.view.MotionEvent.ACTION_CANCEL -> handleTouchCancel(event, target)
                            }
                            lastTouchX = event.x
                            lastTouchY = event.y
                        }
                        // Always forward to original callback so we don't block the app
                        return delegate.dispatchTouchEvent(event)
                    }
                }
    }

    private fun removeGestureListener() {
        // Restore original Window callback
        reactContext.currentActivity?.let { activity ->
            val window = activity.window
            originalWindowCallback?.let { original ->
                if (window.callback !== original) {
                    window.callback = original
                }
            }
        }
        originalWindowCallback = null

        // Cleanup root
        rootView = null

        // Cancel any pending long press
        longPressRunnable?.let { handler?.removeCallbacks(it) }
        longPressRunnable = null
        handler = null
    }

    private fun handleTouchDown(
            event: android.view.MotionEvent,
            target: com.sessionrecordernative.model.TargetInfo
    ) {
        val dp = getScreenDpPoint(event)
        initialTouchTime = System.currentTimeMillis()
        initialTouchX = dp.x
        initialTouchY = dp.y
        lastTouchX = dp.x
        lastTouchY = dp.y
        isPanning = false
        isLongPressTriggered = false

        // Schedule long press detection
        longPressRunnable = Runnable {
            if (!isLongPressTriggered && !isPanning) {
                isLongPressTriggered = true
                sendGestureEvent("long_press", dp.x, dp.y, target, createLongPressMetadata())
            }
        }
        handler?.postDelayed(longPressRunnable!!, 500) // 0.5 seconds like iOS
    }

    private fun handleTouchMove(
            event: android.view.MotionEvent,
            target: com.sessionrecordernative.model.TargetInfo
    ) {
        val dp = getScreenDpPoint(event)
        val deltaX = dp.x - initialTouchX
        val deltaY = dp.y - initialTouchY
        val distance = kotlin.math.sqrt(deltaX * deltaX + deltaY * deltaY)

        // Start panning if moved more than 10 pixels
        if (!isPanning && distance > 10) {
            isPanning = true
            // Cancel long press if we start panning
            longPressRunnable?.let { handler?.removeCallbacks(it) }
            sendGestureEvent("pan_start", dp.x, dp.y, target, createPanMetadata(event, deltaX, deltaY))
        } else if (isPanning) {
            sendGestureEvent("pan_move", dp.x, dp.y, target, createPanMetadata(event, deltaX, deltaY))
        }

        lastTouchX = dp.x
        lastTouchY = dp.y
    }

    private fun handleTouchUp(
            event: android.view.MotionEvent,
            target: com.sessionrecordernative.model.TargetInfo
    ) {
        val dp = getScreenDpPoint(event)
        val touchDuration = System.currentTimeMillis() - initialTouchTime
        val deltaX = dp.x - initialTouchX
        val deltaY = dp.y - initialTouchY
        val distance = kotlin.math.sqrt(deltaX * deltaX + deltaY * deltaY)

        // Cancel long press
        longPressRunnable?.let { handler?.removeCallbacks(it) }

        if (isPanning) {
            // End pan gesture
            sendGestureEvent("pan_end", dp.x, dp.y, target, createPanMetadata(event, deltaX, deltaY))
        } else if (distance < 10 && touchDuration < 500 && !isLongPressTriggered) {
            // Single tap (short duration, small movement)
            sendGestureEvent("tap", dp.x, dp.y, target, createTapMetadata())
        }

        // Reset state
        isPanning = false
        isLongPressTriggered = false
    }

    private fun handleTouchCancel(
            event: android.view.MotionEvent,
            target: com.sessionrecordernative.model.TargetInfo
    ) {
        // Cancel long press
        longPressRunnable?.let { handler?.removeCallbacks(it) }

        if (isPanning) {
            val dp = getScreenDpPoint(event)
            val deltaX = dp.x - initialTouchX
            val deltaY = dp.y - initialTouchY
            sendGestureEvent("pan_end", dp.x, dp.y, target, createPanMetadata(event, deltaX, deltaY))
        }

        // Reset state
        isPanning = false
        isLongPressTriggered = false
    }

    private fun getScreenDpPoint(event: android.view.MotionEvent): android.graphics.PointF {
        val density = reactContext.resources.displayMetrics.density
        return android.graphics.PointF(event.rawX / density, event.rawY / density)
    }

    private fun sendGestureEvent(
            gestureType: String,
            x: Float,
            y: Float,
            target: com.sessionrecordernative.model.TargetInfo,
            metadata: WritableMap
    ) {
        val targetInfo =
                Arguments.createMap().apply {
                    putString("identifier", target.identifier)
                    putString("label", target.label)
                    putString("role", target.role)
                    putString("testId", target.testId)
                    putString("text", target.text)
                }

        val gestureEvent =
                Arguments.createMap().apply {
                    putString("type", gestureType)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                    putDouble("x", x.toDouble())
                    putDouble("y", y.toDouble())
                    putString("target", target.identifier)
                    putMap("targetInfo", targetInfo)
                    putMap("metadata", metadata)
                }

        sendEvent("onGestureDetected", gestureEvent)
        gestureCallback?.invoke(gestureEvent)
    }

    private fun createTapMetadata(): WritableMap {
        return Arguments.createMap().apply { putDouble("pressure", 1.0) }
    }

    private fun createLongPressMetadata(): WritableMap {
        return Arguments.createMap().apply {
            putDouble("duration", 0.5)
            putDouble("pressure", 1.0)
        }
    }

    private fun createPanMetadata(event: android.view.MotionEvent, deltaX: Float, deltaY: Float): WritableMap {
        val velocity = kotlin.math.sqrt(deltaX * deltaX + deltaY * deltaY)
        return Arguments.createMap().apply {
            putDouble("velocity", velocity.toDouble())
            putDouble("deltaX", deltaX.toDouble())
            putDouble("deltaY", deltaY.toDouble())
            putDouble("pressure", event.pressure.toDouble())
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN event emitter contracts
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN event emitter contracts
    }

    private fun captureAndMaskScreen(activity: Activity, options: ReadableMap?): String {
        // Update configuration from options
        updateConfiguration(options)

        val rootView = activity.window.decorView.rootView
        val window = activity.window

        // Capture bitmap
        val bitmap =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                captureWithPixelCopy(rootView, window)
            } else {
                captureWithDrawingCache(rootView)
            }

        bitmap ?: throw RuntimeException("Failed to capture screen")

        // Apply masking
        val maskedBitmap = applyMasking(bitmap, rootView, options)

        // Apply optional scaling (resolution downsample)
        val finalBitmap =
            if (config.scale < 1.0f) resizeBitmap(maskedBitmap, config.scale) else maskedBitmap

        // Convert to base64 with compression
        val output = ByteArrayOutputStream()
        val quality = (config.imageQuality * 100).toInt().coerceIn(1, 100)
        finalBitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)
        val base64 = Base64.encodeToString(output.toByteArray(), Base64.DEFAULT)

        // Clean up memory
        if (finalBitmap != maskedBitmap) maskedBitmap.recycle()

        return base64
    }

    private fun resizeBitmap(bitmap: Bitmap, scale: Float): Bitmap {
        val width = (bitmap.width * scale).toInt().coerceAtLeast(1)
        val height = (bitmap.height * scale).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, width, height, true)
    }

    @SuppressLint("NewApi")
    private fun captureWithPixelCopy(rootView: View, window: Window): Bitmap? {
        val bitmap = Bitmap.createBitmap(rootView.width, rootView.height, Bitmap.Config.ARGB_8888)
        val latch = CountDownLatch(1)
        var success = false

        val thread = HandlerThread("SessionRecorderScreenshot")
        thread.start()
        val handler = Handler(thread.looper)

        try {
            PixelCopy.request(
                    window,
                    bitmap,
                    { copyResult ->
                        try {
                            success = copyResult == PixelCopy.SUCCESS
                        } catch (e: Exception) {
                            success = false
                        } finally {
                            latch.countDown()
                        }
                    },
                    handler
            )

            // Wait for capture to complete (max 2 seconds)
            latch.await(2, TimeUnit.SECONDS)

            return if (success) bitmap else null
        } catch (e: Exception) {
            bitmap.recycle()
            return null
        } finally {
            thread.quit()
        }
    }

    @Suppress("DEPRECATION")
    private fun captureWithDrawingCache(rootView: View): Bitmap? {
        return try {
            // Enable drawing cache
            rootView.isDrawingCacheEnabled = true
            rootView.buildDrawingCache()

            val bitmap = Bitmap.createBitmap(rootView.drawingCache)
            rootView.isDrawingCacheEnabled = false
            bitmap
        } catch (e: Exception) {
            rootView.isDrawingCacheEnabled = false
            null
        }
    }

    private fun updateConfiguration(options: ReadableMap?) {
        options?.let { opts ->
            config =
                    SessionRecorderNativeConfig(
                            maskTextInputs =
                                    if (opts.hasKey("maskTextInputs"))
                                            opts.getBoolean("maskTextInputs")
                                    else config.maskTextInputs,
                            maskImages =
                                    if (opts.hasKey("maskImages")) opts.getBoolean("maskImages")
                                    else config.maskImages,
                            maskButtons =
                                    if (opts.hasKey("maskButtons")) opts.getBoolean("maskButtons")
                                    else config.maskButtons,
                            maskWebViews =
                                    if (opts.hasKey("maskWebViews")) opts.getBoolean("maskWebViews")
                                    else config.maskWebViews,
                            imageQuality =
                                    if (opts.hasKey("quality")) opts.getDouble("quality").toFloat()
                                    else config.imageQuality,
                            noCaptureLabel =
                                    if (opts.hasKey("noCaptureLabel"))
                                            opts.getString("noCaptureLabel") ?: "no-capture"
                                    else config.noCaptureLabel,
                            scale =
                                    if (opts.hasKey("scale")) opts.getDouble("scale").toFloat()
                                    else config.scale
                    )
        }
    }

    private fun applyMasking(bitmap: Bitmap, rootView: View, options: ReadableMap?): Bitmap {
        val maskedBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(maskedBitmap)

        // Find maskable widgets
        val maskableWidgets = mutableListOf<Rect>()
        findMaskableWidgets(rootView, rootView, maskableWidgets)

        for (frame in maskableWidgets) {
            // Skip zero rects (which indicate invalid coordinates)
            if (frame.isEmpty) continue

            // Validate frame dimensions before processing
            if (!frame.isValid()) continue

            // Clip the frame to the image bounds to avoid drawing outside context
            val clippedFrame =
                    Rect(
                            frame.left.coerceAtLeast(0),
                            frame.top.coerceAtLeast(0),
                            frame.right.coerceAtMost(bitmap.width),
                            frame.bottom.coerceAtMost(bitmap.height)
                    )

            if (clippedFrame.isEmpty) continue

            applyCleanMask(canvas, clippedFrame)
        }

        return maskedBitmap
    }

    private fun findMaskableWidgets(
            view: View,
            rootView: View,
            maskableWidgets: MutableList<Rect>,
            visitedViews: MutableSet<Int> = mutableSetOf()
    ) {
        val viewId = System.identityHashCode(view)

        // Check for cycles to prevent stack overflow
        if (viewId in visitedViews) {
            return
        }
        visitedViews.add(viewId)

        // Skip hidden or transparent views
        if (!view.isVisible()) {
            return
        }

        // Masking logic - clean and organized
        when {
            view is EditText && view.shouldMaskEditText() -> {
                maskableWidgets.add(view.toAbsoluteRect(rootView))
                return
            }
            view is Button && view.shouldMaskButton() -> {
                maskableWidgets.add(view.toAbsoluteRect(rootView))
                return
            }
            view is ImageView && view.shouldMaskImage() -> {
                maskableWidgets.add(view.toAbsoluteRect(rootView))
                return
            }
            view is WebView && view.shouldMaskWebView() -> {
                maskableWidgets.add(view.toAbsoluteRect(rootView))
                return
            }
        }

        // Detect React Native views
        if (isReactNativeView(view)) {
            if (shouldMaskReactNativeView(view)) {
                maskableWidgets.add(view.toAbsoluteRect(rootView))
                return
            }
        }

        // Recursively check subviews
        if (view is ViewGroup) {
            try {
                val childCount = view.childCount
                for (i in 0 until childCount) {
                    try {
                        val child = view.getChildAt(i)
                        if (child != null && child.isVisible()) {
                            findMaskableWidgets(child, rootView, maskableWidgets, visitedViews)
                        }
                    } catch (e: IndexOutOfBoundsException) {
                        // Skip this child if it's no longer valid
                        continue
                    } catch (e: Exception) {
                        // Skip this child if any other error occurs
                        continue
                    }
                }
            } catch (e: Exception) {
                // If we can't iterate through children, just skip this view group
                return
            }
        }
    }

    // MARK: - Sensitive Content Detection Methods

    private fun View.isAnyInputSensitive(): Boolean {
        return this.isTextInputSensitive() || config.maskImages
    }

    private fun View.isTextInputSensitive(): Boolean {
        return config.maskTextInputs && this is EditText
    }

    // Masking methods for different view types
    private fun Button.shouldMaskButton(): Boolean {
        return config.maskButtons || this.isExplicitlyMasked(config.noCaptureLabel)
    }

    private fun ImageView.shouldMaskImage(): Boolean {
        return config.maskImages || this.isExplicitlyMasked(config.noCaptureLabel)
    }

    private fun WebView.shouldMaskWebView(): Boolean {
        return config.maskWebViews || this.isExplicitlyMasked(config.noCaptureLabel)
    }

    private fun EditText.shouldMaskEditText(): Boolean {
        return this.isTextInputSensitive() || this.isExplicitlyMasked(config.noCaptureLabel)
    }

    // Check if view is explicitly marked as sensitive
    private fun View.isExplicitlyMasked(noCaptureLabel: String = "no-capture"): Boolean {
        return (tag as? String)?.lowercase()?.contains(noCaptureLabel.lowercase()) == true ||
                contentDescription?.toString()?.lowercase()?.contains(noCaptureLabel.lowercase()) ==
                        true
    }

    private fun hasText(text: String?): Boolean {
        return !text.isNullOrEmpty()
    }

    private fun isReactNativeView(view: View): Boolean {
        // Check for React Native view class names
        val className = view.javaClass.simpleName
        return className.contains("React") || className.contains("RCT")
    }

    private fun shouldMaskReactNativeView(view: View): Boolean {
        val className = view.javaClass.simpleName

        // React Native input views: only treat EditText-like classes as inputs.
        // Examples: ReactEditText, EditText, TextInputEditText
        if (className.contains("EditText") ||
                        className.contains("ReactEditText") ||
                        className.contains("TextInputEditText") ||
                        // Some RN implementations may expose TextInput class names without TextView
                        // suffix
                        (className.contains("TextInput") && !className.contains("TextView"))
        ) {
            return config.maskTextInputs
        }

        // Do NOT mask generic ReactTextView labels when maskTextInputs is enabled
        // Only mask images when explicitly configured
        if (className.contains("ImageView") || className.contains("Image")) {
            return config.maskImages
        }

        return false
    }

    private fun applyCleanMask(canvas: Canvas, frame: Rect) {
        // Final validation before drawing to prevent Canvas errors
        if (!frame.isValid()) return

        // Clean, consistent solid color masking approach
        // Use system gray colors that adapt to light/dark mode
        val paint =
                Paint().apply {
                    color = Color.parseColor("#F5F5F5") // Light gray background
                }
        canvas.drawRect(frame, paint)

        // Add subtle border for visual definition
        paint.apply {
            color = Color.parseColor("#E0E0E0") // Slightly darker gray border
            style = Paint.Style.STROKE
            strokeWidth = 1f
        }
        canvas.drawRect(frame, paint)
    }

    private enum class MaskingType {
        BLUR,
        RECTANGLE,
        PIXELATE,
        NONE
    }
}

// Extension functions for View
private fun View.isVisible(): Boolean {
    try {
        // Check for NaN values in dimensions
        val width = width.toFloat()
        val height = height.toFloat()

        // Validate that dimensions are finite numbers (not NaN or infinite)
        if (width.isNaN() || height.isNaN() || width.isInfinite() || height.isInfinite()) {
            return false
        }

        return visibility == View.VISIBLE && alpha > 0.01f && width > 0 && height > 0
    } catch (e: Exception) {
        // If we can't determine visibility, assume it's not visible
        return false
    }
}

private fun View.isViewStateStableForMatrixOperations(): Boolean {
    return try {
        isAttachedToWindow &&
                isLaidOut &&
                // Check if view has valid dimensions
                width > 0 &&
                height > 0 &&
                // Check if view is not in layout transition
                !isInLayout &&
                // Check if view doesn't have transient state (animations, etc.)
                !hasTransientState() &&
                // Check if view is not currently being animated
                !isAnimationRunning() &&
                // Check if view tree is not currently computing layout
                !isComputingLayout() &&
                // Check if view hierarchy is stable
                rootView?.isAttachedToWindow == true
    } catch (e: Throwable) {
        // If any check fails, assume unstable state
        false
    }
}

private fun View.isAnimationRunning(): Boolean {
    return try {
        animation?.hasStarted() == true && animation?.hasEnded() != true
    } catch (e: Throwable) {
        false
    }
}

private fun View.isComputingLayout(): Boolean {
    return try {
        // Check if direct parent ViewGroup is in layout
        (parent as? ViewGroup)?.isInLayout == true
    } catch (e: Throwable) {
        false
    }
}

private fun View.toAbsoluteRect(rootView: View): Rect {
    try {
        val location = IntArray(2)

        // Use stable view state check before accessing location
        if (isViewStateStableForMatrixOperations()) {
            getLocationOnScreen(location)
        } else {
            // Use zero coordinates as fallback when view state is unstable
            location[0] = 0
            location[1] = 0
        }

        val rootLocation = IntArray(2)
        rootView.getLocationOnScreen(rootLocation)

        // Convert to relative coordinates within the root view
        val relativeX = location[0] - rootLocation[0]
        val relativeY = location[1] - rootLocation[1]

        // Validate bounds before conversion to prevent NaN values
        val width = this.width.toFloat()
        val height = this.height.toFloat()

        if (width.isNaN() ||
                        height.isNaN() ||
                        width.isInfinite() ||
                        height.isInfinite() ||
                        relativeX.toFloat().isNaN() ||
                        relativeY.toFloat().isNaN() ||
                        relativeX.toFloat().isInfinite() ||
                        relativeY.toFloat().isInfinite()
        ) {
            return Rect()
        }

        return Rect(relativeX, relativeY, relativeX + width.toInt(), relativeY + height.toInt())
    } catch (e: Exception) {
        // If we can't get the rect, return empty rect
        return Rect()
    }
}

private fun View.isNoCapture(): Boolean {
    // Check for common patterns that indicate sensitive content

    // Check content description for sensitive keywords
    contentDescription?.toString()?.lowercase()?.let { desc ->
        val sensitiveKeywords = listOf("password", "secret", "private", "sensitive", "confidential")
        if (sensitiveKeywords.any { desc.contains(it) }) {
            return true
        }
    }

    // Check for secure text entry in EditText
    if (this is EditText) {
        val inputType = inputType
        return (inputType and android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD) != 0 ||
                (inputType and android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD) != 0
    }

    // Check for password-related tag or accessibility identifier
    tag?.toString()?.lowercase()?.let { tag ->
        val sensitiveIdentifiers =
                listOf("password", "secret", "private", "sensitive", "confidential")
        if (sensitiveIdentifiers.any { tag.contains(it) }) {
            return true
        }
    }

    return false
}

private fun View.isSensitiveText(): Boolean {
    // Check if this view contains sensitive text content
    if (this is EditText) {
        return isSecureTextEntry() || isNoCapture()
    }

    return false
}

private fun EditText.isSecureTextEntry(): Boolean {
    val inputType = inputType
    return (inputType and android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD) != 0 ||
            (inputType and android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD) != 0
}

private fun Rect.isValid(): Boolean {
    return left >= 0 && top >= 0 && right > left && bottom > top && width() > 0 && height() > 0
}

private fun Int.isFinite(): Boolean {
    return this != Int.MAX_VALUE && this != Int.MIN_VALUE
}

private fun Float.isFinite(): Boolean {
    return !this.isNaN() && !this.isInfinite()
}
