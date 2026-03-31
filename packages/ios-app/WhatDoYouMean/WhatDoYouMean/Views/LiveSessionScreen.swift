import SwiftUI

/// Live session screen — mirrors LiveSession.tsx.
/// Shows cards grouped by speaker, with bottom bar controls.
struct LiveSessionScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 0) {
            // Card area (scrollable)
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
                        ForEach(groupedCards, id: \.speakerKey) { group in
                            SpeakerGroup(group: group)
                        }

                        // Anchor for auto-scroll
                        Color.clear
                            .frame(height: 1)
                            .id("bottom")
                    }
                    .padding(.horizontal, Tokens.Spacing.xl)
                }
                .onChange(of: appState.cards.count) {
                    withAnimation {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }
            }

            // Pending preview text
            if !appState.pendingPreview.isEmpty {
                PendingPreviewBar(text: appState.pendingPreview)
            }

            // Bottom bar
            BottomBarView()
        }
        .background(Tokens.Colors.background.ignoresSafeArea())
    }

    /// Group cards by sequential speaker runs (same logic as LiveSession.tsx)
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

struct SpeakerCardGroup: Identifiable {
    let speakerKey: String
    let speakerName: String
    var cards: [CoreMeaningCard]
    var id: String { speakerKey + "_\(cards.first?.id ?? "")" }
}

struct SpeakerGroup: View {
    let group: SpeakerCardGroup

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
            Text(group.speakerName)
                .font(.system(size: Tokens.FontSize.sm, weight: .semibold))
                .foregroundStyle(Tokens.Colors.warmText)

            ForEach(group.cards) { card in
                CoreMeaningCardRow(card: card)
            }
        }
        .padding(.horizontal, Tokens.Spacing.xl)
        .padding(.vertical, Tokens.Spacing.md)
    }
}

struct PendingPreviewBar: View {
    let text: String

    var body: some View {
        HStack {
            Text(text + "...")
                .font(.system(size: Tokens.FontSize.sm, weight: .medium))
                .foregroundStyle(Tokens.Colors.contentText)
                .lineLimit(3)
            Spacer()
        }
        .padding(.horizontal, Tokens.Spacing.xl)
        .padding(.vertical, Tokens.Spacing.sm)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
