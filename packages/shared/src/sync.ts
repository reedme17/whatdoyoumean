/**
 * Sync record types.
 */

export interface SyncRecord {
  id: string;
  userId: string;
  sessionId: string;
  syncStatus: 'pending' | 'synced' | 'conflict';
  localVersion: number;
  remoteVersion: number;
  lastSyncedAt: Date | null;
  queuedAt: Date;
}
