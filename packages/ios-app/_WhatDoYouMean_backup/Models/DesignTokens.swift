import SwiftUI

/// Design tokens — mirrors shared/tokens.ts.
enum Tokens {

    // MARK: - Colors

    enum Colors {
        static let background = Color(hex: "#ffffff")
        static let foreground = Color(hex: "#09090b")
        static let muted = Color(hex: "#71717a")
        static let mutedForeground = Color(hex: "#a1a1aa")
        static let border = Color(hex: "#e4e4e7")
        static let primary = Color(hex: "#18181b")
        static let primaryForeground = Color(hex: "#fafafa")
        static let secondary = Color(hex: "#f4f4f5")
        static let secondaryForeground = Color(hex: "#18181b")
        static let destructive = Color(hex: "#ef4444")
        static let accent = Color(hex: "#f4f4f5")
        static let card = Color(hex: "#ffffff")
        static let cardForeground = Color(hex: "#09090b")

        // App-specific warm palette (from Tailwind classes in React)
        static let warmBg = Color(hex: "#F0EDE8")
        static let warmBgHover = Color(hex: "#E8E4DE")
        static let warmText = Color(hex: "#60594D")
        static let warmTextLight = Color(hex: "#93918E")
        static let warmTextDark = Color(hex: "#5B5449")
        static let contentText = Color(hex: "#171717")
    }

    // MARK: - Typography

    enum FontSize {
        static let xs: CGFloat = 12
        static let sm: CGFloat = 14
        static let base: CGFloat = 16
        static let lg: CGFloat = 18
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 30
    }

    // MARK: - Spacing

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
    }

    // MARK: - Radius

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 6
        static let lg: CGFloat = 8
        static let xl: CGFloat = 16
        static let full: CGFloat = 9999
    }

    // MARK: - Animation

    enum Duration {
        static let fast: Double = 0.15
        static let normal: Double = 0.2
        static let slow: Double = 0.3
    }
}

// MARK: - Color hex initializer

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: Double
        switch hex.count {
        case 6:
            r = Double((int >> 16) & 0xFF) / 255
            g = Double((int >> 8) & 0xFF) / 255
            b = Double(int & 0xFF) / 255
        default:
            r = 1; g = 1; b = 1
        }
        self.init(red: r, green: g, blue: b)
    }
}
