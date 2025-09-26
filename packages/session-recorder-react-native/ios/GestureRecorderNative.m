#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(GestureRecorderNative, RCTEventEmitter)

RCT_EXTERN_METHOD(startGestureRecording:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopGestureRecording:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isGestureRecordingActive:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(recordGesture:(NSString *)gestureType
                  x:(NSNumber *)x
                  y:(NSNumber *)y
                  target:(NSString *)target
                  metadata:(NSDictionary *)metadata)

@end
