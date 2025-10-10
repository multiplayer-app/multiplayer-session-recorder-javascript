package com.multiplayer.sessionrecordernative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Spec class for SessionRecorderNative TurboModule
 * This class defines the interface that React Native expects for TurboModules
 */
class SessionRecorderNativeSpec(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return NAME
    }

    companion object {
        const val NAME = "SessionRecorderNative"
    }

    // Delegate to the actual implementation
    private val implementation = SessionRecorderNativeModule(reactContext)

    @ReactMethod
    fun captureAndMask(promise: Promise) {
        implementation.captureAndMask(promise)
    }

    @ReactMethod
    fun captureAndMaskWithOptions(options: ReadableMap, promise: Promise) {
        implementation.captureAndMaskWithOptions(options, promise)
    }

    @ReactMethod
    fun startGestureRecording(promise: Promise) {
        implementation.startGestureRecording(promise)
    }

    @ReactMethod
    fun stopGestureRecording(promise: Promise) {
        implementation.stopGestureRecording(promise)
    }

    @ReactMethod
    fun isGestureRecordingActive(promise: Promise) {
        implementation.isGestureRecordingActive(promise)
    }

    @ReactMethod
    fun setGestureCallback(callback: Callback) {
        implementation.setGestureCallback(callback)
    }

    @ReactMethod
    fun recordGesture(
        gestureType: String,
        x: Double,
        y: Double,
        target: String?,
        metadata: ReadableMap?
    ) {
        implementation.recordGesture(gestureType, x, y, target, metadata)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        implementation.addListener(eventName)
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        implementation.removeListeners(count)
    }
}
