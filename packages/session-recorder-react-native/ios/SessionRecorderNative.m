#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SessionRecorderNative, NSObject)

RCT_EXTERN_METHOD(captureAndMask:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(captureAndMaskWithOptions:(NSDictionary *)options
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
