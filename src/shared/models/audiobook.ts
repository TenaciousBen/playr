export type AudiobookId = string;

export type AudiobookChapter = {
  index: number;
  title: string;
  /** Absolute path on disk */
  filePath: string;
  /** Start time in seconds within the full audiobook timeline (if known) */
  startSeconds?: number;
  /** Duration in seconds (if known) */
  durationSeconds?: number;
};

export type AudiobookMetadata = {
  title?: string;
  subtitle?: string;
  authors?: string[];
  /** Absolute path to extracted cover art image (if any) */
  coverImagePath?: string;
};

export type Audiobook = {
  id: AudiobookId;
  /** Display name derived from folder name unless metadata provides a title */
  displayName: string;
  /** Folder that was added to the library */
  rootFolderPath: string;
  metadata?: AudiobookMetadata;
  chapters: AudiobookChapter[];
};


