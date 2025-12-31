import type { AudiobookId } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";
import { readJsonFile, writeJsonFile } from "@/src/main/persistence/jsonStore";
import { getUserDataFilePath } from "@/src/main/persistence/paths";

const PLAYBACK_FILE = "playback.json";

export type PersistedPlayback = {
  /** Last-known playback state per audiobook id */
  byAudiobookId: Record<AudiobookId, PlaybackState>;
  /** Most recently opened/played audiobook id (best-effort) */
  lastAudiobookId?: AudiobookId;
};

const EMPTY: PersistedPlayback = { byAudiobookId: {}, lastAudiobookId: undefined };

export async function loadPlayback(): Promise<PersistedPlayback> {
  return await readJsonFile<PersistedPlayback>(getUserDataFilePath(PLAYBACK_FILE), EMPTY);
}

export async function savePlayback(value: PersistedPlayback): Promise<void> {
  await writeJsonFile(getUserDataFilePath(PLAYBACK_FILE), value);
}


