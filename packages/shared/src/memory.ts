/**
 * Memory entry types.
 */

export interface MemoryEntry {
  id: string;
  userId: string;
  sessionId: string;
  type: 'intent' | 'decision' | 'todo' | 'unresolved_question';
  content: string;
  speakerIds: string[];
  topics: string[];
  embedding: number[];
  isResolved: boolean;
  createdAt: Date;
  resolvedAt: Date | null;
}
