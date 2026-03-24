/**
 * BookmarkService — create, store, and retrieve bookmarks.
 * In-memory store for now.
 */

import { randomUUID } from "node:crypto";
import type { Bookmark } from "@wdym/shared";

const bookmarkStore = new Map<string, Bookmark[]>();

export class BookmarkService {
  create(options: {
    sessionId: string;
    userId: string;
    timestamp: number;
    note?: string;
    cardId?: string;
  }): Bookmark {
    const bookmark: Bookmark = {
      id: randomUUID(),
      sessionId: options.sessionId,
      userId: options.userId,
      timestamp: options.timestamp,
      note: options.note ?? null,
      cardId: options.cardId ?? null,
      createdAt: new Date(),
    };

    const list = bookmarkStore.get(options.sessionId) ?? [];
    list.push(bookmark);
    bookmarkStore.set(options.sessionId, list);

    return bookmark;
  }

  getBySession(sessionId: string): Bookmark[] {
    return bookmarkStore.get(sessionId) ?? [];
  }

  getByUser(userId: string): Bookmark[] {
    const all: Bookmark[] = [];
    for (const list of bookmarkStore.values()) {
      for (const bm of list) {
        if (bm.userId === userId) all.push(bm);
      }
    }
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  delete(sessionId: string, bookmarkId: string): boolean {
    const list = bookmarkStore.get(sessionId);
    if (!list) return false;
    const idx = list.findIndex((b) => b.id === bookmarkId);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  }
}

/** Exported for testing */
export function clearBookmarks(): void {
  bookmarkStore.clear();
}
