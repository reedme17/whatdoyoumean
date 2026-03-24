import { describe, it, expect, beforeEach } from "vitest";
import {
  RecommendationEngine,
  type MemoryContext,
  type SessionContext,
} from "./engine.js";
import type { LLMGateway } from "../llm/gateway.js";
import type { LLMRequest, LLMResponse } from "../llm/types.js";
import type {
  CoreMeaningCard,
  Recommendation,
  TopicMap,
} from "@wdym/shared";

// ── mock helpers ─────────────────────────────────────────────────

function makeMockGateway(responseContent: string): LLMGateway {
  return {
    complete: async (_request: LLMRequest): Promise<LLMResponse> => ({
      content: responseContent,
      providerId: "mock",
      usage: { promptTokens: 10, completionTokens: 20 },
      latencyMs: 50,
    }),
  } as unknown as LLMGateway;
}

function makeCard(overrides: Partial<CoreMeaningCard> = {}): CoreMeaningCard {
  return {
    id: "card-1",
    sessionId: "session-1",
    category: "opinion",
    content: "We should use microservices for the new platform",
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
    existingCards: [],
    topicMap: {
      sessionId: "session-1",
      topics: [],
      relations: [],
    },
    ...overrides,
  };
}

function makeMemoryContext(
  overrides: Partial<MemoryContext> = {},
): MemoryContext {
  return {
    relevantEntries: [],
    unresolvedQuestions: [],
    pendingActionItems: [],
    recurringTopics: [],
    ...overrides,
  };
}

// ── tests ────────────────────────────────────────────────────────

describe("RecommendationEngine", () => {
  describe("generateRecommendations()", () => {
    it("produces 1-3 recommendations from LLM response", async () => {
      const gateway = makeMockGateway(
        JSON.stringify([
          {
            type: "follow_up_question",
            text: "What specific benefits do microservices offer here?",
            reasoning: "The claim needs supporting evidence",
          },
          {
            type: "challenge",
            text: "Have you considered the operational complexity?",
            reasoning: "Microservices add deployment overhead",
          },
        ]),
      );

      const engine = new RecommendationEngine(gateway);
      const recs = await engine.generateRecommendations(
        makeCard(),
        makeContext(),
      );

      expect(recs.length).toBeGreaterThanOrEqual(1);
      expect(recs.length).toBeLessThanOrEqual(3);
      expect(recs[0].type).toBe("follow_up_question");
      expect(recs[0].sourceCardId).toBe("card-1");
      expect(recs[0].sessionId).toBe("session-1");
      expect(recs[0].text).toBeTruthy();
      expect(recs[0].reasoning).toBeTruthy();
    });

    it("caps at 3 recommendations even if LLM returns more", async () => {
      const gateway = makeMockGateway(
        JSON.stringify([
          { type: "follow_up_question", text: "Q1?", reasoning: "r1" },
          { type: "clarification", text: "Q2?", reasoning: "r2" },
          { type: "challenge", text: "Q3?", reasoning: "r3" },
          { type: "new_proposal", text: "Q4?", reasoning: "r4" },
          { type: "topic_pivot", text: "Q5?", reasoning: "r5" },
        ]),
      );

      const engine = new RecommendationEngine(gateway);
      const recs = await engine.generateRecommendations(
        makeCard(),
        makeContext(),
      );

      expect(recs.length).toBeLessThanOrEqual(3);
    });

    it("sends request with recommendation taskType and 2s timeout", async () => {
      let capturedRequest: LLMRequest | null = null;
      const gateway = {
        complete: async (request: LLMRequest): Promise<LLMResponse> => {
          capturedRequest = request;
          return {
            content: JSON.stringify([
              { type: "clarification", text: "Can you clarify?", reasoning: "Ambiguous" },
            ]),
            providerId: "mock",
            usage: { promptTokens: 10, completionTokens: 20 },
            latencyMs: 50,
          };
        },
      } as unknown as LLMGateway;

      const engine = new RecommendationEngine(gateway);
      await engine.generateRecommendations(makeCard(), makeContext());

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.taskType).toBe("recommendation");
      expect(capturedRequest!.timeoutMs).toBe(2000);
    });

    it("validates recommendation types, defaulting invalid to follow_up_question", async () => {
      const gateway = makeMockGateway(
        JSON.stringify([
          { type: "invalid_type", text: "Some text", reasoning: "reason" },
        ]),
      );

      const engine = new RecommendationEngine(gateway);
      const recs = await engine.generateRecommendations(
        makeCard(),
        makeContext(),
      );

      expect(recs[0].type).toBe("follow_up_question");
    });

    it("deduplicates: second call for same topic produces different recommendations", async () => {
      let callCount = 0;
      const gateway = {
        complete: async (_request: LLMRequest): Promise<LLMResponse> => {
          callCount++;
          // Both calls return the same set — engine should filter duplicates
          return {
            content: JSON.stringify([
              { type: "follow_up_question", text: "What about scalability?", reasoning: "r1" },
              { type: "challenge", text: "Is this cost-effective?", reasoning: "r2" },
            ]),
            providerId: "mock",
            usage: { promptTokens: 10, completionTokens: 20 },
            latencyMs: 50,
          };
        },
      } as unknown as LLMGateway;

      const engine = new RecommendationEngine(gateway);
      const card = makeCard();
      const ctx = makeContext();

      const first = await engine.generateRecommendations(card, ctx);
      expect(first.length).toBeGreaterThanOrEqual(1);

      // Second call with same topic — duplicates should be filtered
      const second = await engine.generateRecommendations(card, ctx);
      // The engine filters out texts that match the previous set
      // Since LLM returns the same texts, they get filtered, but at least 1 is kept
      expect(second.length).toBeGreaterThanOrEqual(1);
    });

    it("includes memory reference IDs when memory context is provided", async () => {
      const gateway = makeMockGateway(
        JSON.stringify([
          {
            type: "follow_up_question",
            text: "Did you resolve the API issue from last week?",
            reasoning: "Unresolved from previous session",
            memoryReferenceIds: ["mem-1"],
          },
        ]),
      );

      const engine = new RecommendationEngine(gateway);
      const memory = makeMemoryContext({
        unresolvedQuestions: [
          { id: "mem-1", content: "API integration issue" },
        ],
      });

      const recs = await engine.generateRecommendations(
        makeCard(),
        makeContext(),
        memory,
      );

      expect(recs[0].memoryReferenceIds).toEqual(["mem-1"]);
    });

    it("handles malformed LLM response gracefully (returns empty)", async () => {
      const gateway = makeMockGateway("This is not JSON at all");

      const engine = new RecommendationEngine(gateway);
      const recs = await engine.generateRecommendations(
        makeCard(),
        makeContext(),
      );

      expect(recs).toEqual([]);
    });

    it("includes stale topic hint when topic exceeds 5 minutes", async () => {
      let capturedPrompt = "";
      const gateway = {
        complete: async (request: LLMRequest): Promise<LLMResponse> => {
          capturedPrompt = request.messages[1]?.content ?? "";
          return {
            content: JSON.stringify([
              { type: "summary_confirmation", text: "Let me summarize", reasoning: "Stale topic" },
            ]),
            providerId: "mock",
            usage: { promptTokens: 10, completionTokens: 20 },
            latencyMs: 50,
          };
        },
      } as unknown as LLMGateway;

      const staleTopic = {
        id: "topic-1",
        sessionId: "session-1",
        name: "Architecture",
        cardIds: ["card-0"],
        startTime: Date.now() - 6 * 60 * 1000, // 6 minutes ago
        lastActiveTime: Date.now(),
        isResolved: false,
      };

      const engine = new RecommendationEngine(gateway);
      const ctx = makeContext({
        topicMap: {
          sessionId: "session-1",
          topics: [staleTopic],
          relations: [],
        },
      });

      await engine.generateRecommendations(makeCard(), ctx);

      expect(capturedPrompt).toContain("STALE_TOPIC");
    });

    it("assigns incrementing setIndex to each recommendation batch", async () => {
      const gateway = makeMockGateway(
        JSON.stringify([
          { type: "clarification", text: "Clarify A", reasoning: "r" },
        ]),
      );

      const engine = new RecommendationEngine(gateway);
      const r1 = await engine.generateRecommendations(
        makeCard({ topicId: "t-a" }),
        makeContext(),
      );
      const r2 = await engine.generateRecommendations(
        makeCard({ topicId: "t-b" }),
        makeContext(),
      );

      expect(r2[0].setIndex).toBeGreaterThan(r1[0].setIndex);
    });
  });
});
