import { describe, it, expect } from "vitest";
import { VisualizationEngine, type RenderOutput } from "./engine.js";
import type {
  CoreMeaningCard,
  MeaningCategory,
  TopicMap,
} from "@wdym/shared";

// ── helpers ──────────────────────────────────────────────────────

function makeCard(overrides: Partial<CoreMeaningCard> = {}): CoreMeaningCard {
  return {
    id: "card-1",
    sessionId: "session-1",
    category: "opinion",
    content: "We should adopt a modular architecture",
    sourceSegmentIds: ["seg-1", "seg-2"],
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

function makeTopicMap(overrides: Partial<TopicMap> = {}): TopicMap {
  return {
    sessionId: "session-1",
    topics: [],
    relations: [],
    ...overrides,
  };
}

// ── tests ────────────────────────────────────────────────────────

describe("VisualizationEngine", () => {
  const engine = new VisualizationEngine();

  describe("selectFormat()", () => {
    it("returns concise_text for factual_statement", () => {
      expect(engine.selectFormat(makeCard({ category: "factual_statement" }))).toBe("concise_text");
    });

    it("returns concise_text for opinion", () => {
      expect(engine.selectFormat(makeCard({ category: "opinion" }))).toBe("concise_text");
    });

    it("returns concise_text for question", () => {
      expect(engine.selectFormat(makeCard({ category: "question" }))).toBe("concise_text");
    });

    it("returns flow_diagram for decision", () => {
      expect(engine.selectFormat(makeCard({ category: "decision" }))).toBe("flow_diagram");
    });

    it("returns flow_diagram for action_item", () => {
      expect(engine.selectFormat(makeCard({ category: "action_item" }))).toBe("flow_diagram");
    });

    it("returns flow_diagram for disagreement", () => {
      expect(engine.selectFormat(makeCard({ category: "disagreement" }))).toBe("flow_diagram");
    });

    it("returns flow_diagram for cards with linked cards", () => {
      const card = makeCard({
        category: "opinion",
        linkedCardIds: ["card-2"],
      });
      expect(engine.selectFormat(card)).toBe("flow_diagram");
    });
  });

  describe("renderCard() — concise_text", () => {
    it("returns RenderOutput with html and data fields", () => {
      const card = makeCard();
      const output = engine.renderCard(card, "concise_text");

      expect(output.type).toBe("concise_text");
      expect(output.html).toContain("concise-text");
      expect(output.html).toContain(card.content);
      expect(output.html).toContain("Opinion");
      expect(output.data).toHaveProperty("id", "card-1");
      expect(output.data).toHaveProperty("content", card.content);
      expect(output.data).toHaveProperty("category", "opinion");
    });

    it("includes sourceSegmentIds in data for expand-to-source", () => {
      const card = makeCard({ sourceSegmentIds: ["seg-a", "seg-b"] });
      const output = engine.renderCard(card, "concise_text");

      expect(output.data).toHaveProperty("sourceSegmentIds");
      expect((output.data as { sourceSegmentIds: string[] }).sourceSegmentIds).toEqual([
        "seg-a",
        "seg-b",
      ]);
    });

    it("escapes HTML in content", () => {
      const card = makeCard({ content: '<script>alert("xss")</script>' });
      const output = engine.renderCard(card, "concise_text");

      expect(output.html).not.toContain("<script>");
      expect(output.html).toContain("&lt;script&gt;");
    });
  });

  describe("renderCard() — flow_diagram", () => {
    it("renders flow diagram with linked cards", () => {
      const card = makeCard({
        category: "disagreement",
        linkedCardIds: ["card-2"],
        linkType: "contradicts",
      });
      const output = engine.renderCard(card, "flow_diagram");

      expect(output.type).toBe("flow_diagram");
      expect(output.html).toContain("flow-diagram");
      expect(output.html).toContain("Disagreement");
      expect(output.html).toContain('data-target="card-2"');
      expect(output.html).toContain('data-link-type="contradicts"');
    });

    it("includes linkedCardIds and linkType in data", () => {
      const card = makeCard({
        linkedCardIds: ["card-2"],
        linkType: "modifies",
      });
      const output = engine.renderCard(card, "flow_diagram");
      const data = output.data as Record<string, unknown>;

      expect(data.linkedCardIds).toEqual(["card-2"]);
      expect(data.linkType).toBe("modifies");
      expect(data.sourceSegmentIds).toEqual(["seg-1", "seg-2"]);
    });

    it("renders without links section when no linked cards", () => {
      const card = makeCard({ category: "decision" });
      const output = engine.renderCard(card, "flow_diagram");

      expect(output.html).not.toContain("card-links");
    });
  });

  describe("renderTopicMap()", () => {
    it("renders an empty topic map", () => {
      const output = engine.renderTopicMap(makeTopicMap());

      expect(output.type).toBe("flow_diagram");
      expect(output.html).toContain("topic-map");
      const data = output.data as Record<string, unknown>;
      expect(data.nodes).toEqual([]);
      expect(data.edges).toEqual([]);
    });

    it("renders topics as nodes with card counts", () => {
      const map = makeTopicMap({
        topics: [
          {
            id: "t-1",
            sessionId: "session-1",
            name: "Architecture",
            cardIds: ["c-1", "c-2"],
            startTime: 1000,
            lastActiveTime: 2000,
            isResolved: false,
          },
          {
            id: "t-2",
            sessionId: "session-1",
            name: "Budget",
            cardIds: ["c-3"],
            startTime: 3000,
            lastActiveTime: 4000,
            isResolved: true,
          },
        ],
      });

      const output = engine.renderTopicMap(map);
      const data = output.data as {
        nodes: { id: string; label: string; cardCount: number; isResolved: boolean }[];
        edges: unknown[];
      };

      expect(data.nodes).toHaveLength(2);
      expect(data.nodes[0].label).toBe("Architecture");
      expect(data.nodes[0].cardCount).toBe(2);
      expect(data.nodes[1].isResolved).toBe(true);

      expect(output.html).toContain("Architecture");
      expect(output.html).toContain("resolved");
    });

    it("renders relations as edges", () => {
      const map = makeTopicMap({
        topics: [
          {
            id: "t-1",
            sessionId: "session-1",
            name: "A",
            cardIds: [],
            startTime: 0,
            lastActiveTime: 0,
            isResolved: false,
          },
          {
            id: "t-2",
            sessionId: "session-1",
            name: "B",
            cardIds: [],
            startTime: 0,
            lastActiveTime: 0,
            isResolved: false,
          },
        ],
        relations: [
          { fromTopicId: "t-1", toTopicId: "t-2", relationType: "branches_from" },
        ],
      });

      const output = engine.renderTopicMap(map);
      const data = output.data as {
        edges: { from: string; to: string; type: string }[];
      };

      expect(data.edges).toHaveLength(1);
      expect(data.edges[0].type).toBe("branches_from");
      expect(output.html).toContain('data-type="branches_from"');
    });

    it("includes sessionId in data", () => {
      const output = engine.renderTopicMap(makeTopicMap());
      expect((output.data as Record<string, unknown>).sessionId).toBe("session-1");
    });
  });
});
