import SwiftUI

/// History / menu screen — mirrors ExpandPanel.tsx + HistoryView.tsx.
/// Shows past sessions list.
struct HistoryScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 0) {
            // Top bar
            HStack {
                Button {
                    appState.screen = .home
                } label: {
                    Image(systemName: "chevron.left")
                        .foregroundStyle(Tokens.Colors.muted)
                }
                .buttonStyle(.plain)

                Spacer()

                Text("History")
                    .font(.system(size: Tokens.FontSize.sm, weight: .semibold))
                    .foregroundStyle(Tokens.Colors.warmText)

                Spacer()

                Color.clear.frame(width: 24, height: 24)
            }
            .padding(.horizontal, Tokens.Spacing.xl)
            .padding(.vertical, Tokens.Spacing.md)

            Divider()

            // Empty state
            Spacer()
            VStack(spacing: Tokens.Spacing.md) {
                Image(systemName: "clock")
                    .font(.system(size: 32))
                    .foregroundStyle(Tokens.Colors.warmTextLight)
                Text("No sessions yet")
                    .font(.system(size: Tokens.FontSize.sm))
                    .foregroundStyle(Tokens.Colors.warmTextLight)
            }
            Spacer()
        }
        .background(Tokens.Colors.background)
    }
}
