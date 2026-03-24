/**
 * Bookmark types.
 */

export interface Bookmark {
  id: string;
  sessionId: string;
  userId: string;
  timestamp: number;
  note: string | null;
  cardId: string | null;
  createdAt: Date;
}
