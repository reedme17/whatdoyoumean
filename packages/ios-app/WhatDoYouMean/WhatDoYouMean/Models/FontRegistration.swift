import CoreText
import UIKit

/// Register custom fonts at runtime — avoids Info.plist conflicts.
/// Call once from App init.
enum FontRegistration {
    static func registerFonts() {
        let fontFiles = [
            "Lora-VariableFont_wght",
            "Lora-Italic-VariableFont_wght",
            "NunitoSans-VariableFont_YTLC,opsz,wdth,wght",
            "NunitoSans-Italic-VariableFont_YTLC,opsz,wdth,wght",
        ]

        for name in fontFiles {
            if let url = Bundle.main.url(forResource: name, withExtension: "ttf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }

    /// Debug: print all available font names to console.
    /// Call this once to find the exact PostScript names for Font.custom().
    static func printAvailableFonts() {
        for family in UIFont.familyNames.sorted() {
            print("Family: \(family)")
            for name in UIFont.fontNames(forFamilyName: family) {
                print("  - \(name)")
            }
        }
    }
}
