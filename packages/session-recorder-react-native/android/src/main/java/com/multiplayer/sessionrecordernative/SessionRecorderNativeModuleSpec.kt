package com.multiplayer.sessionrecordernative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.TurboModule

abstract class SessionRecorderNativeModuleSpec : TurboModule {

  @ReactMethod
  abstract fun captureAndMask(promise: Promise)

  @ReactMethod
  abstract fun captureAndMaskWithOptions(options: ReadableMap, promise: Promise)

  @ReactMethod
  abstract fun startGestureRecording(promise: Promise)

  @ReactMethod
  abstract fun stopGestureRecording(promise: Promise)

  @ReactMethod
  abstract fun isGestureRecordingActive(promise: Promise)

  @ReactMethod
  abstract fun setGestureCallback(callback: Callback)

  @ReactMethod
  abstract fun recordGesture(
    gestureType: String,
    x: Double,
    y: Double,
    target: String?,
    metadata: ReadableMap?
  )

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for RN event emitter contracts
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for RN event emitter contracts
  }
}
