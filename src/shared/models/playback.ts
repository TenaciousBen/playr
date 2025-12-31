import type { AudiobookId } from "@/src/shared/models/audiobook";

export type PlaybackPosition = {
  /** Current audiobook */
  audiobookId: AudiobookId;
  /** Chapter index within the audiobook */
  chapterIndex: number;
  /** Position within the chapter (seconds) */
  secondsIntoChapter: number;
};

export type PlaybackState = {
  isPlaying: boolean;
  rate: number;
  position?: PlaybackPosition;
};


