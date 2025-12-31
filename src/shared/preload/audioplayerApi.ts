import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";

/**
 * API exposed by the preload script to the renderer via `contextBridge`.
 *
 * This file must stay free of Electron imports so it can be safely shared
 * as types between preload and renderer code.
 */
export type AudioplayerApi = {
  library: {
    list(): Promise<Audiobook[]>;
    search(query: string): Promise<Audiobook[]>;
    addFolders(folderPaths: string[]): Promise<void>;
  };
  playback: {
    getState(): Promise<PlaybackState>;
    play(): Promise<void>;
    pause(): Promise<void>;
  };
};


