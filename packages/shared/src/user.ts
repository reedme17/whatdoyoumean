/**
 * User, settings, and profile types.
 */

export interface User {
  id: string;
  email: string;
  authProvider: 'apple' | 'google' | 'email';
  createdAt: Date;
  lastLoginAt: Date;
}

export interface UserSettings {
  userId: string;
  displayLanguage: 'zh' | 'en';
  defaultAudioDevice: string | null;
  preferredLLMProvider: string;
  sttModePreference: 'auto' | 'local_only' | 'cloud_only';
  memoryStoragePreference: 'local' | 'cloud';
  memoryEnabled: boolean;
  localProcessingOnly: boolean;
  onboardingCompleted: boolean;
}

export interface ActionItem {
  id: string;
  content: string;
  isResolved: boolean;
  sessionId: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface UserProfile {
  userId: string;
  frequentTopics: { topic: string; count: number }[];
  commonSpeakers: { speakerId: string; name: string; sessionCount: number }[];
  trackedActionItems: ActionItem[];
  totalSessions: number;
  totalDurationMs: number;
}
