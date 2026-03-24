/**
 * SyncService — sync queue, push/pull, and conflict detection.
 * In-memory store for now.
 */

import { randomUUID } from "node:crypto";
import type { SyncRecord } from "@wdym/shared";

const syncStore = new Map<string, SyncRecord>();

export interface PushRequest {
  userId: string;
  sessionId: string;
  localVersion: number;
}

export interface PullRequest {
  userId: string;
}

export interface ResolveRequest {
  syncId: string;
  resolution: "local" | "remote";
}

export class SyncService {
  /**
   * Push local changes. If a record already exists with a different
   * remoteVersion, mark as conflict.
   */
  push(req: PushRequest): SyncRecord {
    // Check for existing record for this session
    const existing = Array.from(syncStore.values()).find(
      (r) => r.sessionId === req.sessionId && r.userId === req.userId,
    );

    if (existing) {
      // Conflict: remote was updated independently (remoteVersion advanced
      // beyond what the client last saw, i.e. localVersion doesn't match)
      if (
        existing.syncStatus === "synced" &&
        existing.remoteVersion !== existing.localVersion &&
        existing.remoteVersion !== req.localVersion
      ) {
        existing.syncStatus = "conflict";
        existing.localVersion = req.localVersion;
        return existing;
      }
      // Normal update — client is in sync, just advancing version
      existing.localVersion = req.localVersion;
      existing.syncStatus = "synced";
      existing.remoteVersion = req.localVersion;
      existing.lastSyncedAt = new Date();
      return existing;
    }

    // New sync record
    const record: SyncRecord = {
      id: randomUUID(),
      userId: req.userId,
      sessionId: req.sessionId,
      syncStatus: "synced",
      localVersion: req.localVersion,
      remoteVersion: req.localVersion,
      lastSyncedAt: new Date(),
      queuedAt: new Date(),
    };
    syncStore.set(record.id, record);
    return record;
  }

  /**
   * Pull all sync records for a user.
   */
  pull(req: PullRequest): SyncRecord[] {
    return Array.from(syncStore.values())
      .filter((r) => r.userId === req.userId)
      .sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime());
  }

  /**
   * Resolve a sync conflict by choosing local or remote version.
   */
  resolve(req: ResolveRequest): SyncRecord | undefined {
    const record = syncStore.get(req.syncId);
    if (!record || record.syncStatus !== "conflict") return undefined;

    if (req.resolution === "local") {
      record.remoteVersion = record.localVersion;
    } else {
      record.localVersion = record.remoteVersion;
    }
    record.syncStatus = "synced";
    record.lastSyncedAt = new Date();
    return record;
  }

  /** Get a specific sync record */
  get(syncId: string): SyncRecord | undefined {
    return syncStore.get(syncId);
  }

  /** Get sync records for a specific session */
  getBySession(sessionId: string): SyncRecord | undefined {
    return Array.from(syncStore.values()).find((r) => r.sessionId === sessionId);
  }
}

/** Exported for testing */
export function clearSync(): void {
  syncStore.clear();
}
