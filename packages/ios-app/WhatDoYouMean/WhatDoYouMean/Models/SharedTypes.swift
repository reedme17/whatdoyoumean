import Foundation

// MARK: - Card Types (from shared/card.ts)

enum MeaningCategory: String, Codable, CaseIterable {
    case fact
    case opinion
    case question
    case decision
    case todo
    case proposal
    case request
    case response

    var label: String {
        switch self {
        case .fact: return "Fact"
        case .opinion: return "Opinion"
        case .question: return "Question"
        case .decision: return "Decision"
        case .todo: return "To-do"
        case .proposal: return "Proposal"
        case .request: return "Request"
        case .response: return "Response"
        }
    }
}

enum VisualizationFormat: String, Codable {
    case conciseText = "concise_text"
    case flowDiagram = "flow_diagram"
}

struct CoreMeaningCard: Identifiable, Codable, Equatable {
    let id: String
    let sessionId: String
    let category: MeaningCategory
    var content: String
    let sourceSegmentIds: [String]
    let linkedCardIds: [String]
    let linkType: String?  // "contradicts" | "modifies" | "extends" | null
    let topicId: String
    let visualizationFormat: VisualizationFormat
    var isHighlighted: Bool
    let speakerId: String?
    let createdAt: String
    let updatedAt: String
}

// MARK: - Recommendation (from shared/recommendation.ts)

enum RecommendationType: String, Codable {
    case followUpQuestion = "follow_up_question"
    case clarification
    case newProposal = "new_proposal"
    case challenge
    case summaryConfirmation = "summary_confirmation"
    case topicPivot = "topic_pivot"
}

struct Recommendation: Identifiable, Codable {
    let id: String
    let sessionId: String
    let sourceCardId: String
    let type: RecommendationType
    let text: String
    let reasoning: String
    let memoryReferenceIds: [String]
    let setIndex: Int
    let createdAt: String
}

// MARK: - Transcript (from shared/transcript.ts)

struct TranscriptSegment: Identifiable, Codable {
    let id: String
    let sessionId: String
    let text: String
    let languageCode: String
    let speakerId: String
    let startTime: Double
    let endTime: Double
    let isFinal: Bool
    let confidence: Double
    let provider: String
    let createdAt: String
}

// MARK: - Speaker (from shared/speaker.ts)

struct SpeakerLabel: Identifiable, Codable {
    let id: String
    let sessionId: String
    let displayName: String?
    let isUncertain: Bool
}

// MARK: - Session (from shared/session.ts)

struct ConversationSession: Identifiable, Codable {
    let id: String
    let userId: String
    let mode: String
    let status: String
    let startedAt: String
    let endedAt: String?
    let pausedAt: String?
    let durationMs: Int
    let languageCode: String
    let participantCount: Int
    let sttProvider: String
    let llmProvider: String
    let topicSummary: String
}

// MARK: - Bookmark (from shared/bookmark.ts)

struct Bookmark: Identifiable, Codable {
    let id: String
    let sessionId: String
    let userId: String
    let timestamp: Double
    let note: String?
    let cardId: String?
    let createdAt: String
}

// MARK: - Topic (from shared/topic.ts)

struct Topic: Identifiable, Codable {
    let id: String
    let sessionId: String
    let name: String
    let cardIds: [String]
    let startTime: Double
    let lastActiveTime: Double
    let isResolved: Bool
}

struct TopicRelation: Codable {
    let fromTopicId: String
    let toTopicId: String
    let relationType: String
}

struct TopicMap: Codable {
    let sessionId: String
    let topics: [Topic]
    let relations: [TopicRelation]
}

// MARK: - Settings enums

enum SttLanguage: String, CaseIterable {
    case zhEn = "zh+en"
    case zh = "zh"
    case en = "en"

    var label: String {
        switch self {
        case .zhEn: return "中英"
        case .zh: return "中文"
        case .en: return "English"
        }
    }
}

enum AudioSourceMode: String, CaseIterable {
    case mic
    case system
    case both

    var label: String {
        switch self {
        case .mic: return "Mic"
        case .system: return "System"
        case .both: return "Both"
        }
    }
}

/// Processing mode — determines where LLM inference runs.
enum ProcessingMode: String, CaseIterable {
    case local   // Apple Foundation Model on-device (default)
    case cloud   // Backend LLM via WebSocket
    case fusion  // Local first, cloud refines

    var label: String {
        switch self {
        case .local: return "Local"
        case .cloud: return "Cloud"
        case .fusion: return "Fusion"
        }
    }
}
