/**
 * Core meaning card types.
 */

export type MeaningCategory =
  | 'factual_statement'
  | 'opinion'
  | 'question'
  | 'decision'
  | 'action_item'
  | 'disagreement';

export type VisualizationFormat = 'concise_text' | 'flow_diagram';

export interface CoreMeaningCard {
  id: string;
  sessionId: string;
  category: MeaningCategory;
  content: string;
  sourceSegmentIds: string[];
  linkedCardIds: string[];
  linkType: 'contradicts' | 'modifies' | 'extends' | null;
  topicId: string;
  visualizationFormat: VisualizationFormat;
  isHighlighted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
