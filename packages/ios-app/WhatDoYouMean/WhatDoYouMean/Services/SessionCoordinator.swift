import Foundation
import Network
import Speech
import AVFoundation

/// Wires SocketService + AudioCaptureService + OnDeviceIntelligenceService together.
///
/// Normal (online): cloud STT (Deepgram) + LLM per processingMode
/// Offline fallback: Apple Speech (local STT) + on-device Apple FM
@Observable
class SessionCoordinator {
    let socket = SocketService()
    let audio = AudioCaptureService()
    let onDeviceAI = OnDeviceIntelligenceService()

    private weak var appState: AppState?

    // Network monitoring
    private let networkMonitor = NWPathMonitor()
    private(set) var isOnline = true
    /// True when running in offline fallback mode (local STT + local FM).
    private(set) var isOfflineFallback = false

    // Local LLM processing state
    private var localTranscripts: [(text: String, speakerId: String)] = []
    private var localPendingText = ""
    private var localSilenceTimer: Timer?
    private var localMarkedTexts = Set<String>()
    private var localLockedCards: [CoreMeaningCard] = []
    private var localWindowStartIndex = 0
    private var localWindowPassCount = 0
    private var localConsolidationInFlight = false
    private var localConsolidationVersion = 0
    /// Serializes on-device FM requests (LanguageModelSession doesn't allow concurrent calls).
    private var fmProcessingInFlight = false
    private var fmPendingQueue: [(text: String, speakerId: String)] = []
    /// When true, the next locally-created card gets isHighlighted = true.
    private var localMarkNextCard = false

    // Apple Speech (offline STT)
    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    private let silenceThresholdMs: Double = 3000
    private let maxPendingChars = 300
    private let punctuationMinChars = 20
    private let maxWindowPasses = 3

    private var usesLocalLLM: Bool {
        guard let appState else { return false }
        return isOfflineFallback || appState.processingMode == .local || appState.processingMode == .fusion
    }

    func bind(to state: AppState) {
        self.appState = state
        onDeviceAI.checkAvailability()
        if onDeviceAI.isAvailable { onDeviceAI.createSessions() }
        startNetworkMonitor()
    }

    private func startNetworkMonitor() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isOnline = (path.status == .satisfied)
            }
        }
        networkMonitor.start(queue: DispatchQueue(label: "network-monitor"))
    }


    // MARK: - Start Session

    func startSession() {
        guard let appState else { return }

        // Reset local state
        localTranscripts = []
        localPendingText = ""
        localMarkedTexts = Set()
        localLockedCards = []
        localWindowStartIndex = 0
        localWindowPassCount = 0
        localConsolidationInFlight = false
        localConsolidationVersion = 0
        fmProcessingInFlight = false
        fmPendingQueue = []
        localMarkNextCard = false
        onDeviceAI.resetSessions()

        // Offline? Fall back to local STT + local FM
        if !isOnline {
            print("[SessionCoordinator] Offline — starting local STT + local FM")
            isOfflineFallback = true
            startOfflineSession()
            return
        }

        isOfflineFallback = false

        // Online: all modes use cloud STT via WebSocket
        // Audio chunks are wired AFTER session:start to avoid "No active session" errors
        let eventHandler: (String, [String: Any]) -> Void
        switch appState.processingMode {
        case .local:
            eventHandler = { [weak self] type, payload in
                DispatchQueue.main.async { self?.handleLocalLLMEvent(type: type, payload: payload) }
            }
        case .cloud:
            eventHandler = { [weak self] type, payload in
                DispatchQueue.main.async { self?.handleCloudEvent(type: type, payload: payload) }
            }
        case .fusion:
            eventHandler = { [weak self] type, payload in
                DispatchQueue.main.async { self?.handleFusionEvent(type: type, payload: payload) }
            }
        }

        socket.connect(onEvent: eventHandler)

        waitForConnection { [weak self] in
            guard let self, let appState = self.appState else { return }
            self.socket.send(type: "session:start", data: [
                "config": [
                    "mode": "online",
                    "sampleRate": 16000,
                    "channels": 1,
                    "noiseSuppression": true,
                    "autoGain": true,
                    "language": appState.sttLanguage.rawValue,
                    "responseEnabled": appState.processingMode == .cloud ? appState.responseEnabled : false,
                ] as [String: Any]
            ])

            // Wire audio AFTER session:start so backend has an active session
            self.audio.onAudioChunk = { [weak self] base64 in
                self?.socket.send(type: "audio:chunk", data: ["audioBase64": base64])
            }

            do {
                try self.audio.startCapture()
                appState.isCapturing = true
                print("[SessionCoordinator] Audio capture started (mode: \(appState.processingMode.rawValue))")
            } catch {
                print("[SessionCoordinator] Audio capture failed: \(error)")
            }
        }
    }

    private func waitForConnection(attempt: Int = 0, completion: @escaping () -> Void) {
        if socket.connected { DispatchQueue.main.async { completion() }; return }
        if attempt > 25 { DispatchQueue.main.async { completion() }; return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.waitForConnection(attempt: attempt + 1, completion: completion)
        }
    }

    // MARK: - Stop Session

    func stopSession() {
        guard let appState else { return }
        audio.stopCapture()
        appState.isCapturing = false
        localSilenceTimer?.invalidate()
        localSilenceTimer = nil

        if isOfflineFallback {
            stopLocalSTT()
        } else {
            socket.send(type: "session:end")
        }

        if usesLocalLLM {
            Task { @MainActor in await runLocalFinalConsolidation() }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if appState.screen == .live { appState.screen = .recap }
        }
    }

    func disconnect() {
        audio.stopCapture()
        stopLocalSTT()
        localSilenceTimer?.invalidate()
        socket.disconnect()
    }

    func sendSettingsUpdate() {
        guard let appState else { return }
        socket.send(type: "settings:update", data: [
            "settings": [
                "sttLanguage": appState.sttLanguage.rawValue,
                "responseEnabled": appState.responseEnabled,
            ] as [String: Any]
        ])
    }

    func sendBookmark() {
        guard let appState, let start = appState.sessionStartTime else { return }

        // Cloud mode: let backend handle marking
        if !isOfflineFallback && appState.processingMode != .local {
            socket.send(type: "bookmark:create", data: ["timestamp": Date().timeIntervalSince(start) * 1000])
        }

        // Local/offline: mark locally
        if usesLocalLLM || isOfflineFallback {
            // Track pending text as marked
            if !localPendingText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                localMarkedTexts.insert(localPendingText)
                localMarkNextCard = true
                // Force-finalize pending text so the mark lands on it
                finalizeLocalPendingText()
            } else if let lastIdx = appState.cards.indices.last {
                // No pending text — highlight the most recent card
                let card = appState.cards[lastIdx]
                appState.cards[lastIdx] = CoreMeaningCard(
                    id: card.id, sessionId: card.sessionId, category: card.category,
                    content: card.content, sourceSegmentIds: card.sourceSegmentIds,
                    linkedCardIds: card.linkedCardIds, linkType: card.linkType,
                    topicId: card.topicId, visualizationFormat: card.visualizationFormat,
                    isHighlighted: true, speakerId: card.speakerId,
                    createdAt: card.createdAt, updatedAt: card.updatedAt
                )
            } else {
                // No cards and no pending text — mark the next card that arrives
                localMarkNextCard = true
            }
        }
    }


    // MARK: - Cloud Event Handlers

    /// Cloud mode: full backend pipeline (original behavior).
    private func handleCloudEvent(type: String, payload: [String: Any]) {
        guard let appState else { return }
        switch type {
        case "card:created":
            if let d = payload["card"] as? [String: Any], let c = parseCard(d) { appState.cards.append(c); appState.pendingPreview = "" }
        case "card:updated":
            if let d = payload["card"] as? [String: Any], let c = parseCard(d),
               let idx = appState.cards.firstIndex(where: { $0.id == c.id }) { appState.cards[idx] = c }
        case "cards:consolidated":
            if let arr = payload["cards"] as? [[String: Any]] { let p = arr.compactMap { parseCard($0) }; if !p.isEmpty { appState.cards = p } }
        case "pending:preview":
            if let t = payload["text"] as? String { appState.pendingPreview = t }
        case "transcript:final":
            registerSpeaker(from: payload)
        case "recommendation:new":
            if let arr = payload["recommendations"] as? [[String: Any]] { appState.recommendations = arr.compactMap { parseRecommendation($0) } }
        case "session:state":
            if let s = payload["state"] as? String, s == "ended" { appState.screen = .recap }
        default: break
        }
        appState.connected = socket.connected
    }

    /// Local mode: cloud STT only, LLM analysis on-device.
    private func handleLocalLLMEvent(type: String, payload: [String: Any]) {
        guard let appState else { return }
        switch type {
        case "transcript:final":
            registerSpeaker(from: payload)
            if let seg = payload["segment"] as? [String: Any],
               let text = seg["text"] as? String,
               let speakerId = seg["speakerId"] as? String {
                handleLocalFinalTranscript(text: text, speakerId: speakerId)
            }
        case "pending:preview":
            if let t = payload["text"] as? String { appState.pendingPreview = t }
        case "error":
            // Backend errors in local mode are expected (e.g. LLM not configured)
            // since we only use the server for STT. Log but don't surface to user.
            if let msg = payload["message"] as? String {
                print("[SessionCoordinator] Backend error (ignored in local mode): \(msg)")
            }
        default: break
        }
        appState.connected = socket.connected
    }

    /// Fusion mode: local LLM for fast cards + cloud cards replace/refine.
    private func handleFusionEvent(type: String, payload: [String: Any]) {
        guard let appState else { return }
        switch type {
        case "transcript:final":
            registerSpeaker(from: payload)
            // Feed to local LLM for fast card generation
            if let seg = payload["segment"] as? [String: Any],
               let text = seg["text"] as? String,
               let speakerId = seg["speakerId"] as? String {
                handleLocalFinalTranscript(text: text, speakerId: speakerId)
            }
        case "cards:consolidated":
            // Cloud consolidation replaces local cards (higher quality)
            if let arr = payload["cards"] as? [[String: Any]] { let p = arr.compactMap { parseCard($0) }; if !p.isEmpty { appState.cards = p } }
        case "card:created":
            // Cloud card — replace matching local card or append
            if let d = payload["card"] as? [String: Any], let c = parseCard(d) { appState.cards.append(c); appState.pendingPreview = "" }
        case "pending:preview":
            if let t = payload["text"] as? String { appState.pendingPreview = t }
        case "recommendation:new":
            if let arr = payload["recommendations"] as? [[String: Any]] { appState.recommendations = arr.compactMap { parseRecommendation($0) } }
        case "session:state":
            if let s = payload["state"] as? String, s == "ended" { appState.screen = .recap }
        default: break
        }
        appState.connected = socket.connected
    }

    private func registerSpeaker(from payload: [String: Any]) {
        guard let appState, let seg = payload["segment"] as? [String: Any],
              let speakerId = seg["speakerId"] as? String, speakerId != "user" else { return }
        if appState.speakers[speakerId] == nil {
            appState.speakers[speakerId] = "Speaker \(appState.speakers.count + 1)"
        }
    }


    // MARK: - Offline Fallback (Apple Speech STT + local FM)

    private func startOfflineSession() {
        guard let appState else { return }
        let locale: Locale
        switch appState.sttLanguage {
        case .zh: locale = Locale(identifier: "zh-CN")
        case .en: locale = Locale(identifier: "en-US")
        case .zhEn: locale = Locale(identifier: "zh-CN")
        }

        speechRecognizer = SFSpeechRecognizer(locale: locale)
        guard let speechRecognizer, speechRecognizer.isAvailable else {
            print("[SessionCoordinator] Offline STT not available")
            return
        }

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest else { return }
        recognitionRequest.shouldReportPartialResults = true
        if speechRecognizer.supportsOnDeviceRecognition {
            recognitionRequest.requiresOnDeviceRecognition = true
        }

        audio.onAudioChunk = { [weak self] base64 in
            guard let self, let data = Data(base64Encoded: base64) else { return }
            self.feedAudioToRecognizer(wavData: data)
        }

        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString
                if result.isFinal {
                    self.handleLocalFinalTranscript(text: text, speakerId: "speaker_0")
                } else {
                    DispatchQueue.main.async {
                        self.appState?.pendingPreview = self.localPendingText + (self.localPendingText.isEmpty ? "" : " ") + text
                    }
                }
            }
            if let error {
                print("[SessionCoordinator] Offline STT error: \(error)")
            }
        }

        do {
            try audio.startCapture()
            appState.isCapturing = true
            print("[SessionCoordinator] Offline session started (Apple Speech + local FM)")
        } catch {
            print("[SessionCoordinator] Audio capture failed: \(error)")
        }
    }

    private func stopLocalSTT() {
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        speechRecognizer = nil
    }

    private func feedAudioToRecognizer(wavData: Data) {
        guard let recognitionRequest, wavData.count > 44 else { return }
        let pcmData = wavData.subdata(in: 44..<wavData.count)
        let format = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!
        let frameCount = UInt32(pcmData.count) / format.streamDescription.pointee.mBytesPerFrame
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return }
        buffer.frameLength = frameCount
        pcmData.withUnsafeBytes { rawPtr in
            if let base = rawPtr.baseAddress {
                buffer.int16ChannelData?.pointee.update(from: base.assumingMemoryBound(to: Int16.self), count: Int(frameCount))
            }
        }
        recognitionRequest.append(buffer)
    }


    // MARK: - Local LLM Processing Pipeline

    private func handleLocalFinalTranscript(text: String, speakerId: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        localTranscripts.append((text: text, speakerId: speakerId))
        localPendingText += (localPendingText.isEmpty ? "" : " ") + text.trimmingCharacters(in: .whitespacesAndNewlines)

        DispatchQueue.main.async { [weak self] in
            self?.appState?.pendingPreview = self?.localPendingText ?? ""
        }

        if let trigger = checkSegmentationTriggers(localPendingText) {
            print("[SessionCoordinator] Segmentation trigger: \(trigger)")
            localSilenceTimer?.invalidate(); localSilenceTimer = nil
            finalizeLocalPendingText()
            return
        }

        localSilenceTimer?.invalidate()
        localSilenceTimer = Timer.scheduledTimer(withTimeInterval: silenceThresholdMs / 1000, repeats: false) { [weak self] _ in
            self?.finalizeLocalPendingText()
        }
    }

    private func checkSegmentationTriggers(_ text: String) -> String? {
        if text.count > maxPendingChars { return "max_length" }
        if text.count > punctuationMinChars {
            let t = text.trimmingCharacters(in: .whitespaces)
            if t.hasSuffix("。") || t.hasSuffix("！") || t.hasSuffix("？") || t.hasSuffix(".") || t.hasSuffix("!") || t.hasSuffix("?") {
                return "punctuation"
            }
        }
        return nil
    }

    private func finalizeLocalPendingText() {
        guard !localPendingText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        let text = localPendingText
        localPendingText = ""
        localSilenceTimer?.invalidate(); localSilenceTimer = nil

        // Queue for serial processing — FM doesn't allow concurrent respond() calls
        fmPendingQueue.append((text: text, speakerId: "speaker_0"))
        processNextFMRequest()
    }

    private func processNextFMRequest() {
        guard !fmProcessingInFlight, let next = fmPendingQueue.first else { return }
        fmPendingQueue.removeFirst()
        fmProcessingInFlight = true

        Task { @MainActor in
            defer {
                fmProcessingInFlight = false
                processNextFMRequest()
            }

            guard let appState else { return }
            let langCode = onDeviceAI.detectLanguage(next.text)
            print("[SessionCoordinator] FM analyze starting: \"\(next.text.prefix(50))\" isAvailable=\(onDeviceAI.isAvailable)")
            if let card = await onDeviceAI.analyze(
                text: next.text, languageCode: langCode,
                existingCards: appState.cards,
                topicMap: TopicMap(sessionId: "", topics: [], relations: [])
            ) {
                print("[SessionCoordinator] FM card: \"\(card.content.prefix(50))\" category=\(card.category.rawValue)")
                // Apply markNextCard flag if set
                var finalCard = card
                if localMarkNextCard {
                    finalCard = CoreMeaningCard(
                        id: card.id, sessionId: card.sessionId, category: card.category,
                        content: card.content, sourceSegmentIds: card.sourceSegmentIds,
                        linkedCardIds: card.linkedCardIds, linkType: card.linkType,
                        topicId: card.topicId, visualizationFormat: card.visualizationFormat,
                        isHighlighted: true, speakerId: card.speakerId,
                        createdAt: card.createdAt, updatedAt: card.updatedAt
                    )
                    localMarkNextCard = false
                    print("[SessionCoordinator] Auto-highlighted card from pending mark")
                }
                appState.cards.append(finalCard)
                appState.pendingPreview = ""

                if appState.responseEnabled {
                    let recs = await onDeviceAI.generateRecommendations(card: card, existingCards: appState.cards)
                    if !recs.isEmpty { appState.recommendations = recs }
                }
                if appState.cards.count >= 2 { scheduleLocalConsolidation() }
            } else {
                // FM failed — use fallback card with original text
                print("[SessionCoordinator] FM analyze returned nil — using fallback card")
                let fallback = CoreMeaningCard(
                    id: "fallback_\(Int(Date().timeIntervalSince1970 * 1000))",
                    sessionId: "", category: .fact,
                    content: String(next.text.prefix(100)),
                    sourceSegmentIds: [], linkedCardIds: [], linkType: nil,
                    topicId: "", visualizationFormat: .conciseText,
                    isHighlighted: false, speakerId: next.speakerId,
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    updatedAt: ISO8601DateFormatter().string(from: Date())
                )
                appState.cards.append(fallback)
                appState.pendingPreview = ""
            }
        }
    }

    private func scheduleLocalConsolidation() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self else { return }
            Task { @MainActor in await self.runLocalWindowConsolidation() }
        }
    }

    @MainActor
    private func runLocalWindowConsolidation() async {
        guard let appState, !localConsolidationInFlight else { return }
        let windowTranscripts = Array(localTranscripts.dropFirst(localWindowStartIndex))
        guard !windowTranscripts.isEmpty else { return }

        let hasNew = localTranscripts.count > localWindowStartIndex + localWindowPassCount
        if !hasNew { localWindowPassCount += 1 } else { localWindowPassCount = 0 }
        if localWindowPassCount >= maxWindowPasses {
            localLockedCards = appState.cards; localWindowStartIndex = localTranscripts.count; localWindowPassCount = 0; return
        }

        localConsolidationInFlight = true
        localConsolidationVersion += 1
        let version = localConsolidationVersion

        let result = await onDeviceAI.windowConsolidate(
            windowTranscripts: windowTranscripts, lockedCards: localLockedCards,
            markedTexts: localMarkedTexts, existingCards: appState.cards
        )
        guard version == localConsolidationVersion else { localConsolidationInFlight = false; return }
        appState.cards = result
        localConsolidationInFlight = false
    }

    @MainActor
    private func runLocalFinalConsolidation() async {
        guard let appState, localTranscripts.count >= 2 else { return }
        localConsolidationVersion += 1
        let result = await onDeviceAI.consolidate(
            transcripts: localTranscripts, markedTexts: localMarkedTexts,
            existingHighlightedCards: appState.cards
        )
        appState.cards = result
        if let summary = await onDeviceAI.generateSummary(cards: result) {
            print("[SessionCoordinator] Summary: \(summary.prefix(100))")
        }
    }

    /// Process text:submit locally (text mode in local/fusion).
    func processTextLocally(_ text: String) {
        guard let appState else { return }
        Task { @MainActor in
            let langCode = onDeviceAI.detectLanguage(text)
            let cards = await onDeviceAI.analyzeMulti(text: text, languageCode: langCode)
            for card in cards {
                let c = withSpeaker(card, speakerId: "user")
                appState.cards.append(c)
            }
            if appState.responseEnabled, let last = appState.cards.last {
                let recs = await onDeviceAI.generateRecommendations(card: last, existingCards: appState.cards)
                if !recs.isEmpty { appState.recommendations = recs }
            }
        }
    }

    private func withSpeaker(_ card: CoreMeaningCard, speakerId: String) -> CoreMeaningCard {
        CoreMeaningCard(
            id: card.id, sessionId: card.sessionId, category: card.category, content: card.content,
            sourceSegmentIds: card.sourceSegmentIds, linkedCardIds: card.linkedCardIds, linkType: card.linkType,
            topicId: card.topicId, visualizationFormat: card.visualizationFormat,
            isHighlighted: card.isHighlighted, speakerId: speakerId,
            createdAt: card.createdAt, updatedAt: card.updatedAt
        )
    }


    // MARK: - JSON Parsing

    private func parseCard(_ dict: [String: Any]) -> CoreMeaningCard? {
        guard let id = dict["id"] as? String,
              let sessionId = dict["sessionId"] as? String,
              let categoryStr = dict["category"] as? String,
              let category = MeaningCategory(rawValue: categoryStr),
              let content = dict["content"] as? String
        else { return nil }
        return CoreMeaningCard(
            id: id, sessionId: sessionId, category: category, content: content,
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
