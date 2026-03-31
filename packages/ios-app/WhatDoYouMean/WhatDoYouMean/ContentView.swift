import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @State private var phase: Phase = .onboarding
    @State private var overlayOpacity: Double = 0
    @State private var homeOpacity: Double = 0
    @State private var sheetContentHeight: CGFloat = 300
    @State private var selectedDetent: PresentationDetent = .height(300)

    private static let allDetents: Set<PresentationDetent> = {
        var s = Set<PresentationDetent>()
        for h in stride(from: 200, through: 800, by: 10) {
            s.insert(.height(CGFloat(h)))
        }
        return s
    }()

    enum Phase {
        case onboarding
        case transitioning
        case home
    }

    var body: some View {
        @Bindable var state = appState

        ZStack {
            if phase != .onboarding {
                mainContent
                    .opacity(homeOpacity)
            }

            if phase == .onboarding {
                OnboardingScreen(onEnter: startTransition)
                    .zIndex(1)
            }

            if phase == .transitioning {
                Tokens.Colors.warmBg
                    .ignoresSafeArea()
                    .opacity(overlayOpacity)
                    .allowsHitTesting(false)
            }
        }
        .sheet(isPresented: $state.showSidePanel) {
            SidePanel(isPresented: $state.showSidePanel)
                .environment(appState)
                .fixedSize(horizontal: false, vertical: true)
                .background(
                    GeometryReader { geo in
                        Color.clear
                            .onChange(of: geo.size.height, initial: true) { _, h in
                                let snapped = round(h / 10) * 10
                                let clamped = max(200, min(800, snapped))
                                if clamped != sheetContentHeight {
                                    sheetContentHeight = clamped
                                    withAnimation(.easeOut(duration: 0.2)) {
                                        selectedDetent = .height(clamped)
                                    }
                                }
                            }
                    }
                )
                .presentationDetents(Self.allDetents, selection: $selectedDetent)
                .presentationDragIndicator(.visible)
                .presentationBackground(Tokens.Colors.background)
        }
        .onChange(of: appState.requestOnboarding) { _, requested in
            if requested {
                appState.requestOnboarding = false
                goToOnboarding()
            }
        }
    }

    private func startTransition() {
        overlayOpacity = 1
        homeOpacity = 0
        phase = .transitioning
        appState.hasCompletedOnboarding = true

        withAnimation(.easeOut(duration: 0.6)) {
            overlayOpacity = 0
            homeOpacity = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            phase = .home
        }
    }

    private func goToOnboarding() {
        // Fade out home, then show onboarding
        withAnimation(.easeIn(duration: 0.3)) {
            homeOpacity = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            phase = .onboarding
            appState.hasCompletedOnboarding = false
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        Group {
            switch appState.screen {
            case .home: HomeScreen()
            case .live: LiveSessionScreen()
            case .text: TextModeScreen()
            case .recap: RecapScreen()
            case .history: HistoryScreen()
            }
        }
        .animation(.easeOut(duration: 0.3), value: appState.screen)
    }
}
