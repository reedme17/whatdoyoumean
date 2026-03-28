import type {
  CoreMeaningCard,
  MeaningCategory,
  VisualizationFormat,
  TopicMap,
} from "@wdym/shared";

// ── public types ─────────────────────────────────────────────────

export interface RenderOutput {
  type: VisualizationFormat;
  html: string;
  data: Record<string, unknown>;
}

// ── constants ────────────────────────────────────────────────────

/**
 * Categories that benefit from flow_diagram visualization.
 * Others default to concise_text.
 */
const DIAGRAM_CATEGORIES: MeaningCategory[] = [
  "decision",
  "action_item",
  "proposal",
];

// ── VisualizationEngine ──────────────────────────────────────────

export class VisualizationEngine {
  /**
   * Select the optimal visualization format for a card based on its
   * content type / category. Returns within the 500ms render budget.
   */
  selectFormat(card: CoreMeaningCard): VisualizationFormat {
    if (DIAGRAM_CATEGORIES.includes(card.category)) {
      return "flow_diagram";
    }
    // Cards with links to other cards benefit from diagram view
    if (card.linkedCardIds.length > 0) {
      return "flow_diagram";
    }
    return "concise_text";
  }

  /**
   * Render a CoreMeaningCard in the given format.
   * Returns HTML for web rendering and structured data for native clients.
   * Includes sourceSegmentIds for expand-to-source interaction.
   */
  renderCard(
    card: CoreMeaningCard,
    format: VisualizationFormat,
  ): RenderOutput {
    if (format === "flow_diagram") {
      return this.renderFlowDiagram(card);
    }
    return this.renderConciseText(card);
  }

  /**
   * Render a TopicMap as an interactive mind-map structure.
   * Returns HTML for web and structured graph data for native.
   */
  renderTopicMap(topicMap: TopicMap): RenderOutput {
    const nodes = topicMap.topics.map((topic) => ({
      id: topic.id,
      label: topic.name,
      cardCount: topic.cardIds.length,
      isResolved: topic.isResolved,
    }));

    const edges = topicMap.relations.map((rel) => ({
      from: rel.fromTopicId,
      to: rel.toTopicId,
      type: rel.relationType,
    }));

    const nodesHtml = nodes
      .map(
        (n) =>
          `<div class="topic-node${n.isResolved ? " resolved" : ""}" data-id="${n.id}">` +
          `<span class="topic-name">${escapeHtml(n.label)}</span>` +
          `<span class="card-count">${n.cardCount}</span>` +
          `</div>`,
      )
      .join("\n");

    const edgesHtml = edges
      .map(
        (e) =>
          `<div class="topic-edge" data-from="${e.from}" data-to="${e.to}" data-type="${e.type}"></div>`,
      )
      .join("\n");

    return {
      type: "flow_diagram",
      html: `<div class="topic-map">\n<div class="nodes">\n${nodesHtml}\n</div>\n<div class="edges">\n${edgesHtml}\n</div>\n</div>`,
      data: {
        nodes,
        edges,
        sessionId: topicMap.sessionId,
      },
    };
  }

  // ── private renderers ────────────────────────────────────────

  private renderConciseText(card: CoreMeaningCard): RenderOutput {
    const categoryLabel = formatCategory(card.category);
    const html =
      `<div class="card concise-text" data-id="${card.id}" data-category="${card.category}">` +
      `<span class="category-badge">${escapeHtml(categoryLabel)}</span>` +
      `<p class="card-content">${escapeHtml(card.content)}</p>` +
      `</div>`;

    return {
      type: "concise_text",
      html,
      data: {
        id: card.id,
        category: card.category,
        content: card.content,
        sourceSegmentIds: card.sourceSegmentIds,
        isHighlighted: card.isHighlighted,
      },
    };
  }

  private renderFlowDiagram(card: CoreMeaningCard): RenderOutput {
    const categoryLabel = formatCategory(card.category);
    const linksHtml = card.linkedCardIds
      .map(
        (linkedId) =>
          `<div class="card-link" data-target="${linkedId}" data-link-type="${card.linkType ?? "related"}"></div>`,
      )
      .join("\n");

    const html =
      `<div class="card flow-diagram" data-id="${card.id}" data-category="${card.category}">` +
      `<div class="diagram-node">` +
      `<span class="category-badge">${escapeHtml(categoryLabel)}</span>` +
      `<p class="card-content">${escapeHtml(card.content)}</p>` +
      `</div>` +
      (linksHtml ? `\n<div class="card-links">\n${linksHtml}\n</div>` : "") +
      `</div>`;

    return {
      type: "flow_diagram",
      html,
      data: {
        id: card.id,
        category: card.category,
        content: card.content,
        sourceSegmentIds: card.sourceSegmentIds,
        linkedCardIds: card.linkedCardIds,
        linkType: card.linkType,
        isHighlighted: card.isHighlighted,
      },
    };
  }
}

// ── utilities ────────────────────────────────────────────────────

function formatCategory(category: MeaningCategory): string {
  const labels: Record<MeaningCategory, string> = {
    fact: "Fact",
    opinion: "Opinion",
    question: "Question",
    decision: "Decision",
    action_item: "Action",
    proposal: "Proposal",
  };
  return labels[category] ?? category;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
