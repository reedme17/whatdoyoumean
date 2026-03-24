/**
 * Speaker label types.
 */

export interface SpeakerLabel {
  id: string;
  sessionId: string;
  displayName: string | null;
  isUncertain: boolean;
}
