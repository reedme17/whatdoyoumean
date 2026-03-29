/**
 * Core meaning card types.
 */

export type MeaningCategory =
  | 'fact'
  | 'opinion'
  | 'question'
  | 'decision'
  | 'action_item'
  | 'proposal';

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
  /** Speaker ID from diarization (e.g. "speaker_0") */
  speakerId?: string;
  createdAt: Date;
  updatedAt: Date;
}
