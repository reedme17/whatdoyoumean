import { describe, it, expect, beforeEach } from "vitest";
import {
  SemanticAnalyzer,
  enforceContentLimit,
  validateCategory,
  type SessionContext,
  type MergeDecision,
} from "./analyzer.js";
import type { LLMGateway } from "../llm/gateway.js";
import type { LLMRequest, LLMResponse } from "../llm/types.js";
import type {
  CoreMeaningCard,
  MeaningCategory,
  TranscriptSegment,
  TopicMap,
} from "@wdym/shared";

// ── mock helpers ─────────────────────────────────────────────────

function makeMockGateway(
  responseMap: Record<string, string>,
): LLMGateway {
  return {
    complete: async (request: LLMRequest): Promise<LLMResponse> => {
      const taskType = request.taskType;
      const content = responseMap[taskType] ?? "{}";
      return {
        content,
        providerId: "mock",
        usage: { promptTokens: 10, completionTokens: 20 },
        latencyMs: 50,
      };
    },
  } as unknown as LLMGateway;
}

function makeSegment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: "seg-1",
    sessionId: "session-1",
    text: "We should schedule the product launch for next Friday.",
    languageCode: "en",
    speakerId: "speaker-1",
    startTime: 1000,
    endTime: 5000,
    isFinal: true,
    confidence: 0.95,
    provider: "groq_whisper",
    createdAt: new Date(),
    ...overrides,
  };
}

function makeCard(overrides: Partial<CoreMeaningCard> = {}): CoreMeaningCard {
  return {
    id: "card-1",
    sessionId: "session-1",
    category: "decision",
    content: "Product launch scheduled for next Friday",
    sourceSegmentIds: ["seg-1"],
    linkedCardIds: [],
    linkType: null,
    topicId: "topic-1",
    visualizationFormat: "concise_text",
    isHighlighted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    sessionId: "session-1",
    recentTranscripts: [],
    existingCards: [],
    topicMap: {
      sessionId: "session-1",
      topics: [],
      relations: [],
    },
    ...overrides,
  };
}

function makeTopicMap(overrides: Partial<TopicMap> = {}): TopicMap {
  return {
    sessionId: "session-1",
    topics: [],
    relations: [],
    ...overrides,
  };
}

// ── unit tests: enforceContentLimit ──────────────────────────────

describe("enforceContentLimit", () => {
  it("returns English content unchanged when under 30 words", () => {
    const text = "This is a short sentence.";
    expect(enforceContentLimit(text, "en")).toBe(text);
  });

  it("truncates English content to 30 words", () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const result = enforceContentLimit(text, "en");
    expect(result.split(/\s+/).length).toBe(30);
  });

  it("returns Chinese content unchanged when under 50 characters", () => {
    const text = "这是一个简短的句子";
    expect(enforceContentLimit(text, "zh")).toBe(text);
  });

  it("truncates Chinese content to 50 Chinese characters", () => {
    // 60 Chinese characters
    const chars = "我".repeat(60);
    const result = enforceContentLimit(chars, "zh");
    const chineseCount = [...result].filter((c) => /[\u4e00-\u9fff]/.test(c)).length;
    expect(chineseCount).toBe(50);
  });

  it("handles mixed Chinese/English in zh mode by counting only Chinese chars", () => {
    // 45 Chinese chars + some English
    const text = "我".repeat(45) + " hello world";
    const result = enforceContentLimit(text, "zh");
    expect(result).toBe(text); // under 50 Chinese chars
  });
});

// ── unit tests: validateCategory ─────────────────────────────────

describe("validateCategory", () => {
  it("returns valid categories unchanged", () => {
    const categories: MeaningCategory[] = [
      "fact",
      "opinion",
      "question",
      "decision",
      "action_item",
      "proposal",
    ];
    for (const cat of categories) {
      expect(validateCategory(cat)).toBe(cat);
    }
  });

  it("defaults to fact for invalid categories", () => {
    expect(validateCategory("invalid")).toBe("fact");
    expect(validateCategory("")).toBe("fact");
  });
});

// ── SemanticAnalyzer.analyze() ───────────────────────────────────

describe("SemanticAnalyzer", () => {
  describe("analyze()", () => {
    it("produces a CoreMeaningCard from a transcript segment", async () => {
      const gateway = makeMockGateway({
        semantic_analysis: JSON.stringify({
          content: "Product launch scheduled for next Friday",
          category: "decision",
          linkType: null,
          linkedCardId: null,
          topicName: "Product Launch",
          isDuplicate: false,
          duplicateCardId: null,
          mergedContent: null,
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const segment = makeSegment();
      const context = makeContext();

      const card = await analyzer.analyze(segment, context);

      expect(card.sessionId).toBe("session-1");
      expect(card.category).toBe("decision");
      expect(card.content).toBe("Product launch scheduled for next Friday");
      expect(card.sourceSegmentIds).toEqual(["seg-1"]);
      expect(card.linkedCardIds).toEqual([]);
      expect(card.linkType).toBeNull();
      expect(card.visualizationFormat).toBe("concise_text");
      expect(card.isHighlighted).toBe(false);
    });

    it("enforces 30-word limit on English content", async () => {
      const longContent = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
      const gateway = makeMockGateway({
        semantic_analysis: JSON.stringify({
          content: longContent,
          category: "fact",
          linkType: null,
          linkedCardId: null,
          topicName: "General",
          isDuplicate: false,
          duplicateCardId: null,
          mergedContent: null,
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const card = await analyzer.analyze(makeSegment(), makeContext());

      expect(card.content.split(/\s+/).length).toBeLessThanOrEqual(30);
    });

    it("enforces 50-character limit on Chinese content", async () => {
      const longContent = "我".repeat(60);
      const gateway = makeMockGateway({
        semantic_analysis: JSON.stringify({
          content: longContent,
          category: "opinion",
          linkType: null,
          linkedCardId: null,
          topicName: "General",
          isDuplicate: false,
          duplicateCardId: null,
          mergedContent: null,
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const segment = makeSegment({ languageCode: "zh" });
      const card = await analyzer.analyze(segment, makeContext());

      const chineseCount = [...card.content].filter((c) =>
        /[\u4e00-\u9fff]/.test(c),
      ).length;
      expect(chineseCount).toBeLessThanOrEqual(50);
    });

    it("defaults to fact for invalid categories", async () => {
      const gateway = makeMockGateway({
        semantic_analysis: JSON.stringify({
          content: "Some content",
          category: "invalid_category",
          linkType: null,
          linkedCardId: null,
          topicName: "General",
          isDuplicate: false,
          duplicateCardId: null,
          mergedContent: null,
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const card = await analyzer.analyze(makeSegment(), makeContext());

      expect(card.category).toBe("fact");
    });

    it("populates linkedCardIds when LLM detects a relationship", async () => {
      const gateway = makeMockGateway({
        semantic_analysis: JSON.stringify({
          content: "Actually, launch should be Monday instead",
          category: "opinion",
          linkType: "contradicts",
          linkedCardId: "card-1",
          topicName: "Product Launch",
          isDuplicate: false,
          duplicateCardId: null,
          mergedContent: null,
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const context = makeContext({
        existingCards: [makeCard()],
      });
      const card = await analyzer.analyze(makeSegment(), context);

      expect(card.linkedCardIds).toEqual(["card-1"]);
      expect(card.linkType).toBe("contradicts");
    });

    it("handles malformed LLM response gracefully", async () => {
      const gateway = makeMockGateway({
        semantic_analysis: "This is not JSON at all",
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const card = await analyzer.analyze(makeSegment(), makeContext());

      // Should fall back to defaults
      expect(card.category).toBe("fact");
      expect(card.content).toBeTruthy();
    });

    it("sends request with semantic_analysis taskType", async () => {
      let capturedRequest: LLMRequest | null = null;
      const gateway = {
        complete: async (request: LLMRequest): Promise<LLMResponse> => {
          capturedRequest = request;
          return {
            content: JSON.stringify({
              content: "Test",
              category: "opinion",
              linkType: null,
              linkedCardId: null,
              topicName: "General",
              isDuplicate: false,
              duplicateCardId: null,
              mergedContent: null,
            }),
            providerId: "mock",
            usage: { promptTokens: 10, completionTokens: 20 },
            latencyMs: 50,
          };
        },
      } as unknown as LLMGateway;

      const analyzer = new SemanticAnalyzer(gateway);
      await analyzer.analyze(makeSegment(), makeContext());

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.taskType).toBe("semantic_analysis");
      expect(capturedRequest!.timeoutMs).toBe(3000);
    });
  });

  // ── detectDuplicate() ────────────────────────────────────────

  describe("detectDuplicate()", () => {
    it("returns no merge when there are no existing cards", async () => {
      const gateway = makeMockGateway({});
      const analyzer = new SemanticAnalyzer(gateway);

      const result = await analyzer.detectDuplicate(makeCard(), []);

      expect(result.shouldMerge).toBe(false);
      expect(result.targetCardId).toBeNull();
      expect(result.mergedContent).toBeNull();
    });

    it("detects a duplicate and returns merge decision", async () => {
      const gateway = makeMockGateway({
        semantic_analysis: JSON.stringify({
          shouldMerge: true,
          targetCardId: "card-1",
          mergedContent: "Product launch confirmed for next Friday with full team",
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const newCard = makeCard({
        id: "card-2",
        content: "Launch is next Friday with everyone",
      });
      const existingCards = [makeCard()];

      const result = await analyzer.detectDuplicate(newCard, existingCards);

      expect(result.shouldMerge).toBe(true);
      expect(result.targetCardId).toBe("card-1");
      expect(result.mergedContent).toBe(
        "Product launch confirmed for next Friday with full team",
      );
    });

    it("returns no merge when cards are distinct", async () => {
      const gateway = makeMockGateway({
        semantic_analysis: JSON.stringify({
          shouldMerge: false,
          targetCardId: null,
          mergedContent: null,
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const newCard = makeCard({
        id: "card-2",
        content: "Budget needs to be approved by finance",
        category: "action_item",
      });

      const result = await analyzer.detectDuplicate(newCard, [makeCard()]);

      expect(result.shouldMerge).toBe(false);
    });

    it("handles malformed duplicate response gracefully", async () => {
      const gateway = makeMockGateway({
        semantic_analysis: "not json",
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const result = await analyzer.detectDuplicate(makeCard(), [makeCard()]);

      expect(result.shouldMerge).toBe(false);
      expect(result.targetCardId).toBeNull();
    });
  });

  // ── updateTopicMap() ─────────────────────────────────────────

  describe("updateTopicMap()", () => {
    it("creates a new topic when none exist", async () => {
      const gateway = makeMockGateway({
        topic_extraction: JSON.stringify({
          topicId: "new",
          topicName: "Product Launch",
          relationType: null,
          relatedTopicId: null,
          topicSummary: "Discussion about upcoming product launch",
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const card = makeCard();
      const map = makeTopicMap();

      const result = await analyzer.updateTopicMap(card, map);

      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].name).toBe("Product Launch");
      expect(result.topics[0].cardIds).toContain("card-1");
      expect(result.relations).toHaveLength(0);
    });

    it("adds card to existing topic", async () => {
      const existingTopic = {
        id: "topic-1",
        sessionId: "session-1",
        name: "Product Launch",
        cardIds: ["card-0"],
        startTime: 1000,
        lastActiveTime: 2000,
        isResolved: false,
      };

      const gateway = makeMockGateway({
        topic_extraction: JSON.stringify({
          topicId: "topic-1",
          topicName: "Product Launch",
          relationType: null,
          relatedTopicId: null,
          topicSummary: "Continued discussion about product launch",
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const card = makeCard();
      const map = makeTopicMap({ topics: [existingTopic] });

      const result = await analyzer.updateTopicMap(card, map);

      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].cardIds).toEqual(["card-0", "card-1"]);
    });

    it("detects topic transition and creates a relation", async () => {
      const existingTopic = {
        id: "topic-1",
        sessionId: "session-1",
        name: "Product Launch",
        cardIds: ["card-0"],
        startTime: 1000,
        lastActiveTime: 2000,
        isResolved: false,
      };

      const gateway = makeMockGateway({
        topic_extraction: JSON.stringify({
          topicId: "new",
          topicName: "Marketing Strategy",
          relationType: "branches_from",
          relatedTopicId: "topic-1",
          topicSummary: "Marketing approach for the launch",
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const card = makeCard({ id: "card-2", content: "We need a marketing plan" });
      const map = makeTopicMap({ topics: [existingTopic] });

      const result = await analyzer.updateTopicMap(card, map);

      expect(result.topics).toHaveLength(2);
      expect(result.topics[1].name).toBe("Marketing Strategy");
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].relationType).toBe("branches_from");
      expect(result.relations[0].fromTopicId).toBe("topic-1");
    });

    it("detects returns_to relation when revisiting a topic", async () => {
      const topic1 = {
        id: "topic-1",
        sessionId: "session-1",
        name: "Budget",
        cardIds: ["card-0"],
        startTime: 1000,
        lastActiveTime: 2000,
        isResolved: false,
      };
      const topic2 = {
        id: "topic-2",
        sessionId: "session-1",
        name: "Timeline",
        cardIds: ["card-1"],
        startTime: 3000,
        lastActiveTime: 4000,
        isResolved: false,
      };

      const gateway = makeMockGateway({
        topic_extraction: JSON.stringify({
          topicId: "new",
          topicName: "Budget Revisited",
          relationType: "returns_to",
          relatedTopicId: "topic-1",
          topicSummary: "Returning to budget discussion",
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const card = makeCard({ id: "card-3", content: "Back to the budget question" });
      const map = makeTopicMap({ topics: [topic1, topic2] });

      const result = await analyzer.updateTopicMap(card, map);

      expect(result.topics).toHaveLength(3);
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].relationType).toBe("returns_to");
      expect(result.relations[0].fromTopicId).toBe("topic-1");
    });

    it("preserves existing relations when adding new ones", async () => {
      const topic1 = {
        id: "topic-1",
        sessionId: "session-1",
        name: "Budget",
        cardIds: ["card-0"],
        startTime: 1000,
        lastActiveTime: 2000,
        isResolved: false,
      };

      const existingRelation = {
        fromTopicId: "topic-0",
        toTopicId: "topic-1",
        relationType: "follows" as const,
      };

      const gateway = makeMockGateway({
        topic_extraction: JSON.stringify({
          topicId: "new",
          topicName: "Staffing",
          relationType: "branches_from",
          relatedTopicId: "topic-1",
          topicSummary: "Staffing needs for budget",
        }),
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const card = makeCard({ id: "card-2" });
      const map = makeTopicMap({
        topics: [topic1],
        relations: [existingRelation],
      });

      const result = await analyzer.updateTopicMap(card, map);

      expect(result.relations).toHaveLength(2);
      expect(result.relations[0]).toEqual(existingRelation);
    });

    it("handles malformed topic response gracefully", async () => {
      const gateway = makeMockGateway({
        topic_extraction: "not json",
      });

      const analyzer = new SemanticAnalyzer(gateway);
      const card = makeCard();
      const map = makeTopicMap();

      const result = await analyzer.updateTopicMap(card, map);

      // Should create a new "General" topic as fallback
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].name).toBe("General");
      expect(result.topics[0].cardIds).toContain("card-1");
    });

    it("sends request with topic_extraction taskType", async () => {
      let capturedRequest: LLMRequest | null = null;
      const gateway = {
        complete: async (request: LLMRequest): Promise<LLMResponse> => {
          capturedRequest = request;
          return {
            content: JSON.stringify({
              topicId: "new",
              topicName: "Test",
              relationType: null,
              relatedTopicId: null,
              topicSummary: "Test topic",
            }),
            providerId: "mock",
            usage: { promptTokens: 10, completionTokens: 20 },
            latencyMs: 50,
          };
        },
      } as unknown as LLMGateway;

      const analyzer = new SemanticAnalyzer(gateway);
      await analyzer.updateTopicMap(makeCard(), makeTopicMap());

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.taskType).toBe("topic_extraction");
    });
  });
});
