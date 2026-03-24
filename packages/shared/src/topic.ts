/**
 * Topic and topic map types.
 */

export interface Topic {
  id: string;
  sessionId: string;
  name: string;
  cardIds: string[];
  startTime: number;
  lastActiveTime: number;
  isResolved: boolean;
}

export interface TopicRelation {
  fromTopicId: string;
  toTopicId: string;
  relationType: 'follows' | 'branches_from' | 'returns_to';
}

export interface TopicMap {
  sessionId: string;
  topics: Topic[];
  relations: TopicRelation[];
}
