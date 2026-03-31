import SwiftUI

/// Root view — mirrors App.tsx routing logic.
/// Routes between Home, LiveSession, TextMode, and Recap screens.
struct ContentView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        ZStack {
            switch appState.screen {
            case .home:
                HomeScreen()
            case .live:
                LiveSessionScreen()
            case .text:
                TextModeScreen()
            case .recap:
                RecapScreen()
            case .history:
                HistoryScreen()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: appState.screen)
    }
}
