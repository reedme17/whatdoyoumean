/**
 * @wdym/shared — shared types and utilities for "What Do You Mean" (啥意思)
 */

export type { ConversationSession, SessionMetadata } from './session.js';
export type { TranscriptSegment } from './transcript.js';
export type { CoreMeaningCard, MeaningCategory, VisualizationFormat } from './card.js';
export type { Recommendation, RecommendationType } from './recommendation.js';
export type { Topic, TopicMap, TopicRelation } from './topic.js';
export type { SpeakerLabel } from './speaker.js';
export type { User, UserSettings, UserProfile, ActionItem } from './user.js';
export type { MemoryEntry } from './memory.js';
export type { Bookmark } from './bookmark.js';
export type { SessionArchive } from './archive.js';
export type { SyncRecord } from './sync.js';
export type {
  ClientEvent,
  ServerEvent,
  CaptureConfig,
  AudioChunk,
} from './events.js';

export { t, getAvailableLocales, registerLocale } from './i18n/index.js';
export type { Locale } from './i18n/index.js';
