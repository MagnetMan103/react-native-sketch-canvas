// This guard prevent this file to be compiled in the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
#import "RNSketchCanvas.h"

#ifndef RNTSketchCanvasNativeComponent_h
#define RNTSketchCanvasNativeComponent_h

NS_ASSUME_NONNULL_BEGIN

@interface RNTSketchCanvas : RCTViewComponentView <RNSketchCanvasEventDelegate>

@end

NS_ASSUME_NONNULL_END

#endif /* RNTSketchCanvasNativeComponent_h */
#endif /* RCT_NEW_ARCH_ENABLED */
