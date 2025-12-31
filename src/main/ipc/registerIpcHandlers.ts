import { ipcMain } from "electron";
import { IpcChannels } from "@/src/shared/ipc/channels";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";
import type { IpcMainInvokeEvent } from "electron";

/**
 * Central place to register IPC handlers.
 * Keep handlers thin and delegate to services (library scan, metadata, persistence, playback).
 */
export function registerIpcHandlers() {
  ipcMain.handle(IpcChannels.Library.List, async (): Promise<Audiobook[]> => {
    // TODO: load library from persistence and/or scan configured folders
    return [];
  });

  ipcMain.handle(
    IpcChannels.Library.Search,
    async (_event: IpcMainInvokeEvent, _query: string): Promise<Audiobook[]> => {
      // TODO: fuzzy search by title/subtitle/authors
      return [];
    }
  );

  ipcMain.handle(
    IpcChannels.Library.AddFolders,
    async (
      _event: IpcMainInvokeEvent,
      _folderPaths: string[]
    ): Promise<void> => {
      // TODO: ingest dragged-in folders, extract metadata, persist
    }
  );

  ipcMain.handle(IpcChannels.Playback.GetState, async (): Promise<PlaybackState> => {
    // TODO: persist and restore last playback position
    return { isPlaying: false, rate: 1 };
  });

  ipcMain.handle(IpcChannels.Playback.Play, async (): Promise<void> => {
    // TODO: start playback
  });

  ipcMain.handle(IpcChannels.Playback.Pause, async (): Promise<void> => {
    // TODO: pause playback
  });
}


