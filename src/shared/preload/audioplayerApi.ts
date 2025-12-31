import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";
import type { Collection, CollectionId } from "@/src/shared/models/collection";
import type { UserSettings } from "@/src/shared/models/userSettings";

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
    addFiles(filePaths: string[]): Promise<void>;
    /**
     * Preferred way to ingest drag-and-drop file(s) from the renderer.
     * Electron can securely map a `File` object to a native path via `webUtils.getPathForFile`.
     */
    addDroppedFiles(files: File[]): Promise<void>;
    remove(audiobookId: string): Promise<void>;
    clear(): Promise<void>;
    setFavorite(audiobookId: string, isFavorite: boolean): Promise<void>;
    setDuration(audiobookId: string, durationSeconds: number): Promise<void>;
    updateMetadata(
      audiobookId: string,
      patch: { title?: string; authors?: string[] }
    ): Promise<void>;
  };
  collections: {
    list(): Promise<Collection[]>;
    create(name: string): Promise<Collection>;
    rename(collectionId: CollectionId, name: string): Promise<void>;
    remove(collectionId: CollectionId): Promise<void>;
    setBooks(collectionId: CollectionId, audiobookIds: string[]): Promise<void>;
  };
  settings: {
    get(): Promise<UserSettings>;
    set(settings: UserSettings): Promise<void>;
  };
  playback: {
    getState(): Promise<PlaybackState>;
    getStateForAudiobook(audiobookId: string): Promise<PlaybackState>;
    setState(state: PlaybackState): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
  };
};


