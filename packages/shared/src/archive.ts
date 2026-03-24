/**
 * Session archive composite type.
 */

import type { ConversationSession } from './session.js';
import type { TranscriptSegment } from './transcript.js';
import type { CoreMeaningCard } from './card.js';
import type { Recommendation } from './recommendation.js';
import type { SpeakerLabel } from './speaker.js';
import type { TopicMap } from './topic.js';
import type { Bookmark } from './bookmark.js';

export interface SessionArchive {
  session: ConversationSession;
  transcripts: TranscriptSegment[];
  cards: CoreMeaningCard[];
  recommendations: Recommendation[];
  speakers: SpeakerLabel[];
  topicMap: TopicMap;
  bookmarks: Bookmark[];
}
