/**
 * WebSocket event types for client ↔ server communication.
 */

import type { TranscriptSegment } from './transcript.js';
import type { CoreMeaningCard } from './card.js';
import type { Recommendation } from './recommendation.js';
import type { TopicMap } from './topic.js';

// ── Client → Server ──

export interface CaptureConfig {
  mode: 'online' | 'offline';
  sampleRate: 16000 | 44100;
  channels: 1 | 2;
  noiseSuppression: boolean;
  autoGain: boolean;
}

export interface AudioChunk {
  data: Float32Array;
  timestamp: number;
  channel: 'system' | 'microphone' | 'mixed';
  durationMs: number;
}

export type ClientEvent =
  | { type: 'session:start'; config: CaptureConfig }
  | { type: 'session:pause' }
  | { type: 'session:resume' }
  | { type: 'session:end' }
  | { type: 'audio:chunk'; data: AudioChunk }
  | { type: 'text:submit'; text: string }
  | { type: 'speaker:rename'; speakerId: string; name: string }
  | { type: 'bookmark:create'; timestamp: number; note?: string };

// ── Server → Client ──

export type ServerEvent =
  | { type: 'transcript:interim'; segment: TranscriptSegment }
  | { type: 'transcript:final'; segment: TranscriptSegment }
  | { type: 'card:created'; card: CoreMeaningCard }
  | { type: 'card:updated'; card: CoreMeaningCard }
  | { type: 'cards:consolidated'; cards: CoreMeaningCard[] }
  | { type: 'recommendation:new'; recommendations: Recommendation[] }
  | { type: 'topic:updated'; topicMap: TopicMap }
  | { type: 'stt:provider_switch'; from: string; to: string }
  | { type: 'pending:preview'; text: string }
  | { type: 'error'; subsystem: string; message: string; recoverable: boolean }
  | { type: 'session:state'; state: 'active' | 'paused' | 'ended' };
