import Foundation
import React

@objc(SessionRecorderNativeSpec)
class SessionRecorderNativeSpec: NSObject, RCTTurboModule {

  @objc static func moduleName() -> String! {
    return "SessionRecorderNative"
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc func captureAndMask(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Implementation will be provided by the actual module
    reject("NOT_IMPLEMENTED", "Method not implemented", nil)
  }

  @objc func captureAndMaskWithOptions(_ options: NSDictionary, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Implementation will be provided by the actual module
    reject("NOT_IMPLEMENTED", "Method not implemented", nil)
  }

  @objc func startGestureRecording(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Implementation will be provided by the actual module
    reject("NOT_IMPLEMENTED", "Method not implemented", nil)
  }

  @objc func stopGestureRecording(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Implementation will be provided by the actual module
    reject("NOT_IMPLEMENTED", "Method not implemented", nil)
  }

  @objc func isGestureRecordingActive(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Implementation will be provided by the actual module
    reject("NOT_IMPLEMENTED", "Method not implemented", nil)
  }

  @objc func setGestureCallback(_ callback: @escaping RCTResponseSenderBlock) {
    // Implementation will be provided by the actual module
  }

  @objc func recordGesture(_ gestureType: String, x: NSNumber, y: NSNumber, target: String?, metadata: NSDictionary?) {
    // Implementation will be provided by the actual module
  }

  @objc func addListener(_ eventName: String) {
    // Required for RN event emitter contracts
  }

  @objc func removeListeners(_ count: Int) {
    // Required for RN event emitter contracts
  }
}
