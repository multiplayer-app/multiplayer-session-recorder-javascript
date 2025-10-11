#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(SessionRecorderNative, RCTEventEmitter)

RCT_EXTERN_METHOD(captureAndMask:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(captureAndMaskWithOptions:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// Gesture recording APIs
RCT_EXTERN_METHOD(startGestureRecording:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopGestureRecording:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(isGestureRecordingActive:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(recordGesture:(NSString *)gestureType
                  x:(nonnull NSNumber *)x
                  y:(nonnull NSNumber *)y
                  target:(NSString *)target
                  metadata:(NSDictionary *)metadata)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
