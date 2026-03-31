import SwiftUI

/// Recap screen — shown after session ends.
/// Mirrors RecapScreen.tsx — shows all cards with speaker grouping.
struct RecapScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 0) {
            // Top bar
            HStack {
                Button {
                    appState.reset()
                } label: {
                    Image(systemName: "xmark")
                        .foregroundStyle(Tokens.Colors.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close recap")

                Spacer()

                Text("Recap")
                    .font(.system(size: Tokens.FontSize.sm, weight: .semibold))
                    .foregroundStyle(Tokens.Colors.warmText)

                Spacer()

                // Share / export button
                Button {
                    // TODO: share session
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundStyle(Tokens.Colors.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Share recap")
            }
            .padding(.horizontal, Tokens.Spacing.xl)
            .padding(.vertical, Tokens.Spacing.md)

            Divider()

            // Cards
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
                    ForEach(groupedCards, id: \.speakerKey) { group in
                        SpeakerGroup(group: group)
                    }
                }
                .padding(.vertical, Tokens.Spacing.md)
            }

            // Done button
            Button {
                appState.reset()
            } label: {
                Text("Done")
                    .font(.system(size: Tokens.FontSize.sm, weight: .bold))
                    .foregroundStyle(Tokens.Colors.warmTextDark)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Tokens.Spacing.md)
                    .background(Tokens.Colors.warmBg)
                    .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.xl))
            }
            .buttonStyle(.plain)
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
