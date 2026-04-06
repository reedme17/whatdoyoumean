import SwiftUI

/// Recap screen — shown after session ends.
/// Matches Mac RecapScreen.tsx layout: serif title top-left, cards, bottom bar with New session + X.
struct RecapScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(SessionCoordinator.self) private var coordinator

    var body: some View {
        VStack(spacing: 0) {
            // Cards area
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Title
                    Text("Session recap")
                        .font(Tokens.Fonts.serif(size: 20))
                        .foregroundStyle(Tokens.Colors.warmText)
                        .padding(.horizontal, Tokens.Spacing.xl)
                        .padding(.top, 12)
                        .padding(.bottom, 4)

                    // Speaker-grouped cards
                    LazyVStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
                        ForEach(groupedCards, id: \.speakerKey) { group in
                            SpeakerGroup(group: group)
                        }
                    }
                    .padding(.vertical, Tokens.Spacing.md)

                    if appState.cards.isEmpty {
                        Text("Nothing was captured in this session.")
                            .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                            .foregroundStyle(Tokens.Colors.warmTextLight)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 64)
                    }
                }
            }

            // Bottom bar: New session (left) — X (right)
            HStack {
                Button {
                    appState.reset()
                    appState.startSession()
                    coordinator.startSession()
                } label: {
                    Text("New session")
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .bold))
                        .foregroundStyle(Tokens.Colors.muted)
                        .frame(height: 44)
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    coordinator.disconnect()
                    appState.reset()
                } label: {
                    XIcon(size: 20, color: Tokens.Colors.muted)
                        .allowsHitTesting(false)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close recap")
            }
            .padding(.horizontal, Tokens.Spacing.xl)
            .padding(.bottom, Tokens.Spacing.xl)
        }
        .background(Tokens.Colors.background)
    }

    private var groupedCards: [SpeakerCardGroup] {
        var groups: [SpeakerCardGroup] = []
        for card in appState.cards {
            let key = card.speakerId ?? ""
            let name = appState.speakers[key] ?? "Speaker 1"
            if let last = groups.last, last.speakerKey == key {
                groups[groups.count - 1].cards.append(card)
            } else {
                groups.append(SpeakerCardGroup(speakerKey: key, speakerName: name, cards: [card]))
            }
        }
        return groups
    }
}
