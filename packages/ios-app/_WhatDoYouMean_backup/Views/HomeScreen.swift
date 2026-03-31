import SwiftUI

/// Home screen — mirrors HomeScreen.tsx.
/// Editorial idle state with "Start listening" button.
struct HomeScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Tagline
            Text("Ready to interpret for you.")
                .font(.system(size: Tokens.FontSize.xl, design: .serif))
                .foregroundStyle(Tokens.Colors.warmText)

            Spacer().frame(height: Tokens.Spacing.xl)

            // Action buttons
            HStack(spacing: Tokens.Spacing.md) {
                // Start listening button
                Button {
                    appState.startSession()
                } label: {
                    Text("Start listening")
                        .font(.system(size: Tokens.FontSize.sm, weight: .bold))
                        .foregroundStyle(Tokens.Colors.warmTextDark)
                        .padding(.horizontal, Tokens.Spacing.lg)
                        .padding(.vertical, Tokens.Spacing.sm)
                        .background(Tokens.Colors.warmBg)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)

                // Text mode button
                Button {
                    appState.screen = .text
                } label: {
                    Image(systemName: "keyboard")
                        .font(.system(size: Tokens.FontSize.xl))
                        .foregroundStyle(Tokens.Colors.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Switch to text input mode")
            }

            Spacer()

            // Bottom menu
            HStack {
                Spacer()
                Button {
                    appState.screen = .history
                } label: {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: Tokens.FontSize.xl))
                        .foregroundStyle(Tokens.Colors.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Open menu")
            }
            .padding(Tokens.Spacing.sm)
        }
        .padding(Tokens.Spacing.sm)
        .background(Tokens.Colors.background)
    }
}
