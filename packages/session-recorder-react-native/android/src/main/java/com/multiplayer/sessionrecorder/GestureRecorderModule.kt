package com.multiplayer.sessionrecorder

import android.app.Activity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.multiplayer.sessionrecorder.util.ViewUtils

class GestureRecorderModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

  private var isRecording = false
  private var rootView: ViewGroup? = null
  private var gestureListener: View.OnTouchListener? = null
  private var gestureCallback: Callback? = null
  private var originalWindowCallback: android.view.Window.Callback? = null

  // Gesture state tracking
  private var initialTouchTime = 0L
  private var initialTouchX = 0f
  private var initialTouchY = 0f
  private var lastTouchX = 0f
  private var lastTouchY = 0f
  private var isPanning = false
  private var isLongPressTriggered = false
  private var longPressRunnable: Runnable? = null
  private var handler: android.os.Handler? = null

  override fun getName() = "GestureRecorderNative"

  @ReactMethod
  fun startGestureRecording(promise: Promise) {
    val activity =
            reactApplicationContext.currentActivity
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
              override fun dispatchTouchEvent(event: MotionEvent): Boolean {
                if (isRecording) {
                  // Use screen pixel coordinates for hit-testing target
                  val screenPointPx = android.graphics.PointF(event.rawX, event.rawY)
                  val target = ViewUtils.findTargetView(screenPointPx, rootView)
                  when (event.action) {
                    MotionEvent.ACTION_DOWN -> handleTouchDown(event, target)
                    MotionEvent.ACTION_MOVE -> handleTouchMove(event, target)
                    MotionEvent.ACTION_UP -> handleTouchUp(event, target)
                    MotionEvent.ACTION_CANCEL -> handleTouchCancel(event, target)
                  }
                }
                // Always forward to original callback so we don't block the app
                return delegate.dispatchTouchEvent(event)
              }
            }
  }

  private fun removeGestureListener() {
    // Restore original Window callback
    reactApplicationContext.currentActivity?.let { activity ->
      val window = activity.window
      originalWindowCallback?.let { original ->
        if (window.callback !== original) {
          window.callback = original
        }
      }
    }
    originalWindowCallback = null

    // Cleanup root and listener
    rootView?.setOnTouchListener(null)
    gestureListener = null
    rootView = null

    // Cancel any pending long press
    longPressRunnable?.let { handler?.removeCallbacks(it) }
    longPressRunnable = null
    handler = null
  }

  private fun handleTouchDown(
          event: MotionEvent,
          target: com.multiplayer.sessionrecorder.model.TargetInfo
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
          event: MotionEvent,
          target: com.multiplayer.sessionrecorder.model.TargetInfo
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
          event: MotionEvent,
          target: com.multiplayer.sessionrecorder.model.TargetInfo
  ) {
    val dp = getScreenDpPoint(event)
    val touchDuration = System.currentTimeMillis() - initialTouchTime
    val deltaX = dp.x - initialTouchX
    val deltaY = dp.y - initialTouchY
    val distance = kotlin.math.sqrt(deltaX * deltaX + deltaY * deltaY)

    android.util.Log.d(
            "GestureRecorder",
            "Touch up detected at (${event.rawX}, ${event.rawY}), duration: ${touchDuration}ms, distance: $distance"
    )

    // Cancel long press
    longPressRunnable?.let { handler?.removeCallbacks(it) }

    if (isPanning) {
      // End pan gesture
      android.util.Log.d("GestureRecorder", "Pan end detected")
      sendGestureEvent("pan_end", dp.x, dp.y, target, createPanMetadata(event, deltaX, deltaY))
    } else if (distance < 10 && touchDuration < 500 && !isLongPressTriggered) {
      // Single tap (short duration, small movement)
      android.util.Log.d("GestureRecorder", "Tap detected")
      sendGestureEvent("tap", dp.x, dp.y, target, createTapMetadata())
    }

    // Reset state
    isPanning = false
    isLongPressTriggered = false
  }

  private fun handleTouchCancel(
          event: MotionEvent,
          target: com.multiplayer.sessionrecorder.model.TargetInfo
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

  // Convert MotionEvent screen coordinates (px) to density-independent points (dp)
  private fun getScreenDpPoint(event: MotionEvent): android.graphics.PointF {
    val density = reactApplicationContext.resources.displayMetrics.density
    return android.graphics.PointF(event.rawX / density, event.rawY / density)
  }

  private fun sendGestureEvent(
          gestureType: String,
          x: Float,
          y: Float,
          target: com.multiplayer.sessionrecorder.model.TargetInfo,
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

  private fun createPanMetadata(event: MotionEvent, deltaX: Float, deltaY: Float): WritableMap {
    val velocity = kotlin.math.sqrt(deltaX * deltaX + deltaY * deltaY)
    return Arguments.createMap().apply {
      putDouble("velocity", velocity.toDouble())
      putDouble("deltaX", deltaX.toDouble())
      putDouble("deltaY", deltaY.toDouble())
      putDouble("pressure", event.pressure.toDouble())
    }
  }

  private fun sendEvent(eventName: String, params: WritableMap) {
    reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
  }
}
