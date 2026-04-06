import SwiftUI

/// Text mode — mirrors TextModeScreen.tsx.
/// Manual text input for when audio isn't available.
struct TextModeScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(SessionCoordinator.self) private var coordinator
    @State private var inputText = ""
    @FocusState private var focused: Bool

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

                Text("Text Mode")
                    .font(.system(size: Tokens.FontSize.sm, weight: .semibold))
                    .foregroundStyle(Tokens.Colors.warmText)

                Spacer()

                // Spacer for symmetry
                Color.clear.frame(width: 24, height: 24)
            }
            .padding(.horizontal, Tokens.Spacing.xl)
            .padding(.vertical, Tokens.Spacing.md)

            Divider()

            // Cards area
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
                    ForEach(appState.cards) { card in
                        CoreMeaningCardRow(card: card)
                    }
                }
                .padding(Tokens.Spacing.xl)
            }

            Divider()

            // Input area
            HStack(spacing: Tokens.Spacing.md) {
                TextField("Type something to analyze...", text: $inputText, axis: .vertical)
                    .font(.system(size: Tokens.FontSize.sm))
                    .lineLimit(1...4)
                    .focused($focused)
                    .onSubmit { sendText() }

                Button {
                    sendText()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(
                            inputText.isEmpty
                                ? Tokens.Colors.warmTextLight
                                : Tokens.Colors.warmText
                        )
                }
                .buttonStyle(.plain)
                .disabled(inputText.isEmpty)
            }
            .padding(.horizontal, Tokens.Spacing.xl)
            .padding(.vertical, Tokens.Spacing.md)
        }
        .background(Tokens.Colors.background.ignoresSafeArea())
        .onAppear { focused = true }
    }

    private func sendText() {
        guard !inputText.isEmpty else { return }
        let text = inputText
        inputText = ""

        if appState.processingMode == .local || appState.processingMode == .fusion {
            coordinator.processTextLocally(text)
        }
        if appState.processingMode == .cloud || appState.processingMode == .fusion {
            coordinator.socket.send(type: "text:submit", data: ["text": text])
        }
    }
}
