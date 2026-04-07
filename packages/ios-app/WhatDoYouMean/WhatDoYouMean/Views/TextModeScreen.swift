import SwiftUI

/// Text mode — three-phase screen:
/// 1. Input phase: title top-left, left-aligned text field, bottom bar with settings + X
/// 2. Processing phase: centered "Analyzing..." transition (matches Mac processing screen)
/// 3. Result phase: recap-style card list with bottom bar (Analyze another + settings + X)
struct TextModeScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(SessionCoordinator.self) private var coordinator
    @State private var inputText = ""
    @State private var phase: Phase = .input
    @State private var showSettings = false
    @State private var processingStage = "Analyzing..."
    @State private var lastSubmittedText = ""
    @State private var lastUsedMode: ProcessingMode? = nil
    @State private var thinking = false
    @FocusState private var focused: Bool

    enum Phase { case input, processing, result }

    var body: some View {
        Group {
            switch phase {
            case .input:
                inputPhase
            case .processing:
                processingPhase
            case .result:
                resultPhase
            }
        }
        .onAppear {
            if appState.processingMode == .fusion {
                appState.processingMode = .local
            }
        }
        .onChange(of: appState.cards.count) { _, newCount in
            if phase == .processing && newCount > 0 {
                withAnimation(.easeOut(duration: 0.3)) {
                    phase = .result
                    thinking = false
                }
            }
            if phase == .result && thinking && newCount > 0 {
                withAnimation(.easeOut(duration: 0.2)) {
                    thinking = false
                }
            }
        }
        .onChange(of: appState.processingMode) { _, newMode in
            // Re-analyze in-place if mode changed while viewing results
            if phase == .result, let oldMode = lastUsedMode, oldMode != newMode,
               !lastSubmittedText.isEmpty {
                reanalyze(lastSubmittedText)
            }
        }
    }

    // MARK: - Input Phase

    private var inputPhase: some View {
        VStack(spacing: 0) {
            // Title — same position & style as RecapScreen
            HStack {
                Text("Analyze text")
                    .font(Tokens.Fonts.serif(size: 20))
                    .foregroundStyle(Tokens.Colors.warmText)
                Spacer()
                Button {
                    submitText()
                } label: {
                    Text("Analyze")
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .bold))
                        .foregroundStyle(
                            inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? Tokens.Colors.warmTextLight
                                : Tokens.Colors.warmTextDark
                        )
                        .padding(.horizontal, Tokens.Spacing.lg)
                        .padding(.vertical, Tokens.Spacing.sm)
                        .background(
                            inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? Tokens.Colors.warmBg.opacity(0.5)
                                : Tokens.Colors.warmBg
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, Tokens.Spacing.xl)
            .padding(.top, 12)
            .padding(.bottom, 4)

            // Content area — left-aligned text input
            ScrollView {
                TextField("Paste or type text here...", text: $inputText, axis: .vertical)
                    .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                    .foregroundStyle(Tokens.Colors.contentText)
                    .lineLimit(1...100)
                    .focused($focused)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, 40)
                    .padding(.vertical, Tokens.Spacing.xl)
                    .onSubmit { submitText() }
            }

            // Bottom bar
            bottomBar(showAction: false)
        }
        .background(Tokens.Colors.background)
        .onAppear { focused = true }
    }

    // MARK: - Processing Phase (matches Mac processing screen)

    private var processingPhase: some View {
        VStack {
            Spacer()
            Text(processingStage)
                .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                .foregroundStyle(Tokens.Colors.warmTextLight)
                .transition(.opacity)
                .animation(.easeOut(duration: 0.8), value: processingStage)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Tokens.Colors.background)
        .onAppear {
            // Fallback: if no cards arrive within 15s, show result anyway
            DispatchQueue.main.asyncAfter(deadline: .now() + 15) {
                if phase == .processing {
                    withAnimation { phase = .result }
                }
            }
        }
    }

    // MARK: - Result Phase

    private var resultPhase: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Result")
                        .font(Tokens.Fonts.serif(size: 20))
                        .foregroundStyle(Tokens.Colors.warmText)
                        .padding(.horizontal, Tokens.Spacing.xl)
                        .padding(.top, 12)
                        .padding(.bottom, 4)

                    LazyVStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
                        ForEach(appState.cards) { card in
                            CoreMeaningCardRow(card: card)
                        }
                    }
                    .padding(.horizontal, Tokens.Spacing.xl)
                    .padding(.vertical, Tokens.Spacing.md)

                    if appState.cards.isEmpty {
                        if thinking {
                            Text("Thinking...")
                                .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                                .foregroundStyle(Tokens.Colors.warmTextLight)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 64)
                                .transition(.opacity)
                        } else {
                            Text("No results.")
                                .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                                .foregroundStyle(Tokens.Colors.warmTextLight)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 64)
                        }
                    }

                    // Recommendations — matches Mac RecommendationTokens
                    if appState.responseEnabled && !appState.recommendations.isEmpty {
                        HStack(alignment: .top, spacing: Tokens.Spacing.sm) {
                            CornerDownRightIcon(size: 14, color: Tokens.Colors.warmTextLight)
                                .padding(.top, 3)

                            // Wrap pills in a flow layout
                            FlowLayout(spacing: 6) {
                                ForEach(appState.recommendations) { rec in
                                    Text(rec.text)
                                        .font(Tokens.Fonts.sans(size: 10, weight: .medium))
                                        .foregroundStyle(Tokens.Colors.warmText)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 3)
                                        .overlay(
                                            Capsule()
                                                .stroke(Tokens.Colors.border, lineWidth: 1)
                                        )
                                }
                            }
                        }
                        .padding(.horizontal, Tokens.Spacing.xl)
                        .padding(.top, Tokens.Spacing.sm)
                    } else if appState.responseEnabled && !appState.cards.isEmpty && appState.recommendations.isEmpty {
                        // Waiting for recommendations
                        HStack(spacing: Tokens.Spacing.sm) {
                            CornerDownRightIcon(size: 14, color: Tokens.Colors.warmTextLight)
                            Text("Thinking...")
                                .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm))
                                .foregroundStyle(Tokens.Colors.warmTextLight)
                        }
                        .padding(.horizontal, Tokens.Spacing.xl)
                        .padding(.top, Tokens.Spacing.sm)
                    }
                }
            }

            // Bottom bar with "Analyze another"
            bottomBar(showAction: true)
        }
        .background(Tokens.Colors.background)
    }

    // MARK: - Shared Bottom Bar

    private func bottomBar(showAction: Bool) -> some View {
        HStack {
            if showAction {
                Button {
                    appState.cards = []
                    appState.recommendations = []
                    inputText = ""
                    phase = .input
                } label: {
                    Text("Analyze another")
                        .font(Tokens.Fonts.sans(size: Tokens.FontSize.sm, weight: .bold))
                        .foregroundStyle(Tokens.Colors.muted)
                        .frame(height: 44)
                }
                .buttonStyle(.plain)
            }

            Spacer()

            HStack(spacing: Tokens.Spacing.lg) {
                Button {
                    showSettings.toggle()
                } label: {
                    SlidersIcon(size: 18, color: showSettings ? Tokens.Colors.warmText : Tokens.Colors.warmTextLight)
                        .allowsHitTesting(false)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Settings")
                .popover(isPresented: $showSettings, attachmentAnchor: .point(.top), arrowEdge: .bottom) {
                    SettingsControls(variant: .textMode)
                        .padding(Tokens.Spacing.lg)
                        .presentationCompactAdaptation(.popover)
                }

                Button {
                    coordinator.socket.disconnect()
                    appState.reset()
                } label: {
                    XIcon(size: 20, color: Tokens.Colors.muted)
                        .allowsHitTesting(false)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
        }
        .padding(.horizontal, Tokens.Spacing.xl)
        .padding(.bottom, Tokens.Spacing.xl)
    }

    // MARK: - Actions

    private func submitText() {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, phase == .input else { return }
        analyzeText(trimmed)
    }

    private func reanalyze(_ text: String) {
        // Stay on result phase, just clear data and show thinking
        appState.cards = []
        appState.recommendations = []
        lastUsedMode = appState.processingMode
        thinking = true

        if appState.processingMode == .local {
            coordinator.processTextLocally(text)
        } else {
            cloudAnalyze(text)
        }
    }

    private func analyzeText(_ text: String) {
        appState.cards = []
        appState.recommendations = []
        lastSubmittedText = text
        lastUsedMode = appState.processingMode
        thinking = true

        // Show processing transition (from input phase)
        processingStage = "Analyzing..."
        withAnimation(.easeOut(duration: 0.3)) {
            phase = .processing
        }

        if appState.processingMode == .local {
            coordinator.processTextLocally(text)
        } else {
            cloudAnalyze(text)
        }
    }

    private func cloudAnalyze(_ text: String) {
        let eventHandler: (String, [String: Any]) -> Void = { type, payload in
            DispatchQueue.main.async {
                switch type {
                case "card:created":
                    if let d = payload["card"] as? [String: Any],
                       let card = self.parseCard(d) {
                        self.appState.cards.append(card)
                    }
                case "recommendation:new":
                    if let arr = payload["recommendations"] as? [[String: Any]] {
                        let recs = arr.compactMap { self.parseRecommendation($0) }
                        if !recs.isEmpty { self.appState.recommendations = recs }
                    }
                case "processing:progress":
                    if let stage = payload["stage"] as? String {
                        self.processingStage = stage
                    }
                case "session:summary":
                    // Could store summary if needed
                    break
                default:
                    break
                }
            }
        }

        if !coordinator.socket.connected {
            coordinator.socket.connect(onEvent: eventHandler)
            // Wait for connection, then start session + submit
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.sendCloudTextSession(text)
            }
        } else {
            // Already connected — just start a new session
            sendCloudTextSession(text)
        }
    }

    private func sendCloudTextSession(_ text: String) {
        // Start a text-mode session first (like Mac's handleTextAnalyze)
        coordinator.socket.send(type: "session:start", data: [
            "config": [
                "mode": "offline",
                "sampleRate": 16000,
                "channels": 1,
                "noiseSuppression": false,
                "autoGain": false,
                "language": appState.sttLanguage.rawValue,
                "responseEnabled": appState.responseEnabled,
            ] as [String: Any]
        ])

        // Small delay to let session initialize, then submit text
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.coordinator.socket.send(type: "text:submit", data: ["text": text])
        }
    }

    // MARK: - Parsing

    private func parseCard(_ dict: [String: Any]) -> CoreMeaningCard? {
        guard let id = dict["id"] as? String,
              let sessionId = dict["sessionId"] as? String,
              let catStr = dict["category"] as? String,
              let cat = MeaningCategory(rawValue: catStr),
              let content = dict["content"] as? String
        else { return nil }
        return CoreMeaningCard(
            id: id, sessionId: sessionId, category: cat, content: content,
            sourceSegmentIds: dict["sourceSegmentIds"] as? [String] ?? [],
            linkedCardIds: dict["linkedCardIds"] as? [String] ?? [],
            linkType: dict["linkType"] as? String,
            topicId: dict["topicId"] as? String ?? "",
            visualizationFormat: VisualizationFormat(rawValue: dict["visualizationFormat"] as? String ?? "concise_text") ?? .conciseText,
            isHighlighted: dict["isHighlighted"] as? Bool ?? false,
            speakerId: dict["speakerId"] as? String,
            createdAt: dict["createdAt"] as? String ?? "",
            updatedAt: dict["updatedAt"] as? String ?? ""
        )
    }

    private func parseRecommendation(_ dict: [String: Any]) -> Recommendation? {
        guard let id = dict["id"] as? String,
              let sessionId = dict["sessionId"] as? String,
              let sourceCardId = dict["sourceCardId"] as? String,
              let typeStr = dict["type"] as? String,
              let type = RecommendationType(rawValue: typeStr),
              let text = dict["text"] as? String,
              let reasoning = dict["reasoning"] as? String
        else { return nil }
        return Recommendation(
            id: id, sessionId: sessionId, sourceCardId: sourceCardId,
            type: type, text: text, reasoning: reasoning,
            memoryReferenceIds: dict["memoryReferenceIds"] as? [String] ?? [],
            setIndex: dict["setIndex"] as? Int ?? 0,
            createdAt: dict["createdAt"] as? String ?? ""
        )
    }
}


// MARK: - FlowLayout (flex-wrap equivalent for recommendation pills)

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowH: CGFloat = 0

        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxW && x > 0 {
                y += rowH + spacing
                x = 0
                rowH = 0
            }
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
        return CGSize(width: maxW, height: y + rowH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowH: CGFloat = 0

        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                y += rowH + spacing
                x = bounds.minX
                rowH = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
    }
}
