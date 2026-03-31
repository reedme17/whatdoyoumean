import SwiftUI

@main
struct WhatDoYouMeanApp: App {
    @State private var appState = AppState()

    init() {
        FontRegistration.registerFonts()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
        }
    }
}
