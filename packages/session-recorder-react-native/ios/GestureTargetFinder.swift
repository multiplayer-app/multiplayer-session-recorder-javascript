import UIKit

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
