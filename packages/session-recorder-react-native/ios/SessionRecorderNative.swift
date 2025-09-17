import UIKit
import React

@objc(SessionRecorderNative)
class SessionRecorderNative: NSObject {

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

      if let data = maskedImage.jpegData(compressionQuality: 0.5) {
        let base64 = data.base64EncodedString()
        resolve(base64)
      } else {
        reject("ENCODING_FAILED", "Failed to encode image", nil)
      }
    }
  }

  @objc func captureAndMaskWithOptions(_ options: NSDictionary, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
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

      // Apply masking with custom options
      let maskedImage = self.applyMaskingWithOptions(to: image, in: window, options: options)

      if let data = maskedImage.jpegData(compressionQuality: 0.5) {
        let base64 = data.base64EncodedString()
        resolve(base64)
      } else {
        reject("ENCODING_FAILED", "Failed to encode image", nil)
      }
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

    // Find and mask sensitive elements
    let sensitiveElements = findSensitiveElements(in: window)

    for element in sensitiveElements {
      let frame = element.frame
      let maskingType = getMaskingType(for: element)

      switch maskingType {
      case .blur:
        applyBlurMask(in: context, frame: frame)
      case .rectangle:
        applyRectangleMask(in: context, frame: frame)
      case .pixelate:
        applyPixelateMask(in: context, frame: frame, image: image)
      case .none:
        break
      }
    }

    let maskedImage = UIGraphicsGetImageFromCurrentImageContext() ?? image
    UIGraphicsEndImageContext()

    return maskedImage
  }

  private func findSensitiveElements(in view: UIView) -> [UIView] {
    var sensitiveElements: [UIView] = []

    func traverseView(_ view: UIView) {
      // Check if this view should be masked
      if shouldMaskView(view) {
        sensitiveElements.append(view)
      }

      // Recursively check subviews
      for subview in view.subviews {
        traverseView(subview)
      }
    }

    traverseView(view)
    return sensitiveElements
  }

  private func shouldMaskView(_ view: UIView) -> Bool {
    // Check for UITextField - mask all text fields when inputMasking is enabled
    if view is UITextField {
      return true
    }

    // Check for UITextView - mask all text views when inputMasking is enabled
    if view is UITextView {
      return true
    }

    return false
  }

  private func getMaskingType(for view: UIView) -> MaskingType {
    // Default masking type for all text inputs
    return .rectangle
  }

  private func applyBlurMask(in context: CGContext, frame: CGRect) {
    // Create a blur effect
    context.setFillColor(UIColor.black.withAlphaComponent(0.8).cgColor)
    context.fill(frame)

    // Add some noise to make it look blurred
    context.setFillColor(UIColor.white.withAlphaComponent(0.3).cgColor)
    for _ in 0..<20 {
      let randomX = frame.origin.x + CGFloat.random(in: 0...frame.width)
      let randomY = frame.origin.y + CGFloat.random(in: 0...frame.height)
      let randomSize = CGFloat.random(in: 2...8)
      context.fillEllipse(in: CGRect(x: randomX, y: randomY, width: randomSize, height: randomSize))
    }
  }

  private func applyRectangleMask(in context: CGContext, frame: CGRect) {
    // Simple rectangle fill
    context.setFillColor(UIColor.gray.cgColor)
    context.fill(frame)

    // Add some text-like pattern
    context.setFillColor(UIColor.darkGray.cgColor)
    let lineHeight: CGFloat = 4
    let spacing: CGFloat = 8

    for i in stride(from: frame.origin.y + spacing, to: frame.origin.y + frame.height - spacing, by: lineHeight + spacing) {
      let lineWidth = CGFloat.random(in: frame.width * 0.3...frame.width * 0.8)
      let lineX = frame.origin.x + CGFloat.random(in: 0...(frame.width - lineWidth))
      context.fill(CGRect(x: lineX, y: i, width: lineWidth, height: lineHeight))
    }
  }

  private func applyPixelateMask(in context: CGContext, frame: CGRect, image: UIImage) {
    // Create a pixelated effect
    let pixelSize: CGFloat = 8
    let pixelCountX = Int(frame.width / pixelSize)
    let pixelCountY = Int(frame.height / pixelSize)

    for x in 0..<pixelCountX {
      for y in 0..<pixelCountY {
        let pixelFrame = CGRect(
          x: frame.origin.x + CGFloat(x) * pixelSize,
          y: frame.origin.y + CGFloat(y) * pixelSize,
          width: pixelSize,
          height: pixelSize
        )

        // Use a random color for each pixel
        let randomColor = UIColor(
          red: CGFloat.random(in: 0...1),
          green: CGFloat.random(in: 0...1),
          blue: CGFloat.random(in: 0...1),
          alpha: 1.0
        )
        context.setFillColor(randomColor.cgColor)
        context.fill(pixelFrame)
      }
    }
  }
}

private enum MaskingType {
  case blur
  case rectangle
  case pixelate
  case none
}
