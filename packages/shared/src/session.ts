/**
 * Conversation session types.
 */

export interface SessionMetadata {
  platform: 'web' | 'ios';
  deviceInfo: string;
  appVersion: string;
  localProcessingOnly: boolean;
}

export interface ConversationSession {
  id: string;
  userId: string;
  mode: 'online' | 'offline' | 'text';
  status: 'active' | 'paused' | 'ended';
  startedAt: Date;
  endedAt: Date | null;
  pausedAt: Date | null;
  durationMs: number;
  languageCode: 'zh' | 'en' | 'mixed';
  participantCount: number;
  sttProvider: string;
  llmProvider: string;
  topicSummary: string;
  metadata: SessionMetadata;
}
