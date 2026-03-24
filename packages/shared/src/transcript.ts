/**
 * Transcript segment types.
 */

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  text: string;
  languageCode: 'zh' | 'en';
  speakerId: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
  confidence: number;
  provider: string;
  createdAt: Date;
}
