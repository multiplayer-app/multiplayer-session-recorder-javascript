import UIKit
import React
import WebKit

@objc(SessionRecorderNative)
class SessionRecorderNative: RCTEventEmitter, UIGestureRecognizerDelegate {

  // Configuration options
  private var maskTextInputs: Bool = true
  private var maskImages: Bool = false
  private var maskButtons: Bool = false
  private var maskLabels: Bool = false
  private var maskWebViews: Bool = false
  private var maskSandboxedViews: Bool = false
  private var imageQuality: CGFloat = 0.05
  private var scale: CGFloat = 1.0

  // React Native view types
  private let reactNativeTextView: AnyClass? = NSClassFromString("RCTTextView")
  private let reactNativeImageView: AnyClass? = NSClassFromString("RCTImageView")
  private let reactNativeTextInput: AnyClass? = NSClassFromString("RCTUITextField")
  private let reactNativeTextInputView: AnyClass? = NSClassFromString("RCTUITextView")

  // System sandboxed views (usually sensitive)
  private let systemSandboxedView: AnyClass? = NSClassFromString("_UIRemoteView")

  // SwiftUI view types
  private let swiftUITextBasedViewTypes = [
    "SwiftUI.CGDrawingView", // Text, Button
    "SwiftUI.TextEditorTextView", // TextEditor
    "SwiftUI.VerticalTextView", // TextField, vertical axis
  ].compactMap(NSClassFromString)

  private let swiftUIImageLayerTypes = [
    "SwiftUI.ImageLayer",
  ].compactMap(NSClassFromString)

  private let swiftUIGenericTypes = [
    "_TtC7SwiftUIP33_A34643117F00277B93DEBAB70EC0697122_UIShapeHitTestingView",
  ].compactMap(NSClassFromString)

  // Safe layer types that shouldn't be masked
  private let swiftUISafeLayerTypes: [AnyClass] = [
    "SwiftUI.GradientLayer", // Views like LinearGradient, RadialGradient, or AngularGradient
  ].compactMap(NSClassFromString)

  // MARK: - Screen capture APIs
  @objc func captureAndMask(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) else {
        reject("NO_WINDOW", "Unable to get key window", nil)
        return
      }

      // Skip screenshot if window is not visible or if an animation/scroll is in progress
      // || self.isAnimatingTransition(window) || self.windowHasActiveAnimations(window)
      if !window.isVisible()  {
        reject("ANIMATION_IN_PROGRESS", "Skipping screenshot - animation or transition in progress", nil)
        return
      }

      // Integrate optional scale directly into the capture to avoid a second resize pass
      let clampedScale = max(CGFloat(0.1), min(self.scale, 1.0))
      let contextScale = UIScreen.main.scale * clampedScale

      let rendererFormat = UIGraphicsImageRendererFormat()
      rendererFormat.scale = contextScale
      rendererFormat.opaque = false

      let renderer = UIGraphicsImageRenderer(size: window.bounds.size, format: rendererFormat)
      let image = renderer.image { _ in
        window.drawHierarchy(in: window.bounds, afterScreenUpdates: false)
      }

      // Apply masking to sensitive elements
      let maskedImage = self.applyMasking(to: image, in: window)


      let quality = self.imageQuality
      let finalImageForEncoding = maskedImage

      // Move JPEG encoding off the main thread to reduce UI stalls
      DispatchQueue.global(qos: .userInitiated).async {
        if let data = finalImageForEncoding.jpegData(compressionQuality: quality) {
          let base64 = data.base64EncodedString()
          DispatchQueue.main.async {
            resolve(base64)
          }
        } else {
          DispatchQueue.main.async {
            reject("ENCODING_FAILED", "Failed to encode image", nil)
          }
        }
      }
    }
  }

  @objc func captureAndMaskWithOptions(_ options: NSDictionary, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      // Update configuration from options
      self.updateConfiguration(from: options)

      guard let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) else {
        reject("NO_WINDOW", "Unable to get key window", nil)
        return
      }

      // Skip screenshot if window is not visible or if an animation/scroll is in progress
      // || self.isAnimatingTransition(window) || self.windowHasActiveAnimations(window)
      if !window.isVisible()  {
        reject("ANIMATION_IN_PROGRESS", "Skipping screenshot - animation or transition in progress", nil)
        return
      }

      // Integrate optional scale directly into the capture to avoid a second resize pass
      let clampedScale = max(CGFloat(0.1), min(self.scale, 1.0))
      let contextScale = UIScreen.main.scale * clampedScale

      let rendererFormat = UIGraphicsImageRendererFormat()
      rendererFormat.scale = contextScale
      rendererFormat.opaque = false

      let renderer = UIGraphicsImageRenderer(size: window.bounds.size, format: rendererFormat)
      let image = renderer.image { _ in
        window.drawHierarchy(in: window.bounds, afterScreenUpdates: false)
      }

      // Apply masking with custom options
      let maskedImage = self.applyMaskingWithOptions(to: image, in: window, options: options)


      let quality = self.imageQuality
      let finalImageForEncoding = maskedImage

      // Move JPEG encoding off the main thread to reduce UI stalls
      DispatchQueue.global(qos: .userInitiated).async {
        if let data = finalImageForEncoding.jpegData(compressionQuality: quality) {
          let base64 = data.base64EncodedString()
          DispatchQueue.main.async {
            resolve(base64)
          }
        } else {
          DispatchQueue.main.async {
            reject("ENCODING_FAILED", "Failed to encode image", nil)
          }
        }
      }
    }
  }

  // MARK: - Gesture recording state
  private var isRecording = false
  private var rootViewController: UIViewController?

  private var tapGestureRecognizer: UITapGestureRecognizer?
  private var panGestureRecognizer: UIPanGestureRecognizer?
  private var longPressGestureRecognizer: UILongPressGestureRecognizer?
  private var pinchGestureRecognizer: UIPinchGestureRecognizer?

  // MARK: - Event Emitter overrides
  override func supportedEvents() -> [String]! {
    return ["onGestureDetected"]
  }

  @objc override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  // MARK: - Gesture recording APIs
  @objc func startGestureRecording(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard !self.isRecording else {
        resolve(nil)
        return
      }

      self.setupGestureRecognizers()
      self.isRecording = true
      resolve(nil)
    }
  }

  @objc func stopGestureRecording(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.isRecording else {
        resolve(nil)
        return
      }

      self.removeGestureRecognizers()
      self.isRecording = false
      resolve(nil)
    }
  }

  @objc func isGestureRecordingActive(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(self.isRecording)
  }

  @objc func recordGesture(_ gestureType: String, x: NSNumber, y: NSNumber, target: String?, metadata: NSDictionary?) {
    let gestureEvent: [String: Any] = [
      "type": gestureType,
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "x": x.doubleValue,
      "y": y.doubleValue,
      "target": target ?? "",
      "metadata": metadata ?? [:]
    ]

    self.sendEvent(withName: "onGestureDetected", body: gestureEvent)
  }

  private func updateConfiguration(from options: NSDictionary) {
    print("SessionRecorder: updateConfiguration called with options: \(options)")

    if let maskTextInputs = options["maskTextInputs"] as? Bool {
      self.maskTextInputs = maskTextInputs
    }
    if let maskImages = options["maskImages"] as? Bool {
      self.maskImages = maskImages
    }
    if let maskSandboxedViews = options["maskSandboxedViews"] as? Bool {
      self.maskSandboxedViews = maskSandboxedViews
    }
    if let maskButtons = options["maskButtons"] as? Bool {
      self.maskButtons = maskButtons
    }
    if let maskLabels = options["maskLabels"] as? Bool {
      self.maskLabels = maskLabels
    }
    if let maskWebViews = options["maskWebViews"] as? Bool {
      self.maskWebViews = maskWebViews
    }
    if let quality = options["quality"] as? NSNumber {
      self.imageQuality = CGFloat(quality.floatValue)
    }
    if let scale = options["scale"] as? NSNumber {
      self.scale = CGFloat(scale.floatValue)
      print("SessionRecorder: Scale updated to \(self.scale) (from NSNumber: \(scale))")
    } else if let scale = options["scale"] as? Double {
      self.scale = CGFloat(scale)
      print("SessionRecorder: Scale updated to \(self.scale) (from Double: \(scale))")
    } else if let scale = options["scale"] as? Float {
      self.scale = CGFloat(scale)
      print("SessionRecorder: Scale updated to \(self.scale) (from Float: \(scale))")
    }
  }

  private func applyMasking(to image: UIImage, in window: UIWindow) -> UIImage {
    return applyMaskingWithOptions(to: image, in: window, options: [:])
  }

  private func applyMaskingWithOptions(to image: UIImage, in window: UIWindow, options: NSDictionary) -> UIImage {
    // Early exit optimization: if all masking options are false, skip masking entirely
    if !hasAnyMaskingEnabled() {
      return image
    }

    let rendererFormat = UIGraphicsImageRendererFormat()
    rendererFormat.scale = image.scale
    rendererFormat.opaque = false

    let renderer = UIGraphicsImageRenderer(size: image.size, format: rendererFormat)

    let maskedImage = renderer.image { rendererContext in
      let context = rendererContext.cgContext

      // Draw the original image
      image.draw(in: CGRect(origin: .zero, size: image.size))

      var maskableWidgets: [CGRect] = []
      findMaskableWidgets(window, window, &maskableWidgets)

      for frame in maskableWidgets {
        // Skip zero rects (which indicate invalid coordinates)
        if frame == CGRect.zero { continue }

        // Validate frame dimensions before processing
        guard frame.size.width.isFinite && frame.size.height.isFinite &&
              frame.origin.x.isFinite && frame.origin.y.isFinite else {
          continue
        }

        // Clip the frame to the image bounds to avoid drawing outside context
        let clippedFrame = frame.intersection(CGRect(origin: .zero, size: image.size))
        if clippedFrame.isNull || clippedFrame.isEmpty { continue }

        applyCleanMask(in: context, frame: clippedFrame)
      }
    }

    return maskedImage
  }

  // Check if any masking option is enabled (optimization)
  private func hasAnyMaskingEnabled() -> Bool {
    return maskTextInputs || maskImages || maskButtons || maskLabels || maskWebViews || maskSandboxedViews
  }

  private func findMaskableWidgets(_ view: UIView, _ window: UIWindow, _ maskableWidgets: inout [CGRect]) {
    // Skip hidden or transparent views
    if !view.isVisible() {
      return
    }

    // Check for UITextView (TextEditor, SwiftUI.TextEditorTextView, SwiftUI.UIKitTextView)
    if maskTextInputs, let textView = view as? UITextView {
      if isTextViewSensitive(textView) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // Check for UITextField (SwiftUI: TextField, SecureField)
    if maskTextInputs, let textField = view as? UITextField {
      if isTextFieldSensitive(textField) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // React Native text views - only if maskTextInputs is enabled
    if maskTextInputs, let reactNativeTextView = reactNativeTextView {
      if view.isKind(of: reactNativeTextView) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // React Native text inputs - only if maskTextInputs is enabled
    if maskTextInputs, let reactNativeTextInput = reactNativeTextInput {
      if view.isKind(of: reactNativeTextInput) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    if maskTextInputs, let reactNativeTextInputView = reactNativeTextInputView {
      if view.isKind(of: reactNativeTextInputView) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // UIImageView (SwiftUI: Some control images like the ones in Picker view) - only if maskImages is enabled
    if maskImages, let imageView = view as? UIImageView {
      if isImageViewSensitive(imageView) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // React Native image views - only if maskImages is enabled
    if maskImages, let reactNativeImageView = reactNativeImageView {
      if view.isKind(of: reactNativeImageView) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // UILabel (Text) - only if maskLabels is enabled
    if maskLabels, let label = view as? UILabel {
      if hasText(label.text) || label.isNoCapture() {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // WKWebView - only if maskWebViews is enabled
    if maskWebViews, let webView = view as? WKWebView {
      maskableWidgets.append(view.toAbsoluteRect(window))
      return
    }

    // UIButton - only if maskButtons is enabled
    if maskButtons, let button = view as? UIButton {
      if hasText(button.titleLabel?.text) || button.isNoCapture() {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // UISwitch (SwiftUI: Toggle) - only if maskButtons is enabled (treat as button-like)
    if maskButtons, let theSwitch = view as? UISwitch {
      var containsText = true
      if #available(iOS 14.0, *) {
        containsText = hasText(theSwitch.title)
      }
      if containsText || theSwitch.isNoCapture() {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // UIPickerView (SwiftUI: Picker with .pickerStyle(.wheel)) - only if maskTextInputs is enabled
    if maskTextInputs, let picker = view as? UIPickerView {
      if !view.subviews.isEmpty {
        maskableWidgets.append(picker.toAbsoluteRect(window))
        return
      }
    }

    // Detect any views that don't belong to the current process (likely system views)
    if maskSandboxedViews,
       let systemSandboxedView,
       view.isKind(of: systemSandboxedView) {
      maskableWidgets.append(view.toAbsoluteRect(window))
      return
    }

    let hasSubViews = !view.subviews.isEmpty

    // SwiftUI: Text based views like Text, Button, TextEditor
    // Only check if relevant masking options are enabled
    if swiftUITextBasedViewTypes.contains(where: view.isKind(of:)), !hasSubViews {
      // Check if it's a text input (should be masked with maskTextInputs)
      if maskTextInputs && view.isNoCapture() {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
      // Check if it's a button (should be masked with maskButtons)
      if maskButtons && view.isNoCapture() {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // SwiftUI: Image based views like Image, AsyncImage - only if maskImages is enabled
    if maskImages, swiftUIImageLayerTypes.contains(where: view.layer.isKind(of:)), !hasSubViews {
      if isSwiftUIImageSensitive(view) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // Generic SwiftUI types - only check if relevant masking is enabled
    if swiftUIGenericTypes.contains(where: { view.isKind(of: $0) }), !isSwiftUILayerSafe(view.layer), !hasSubViews {
      if (maskTextInputs || maskButtons) && view.isNoCapture() {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // Recursively check subviews only if we still need to check for more widgets
    // Early exit optimization: if we've found all we need, don't recurse
    if !view.subviews.isEmpty {
      for child in view.subviews {
        if !child.isVisible() {
          continue
        }
        findMaskableWidgets(child, window, &maskableWidgets)
      }
    }
  }

  // MARK: - Sensitive Content Detection Methods

  private func isTextViewSensitive(_ view: UITextView) -> Bool {
    // Only check if maskTextInputs is enabled, or if view is explicitly marked as sensitive
    return (maskTextInputs || view.isSensitiveText()) && hasText(view.text)
  }

  private func isTextFieldSensitive(_ view: UITextField) -> Bool {
    // Only check if maskTextInputs is enabled, or if view is explicitly marked as sensitive
    return (maskTextInputs || view.isSensitiveText()) && (hasText(view.text) || hasText(view.placeholder))
  }

  private func isSwiftUILayerSafe(_ layer: CALayer) -> Bool {
    return swiftUISafeLayerTypes.contains(where: { layer.isKind(of: $0) })
  }

  private func hasText(_ text: String?) -> Bool {
    if let text = text, !text.isEmpty {
      return true
    } else {
      // if there's no text, there's nothing to mask
      return false
    }
  }

  private func isSwiftUIImageSensitive(_ view: UIView) -> Bool {
    // No way of checking if this is an asset image or not
    // No way of checking if there's actual content in the image or not
    return maskImages || view.isNoCapture()
  }

  private func isImageViewSensitive(_ view: UIImageView) -> Bool {
    // if there's no image, there's nothing to mask
    guard let image = view.image else { return false }

    // sensitive, regardless
    if view.isNoCapture() {
      return true
    }

    // asset images are probably not sensitive
    if isAssetsImage(image) {
      return false
    }

    // symbols are probably not sensitive
    if image.isSymbolImage {
      return false
    }

    return maskImages
  }

  private func isAssetsImage(_ image: UIImage) -> Bool {
    // https://github.com/daydreamboy/lldb_scripts#9-pimage
    // do not mask if its an asset image, likely not PII anyway
    return image.imageAsset?.value(forKey: "_containingBundle") != nil
  }

  private func applyCleanMask(in context: CGContext, frame: CGRect) {
    // Final validation before drawing to prevent CoreGraphics NaN errors
    guard frame.size.width.isFinite && frame.size.height.isFinite &&
          frame.origin.x.isFinite && frame.origin.y.isFinite &&
          frame.size.width > 0 && frame.size.height > 0 else {
      return
    }

    // Clean, consistent solid color masking approach
    // Use system gray colors that adapt to light/dark mode
    context.setFillColor(UIColor.systemGray5.cgColor)
    context.fill(frame)

    // Add subtle border for visual definition
    context.setStrokeColor(UIColor.systemGray4.cgColor)
    context.setLineWidth(0.5)
    context.stroke(frame)
  }

  private func applyBlurMask(in context: CGContext, frame: CGRect) {
    // Final validation before drawing to prevent CoreGraphics NaN errors
    guard frame.size.width.isFinite && frame.size.height.isFinite &&
          frame.origin.x.isFinite && frame.origin.y.isFinite &&
          frame.size.width > 0 && frame.size.height > 0 else {
      return
    }

    // Clean solid color masking
    // Use a consistent gray color for consistent appearance
    context.setFillColor(UIColor.systemGray5.cgColor)
    context.fill(frame)

    // Add subtle border for visual definition
    context.setStrokeColor(UIColor.systemGray4.cgColor)
    context.setLineWidth(1.0)
    context.stroke(frame)
  }

  private func applyRectangleMask(in context: CGContext, frame: CGRect) {
    // Final validation before drawing to prevent CoreGraphics NaN errors
    guard frame.size.width.isFinite && frame.size.height.isFinite &&
          frame.origin.x.isFinite && frame.origin.y.isFinite &&
          frame.size.width > 0 && frame.size.height > 0 else {
      return
    }

    // Clean solid rectangle masking
    context.setFillColor(UIColor.systemGray5.cgColor)
    context.fill(frame)

    // Add subtle border
    context.setStrokeColor(UIColor.systemGray4.cgColor)
    context.setLineWidth(1.0)
    context.stroke(frame)
  }

  private func applyPixelateMask(in context: CGContext, frame: CGRect, image: UIImage) {
    // Final validation before drawing to prevent CoreGraphics NaN errors
    guard frame.size.width.isFinite && frame.size.height.isFinite &&
          frame.origin.x.isFinite && frame.origin.y.isFinite &&
          frame.size.width > 0 && frame.size.height > 0 else {
      return
    }

    // Clean solid color masking (consistent with other methods)
    context.setFillColor(UIColor.systemGray5.cgColor)
    context.fill(frame)

    // Add subtle border
    context.setStrokeColor(UIColor.systemGray4.cgColor)
    context.setLineWidth(1.0)
    context.stroke(frame)
  }

  private func resizeImage(_ image: UIImage, scale: CGFloat) -> UIImage {
      // Simple approach: scale the logical size directly
      let newSize = CGSize(
        width: max(1.0, image.size.width * scale),
        height: max(1.0, image.size.height * scale)
      )


      // Use UIGraphicsImageRenderer (modern API) to render the resized image
      let rendererFormat = UIGraphicsImageRendererFormat()
      rendererFormat.scale = image.scale
      rendererFormat.opaque = false

      let renderer = UIGraphicsImageRenderer(size: newSize, format: rendererFormat)
      let newImage = renderer.image { _ in
        image.draw(in: CGRect(origin: .zero, size: newSize))
      }

      return newImage
  }

  // MARK: - Gesture setup and handlers
  private func setupGestureRecognizers() {
    guard let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }),
          let rootViewController = window.rootViewController else {
      return
    }

    self.rootViewController = rootViewController

    // Tap
    tapGestureRecognizer = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
    tapGestureRecognizer?.numberOfTapsRequired = 1
    tapGestureRecognizer?.numberOfTouchesRequired = 1
    rootViewController.view.addGestureRecognizer(tapGestureRecognizer!)

    // Pan
    panGestureRecognizer = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
    rootViewController.view.addGestureRecognizer(panGestureRecognizer!)

    // Long press
    longPressGestureRecognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
    longPressGestureRecognizer?.minimumPressDuration = 0.5
    rootViewController.view.addGestureRecognizer(longPressGestureRecognizer!)

    // Pinch
    pinchGestureRecognizer = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
    rootViewController.view.addGestureRecognizer(pinchGestureRecognizer!)

    // Allow simultaneous recognition
    tapGestureRecognizer?.delegate = self
    panGestureRecognizer?.delegate = self
    longPressGestureRecognizer?.delegate = self
    pinchGestureRecognizer?.delegate = self
  }

  private func removeGestureRecognizers() {
    guard let rootViewController = rootViewController else { return }

    if let tapGesture = tapGestureRecognizer { rootViewController.view.removeGestureRecognizer(tapGesture) }
    if let panGesture = panGestureRecognizer { rootViewController.view.removeGestureRecognizer(panGesture) }
    if let longPressGesture = longPressGestureRecognizer { rootViewController.view.removeGestureRecognizer(longPressGesture) }
    if let pinchGesture = pinchGestureRecognizer { rootViewController.view.removeGestureRecognizer(pinchGesture) }

    tapGestureRecognizer = nil
    panGestureRecognizer = nil
    longPressGestureRecognizer = nil
    pinchGestureRecognizer = nil
    self.rootViewController = nil
  }

  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    guard let view = gesture.view else { return }
    let location = gesture.location(in: view)
    let target = GestureTargetFinder.findTargetView(at: location, in: view)

    let gestureEvent: [String: Any] = [
      "type": "tap",
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "x": location.x,
      "y": location.y,
      "target": target.identifier,
      "targetInfo": [
        "identifier": target.identifier,
        "label": target.label as Any,
        "role": target.role as Any,
        "testId": target.testId as Any,
        "text": target.text as Any
      ],
      "metadata": [
        "pressure": 1.0
      ]
    ]

    self.sendEvent(withName: "onGestureDetected", body: gestureEvent)
  }

  @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
    guard let view = gesture.view else { return }
    let location = gesture.location(in: view)
    let velocity = gesture.velocity(in: view)
    let translation = gesture.translation(in: view)

    let target = GestureTargetFinder.findTargetView(at: location, in: view)

    let gestureType: String
    switch gesture.state {
    case .began: gestureType = "pan_start"
    case .changed: gestureType = "pan_move"
    case .ended, .cancelled: gestureType = "pan_end"
    default: return
    }

    let gestureEvent: [String: Any] = [
      "type": gestureType,
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "x": location.x,
      "y": location.y,
      "target": target.identifier,
      "targetInfo": [
        "identifier": target.identifier,
        "label": target.label as Any,
        "role": target.role as Any,
        "testId": target.testId as Any,
        "text": target.text as Any
      ],
      "metadata": [
        "velocity": sqrt(velocity.x * velocity.x + velocity.y * velocity.y),
        "deltaX": translation.x,
        "deltaY": translation.y
      ]
    ]

    self.sendEvent(withName: "onGestureDetected", body: gestureEvent)
  }

  @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
    guard gesture.state == .began else { return }
    guard let view = gesture.view else { return }
    let location = gesture.location(in: view)
    let target = GestureTargetFinder.findTargetView(at: location, in: view)

    let gestureEvent: [String: Any] = [
      "type": "long_press",
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "x": location.x,
      "y": location.y,
      "target": target.identifier,
      "targetInfo": [
        "identifier": target.identifier,
        "label": target.label as Any,
        "role": target.role as Any,
        "testId": target.testId as Any,
        "text": target.text as Any
      ],
      "metadata": [
        "duration": 0.5,
        "pressure": 1.0
      ]
    ]

    self.sendEvent(withName: "onGestureDetected", body: gestureEvent)
  }

  @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
    guard let view = gesture.view else { return }
    let location = gesture.location(in: view)
    let scale = gesture.scale
    let velocity = gesture.velocity

    let target = GestureTargetFinder.findTargetView(at: location, in: view)

    let gestureEvent: [String: Any] = [
      "type": "pinch",
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "x": location.x,
      "y": location.y,
      "target": target.identifier,
      "targetInfo": [
        "identifier": target.identifier,
        "label": target.label as Any,
        "role": target.role as Any,
        "testId": target.testId as Any,
        "text": target.text as Any
      ],
      "metadata": [
        "scale": scale,
        "velocity": velocity
      ]
    ]

    self.sendEvent(withName: "onGestureDetected", body: gestureEvent)
  }

  // MARK: - UIGestureRecognizerDelegate
  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
    return true
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    return true
  }

  // MARK: - Animation Transition Detection
  /// Check if any view controller in the hierarchy is animating a transition
  private func isAnimatingTransition(_ window: UIWindow) -> Bool {
    guard let rootViewController = window.rootViewController else { return false }
    return isAnimatingTransition(rootViewController)
  }

  private func isAnimatingTransition(_ viewController: UIViewController) -> Bool {
    // Check if this view controller is animating
    if viewController.transitionCoordinator?.isAnimated ?? false {
      return true
    }

    // Check if presented view controller is animating
    if let presented = viewController.presentedViewController, isAnimatingTransition(presented) {
      return true
    }

    // Check if any of the child view controllers is animating
    if viewController.children.first(where: { self.isAnimatingTransition($0) }) != nil {
      return true
    }

    return false
  }

  // MARK: - Additional animation detection (layer + scroll)
  /// Detects ongoing layer-based animations or actively scrolling scroll views.
  private func windowHasActiveAnimations(_ window: UIWindow) -> Bool {
    // Check for any Core Animation animations attached to the window's layer
    if let keys = window.layer.animationKeys(), !keys.isEmpty {
      return true
    }

    // Check for actively scrolling UIScrollView instances
    return hasAnimatingScrollView(in: window)
  }

  private func hasAnimatingScrollView(in view: UIView) -> Bool {
    if let scrollView = view as? UIScrollView {
      if scrollView.isDragging || scrollView.isDecelerating {
        return true
      }
    }

    for subview in view.subviews {
      if hasAnimatingScrollView(in: subview) {
        return true
      }
    }

    return false
  }
}

private enum MaskingType {
  case blur
  case rectangle
  case pixelate
  case none
}


extension UIView {
  func isVisible() -> Bool {
    // Check for NaN values in frame dimensions
    let frame = self.frame
    let width = frame.size.width
    let height = frame.size.height

    // Validate that dimensions are finite numbers (not NaN or infinite)
    guard width.isFinite && height.isFinite else {
      return false
    }

    return !isHidden && alpha > 0.01 && width > 0 && height > 0
  }

  func toAbsoluteRect(_ window: UIWindow) -> CGRect {
    let bounds = self.bounds

    // Validate bounds before conversion to prevent NaN values
    guard bounds.size.width.isFinite && bounds.size.height.isFinite &&
          bounds.origin.x.isFinite && bounds.origin.y.isFinite else {
      // Return a zero rect if bounds contain NaN values
      return CGRect.zero
    }

    let convertedRect = convert(bounds, to: window)

    // Validate the converted rect to ensure no NaN values were introduced
    guard convertedRect.size.width.isFinite && convertedRect.size.height.isFinite &&
          convertedRect.origin.x.isFinite && convertedRect.origin.y.isFinite else {
      // Return a zero rect if conversion resulted in NaN values
      return CGRect.zero
    }

    return convertedRect
  }

  func isNoCapture() -> Bool {
    // Check accessibility label for sensitive keywords
    if let accessibilityLabel = accessibilityLabel?.lowercased() {
      let sensitiveKeywords = ["password", "secret", "private", "sensitive", "confidential"]
      if sensitiveKeywords.contains(where: accessibilityLabel.contains) {
        return true
      }
    }

    // Check for secure text entry
    if let textField = self as? UITextField {
      return textField.isSecureTextEntry
    }

    // Check for password-related class names or accessibility identifiers
    if let accessibilityIdentifier = accessibilityIdentifier?.lowercased() {
      let sensitiveIdentifiers = ["password", "secret", "private", "sensitive", "confidential"]
      if sensitiveIdentifiers.contains(where: accessibilityIdentifier.contains) {
        return true
      }
    }

    return false
  }

  func isSensitiveText() -> Bool {
    // Check if this view contains sensitive text content
    if let textField = self as? UITextField {
      return textField.isSecureTextEntry || isNoCapture()
    }

    if let textView = self as? UITextView {
      return isNoCapture()
    }

    return false
  }
}
