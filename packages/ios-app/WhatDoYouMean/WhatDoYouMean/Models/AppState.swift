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

    // Side panel
    var showSidePanel: Bool = false

    // Settings
    var sttLanguage: SttLanguage = .en
    var responseEnabled: Bool = true
    var audioSource: AudioSourceMode = .mic
    var processingMode: ProcessingMode = .local

    // History
    var sessionHistory: [SessionHistoryItem] = []

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

/// Session history item — mirrors SessionSummary in ExpandPanel.tsx.
struct SessionHistoryItem: Identifiable {
    let id: String
    let timestamp: Date
    let durationMin: Int
    let topicSummary: String
    let mode: String  // "online" | "offline" | "text"
    var cards: [CoreMeaningCard] = []

    var relativeTime: String {
        let diff = Date().timeIntervalSince(timestamp)
        let mins = Int(diff / 60)
        if mins < 1 { return "Just now" }
        if mins < 60 { return "\(mins)m ago" }
        let hrs = mins / 60
        if hrs < 24 { return "\(hrs)h ago" }
        let days = hrs / 24
        if days < 7 { return "\(days)d ago" }
        return timestamp.formatted(date: .abbreviated, time: .omitted)
    }
}
