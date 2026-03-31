import SwiftUI

/// Global app state — mirrors the top-level state in App.tsx.
@Observable
class AppState {
    var screen: Screen = .home
    var cards: [CoreMeaningCard] = []
    var currentCard: CoreMeaningCard? = nil
    var recommendations: [Recommendation] = []
    var speakers: [String: String] = [:]  // speakerId -> displayName
    var pendingPreview: String = ""
    var sessionStartTime: Date? = nil
    var isCapturing: Bool = false
    var connected: Bool = false

    // Settings
    var sttLanguage: SttLanguage = .zhEn
    var responseEnabled: Bool = false
    var audioSource: AudioSourceMode = .mic

    enum Screen: Equatable {
        case home
        case live
        case text
        case recap
        case history
    }

    func startSession() {
        cards = []
        currentCard = nil
        recommendations = []
        pendingPreview = ""
        sessionStartTime = Date()
        screen = .live
    }

    func endSession() {
        isCapturing = false
        screen = .recap
    }

    func reset() {
        cards = []
        currentCard = nil
        recommendations = []
        pendingPreview = ""
        sessionStartTime = nil
        isCapturing = false
        screen = .home
    }
}
