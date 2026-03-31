import SwiftUI

/// History screen — standalone fallback, but primary history is in SidePanel.
/// Kept for direct navigation if needed.
struct HistoryScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 0) {
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

            if appState.sessionHistory.isEmpty {
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
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(appState.sessionHistory) { session in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(session.topicSummary)
                                    .font(.system(size: Tokens.FontSize.xs, weight: .semibold))
                                    .foregroundStyle(Tokens.Colors.warmText)
                                    .lineLimit(1)
                                HStack(spacing: 4) {
                                    Text(session.relativeTime)
                                    Text("·")
                                    Text(session.mode == "online" ? "Audio" : "Text")
                                }
                                .font(.system(size: 10))
                                .foregroundStyle(Tokens.Colors.warmTextLight)
                            }
                            .padding(.horizontal, Tokens.Spacing.xl)
                            .padding(.vertical, Tokens.Spacing.sm)
                        }
                    }
                }
            }
        }
        .background(Tokens.Colors.background)
    }
}
