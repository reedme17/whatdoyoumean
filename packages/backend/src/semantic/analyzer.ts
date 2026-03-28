import type { LLMGateway } from "../llm/gateway.js";
import type { LLMResponse } from "../llm/types.js";
import type {
  CoreMeaningCard,
  MeaningCategory,
  TranscriptSegment,
  Topic,
  TopicMap,
  TopicRelation,
} from "@wdym/shared";

// ── public types ─────────────────────────────────────────────────

export interface SessionContext {
  sessionId: string;
  recentTranscripts: TranscriptSegment[];
  existingCards: CoreMeaningCard[];
  topicMap: TopicMap;
}

export interface MergeDecision {
  shouldMerge: boolean;
  targetCardId: string | null;
  mergedContent: string | null;
}

interface AnalysisResult {
  content: string;
  category: MeaningCategory;
  linkType: "contradicts" | "modifies" | "extends" | null;
  linkedCardId: string | null;
  topicName: string;
  isDuplicate: boolean;
  duplicateCardId: string | null;
  mergedContent: string | null;
}

// ── constants ────────────────────────────────────────────────────

const MAX_ENGLISH_WORDS = 30;
const MAX_CHINESE_CHARS = 50;
const ANALYSIS_TIMEOUT_MS = 3000;

const VALID_CATEGORIES: MeaningCategory[] = [
  "fact",
  "opinion",
  "question",
  "decision",
  "action_item",
  "proposal",
];

// ── SemanticAnalyzer ─────────────────────────────────────────────

export class SemanticAnalyzer {
  private llm: LLMGateway;

  constructor(llmGateway: LLMGateway) {
    this.llm = llmGateway;
  }

  /**
   * Analyze a finalized transcript segment and produce a CoreMeaningCard.
   * Sends the segment + session context to the LLM, enforces content length
   * limits, and returns a card within the 3-second latency budget.
   */
  async analyze(
    segment: TranscriptSegment,
    context: SessionContext,
  ): Promise<CoreMeaningCard> {
    const existingCardsSummary = context.existingCards
      .slice(-10)
      .map((c) => `[${c.id}] (${c.category}) ${c.content}`)
      .join("\n");

    const topicsSummary = context.topicMap.topics
      .map((t) => `[${t.id}] ${t.name}`)
      .join(", ");

    const prompt = buildAnalysisPrompt(
      segment,
      existingCardsSummary,
      topicsSummary,
    );

    const response = await this.llm.complete({
      taskType: "semantic_analysis",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      maxTokens: 300,
      temperature: 0.3,
      stream: false,
      timeoutMs: ANALYSIS_TIMEOUT_MS,
    });

    const parsed = parseAnalysisResponse(response);
    const content = enforceContentLimit(parsed.content, segment.languageCode);
    const category = validateCategory(parsed.category);

    const cardId = generateId();
    const now = new Date();

    return {
      id: cardId,
      sessionId: context.sessionId,
      category,
      content,
      sourceSegmentIds: [segment.id],
      linkedCardIds: parsed.linkedCardId ? [parsed.linkedCardId] : [],
      linkType: parsed.linkType,
      topicId: resolveTopicId(parsed.topicName, context.topicMap),
      visualizationFormat: "concise_text",
      isHighlighted: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Detect whether a new card duplicates an existing one.
   * Returns a MergeDecision indicating whether to merge and into which card.
   */
  async analyzeMulti(text: string, languageCode: string): Promise<CoreMeaningCard[]> {
    console.log("[SemanticAnalyzer] analyzeMulti calling LLM...");
    const response = await this.llm.complete({
      taskType: "semantic_analysis",
      messages: [
        { role: "system", content: MULTI_SYSTEM_PROMPT },
        { role: "user", content: `Analyze this text and extract all distinct points:\n\n${text}` },
      ],
      maxTokens: 1000,
      temperature: 0.3,
      stream: false,
      timeoutMs: 10000,
    });

    try {
      console.log("[SemanticAnalyzer] analyzeMulti raw response:", response.content.slice(0, 300));
      const raw = response.content.replace(/```json\n?|```/g, "").trim();
      const items = JSON.parse(raw) as { content: string; category: string }[];
      if (!Array.isArray(items) || items.length === 0) throw new Error("Empty array");

      return items.map((item, i) => ({
        id: `card_multi_${Date.now()}_${i}`,
        sessionId: "",
        content: enforceContentLimit(item.content || text.slice(0, 50), languageCode),
        category: validateCategory(item.category),
        sourceSegmentIds: [],
        linkedCardId: null,
        linkType: null,
        topicId: null,
        visualizationType: "concise_text" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    } catch (err) {
      // Fallback: return single card
      console.log("[SemanticAnalyzer] Multi-parse failed, falling back to single. Raw response:", response.content?.slice(0, 200));
      console.log("[SemanticAnalyzer] Parse error:", err);
      return [{
        id: `card_multi_${Date.now()}`,
        sessionId: "",
        content: text.slice(0, 100),
        category: "fact",
        sourceSegmentIds: [],
        linkedCardId: null,
        linkType: null,
        topicId: null,
        visualizationType: "concise_text" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }];
    }
  }

  async detectDuplicate(
    card: CoreMeaningCard,
    existingCards: CoreMeaningCard[],
  ): Promise<MergeDecision> {
    if (existingCards.length === 0) {
      return { shouldMerge: false, targetCardId: null, mergedContent: null };
    }

    const cardsList = existingCards
      .map((c) => `[${c.id}] (${c.category}) ${c.content}`)
      .join("\n");

    const prompt = buildDuplicatePrompt(card, cardsList);

    const response = await this.llm.complete({
      taskType: "semantic_analysis",
      messages: [
        { role: "system", content: DUPLICATE_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      maxTokens: 200,
      temperature: 0.2,
      stream: false,
      timeoutMs: ANALYSIS_TIMEOUT_MS,
    });

    return parseDuplicateResponse(response);
  }

  /**
   * Update the topic map with a new card. Groups the card under an existing
   * or new topic, detects topic transitions, and maintains topic relationships.
   */
  async updateTopicMap(
    card: CoreMeaningCard,
    currentMap: TopicMap,
  ): Promise<TopicMap> {
    const topicsSummary = currentMap.topics
      .map((t) => `[${t.id}] ${t.name} (cards: ${t.cardIds.length})`)
      .join("\n");

    const prompt = buildTopicPrompt(card, topicsSummary);

    const response = await this.llm.complete({
      taskType: "topic_extraction",
      messages: [
        { role: "system", content: TOPIC_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      maxTokens: 200,
      temperature: 0.2,
      stream: false,
      timeoutMs: ANALYSIS_TIMEOUT_MS,
    });

    return applyTopicUpdate(response, card, currentMap);
  }
}

// ── prompt builders ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a semantic analysis engine. Given a transcript segment and conversation context, extract the core meaning in a concise statement.

CRITICAL: The "content" field MUST be in the SAME LANGUAGE as the transcript segment. If the input is Chinese, respond in Chinese. If English, respond in English. If mixed, use the dominant language.

Respond ONLY with valid JSON in this exact format:
{
  "content": "<core meaning in ≤30 English words or ≤50 Chinese characters>",
  "category": "<one of: fact, opinion, question, decision, action_item, proposal>",
  "linkType": "<one of: contradicts, modifies, extends, or null>",
  "linkedCardId": "<id of related card or null>",
  "topicName": "<short topic name>",
  "isDuplicate": false,
  "duplicateCardId": null,
  "mergedContent": null
}`;

const MULTI_SYSTEM_PROMPT = `You are a semantic analysis engine. Given a text passage, identify the key distinct points, opinions, facts, questions, decisions, or action items. Return them as a JSON array.

CRITICAL: The "content" field MUST be in the SAME LANGUAGE as the input text.
CRITICAL: Merge related clauses into ONE item. Do NOT split on commas or conjunctions. Each item should represent a complete, self-contained idea — not a sentence fragment.

Respond ONLY with a valid JSON array. Each element has this format:
{
  "content": "<core meaning in ≤30 English words or ≤50 Chinese characters>",
  "category": "<one of: fact, opinion, question, decision, action_item, proposal>"
}

Example: [{"content":"The meeting is at 3pm","category":"fact"},{"content":"We should cancel the project","category":"opinion"}]

Return as many items as needed based on the text complexity. Short simple text = 1 item. Long text with multiple points = multiple items. Prefer fewer, richer items over many fragments.`;

const DUPLICATE_SYSTEM_PROMPT = `You detect duplicate or rephrased points in a conversation. Given a new card and existing cards, determine if the new card duplicates an existing one.

Respond ONLY with valid JSON:
{
  "shouldMerge": true/false,
  "targetCardId": "<id of card to merge into or null>",
  "mergedContent": "<combined content if merging, or null>"
}`;

const TOPIC_SYSTEM_PROMPT = `You manage conversation topic maps. Given a new card and existing topics, determine which topic the card belongs to and detect topic transitions.

Respond ONLY with valid JSON:
{
  "topicId": "<existing topic id or 'new'>",
  "topicName": "<topic name>",
  "relationType": "<follows, branches_from, returns_to, or null>",
  "relatedTopicId": "<id of related topic or null>",
  "topicSummary": "<brief running summary of the topic>"
}`;

function buildAnalysisPrompt(
  segment: TranscriptSegment,
  existingCards: string,
  topics: string,
): string {
  const hasChinese = /[\u4e00-\u9fff]/.test(segment.text);
  const langHint = hasChinese
    ? "⚠ The transcript is in Chinese. The \"content\" field MUST be in Chinese (中文)."
    : "⚠ The transcript is in English. The \"content\" field MUST be in English.";

  return `Transcript segment (${segment.languageCode}):
"${segment.text}"

${langHint}

Speaker: ${segment.speakerId}

Existing cards:
${existingCards || "(none)"}

Current topics: ${topics || "(none)"}

Extract the core meaning, categorize it, and detect any relationships with existing cards.`;
}

function buildDuplicatePrompt(
  card: CoreMeaningCard,
  existingCards: string,
): string {
  return `New card:
Content: "${card.content}"
Category: ${card.category}

Existing cards:
${existingCards}

Does the new card duplicate or rephrase any existing card? If so, provide merged content.`;
}

function buildTopicPrompt(card: CoreMeaningCard, topics: string): string {
  return `New card:
Content: "${card.content}"
Category: ${card.category}

Existing topics:
${topics || "(none)"}

Assign this card to an existing topic or create a new one. Detect any topic transitions.`;
}

// ── response parsers ─────────────────────────────────────────────

function parseAnalysisResponse(response: LLMResponse): AnalysisResult {
  try {
    const json = extractJson(response.content);
    return {
      content: String(json.content ?? ""),
      category: String(json.category ?? "fact") as MeaningCategory,
      linkType: (json.linkType as AnalysisResult["linkType"]) ?? null,
      linkedCardId: json.linkedCardId != null ? String(json.linkedCardId) : null,
      topicName: String(json.topicName ?? "General"),
      isDuplicate: Boolean(json.isDuplicate),
      duplicateCardId: json.duplicateCardId != null ? String(json.duplicateCardId) : null,
      mergedContent: json.mergedContent != null ? String(json.mergedContent) : null,
    };
  } catch {
    return {
      content: response.content.slice(0, 100),
      category: "fact",
      linkType: null,
      linkedCardId: null,
      topicName: "General",
      isDuplicate: false,
      duplicateCardId: null,
      mergedContent: null,
    };
  }
}

function parseDuplicateResponse(response: LLMResponse): MergeDecision {
  try {
    const json = extractJson(response.content);
    return {
      shouldMerge: Boolean(json.shouldMerge),
      targetCardId: json.targetCardId != null ? String(json.targetCardId) : null,
      mergedContent: json.mergedContent != null ? String(json.mergedContent) : null,
    };
  } catch {
    return { shouldMerge: false, targetCardId: null, mergedContent: null };
  }
}

interface TopicUpdateResult {
  topicId: string;
  topicName: string;
  relationType: TopicRelation["relationType"] | null;
  relatedTopicId: string | null;
  topicSummary: string;
}

function parseTopicResponse(response: LLMResponse): TopicUpdateResult {
  try {
    const json = extractJson(response.content);
    return {
      topicId: String(json.topicId ?? "new"),
      topicName: String(json.topicName ?? "General"),
      relationType: (json.relationType as TopicUpdateResult["relationType"]) ?? null,
      relatedTopicId: json.relatedTopicId != null ? String(json.relatedTopicId) : null,
      topicSummary: String(json.topicSummary ?? ""),
    };
  } catch {
    return {
      topicId: "new",
      topicName: "General",
      relationType: null,
      relatedTopicId: null,
      topicSummary: "",
    };
  }
}

function applyTopicUpdate(
  response: LLMResponse,
  card: CoreMeaningCard,
  currentMap: TopicMap,
): TopicMap {
  const parsed = parseTopicResponse(response);
  const topics = [...currentMap.topics];
  const relations = [...currentMap.relations];

  const existingTopic = topics.find((t) => t.id === parsed.topicId);

  if (existingTopic) {
    // Add card to existing topic
    const idx = topics.indexOf(existingTopic);
    topics[idx] = {
      ...existingTopic,
      cardIds: [...existingTopic.cardIds, card.id],
      lastActiveTime: Date.now(),
    };
  } else {
    // Create new topic
    const newTopic: Topic = {
      id: generateId(),
      sessionId: currentMap.sessionId,
      name: parsed.topicName,
      cardIds: [card.id],
      startTime: Date.now(),
      lastActiveTime: Date.now(),
      isResolved: false,
    };
    topics.push(newTopic);

    // Add relation if there's a topic transition
    if (parsed.relationType && parsed.relatedTopicId) {
      const relatedExists = topics.some((t) => t.id === parsed.relatedTopicId);
      if (relatedExists) {
        relations.push({
          fromTopicId: parsed.relatedTopicId!,
          toTopicId: newTopic.id,
          relationType: parsed.relationType,
        });
      }
    }
  }

  return {
    sessionId: currentMap.sessionId,
    topics,
    relations,
  };
}

// ── utility functions ────────────────────────────────────────────

function extractJson(text: string): Record<string, unknown> {
  // Try to find JSON in the response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  return JSON.parse(jsonMatch[0]);
}

/**
 * Enforce the 30-word (English) / 50-character (Chinese) limit.
 */
export function enforceContentLimit(
  content: string,
  languageCode: "zh" | "en",
): string {
  if (languageCode === "zh") {
    // Count Chinese characters (CJK Unified Ideographs range)
    const chars = [...content];
    const chineseChars = chars.filter((c) => /[\u4e00-\u9fff]/.test(c));
    if (chineseChars.length > MAX_CHINESE_CHARS) {
      // Truncate to limit, keeping whole characters
      let count = 0;
      let cutoff = 0;
      for (let i = 0; i < chars.length; i++) {
        if (/[\u4e00-\u9fff]/.test(chars[i])) count++;
        if (count > MAX_CHINESE_CHARS) {
          cutoff = i;
          break;
        }
        cutoff = i + 1;
      }
      return chars.slice(0, cutoff).join("");
    }
    return content;
  }

  // English: limit to 30 words
  const words = content.split(/\s+/).filter(Boolean);
  if (words.length > MAX_ENGLISH_WORDS) {
    return words.slice(0, MAX_ENGLISH_WORDS).join(" ");
  }
  return content;
}

export function validateCategory(category: string): MeaningCategory {
  if (VALID_CATEGORIES.includes(category as MeaningCategory)) {
    return category as MeaningCategory;
  }
  return "fact";
}

function resolveTopicId(topicName: string, topicMap: TopicMap): string {
  const existing = topicMap.topics.find(
    (t) => t.name.toLowerCase() === topicName.toLowerCase(),
  );
  return existing?.id ?? "pending";
}

let idCounter = 0;
export function generateId(): string {
  return `id_${Date.now()}_${++idCounter}`;
}
