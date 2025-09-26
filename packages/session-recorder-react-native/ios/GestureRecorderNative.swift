import UIKit
import React

// Temporary solution: Embed GestureTargetFinder functionality directly
// TODO: Fix module linking to properly separate these files
struct GestureTargetInfo {
    let identifier: String
    let label: String?
    let role: String?
    let testId: String?
    let text: String?
}

enum GestureTargetFinder {
    static func findTargetView(at point: CGPoint, in view: UIView) -> GestureTargetInfo {
        let targetView = view.hitTest(point, with: nil)

        guard let target = targetView else {
            return GestureTargetInfo(identifier: "unknown", label: nil, role: nil, testId: nil, text: nil)
        }

        let identifier = target.accessibilityIdentifier ?? target.accessibilityLabel ?? "view-\(target.hash)"
        let label = target.accessibilityLabel
        let role = roleFromAccessibilityTraits(target.accessibilityTraits)
        let testId = target.accessibilityIdentifier

        var text: String?
        if let labelView = target as? UILabel {
            text = labelView.text
        } else if let button = target as? UIButton {
            text = button.titleLabel?.text
        } else if let textField = target as? UITextField {
            text = textField.text ?? textField.placeholder
        } else if let textView = target as? UITextView {
            text = textView.text
        }

        return GestureTargetInfo(identifier: identifier, label: label, role: role, testId: testId, text: text)
    }

    static func roleFromAccessibilityTraits(_ traits: UIAccessibilityTraits) -> String? {
        if traits.contains(.button) { return "button" }
        if traits.contains(.link) { return "link" }
        if traits.contains(.image) { return "image" }
        if traits.contains(.staticText) { return "text" }
        if traits.contains(.header) { return "header" }
        if traits.contains(.searchField) { return "search" }
        if traits.contains(.keyboardKey) { return "key" }
        if traits.contains(.adjustable) { return "adjustable" }
        if traits.contains(.tabBar) { return "tabbar" }
        return nil
    }
}

@objc(GestureRecorderNative)
class GestureRecorderNative: RCTEventEmitter {

    private var isRecording = false
    private var gestureCallback: RCTResponseSenderBlock?
    private var rootViewController: UIViewController?

    // Gesture recognizers
    private var tapGestureRecognizer: UITapGestureRecognizer?
    private var panGestureRecognizer: UIPanGestureRecognizer?
    private var longPressGestureRecognizer: UILongPressGestureRecognizer?
    private var pinchGestureRecognizer: UIPinchGestureRecognizer?

    override func supportedEvents() -> [String]! {
        return ["onGestureDetected"]
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

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
            "timestamp": Date().timeIntervalSince1970 * 1000, // Convert to milliseconds
            "x": x.doubleValue,
            "y": y.doubleValue,
            "target": target ?? "",
            "metadata": metadata ?? [:]
        ]

        sendEvent(withName: "onGestureDetected", body: gestureEvent)
    }

    private func setupGestureRecognizers() {
        guard let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }),
              let rootViewController = window.rootViewController else {
            return
        }

        self.rootViewController = rootViewController

        // Tap gesture recognizer
        tapGestureRecognizer = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        tapGestureRecognizer?.numberOfTapsRequired = 1
        tapGestureRecognizer?.numberOfTouchesRequired = 1
        rootViewController.view.addGestureRecognizer(tapGestureRecognizer!)

        // Pan gesture recognizer
        panGestureRecognizer = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        rootViewController.view.addGestureRecognizer(panGestureRecognizer!)

        // Long press gesture recognizer
        longPressGestureRecognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
        longPressGestureRecognizer?.minimumPressDuration = 0.5
        rootViewController.view.addGestureRecognizer(longPressGestureRecognizer!)

        // Pinch gesture recognizer
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

        if let tapGesture = tapGestureRecognizer {
            rootViewController.view.removeGestureRecognizer(tapGesture)
        }
        if let panGesture = panGestureRecognizer {
            rootViewController.view.removeGestureRecognizer(panGesture)
        }
        if let longPressGesture = longPressGestureRecognizer {
            rootViewController.view.removeGestureRecognizer(longPressGesture)
        }
        if let pinchGesture = pinchGestureRecognizer {
            rootViewController.view.removeGestureRecognizer(pinchGesture)
        }

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
                "label": target.label,
                "role": target.role,
                "testId": target.testId,
                "text": target.text
            ],
            "metadata": [
                "pressure": 1.0
            ]
        ]

        sendEvent(withName: "onGestureDetected", body: gestureEvent)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        guard let view = gesture.view else { return }
        let location = gesture.location(in: view)
        let velocity = gesture.velocity(in: view)
        let translation = gesture.translation(in: view)

        let target = GestureTargetFinder.findTargetView(at: location, in: view)

        var gestureType: String
        switch gesture.state {
        case .began:
            gestureType = "pan_start"
        case .changed:
            gestureType = "pan_move"
        case .ended, .cancelled:
            gestureType = "pan_end"
        default:
            return
        }

        let gestureEvent: [String: Any] = [
            "type": gestureType,
            "timestamp": Date().timeIntervalSince1970 * 1000,
            "x": location.x,
            "y": location.y,
            "target": target.identifier,
            "targetInfo": [
                "identifier": target.identifier,
                "label": target.label,
                "role": target.role,
                "testId": target.testId,
                "text": target.text
            ],
            "metadata": [
                "velocity": sqrt(velocity.x * velocity.x + velocity.y * velocity.y),
                "deltaX": translation.x,
                "deltaY": translation.y
            ]
        ]

        sendEvent(withName: "onGestureDetected", body: gestureEvent)
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
                "label": target.label,
                "role": target.role,
                "testId": target.testId,
                "text": target.text
            ],
            "metadata": [
                "duration": 0.5,
                "pressure": 1.0
            ]
        ]

        sendEvent(withName: "onGestureDetected", body: gestureEvent)
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
                "label": target.label,
                "role": target.role,
                "testId": target.testId,
                "text": target.text
            ],
            "metadata": [
                "scale": scale,
                "velocity": velocity
            ]
        ]

        sendEvent(withName: "onGestureDetected", body: gestureEvent)
    }

    // Target finding extracted to GestureTargetFinder
}

// MARK: - UIGestureRecognizerDelegate
extension GestureRecorderNative: UIGestureRecognizerDelegate {
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        return true
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        return true
    }
}
