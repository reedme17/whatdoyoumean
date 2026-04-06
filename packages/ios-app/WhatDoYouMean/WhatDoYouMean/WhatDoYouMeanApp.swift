import SwiftUI

@main
struct WhatDoYouMeanApp: App {
    @State private var appState = AppState()
    @State private var coordinator = SessionCoordinator()

    init() {
        FontRegistration.registerFonts()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .environment(coordinator)
                .onAppear {
                    coordinator.bind(to: appState)
                }
        }
    }
}
