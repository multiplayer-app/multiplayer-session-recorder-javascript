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

      UIGraphicsBeginImageContextWithOptions(window.bounds.size, false, UIScreen.main.scale)
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
      let screenshot = UIGraphicsGetImageFromCurrentImageContext()
      UIGraphicsEndImageContext()

      guard let image = screenshot else {
        reject("CAPTURE_FAILED", "Failed to capture screen", nil)
        return
      }

      // Apply masking to sensitive elements
      let maskedImage = self.applyMasking(to: image, in: window)

      // Apply optional scaling (resolution downsample)
      let finalImage = self.scale < 1.0 ? self.resizeImage(maskedImage, scale: self.scale) : maskedImage

      // Debug logging
      print("SessionRecorder captureAndMask: Scale = \(self.scale), Original size = \(maskedImage.size), Final size = \(finalImage.size)")

      if let data = finalImage.jpegData(compressionQuality: self.imageQuality) {
          let base64 = data.base64EncodedString()
          resolve(base64)
      } else {
        reject("ENCODING_FAILED", "Failed to encode image", nil)
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

      UIGraphicsBeginImageContextWithOptions(window.bounds.size, false, UIScreen.main.scale)
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
      let screenshot = UIGraphicsGetImageFromCurrentImageContext()
      UIGraphicsEndImageContext()

      guard let image = screenshot else {
        reject("CAPTURE_FAILED", "Failed to capture screen", nil)
        return
      }

      // Apply masking with custom options
      let maskedImage = self.applyMaskingWithOptions(to: image, in: window, options: options)

      // Apply optional scaling (resolution downsample)
      let finalImage = self.scale < 1.0 ? self.resizeImage(maskedImage, scale: self.scale) : maskedImage

      // Debug logging
      print("SessionRecorder captureAndMaskWithOptions: Scale = \(self.scale), Original size = \(maskedImage.size), Final size = \(finalImage.size)")

      if let data = finalImage.jpegData(compressionQuality: self.imageQuality) {
        let base64 = data.base64EncodedString()
        resolve(base64)
      } else {
        reject("ENCODING_FAILED", "Failed to encode image", nil)
      }
    }
  }

  // MARK: - Gesture recording state
  private var isRecording = false
  private var gestureCallback: RCTResponseSenderBlock?
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

  @objc func setGestureCallback(_ callback: @escaping RCTResponseSenderBlock) {
    self.gestureCallback = callback
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
    if let cb = gestureCallback { cb([gestureEvent]) }
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
    UIGraphicsBeginImageContextWithOptions(image.size, false, image.scale)
    guard let context = UIGraphicsGetCurrentContext() else { return image }

    // Draw the original image
    image.draw(in: CGRect(origin: .zero, size: image.size))


    var maskableWidgets: [CGRect] = []
    var maskChildren = false
    findMaskableWidgets(window, window, &maskableWidgets, &maskChildren)

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

    let maskedImage = UIGraphicsGetImageFromCurrentImageContext() ?? image
    UIGraphicsEndImageContext()

    return maskedImage
  }

  private func findMaskableWidgets(_ view: UIView, _ window: UIWindow, _ maskableWidgets: inout [CGRect], _ maskChildren: inout Bool) {
    // Skip hidden or transparent views
    if !view.isVisible() {
      return
    }

    // Check for UITextView (TextEditor, SwiftUI.TextEditorTextView, SwiftUI.UIKitTextView)
    if let textView = view as? UITextView {
      if isTextViewSensitive(textView) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // Check for UITextField (SwiftUI: TextField, SecureField)
    if let textField = view as? UITextField {
      if isTextFieldSensitive(textField) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // React Native text views
    if let reactNativeTextView = reactNativeTextView {
      if view.isKind(of: reactNativeTextView), maskTextInputs {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // React Native text inputs
    if let reactNativeTextInput = reactNativeTextInput {
      if view.isKind(of: reactNativeTextInput), maskTextInputs {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    if let reactNativeTextInputView = reactNativeTextInputView {
      if view.isKind(of: reactNativeTextInputView), maskTextInputs {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // UIImageView (SwiftUI: Some control images like the ones in Picker view)
    if let imageView = view as? UIImageView {
      if isImageViewSensitive(imageView) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // React Native image views
    if let reactNativeImageView = reactNativeImageView {
      if view.isKind(of: reactNativeImageView), maskImages {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // UILabel (Text, this code might never be reachable in SwiftUI)
    if let label = view as? UILabel {
      if isLabelSensitive(label) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // WKWebView (Link, this code might never be reachable in SwiftUI)
    if let webView = view as? WKWebView {
      if isAnyInputSensitive(webView) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // UIButton (SwiftUI: SwiftUI.UIKitIconPreferringButton and other subclasses)
    if let button = view as? UIButton {
      if isButtonSensitive(button) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // UISwitch (SwiftUI: Toggle)
    if let theSwitch = view as? UISwitch {
      if isSwitchSensitive(theSwitch) {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // UIPickerView (SwiftUI: Picker with .pickerStyle(.wheel))
    if let picker = view as? UIPickerView {
      if isTextInputSensitive(picker), !view.subviews.isEmpty {
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
    if swiftUITextBasedViewTypes.contains(where: view.isKind(of:)) {
      if isTextInputSensitive(view), !hasSubViews {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // SwiftUI: Image based views like Image, AsyncImage
    if swiftUIImageLayerTypes.contains(where: view.layer.isKind(of:)) {
      if isSwiftUIImageSensitive(view), !hasSubViews {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // Generic SwiftUI types
    if swiftUIGenericTypes.contains(where: { view.isKind(of: $0) }), !isSwiftUILayerSafe(view.layer) {
      if isTextInputSensitive(view), !hasSubViews {
        maskableWidgets.append(view.toAbsoluteRect(window))
        return
      }
    }

    // Recursively check subviews
    if !view.subviews.isEmpty {
      for child in view.subviews {
        if !child.isVisible() {
          continue
        }
        findMaskableWidgets(child, window, &maskableWidgets, &maskChildren)
      }
    }
    maskChildren = false
  }

  // MARK: - Sensitive Content Detection Methods

  private func isAnyInputSensitive(_ view: UIView) -> Bool {
    return isTextInputSensitive(view) || maskImages
  }

  private func isTextInputSensitive(_ view: UIView) -> Bool {
    return maskTextInputs || view.isNoCapture()
  }

  private func isLabelSensitive(_ view: UILabel) -> Bool {
    return isTextInputSensitive(view) && hasText(view.text)
  }

  private func isButtonSensitive(_ view: UIButton) -> Bool {
    return isTextInputSensitive(view) && hasText(view.titleLabel?.text)
  }

  private func isTextViewSensitive(_ view: UITextView) -> Bool {
    return (isTextInputSensitive(view) || view.isSensitiveText()) && hasText(view.text)
  }

  private func isSwitchSensitive(_ view: UISwitch) -> Bool {
    var containsText = true
    if #available(iOS 14.0, *) {
      containsText = hasText(view.title)
    }
    return isTextInputSensitive(view) && containsText
  }

  private func isTextFieldSensitive(_ view: UITextField) -> Bool {
    return (isTextInputSensitive(view) || view.isSensitiveText()) && (hasText(view.text) || hasText(view.placeholder))
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


      // Use the same scale as the original image to maintain quality
      UIGraphicsBeginImageContextWithOptions(newSize, false, image.scale)
      image.draw(in: CGRect(origin: .zero, size: newSize))
      let newImage = UIGraphicsGetImageFromCurrentImageContext()
      UIGraphicsEndImageContext()
      return newImage ?? image
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
    if let cb = gestureCallback { cb([gestureEvent]) }
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
    if let cb = gestureCallback { cb([gestureEvent]) }
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
    if let cb = gestureCallback { cb([gestureEvent]) }
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
    if let cb = gestureCallback { cb([gestureEvent]) }
  }

  // MARK: - UIGestureRecognizerDelegate
  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
    return true
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    return true
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
    // Check for common patterns that indicate sensitive content


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
