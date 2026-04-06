import Foundation

// FoundationModels is only available on iOS 26+ / Xcode 26+.
// The service gracefully degrades: isAvailable = false on older OS.
#if canImport(FoundationModels)
import FoundationModels

// MARK: - Generable types for structured output

@Generable
struct AnalysisOutput {
    @Guide(description: "Core meaning in ≤30 English words or ≤50 Chinese characters. Write as DIRECT summary, NOT third person.")
    var content: String
    @Guide(description: "One of: fact, opinion, question, decision, todo, proposal, request, response")
    var category: String
    @Guide(description: "Short topic name for grouping")
    var topicName: String
}

@Generable
struct MultiAnalysisOutput {
    @Guide(description: "Array of distinct points extracted from the text")
    var items: [AnalysisItem]
}

@Generable
struct AnalysisItem {
    @Guide(description: "Core meaning in ≤30 English words or ≤50 Chinese characters. DIRECT speech only.")
    var content: String
    @Guide(description: "One of: fact, opinion, question, decision, todo, proposal, request, response")
    var category: String
}

@Generable
struct RecommendationOutput {
    @Guide(description: "Array of 1-3 response recommendations")
    var recommendations: [RecommendationItem]
}

@Generable
struct RecommendationItem {
    @Guide(description: "One of: follow_up_question, clarification, new_proposal, challenge, summary_confirmation, topic_pivot")
    var type: String
    @Guide(description: "Short 2-5 word recommendation text in the SAME language as the card")
    var text: String
    @Guide(description: "Brief reason why this recommendation is useful")
    var reasoning: String
}

@Generable
struct SummaryOutput {
    @Guide(description: "2-3 concise sentences summarizing the conversation. Direct and factual.")
    var summary: String
}

#endif // canImport(FoundationModels)

// MARK: - On-Device Intelligence Service

/// Replicates the backend SemanticAnalyzer + RecommendationEngine + consolidation
/// pipeline using Apple's on-device Foundation Model (iOS 26+).
/// On older OS, isAvailable is always false and all methods return empty/nil.
@Observable
class OnDeviceIntelligenceService {

    private(set) var isAvailable = false

    private var previousRecommendationSets: [String: [String]] = [:]
    private var recSetCounter = 0

    private let maxEnglishWords = 30
    private let maxChineseChars = 50

    // MARK: - Lifecycle

    func checkAvailability() {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            let model = SystemLanguageModel.default
            if case .available = model.availability { isAvailable = true }
        }
        #endif
    }

    func createSessions() {
        // No-op: we now create fresh sessions per call to avoid concurrency issues
    }

    func resetSessions() {
        previousRecommendationSets = [:]
        recSetCounter = 0
    }

    /// Create a fresh analysis session (avoids concurrent respond() errors).
    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private func makeAnalysisSession() -> LanguageModelSession {
        LanguageModelSession(instructions: Self.analysisInstructions)
    }

    @available(iOS 26.0, *)
    private func makeRecommendationSession() -> LanguageModelSession {
        LanguageModelSession(instructions: Self.recommendationInstructions)
    }
    #endif


    // MARK: - Single Segment Analysis (matches backend analyze())

    func analyze(
        text: String, languageCode: String,
        existingCards: [CoreMeaningCard], topicMap: TopicMap
    ) async -> CoreMeaningCard? {
        guard isAvailable else { return nil }
        #if canImport(FoundationModels)
        guard #available(iOS 26.0, *) else { return nil }
        let session = makeAnalysisSession()

        let cardsSummary = existingCards.suffix(10)
            .map { "[\($0.id)] (\($0.category.rawValue)) \($0.content)" }
            .joined(separator: "\n")
        let topicsSummary = topicMap.topics.map { "[\($0.id)] \($0.name)" }.joined(separator: ", ")
        let hasChinese = text.range(of: "[\u{4e00}-\u{9fff}]", options: .regularExpression) != nil
        let langHint = hasChinese
            ? "⚠ The transcript is in Chinese. The content MUST be in Chinese (中文)."
            : "⚠ The transcript is in English. The content MUST be in English."

        let prompt = """
        Transcript segment (\(languageCode)):
        "\(text)"

        \(langHint)

        Existing cards:
        \(cardsSummary.isEmpty ? "(none)" : cardsSummary)

        Current topics: \(topicsSummary.isEmpty ? "(none)" : topicsSummary)

        Extract the core meaning, categorize it.
        """

        do {
            let response = try await session.respond(to: prompt, generating: AnalysisOutput.self)
            let result = response.content
            return CoreMeaningCard(
                id: generateId(), sessionId: "",
                category: validateCategory(result.category),
                content: enforceContentLimit(result.content, languageCode: languageCode),
                sourceSegmentIds: [], linkedCardIds: [], linkType: nil,
                topicId: resolveTopicId(result.topicName, topicMap: topicMap),
                visualizationFormat: .conciseText, isHighlighted: false, speakerId: nil,
                createdAt: isoNow(), updatedAt: isoNow()
            )
        } catch {
            print("[OnDeviceFM] analyze error: \(error)")
            return nil
        }
        #else
        return nil
        #endif
    }

    // MARK: - Multi-Card Analysis (matches backend analyzeMulti())

    func analyzeMulti(text: String, languageCode: String) async -> [CoreMeaningCard] {
        guard isAvailable else { return [fallbackCard(text: text)] }
        #if canImport(FoundationModels)
        guard #available(iOS 26.0, *) else { return [fallbackCard(text: text)] }
        let session = makeAnalysisSession()

        let hasMarked = text.contains("⭐IMPORTANT")
        let userPrompt = hasMarked
            ? "Analyze this text and extract all distinct points. Lines prefixed with ⭐IMPORTANT were explicitly marked by the user as critical — each MUST produce its own item:\n\n\(text)"
            : "Analyze this text and extract all distinct points:\n\n\(text)"

        do {
            let response = try await session.respond(to: userPrompt, generating: MultiAnalysisOutput.self)
            let result = response.content
            guard !result.items.isEmpty else { return [fallbackCard(text: text)] }

            return result.items.enumerated().map { i, item in
                CoreMeaningCard(
                    id: "card_multi_\(Int(Date().timeIntervalSince1970 * 1000))_\(i)",
                    sessionId: "",
                    category: validateCategory(item.category),
                    content: enforceContentLimit(item.content.isEmpty ? String(text.prefix(50)) : item.content, languageCode: languageCode),
                    sourceSegmentIds: [], linkedCardIds: [], linkType: nil,
                    topicId: "", visualizationFormat: .conciseText, isHighlighted: false,
                    speakerId: nil, createdAt: isoNow(), updatedAt: isoNow()
                )
            }
        } catch {
            print("[OnDeviceFM] analyzeMulti error: \(error)")
            return [fallbackCard(text: text)]
        }
        #else
        return [fallbackCard(text: text)]
        #endif
    }


    // MARK: - Consolidation (matches backend final consolidation in session:end)

    func consolidate(
        transcripts: [(text: String, speakerId: String)],
        markedTexts: Set<String>,
        existingHighlightedCards: [CoreMeaningCard]
    ) async -> [CoreMeaningCard] {
        var runs: [(speakerId: String, texts: [String])] = []
        for t in transcripts {
            if let last = runs.last, last.speakerId == t.speakerId {
                runs[runs.count - 1].texts.append(t.text)
            } else {
                runs.append((speakerId: t.speakerId, texts: [t.text]))
            }
        }

        var allFinalCards: [CoreMeaningCard] = []
        var orderIdx = 0

        for run in runs {
            let runText = run.texts.map { text in
                "\(markedTexts.contains(text) ? "⭐IMPORTANT " : "")\(text)"
            }.joined(separator: "\n")
            let runHasMarked = run.texts.contains(where: { markedTexts.contains($0) })
            guard !runText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }

            let langCode = detectLanguage(runText)
            let runCards = await analyzeMulti(text: runText, languageCode: langCode)

            for card in runCards {
                let highlighted = runHasMarked && !allFinalCards.contains(where: \.isHighlighted)
                allFinalCards.append(withSpeakerAndOrder(card, speakerId: run.speakerId, orderIdx: &orderIdx, highlighted: highlighted))
            }
        }

        return inheritHighlights(
            dedupedCards: deduplicateCards(allFinalCards),
            previousCards: existingHighlightedCards,
            markedTexts: markedTexts
        )
    }

    // MARK: - Window Consolidation (matches backend runConsolidation mid-session)

    func windowConsolidate(
        windowTranscripts: [(text: String, speakerId: String)],
        lockedCards: [CoreMeaningCard],
        markedTexts: Set<String>,
        existingCards: [CoreMeaningCard]
    ) async -> [CoreMeaningCard] {
        var runs: [(speakerId: String, texts: [String])] = []
        for t in windowTranscripts {
            if let last = runs.last, last.speakerId == t.speakerId {
                runs[runs.count - 1].texts.append(t.text)
            } else {
                runs.append((speakerId: t.speakerId, texts: [t.text]))
            }
        }

        var allNewCards: [CoreMeaningCard] = []
        var orderIdx = 0

        for run in runs {
            let runText = run.texts.map { text in
                "\(markedTexts.contains(text) ? "⭐IMPORTANT " : "")\(text)"
            }.joined(separator: "\n")
            guard !runText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }

            let langCode = detectLanguage(runText)
            let runCards = await analyzeMulti(text: runText, languageCode: langCode)
            for card in runCards {
                allNewCards.append(withSpeakerAndOrder(card, speakerId: run.speakerId, orderIdx: &orderIdx, highlighted: false))
            }
        }

        // Dedup against locked cards
        let dedupedCards = deduplicateCards(allNewCards, against: lockedCards)

        // Speaker attribution via word overlap
        let attributed = dedupedCards.map { card -> CoreMeaningCard in
            let cardWords = Set(card.content.lowercased().split(separator: " ").filter { $0.count > 1 })
            var bestSpeaker = "speaker_0"; var bestScore = -1
            for t in windowTranscripts {
                let tWords = t.text.lowercased().split(separator: " ").filter { $0.count > 1 }
                let overlap = cardWords.filter { w in tWords.contains(where: { $0.contains(w) || w.contains($0) }) }.count
                if overlap > bestScore { bestScore = overlap; bestSpeaker = t.speakerId }
            }
            return withSpeaker(card, speakerId: bestSpeaker)
        }

        return lockedCards + inheritHighlights(dedupedCards: attributed, previousCards: existingCards, markedTexts: markedTexts)
    }


    // MARK: - Recommendations (matches backend RecommendationEngine)

    func generateRecommendations(card: CoreMeaningCard, existingCards: [CoreMeaningCard]) async -> [Recommendation] {
        guard isAvailable else { return [] }
        #if canImport(FoundationModels)
        guard #available(iOS 26.0, *) else { return [] }
        let session = makeRecommendationSession()

        let previousTexts = previousRecommendationSets[card.topicId] ?? []
        let hasChinese = card.content.range(of: "[\u{4e00}-\u{9fff}]", options: .regularExpression) != nil
        let langHint = hasChinese
            ? "\n⚠ LANGUAGE: The card is in Chinese. ALL recommendation text MUST be in Chinese (中文)."
            : "\n⚠ LANGUAGE: The card is in English. ALL recommendation text MUST be in English."
        let recentCards = existingCards.suffix(5).map { "[\($0.category.rawValue)] \($0.content)" }.joined(separator: "\n")

        var prompt = "Current card:\nCategory: \(card.category.rawValue)\nContent: \"\(card.content)\"\(langHint)"
        if !recentCards.isEmpty { prompt += "\n\nRecent conversation cards:\n\(recentCards)" }
        if !previousTexts.isEmpty { prompt += "\n\nPrevious recommendations (DO NOT repeat):\n" + previousTexts.map { "- \($0)" }.joined(separator: "\n") }

        do {
            let response = try await session.respond(to: prompt, generating: RecommendationOutput.self)
            let result = response.content
            recSetCounter += 1
            let recs = result.recommendations.prefix(3).filter { !previousTexts.contains($0.text) }.map { item in
                Recommendation(
                    id: "rec_\(Int(Date().timeIntervalSince1970 * 1000))_\(recSetCounter)",
                    sessionId: "", sourceCardId: card.id,
                    type: validateRecType(item.type), text: item.text, reasoning: item.reasoning,
                    memoryReferenceIds: [], setIndex: recSetCounter, createdAt: isoNow()
                )
            }
            previousRecommendationSets[card.topicId] = recs.map { $0.text }
            return recs
        } catch {
            print("[OnDeviceFM] recommendations error: \(error)")
            return []
        }
        #else
        return []
        #endif
    }

    // MARK: - Session Summary

    func generateSummary(cards: [CoreMeaningCard]) async -> String? {
        guard isAvailable, !cards.isEmpty else { return nil }
        #if canImport(FoundationModels)
        guard #available(iOS 26.0, *) else { return nil }

        let session = LanguageModelSession(
            instructions: "You summarize conversations in 2-3 concise sentences. Be direct and factual."
        )
        let cardsSummary = cards.map { "[\($0.category.rawValue)] \($0.content)" }.joined(separator: "\n")
        let hasChinese = cards.contains { $0.content.range(of: "[\u{4e00}-\u{9fff}]", options: .regularExpression) != nil }
        let langHint = hasChinese ? "Respond in Chinese." : "Respond in English."

        do {
            let response = try await session.respond(
                to: "\(langHint)\nSummarize this conversation:\n\(cardsSummary)",
                generating: SummaryOutput.self
            )
            return response.content.summary
        } catch {
            print("[OnDeviceFM] summary error: \(error)")
            return nil
        }
        #else
        return nil
        #endif
    }


    // MARK: - Helpers (match backend utility functions)

    private func enforceContentLimit(_ content: String, languageCode: String) -> String {
        if languageCode == "zh" {
            let chars = Array(content)
            var chineseCount = 0
            for c in chars {
                if let scalar = String(c).unicodeScalars.first, scalar.value >= 0x4e00 && scalar.value <= 0x9fff {
                    chineseCount += 1
                }
            }
            if chineseCount > maxChineseChars {
                var count = 0; var cutoff = 0
                for i in 0..<chars.count {
                    if let scalar = String(chars[i]).unicodeScalars.first, scalar.value >= 0x4e00 && scalar.value <= 0x9fff { count += 1 }
                    if count > maxChineseChars { cutoff = i; break }
                    cutoff = i + 1
                }
                return String(chars.prefix(cutoff))
            }
            return content
        }
        let words = content.split(separator: " ").filter { !$0.isEmpty }
        return words.count > maxEnglishWords ? words.prefix(maxEnglishWords).joined(separator: " ") : content
    }

    private func validateCategory(_ cat: String) -> MeaningCategory { MeaningCategory(rawValue: cat) ?? .fact }
    private func validateRecType(_ type: String) -> RecommendationType { RecommendationType(rawValue: type) ?? .followUpQuestion }
    private func resolveTopicId(_ name: String, topicMap: TopicMap) -> String {
        topicMap.topics.first(where: { $0.name.lowercased() == name.lowercased() })?.id ?? "pending"
    }
    func detectLanguage(_ text: String) -> String {
        let cn = text.unicodeScalars.filter { $0.value >= 0x4e00 && $0.value <= 0x9fff }.count
        return (text.count > 0 && Double(cn) / Double(text.count) > 0.3) ? "zh" : "en"
    }
    private func generateId() -> String { "id_\(Int(Date().timeIntervalSince1970 * 1000))_\(Int.random(in: 0...9999))" }
    private func isoNow() -> String { ISO8601DateFormatter().string(from: Date()) }

    private func fallbackCard(text: String) -> CoreMeaningCard {
        CoreMeaningCard(
            id: "card_multi_\(Int(Date().timeIntervalSince1970 * 1000))", sessionId: "",
            category: .fact, content: String(text.prefix(100)),
            sourceSegmentIds: [], linkedCardIds: [], linkType: nil,
            topicId: "", visualizationFormat: .conciseText, isHighlighted: false,
            speakerId: nil, createdAt: isoNow(), updatedAt: isoNow()
        )
    }

    /// Dedup: same category AND >60% word overlap = duplicate. Matches backend.
    private func deduplicateCards(_ cards: [CoreMeaningCard], against existing: [CoreMeaningCard] = []) -> [CoreMeaningCard] {
        var seen: [(content: String, category: String)] = existing.map { ($0.content.lowercased(), $0.category.rawValue) }
        return cards.filter { card in
            let lower = card.content.lowercased()
            let words = lower.split(separator: " ").filter { $0.count > 2 }
            for s in seen {
                guard s.category == card.category.rawValue else { continue }
                let sWords = s.content.split(separator: " ").filter { $0.count > 2 }
                guard !sWords.isEmpty else { continue }
                let overlap = words.filter { sWords.contains($0) }.count
                if Double(overlap) / Double(min(words.count, sWords.count)) > 0.6 { return false }
            }
            seen.append((lower, card.category.rawValue))
            return true
        }
    }

    private func inheritHighlights(dedupedCards: [CoreMeaningCard], previousCards: [CoreMeaningCard], markedTexts: Set<String>) -> [CoreMeaningCard] {
        var result = dedupedCards
        let hadHighlight = previousCards.contains(where: \.isHighlighted)
        if hadHighlight && !result.contains(where: \.isHighlighted) && !result.isEmpty {
            let hContents = previousCards.filter(\.isHighlighted).map { $0.content.lowercased() }
            var bestIdx = 0; var bestScore = -1
            for i in 0..<result.count {
                let words = result[i].content.lowercased().split(separator: " ")
                var score = 0
                for hc in hContents { score += words.filter { $0.count > 2 && hc.contains($0) }.count }
                for mt in markedTexts { score += words.filter { $0.count > 2 && mt.lowercased().contains($0) }.count }
                if score > bestScore { bestScore = score; bestIdx = i }
            }
            result[bestIdx] = withHighlight(result[bestIdx])
        }
        return result
    }

    private func withSpeakerAndOrder(_ card: CoreMeaningCard, speakerId: String, orderIdx: inout Int, highlighted: Bool) -> CoreMeaningCard {
        defer { orderIdx += 1 }
        return CoreMeaningCard(
            id: card.id, sessionId: card.sessionId, category: card.category, content: card.content,
            sourceSegmentIds: card.sourceSegmentIds, linkedCardIds: card.linkedCardIds, linkType: card.linkType,
            topicId: card.topicId, visualizationFormat: card.visualizationFormat,
            isHighlighted: highlighted || card.isHighlighted, speakerId: speakerId,
            createdAt: ISO8601DateFormatter().string(from: Date(timeIntervalSince1970: Date().timeIntervalSince1970 + Double(orderIdx))),
            updatedAt: card.updatedAt
        )
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

    private func withHighlight(_ card: CoreMeaningCard) -> CoreMeaningCard {
        CoreMeaningCard(
            id: card.id, sessionId: card.sessionId, category: card.category, content: card.content,
            sourceSegmentIds: card.sourceSegmentIds, linkedCardIds: card.linkedCardIds, linkType: card.linkType,
            topicId: card.topicId, visualizationFormat: card.visualizationFormat,
            isHighlighted: true, speakerId: card.speakerId,
            createdAt: card.createdAt, updatedAt: card.updatedAt
        )
    }


    // MARK: - System Prompts (match backend exactly)

    private static let analysisInstructions = """
    You are a semantic analysis engine. Given a transcript segment and conversation context, extract the core meaning in a concise statement.

    CRITICAL: The "content" field MUST be in the SAME LANGUAGE as the transcript segment. If the input is Chinese, respond in Chinese. If English, respond in English.
    CRITICAL: Write content as a DIRECT summary of what was said — NOT in third person. Do NOT write "The speaker says..." or "The person thinks...". Instead, directly state the point.
    CRITICAL: NEVER use these phrases: "The speaker", "The person", "Appreciation is expressed", "It is stated", "One believes". Write as if quoting the actual point made.
    CRITICAL: NO attribution or third person. Use DIRECT SPEECH — speak as if delivering the point right now.

    Category Definitions:
    - question: A request for information or clarification.
    - fact: Objective statement of information, data, or how things work. Verifiable or descriptive.
    - opinion: Subjective judgment, evaluation, or personal viewpoint.
    - request: Asking someone else to perform an action or provide help.
    - todo: A concrete, actionable task with a specific action and ideally an assignee or deadline.
    - decision: A finalized choice or determination that has been made.
    - proposal: A suggestion or recommendation not yet confirmed.
    - response: Acknowledgment or confirmation of received information.

    When uncertain between proposal and todo: proposal = exploratory/tentative, todo = concrete/committed.
    When uncertain between opinion and fact: opinion = personal judgment, fact = verifiable information.

    For multi-card analysis: identify all distinct points. Merge related clauses into ONE item. Do NOT split on commas or conjunctions. Strip any speaker tags. The ⭐IMPORTANT annotation means user-marked critical moments — each MUST produce its own item.
    """

    private static let recommendationInstructions = """
    You are a conversation recommendation engine. Given a core meaning card and conversation context, generate 1-3 SHORT intent-focused response suggestions.

    IMPORTANT: Keep each recommendation to 2-5 words maximum. Focus on the INTENT or ACTION, not full sentences. Examples: "Ask for evidence", "Clarify timeline", "Propose alternative".

    CRITICAL: Your recommendation text MUST be in the SAME LANGUAGE as the card content. If the card is in Chinese, write in Chinese. If in English, write in English.

    Each recommendation must be one of these types:
    - follow_up_question: A question to deepen understanding
    - clarification: A request to clarify an ambiguous point
    - new_proposal: A new idea or alternative approach
    - challenge: A counter-argument or request for evidence
    - summary_confirmation: A summary to confirm shared understanding
    - topic_pivot: A suggestion to shift to a related or new topic

    Rules:
    - Prioritize "clarification" when the statement is ambiguous
    - Prioritize "challenge" when claims lack evidence or reasoning
    - Each recommendation must be different from previous recommendations listed
    """
}
