import SwiftUI

/// Design tokens — matches globals.css exactly.
/// Fonts: Lora (serif), Nunito Sans (sans), Inconsolata (mono)
/// To use custom fonts, add .ttf/.otf files to the Xcode project and register in Info.plist.
/// For now, we use system fonts with matching design traits as fallback.
enum Tokens {

    // MARK: - Colors (from globals.css @theme)

    enum Colors {
        static let background = Color(hex: "#FAF8F5")
        static let foreground = Color(hex: "#1A1A1A")
        static let muted = Color(hex: "#8C8578")
        static let mutedForeground = Color(hex: "#A89F94")
        static let border = Color(hex: "#E8E4DE")
        static let primary = Color(hex: "#1A1A1A")
        static let primaryForeground = Color(hex: "#FAF8F5")
        static let secondary = Color(hex: "#F0ECE6")
        static let secondaryForeground = Color(hex: "#1A1A1A")
        static let destructive = Color(hex: "#C4553A")
        static let accent = Color(hex: "#F0ECE6")
        static let card = Color(hex: "#FFFFFF")
        static let cardForeground = Color(hex: "#1A1A1A")

        // App-specific warm palette (from Tailwind classes)
        static let warmBg = Color(hex: "#F0EDE8")
        static let warmBgHover = Color(hex: "#E8E4DE")
        static let warmText = Color(hex: "#60594D")
        static let warmTextLight = Color(hex: "#93918E")
        static let warmTextDark = Color(hex: "#5B5449")
        static let contentText = Color(hex: "#171717")
    }

    // MARK: - Typography
    // Mac version: Lora (serif), Nunito Sans (sans)
    // Registered at runtime via FontRegistration.swift

    enum Fonts {
        /// Serif font — matches CSS var(--font-serif): "Lora"
        static func serif(size: CGFloat, weight: Font.Weight = .regular) -> Font {
            .custom("Lora", size: size).weight(weight)
        }

        /// Sans font — matches CSS var(--font-sans): "Nunito Sans"
        static func sans(size: CGFloat, weight: Font.Weight = .regular) -> Font {
            .custom("Nunito Sans", size: size).weight(weight)
        }

        /// Italic serif
        static func serifItalic(size: CGFloat) -> Font {
            .custom("Lora", size: size).italic()
        }
    }

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
