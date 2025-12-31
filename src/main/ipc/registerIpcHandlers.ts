import { ipcMain } from "electron";
import { IpcChannels } from "@/src/shared/ipc/channels";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";
import type { IpcMainInvokeEvent } from "electron";
import { ingestPathsToAudiobooks } from "@/src/main/library/ingest";
import { loadLibrary, saveLibrary } from "@/src/main/persistence/libraryStore";
import { loadPlayback, savePlayback } from "@/src/main/persistence/playbackStore";
import fs from "fs/promises";

/**
 * Central place to register IPC handlers.
 * Keep handlers thin and delegate to services (library scan, metadata, persistence, playback).
 */
export function registerIpcHandlers() {
  ipcMain.handle(IpcChannels.Library.List, async (): Promise<Audiobook[]> => {
    return await loadLibrary();
  });

  ipcMain.handle(
    IpcChannels.Library.Search,
    async (_event: IpcMainInvokeEvent, query: string): Promise<Audiobook[]> => {
      const library = await loadLibrary();
      const q = query.trim().toLowerCase();
      if (!q) return library;

      return library.filter((b) => {
        const hay = [
          b.displayName,
          b.metadata?.title,
          b.metadata?.subtitle,
          ...(b.metadata?.authors ?? [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
  );

  ipcMain.handle(
    IpcChannels.Library.AddFiles,
    async (_event: IpcMainInvokeEvent, filePaths: string[]): Promise<void> => {
      try {
        // eslint-disable-next-line no-console
        console.log("[library:add-files] called", {
          count: filePaths?.length ?? 0,
          sample: (filePaths ?? []).slice(0, 3)
        });

        const existing = await loadLibrary();
        // eslint-disable-next-line no-console
        console.log("[library:add-files] existing library", { count: existing.length });

        const incoming = await ingestPathsToAudiobooks(filePaths);
        // eslint-disable-next-line no-console
        console.log("[library:add-files] ingested", {
          count: incoming.length,
          sample: incoming.slice(0, 3).map((b) => ({
            id: b.id,
            displayName: b.displayName,
            chapters: b.chapters.length
          }))
        });

        // Merge by rootFolderPath (stable id).
        const byId = new Map<string, Audiobook>();
        for (const b of existing) byId.set(b.id, b);
        for (const b of incoming) byId.set(b.id, b);

        const merged = Array.from(byId.values()).sort((a, b) =>
          a.displayName.localeCompare(b.displayName, undefined, { numeric: true })
        );

        await saveLibrary(merged);
        // eslint-disable-next-line no-console
        console.log("[library:add-files] saved", { count: merged.length });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[library:add-files] failed", err);
        throw err;
      }
    }
  );

  ipcMain.handle(
    IpcChannels.Library.Remove,
    async (_event: IpcMainInvokeEvent, audiobookId: string): Promise<void> => {
      const existing = await loadLibrary();
      const removed = existing.find((b) => b.id === audiobookId);
      const remaining = existing.filter((b) => b.id !== audiobookId);
      await saveLibrary(remaining);

      // Best-effort: delete cover image file if we wrote one.
      const cover = removed?.metadata?.coverImagePath;
      if (cover) {
        try {
          await fs.unlink(cover);
        } catch {
          // ignore
        }
      }

      // Best-effort: remove persisted playback state
      try {
        const persisted = await loadPlayback();
        delete persisted.byAudiobookId[audiobookId];
        await savePlayback(persisted);
      } catch {
        // ignore
      }
    }
  );

  ipcMain.handle(
    IpcChannels.Library.AddFolders,
    async (
      _event: IpcMainInvokeEvent,
      _folderPaths: string[]
    ): Promise<void> => {
      // For now treat folders the same as dropped paths (folders will be scanned recursively).
      const existing = await loadLibrary();
      const incoming = await ingestPathsToAudiobooks(_folderPaths);

      const byId = new Map<string, Audiobook>();
      for (const b of existing) byId.set(b.id, b);
      for (const b of incoming) byId.set(b.id, b);

      const merged = Array.from(byId.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { numeric: true })
      );

      await saveLibrary(merged);
    }
  );

  ipcMain.handle(IpcChannels.Playback.GetState, async (): Promise<PlaybackState> => {
    // Return the most recently updated state we have (best-effort).
    const persisted = await loadPlayback();
    const states = Object.values(persisted.byAudiobookId);
    return states[0] ?? { isPlaying: false, rate: 1 };
  });

  ipcMain.handle(
    IpcChannels.Playback.GetStateForAudiobook,
    async (_event: IpcMainInvokeEvent, audiobookId: string): Promise<PlaybackState> => {
      const persisted = await loadPlayback();
      return (
        persisted.byAudiobookId[audiobookId] ?? {
          isPlaying: false,
          rate: 1,
          position: {
            audiobookId,
            chapterIndex: 0,
            secondsIntoChapter: 0
          }
        }
      );
    }
  );

  ipcMain.handle(
    IpcChannels.Playback.SetState,
    async (_event: IpcMainInvokeEvent, state: PlaybackState): Promise<void> => {
      const persisted = await loadPlayback();
      if (state.position?.audiobookId) {
        persisted.byAudiobookId[state.position.audiobookId] = state;
        await savePlayback(persisted);
      }
    }
  );

  ipcMain.handle(IpcChannels.Playback.Play, async (): Promise<void> => {
    // TODO: start playback
  });

  ipcMain.handle(IpcChannels.Playback.Pause, async (): Promise<void> => {
    // TODO: pause playback
  });
}


