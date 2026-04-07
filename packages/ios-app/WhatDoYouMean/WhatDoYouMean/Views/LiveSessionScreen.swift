import SwiftUI

/// Live session screen — mirrors LiveSession.tsx.
/// Shows cards grouped by speaker, with bottom bar controls.
struct LiveSessionScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(SessionCoordinator.self) private var coordinator

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

            // Waveform above bottom bar
            WaveformView(
                samples: coordinator.audio.waveformSamples,
                isCapturing: coordinator.audio.isCapturing
            )
            .padding(.horizontal, Tokens.Spacing.xl)

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
    var onToggleMark: ((String) -> Void)? = nil
    var onRenameSpeaker: ((String, String) -> Void)? = nil  // (speakerKey, newName)

    @State private var showRename = false
    @State private var editName = ""

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
            // Speaker name + rename button
            HStack(alignment: .firstTextBaseline, spacing: Tokens.Spacing.sm) {
                Text(group.speakerName)
                    .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .semibold))
                    .foregroundStyle(Tokens.Colors.warmText)

                if onRenameSpeaker != nil {
                    Button {
                        editName = group.speakerName.hasPrefix("Speaker") ? "" : group.speakerName
                        showRename = true
                    } label: {
                        Text(group.speakerName.hasPrefix("Speaker") ? "Add name" : "Edit")
                            .font(Tokens.Fonts.sans(size: 10, weight: .bold))
                            .foregroundStyle(Tokens.Colors.warmTextDark)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Tokens.Colors.warmBg)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .popover(isPresented: $showRename, attachmentAnchor: .point(.trailing), arrowEdge: .leading) {
                        VStack(spacing: Tokens.Spacing.sm) {
                            TextField("Enter name...", text: $editName)
                                .font(Tokens.Fonts.sans(size: Tokens.FontSize.xs))
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 180)
                                .onSubmit { saveName() }

                            HStack {
                                Button("Cancel") { showRename = false }
                                    .font(Tokens.Fonts.sans(size: 10))
                                    .foregroundStyle(Tokens.Colors.warmTextLight)
                                    .buttonStyle(.plain)
                                Spacer()
                                // "Apply to all Speaker X" — shows when speaker hasn't been globally renamed
                                if group.speakerName.hasPrefix("Speaker") {
                                    Button("Apply to all \(group.speakerName)") {
                                        let trimmed = editName.trimmingCharacters(in: .whitespacesAndNewlines)
                                        guard !trimmed.isEmpty else { return }
                                        onRenameSpeaker?(group.speakerKey, trimmed)
                                        showRename = false
                                    }
                                    .font(Tokens.Fonts.sans(size: 10, weight: .medium))
                                    .foregroundStyle(
                                        editName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                            ? Tokens.Colors.warmTextLight.opacity(0.5)
                                            : Tokens.Colors.warmTextDark
                                    )
                                    .buttonStyle(.plain)
                                    .disabled(editName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                                }
                                Button("Save") { saveName() }
                                    .font(Tokens.Fonts.sans(size: 10, weight: .medium))
                                    .foregroundStyle(Tokens.Colors.warmTextDark)
                                    .buttonStyle(.plain)
                            }
                        }
                        .padding(Tokens.Spacing.md)
                        .presentationCompactAdaptation(.popover)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(group.cards.enumerated()), id: \.element.id) { index, card in
                    if index > 0 {
                        Divider()
                            .padding(.vertical, 8)
                    }
                    CoreMeaningCardRow(card: card, onToggleMark: onToggleMark)
                }
            }
        }
        .padding(.horizontal, Tokens.Spacing.xl)
        .padding(.vertical, Tokens.Spacing.md)
    }

    private func saveName() {
        let trimmed = editName.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            // Reset to default
            onRenameSpeaker?(group.speakerKey, "Speaker \(group.speakerKey == "" ? "1" : group.speakerKey)")
        } else {
            onRenameSpeaker?(group.speakerKey, trimmed)
        }
        showRename = false
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
