/**
 * Recommendation types.
 */

export type RecommendationType =
  | 'follow_up_question'
  | 'clarification'
  | 'new_proposal'
  | 'challenge'
  | 'summary_confirmation'
  | 'topic_pivot';

export interface Recommendation {
  id: string;
  sessionId: string;
  sourceCardId: string;
  type: RecommendationType;
  text: string;
  reasoning: string;
  memoryReferenceIds: string[];
  setIndex: number;
  createdAt: Date;
}
