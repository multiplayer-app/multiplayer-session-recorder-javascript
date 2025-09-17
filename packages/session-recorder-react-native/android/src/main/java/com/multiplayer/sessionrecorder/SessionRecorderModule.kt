package com.multiplayer.sessionrecorder

import android.app.Activity
import android.graphics.*
import android.util.Base64
import android.view.View
import android.widget.EditText
import android.widget.TextView
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class SessionRecorderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SessionRecorderNative"

    @ReactMethod
    fun captureAndMask(promise: Promise) {
        val activity = currentActivity ?: return promise.reject("NO_ACTIVITY", "No activity found")

        try {
            val maskedImage = captureAndMaskScreen(activity, null)
            promise.resolve(maskedImage)
        } catch (e: Exception) {
            promise.reject("CAPTURE_FAILED", "Failed to capture and mask screen", e)
        }
    }

    @ReactMethod
    fun captureAndMaskWithOptions(options: ReadableMap, promise: Promise) {
        val activity = currentActivity ?: return promise.reject("NO_ACTIVITY", "No activity found")

        try {
            val maskedImage = captureAndMaskScreen(activity, options)
            promise.resolve(maskedImage)
        } catch (e: Exception) {
            promise.reject("CAPTURE_FAILED", "Failed to capture and mask screen", e)
        }
    }

    private fun captureAndMaskScreen(activity: Activity, options: ReadableMap?): String {
        val rootView = activity.window.decorView.rootView

        // Enable drawing cache
        rootView.isDrawingCacheEnabled = true
        rootView.buildDrawingCache()

        val bitmap = Bitmap.createBitmap(rootView.drawingCache)
        rootView.isDrawingCacheEnabled = false

        // Apply masking
        val maskedBitmap = applyMasking(bitmap, rootView, options)

        // Convert to base64
        val output = ByteArrayOutputStream()
        maskedBitmap.compress(Bitmap.CompressFormat.JPEG, 70, output)
        val base64 = Base64.encodeToString(output.toByteArray(), Base64.DEFAULT)

        return base64
    }

    private fun applyMasking(bitmap: Bitmap, rootView: View, options: ReadableMap?): Bitmap {
        val maskedBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(maskedBitmap)

        // Find sensitive elements
        val sensitiveElements = findSensitiveElements(rootView)

        for (element in sensitiveElements) {
            val location = IntArray(2)
            element.getLocationOnScreen(location)

            val frame = Rect(
                location[0],
                location[1],
                location[0] + element.width,
                location[1] + element.height
            )

            val maskingType = getMaskingType(element)

            when (maskingType) {
                MaskingType.BLUR -> applyBlurMask(canvas, frame)
                MaskingType.RECTANGLE -> applyRectangleMask(canvas, frame)
                MaskingType.PIXELATE -> applyPixelateMask(canvas, frame)
                MaskingType.NONE -> { /* No masking */ }
            }
        }

        return maskedBitmap
    }

    private fun findSensitiveElements(view: View): List<View> {
        val sensitiveElements = mutableListOf<View>()

        fun traverseView(currentView: View) {
            if (shouldMaskView(currentView)) {
                sensitiveElements.add(currentView)
            }

            if (currentView is ViewGroup) {
                for (i in 0 until currentView.childCount) {
                    traverseView(currentView.getChildAt(i))
                }
            }
        }

        traverseView(view)
        return sensitiveElements
    }

    private fun shouldMaskView(view: View): Boolean {
        // Check for EditText - mask all text fields when inputMasking is enabled
        if (view is EditText) {
            return true
        }

        // Check for TextView - mask all text views when inputMasking is enabled
        if (view is TextView) {
            return true
        }

        return false
    }

    private fun getMaskingType(view: View): MaskingType {
        // Default masking type for all text inputs
        return MaskingType.RECTANGLE
    }

    private fun applyBlurMask(canvas: Canvas, frame: Rect) {
        val paint = Paint().apply {
            color = Color.BLACK
            alpha = 200 // Semi-transparent
        }

        canvas.drawRect(frame, paint)

        // Add some noise to make it look blurred
        paint.color = Color.WHITE
        paint.alpha = 80

        for (i in 0..20) {
            val randomX = frame.left + (Math.random() * frame.width()).toFloat()
            val randomY = frame.top + (Math.random() * frame.height()).toFloat()
            val randomSize = (Math.random() * 6 + 2).toFloat()
            canvas.drawCircle(randomX, randomY, randomSize, paint)
        }
    }

    private fun applyRectangleMask(canvas: Canvas, frame: Rect) {
        val paint = Paint().apply {
            color = Color.GRAY
        }

        canvas.drawRect(frame, paint)

        // Add some text-like pattern
        paint.color = Color.DKGRAY
        val lineHeight = 4f
        val spacing = 8f

        var y = frame.top + spacing
        while (y < frame.bottom - spacing) {
            val lineWidth = (Math.random() * frame.width() * 0.5 + frame.width() * 0.3).toFloat()
            val x = frame.left + (Math.random() * (frame.width() - lineWidth)).toFloat()
            canvas.drawRect(x, y, x + lineWidth, y + lineHeight, paint)
            y += lineHeight + spacing
        }
    }

    private fun applyPixelateMask(canvas: Canvas, frame: Rect) {
        val pixelSize = 8f
        val pixelCountX = (frame.width() / pixelSize).toInt()
        val pixelCountY = (frame.height() / pixelSize).toInt()

        val paint = Paint()

        for (x in 0 until pixelCountX) {
            for (y in 0 until pixelCountY) {
                val pixelFrame = RectF(
                    frame.left + x * pixelSize,
                    frame.top + y * pixelSize,
                    frame.left + (x + 1) * pixelSize,
                    frame.top + (y + 1) * pixelSize
                )

                // Use a random color for each pixel
                paint.color = Color.rgb(
                    (Math.random() * 255).toInt(),
                    (Math.random() * 255).toInt(),
                    (Math.random() * 255).toInt()
                )
                canvas.drawRect(pixelFrame, paint)
            }
        }
    }

    private enum class MaskingType {
        BLUR, RECTANGLE, PIXELATE, NONE
    }
}
