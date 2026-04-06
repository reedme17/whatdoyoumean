import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @State private var sheetContentHeight: CGFloat = 300
    @State private var selectedDetent: PresentationDetent = .height(300)

    private static let allDetents: Set<PresentationDetent> = {
        var s = Set<PresentationDetent>()
        for h in stride(from: 200, through: 800, by: 10) {
            s.insert(.height(CGFloat(h)))
        }
        return s
    }()

    var body: some View {
        @Bindable var state = appState

        mainContent
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
