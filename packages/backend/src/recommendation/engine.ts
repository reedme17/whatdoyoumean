import type { LLMGateway } from "../llm/gateway.js";
import type { LLMResponse } from "../llm/types.js";
import type {
  CoreMeaningCard,
  Recommendation,
  RecommendationType,
  TopicMap,
} from "@wdym/shared";

// ── public types ─────────────────────────────────────────────────

export interface MemoryContext {
  relevantEntries: { id: string; content: string; type: string }[];
  unresolvedQuestions: { id: string; content: string }[];
  pendingActionItems: { id: string; content: string }[];
  recurringTopics: string[];
}

export interface SessionContext {
  sessionId: string;
  existingCards: CoreMeaningCard[];
  topicMap: TopicMap;
}

// ── constants ────────────────────────────────────────────────────

const RECOMMENDATION_TIMEOUT_MS = 2000;
const TOPIC_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const VALID_TYPES: RecommendationType[] = [
  "follow_up_question",
  "clarification",
  "new_proposal",
  "challenge",
  "summary_confirmation",
  "topic_pivot",
];

// ── RecommendationEngine ─────────────────────────────────────────

export class RecommendationEngine {
  private llm: LLMGateway;
  /** Tracks previous recommendation sets per topic for deduplication */
  private previousSets = new Map<string, string[]>();
  private setCounter = 0;

  constructor(llmGateway: LLMGateway) {
    this.llm = llmGateway;
  }

  /**
   * Generate 1-3 recommendations for a given card within a 2-second budget.
   * Accepts optional MemoryContext for personalized suggestions.
   */
  async generateRecommendations(
    card: CoreMeaningCard,
    sessionContext: SessionContext,
    memoryContext?: MemoryContext | null,
  ): Promise<Recommendation[]> {
    const topicHint = this.getTopicHint(card, sessionContext.topicMap);
    const memoryHint = memoryContext ? this.buildMemoryHint(memoryContext) : "";
    const previousTexts = this.previousSets.get(card.topicId) ?? [];

    const prompt = buildRecommendationPrompt(
      card,
      sessionContext,
      topicHint,
      memoryHint,
      previousTexts,
    );

    const response = await this.llm.complete({
      taskType: "recommendation",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      maxTokens: 400,
      temperature: 0.7,
      stream: false,
      timeoutMs: RECOMMENDATION_TIMEOUT_MS,
    });

    const parsed = parseRecommendationResponse(response);
    const setIndex = ++this.setCounter;

    const recommendations = parsed
      .slice(0, 3) // max 3
      .filter((r) => !previousTexts.includes(r.text)) // deduplicate
      .map((r) => ({
        id: generateId(),
        sessionId: sessionContext.sessionId,
        sourceCardId: card.id,
        type: validateType(r.type),
        text: r.text,
        reasoning: r.reasoning,
        memoryReferenceIds: r.memoryReferenceIds ?? [],
        setIndex,
        createdAt: new Date(),
      }));

    // Ensure at least 1 recommendation
    if (recommendations.length === 0 && parsed.length > 0) {
      const first = parsed[0];
      recommendations.push({
        id: generateId(),
        sessionId: sessionContext.sessionId,
        sourceCardId: card.id,
        type: validateType(first.type),
        text: first.text,
        reasoning: first.reasoning,
        memoryReferenceIds: first.memoryReferenceIds ?? [],
        setIndex,
        createdAt: new Date(),
      });
    }

    // Store for future deduplication
    this.previousSets.set(
      card.topicId,
      recommendations.map((r) => r.text),
    );

    return recommendations;
  }

  // ── private helpers ──────────────────────────────────────────

  private getTopicHint(card: CoreMeaningCard, topicMap: TopicMap): string {
    const topic = topicMap.topics.find((t) => t.id === card.topicId);
    if (!topic) return "";

    const elapsed = Date.now() - topic.startTime;
    if (elapsed > TOPIC_STALE_THRESHOLD_MS && !topic.isResolved) {
      return "STALE_TOPIC: This topic has been discussed for over 5 minutes without resolution. Prioritize summary_confirmation or topic_pivot.";
    }
    return "";
  }

  private buildMemoryHint(ctx: MemoryContext): string {
    const parts: string[] = [];
    if (ctx.unresolvedQuestions.length > 0) {
      parts.push(
        `Unresolved questions from past sessions:\n${ctx.unresolvedQuestions.map((q) => `- ${q.content}`).join("\n")}`,
      );
    }
    if (ctx.pendingActionItems.length > 0) {
      parts.push(
        `Pending action items:\n${ctx.pendingActionItems.map((a) => `- ${a.content}`).join("\n")}`,
      );
    }
    if (ctx.recurringTopics.length > 0) {
      parts.push(`Recurring topics: ${ctx.recurringTopics.join(", ")}`);
    }
    return parts.join("\n\n");
  }
}

// ── prompt builders ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a conversation recommendation engine. Given a core meaning card and conversation context, generate 1-3 actionable conversation recommendations.

CRITICAL: Your recommendation text MUST be in the SAME LANGUAGE as the card content. If the card is in Chinese, write recommendations in Chinese. If in English, write in English. If mixed, match the dominant language.

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
- If a topic has been discussed for 5+ minutes without resolution, suggest "summary_confirmation" or "topic_pivot"
- Each recommendation must be different from previous recommendations listed

Respond ONLY with valid JSON array:
[
  {
    "type": "<recommendation_type>",
    "text": "<the recommendation text the user could say>",
    "reasoning": "<why this recommendation is useful>",
    "memoryReferenceIds": []
  }
]`;

function buildRecommendationPrompt(
  card: CoreMeaningCard,
  context: SessionContext,
  topicHint: string,
  memoryHint: string,
  previousTexts: string[],
): string {
  const recentCards = context.existingCards
    .slice(-5)
    .map((c) => `[${c.category}] ${c.content}`)
    .join("\n");

  const parts = [
    `Current card:\nCategory: ${card.category}\nContent: "${card.content}"`,
    recentCards ? `\nRecent conversation cards:\n${recentCards}` : "",
    topicHint ? `\n${topicHint}` : "",
    memoryHint ? `\nUser memory context:\n${memoryHint}` : "",
    previousTexts.length > 0
      ? `\nPrevious recommendations for this topic (DO NOT repeat):\n${previousTexts.map((t) => `- ${t}`).join("\n")}`
      : "",
  ];

  return parts.filter(Boolean).join("\n");
}

// ── response parsing ─────────────────────────────────────────────

interface ParsedRecommendation {
  type: string;
  text: string;
  reasoning: string;
  memoryReferenceIds?: string[];
}

function parseRecommendationResponse(
  response: LLMResponse,
): ParsedRecommendation[] {
  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const arr = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (item: unknown): item is ParsedRecommendation =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ParsedRecommendation).text === "string" &&
          typeof (item as ParsedRecommendation).type === "string",
      )
      .map((item) => ({
        type: String(item.type),
        text: String(item.text),
        reasoning: String(item.reasoning ?? ""),
        memoryReferenceIds: Array.isArray(item.memoryReferenceIds)
          ? item.memoryReferenceIds.map(String)
          : [],
      }));
  } catch {
    return [];
  }
}

// ── utilities ────────────────────────────────────────────────────

function validateType(type: string): RecommendationType {
  if (VALID_TYPES.includes(type as RecommendationType)) {
    return type as RecommendationType;
  }
  return "follow_up_question";
}

let idCounter = 0;
function generateId(): string {
  return `rec_${Date.now()}_${++idCounter}`;
}
