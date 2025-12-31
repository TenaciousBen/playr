import { ipcMain } from "electron";
import { IpcChannels } from "@/src/shared/ipc/channels";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";
import type { IpcMainInvokeEvent } from "electron";
import { loadLibrary, saveLibrary } from "@/src/main/persistence/libraryStore";
import { loadPlayback, savePlayback } from "@/src/main/persistence/playbackStore";
import fs from "fs/promises";
import path from "path";
import { app } from "electron";
import { loadSettings, saveSettings } from "@/src/main/persistence/settingsStore";
import type { UserSettings } from "@/src/shared/models/userSettings";
import type { Collection } from "@/src/shared/models/collection";
import { loadCollections, saveCollections } from "@/src/main/persistence/collectionsStore";
import { Worker } from "worker_threads";

type IngestProgressPayload =
  | { type: "started"; totalFiles?: number }
  | { type: "scanned"; totalFiles: number }
  | { type: "book"; bookId: string; displayName: string; countDone: number; totalFiles?: number }
  | { type: "saved"; libraryCount: number; countDone: number; totalFiles?: number }
  | { type: "done"; libraryCount: number; countDone: number; totalFiles?: number }
  | { type: "error"; message: string };

function startIngestWorker(
  inputPaths: string[],
  userDataDir: string
): Worker {
  // The worker is bundled as a separate main-process entry by electron-vite.
  const workerPath = path.join(__dirname, "ingestWorker.js");
  return new Worker(workerPath, { workerData: { inputPaths, userDataDir } });
}

async function startIngestToLibrary(
  inputPaths: string[],
  sender: Electron.WebContents
): Promise<void> {
  const userDataDir = app.getPath("userData");
  sender.send(IpcChannels.Library.IngestProgress, { type: "started" } satisfies IngestProgressPayload);

  const existing = await loadLibrary();
  const byId = new Map<string, Audiobook>();
  for (const b of existing) byId.set(b.id, b);

  let countDone = 0;
  let totalFiles: number | undefined;
  let pendingSave = false;
  let lastSaveAt = 0;

  const flushSave = async () => {
    if (pendingSave) return;
    pendingSave = true;
    try {
      const merged = Array.from(byId.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { numeric: true })
      );
      await saveLibrary(merged);
      sender.send(IpcChannels.Library.IngestProgress, {
        type: "saved",
        libraryCount: merged.length,
        countDone,
        totalFiles
      } satisfies IngestProgressPayload);
    } finally {
      pendingSave = false;
      lastSaveAt = Date.now();
    }
  };

  let worker: Worker;
  try {
    // eslint-disable-next-line no-console
    console.log("[library:ingest] start", { count: inputPaths?.length ?? 0 });
    worker = startIngestWorker(inputPaths, userDataDir);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[library:ingest] failed to start worker", err);
    sender.send(IpcChannels.Library.IngestProgress, {
      type: "error",
      message: String(err?.message ?? err ?? "Failed to start ingest worker")
    } satisfies IngestProgressPayload);
    return;
  }

  worker.on("message", (msg: any) => {
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "scanned") {
      const tf = Number(msg.totalFiles);
      totalFiles = Number.isFinite(tf) ? tf : 0;
      // eslint-disable-next-line no-console
      console.log("[library:ingest] scanned", { totalFiles });
      sender.send(IpcChannels.Library.IngestProgress, {
        type: "scanned",
        totalFiles: totalFiles ?? 0
      } satisfies IngestProgressPayload);
      return;
    }
    if (msg.type === "book" && msg.book) {
      const b: Audiobook = msg.book;
      countDone = msg.countDone ?? countDone + 1;
      totalFiles = msg.totalFiles ?? totalFiles;
      const prev = byId.get(b.id);
      const merged: Audiobook = {
        ...b,
        isFavorite: prev?.isFavorite ?? b.isFavorite ?? false,
        addedAt: prev?.addedAt ?? b.addedAt ?? new Date().toISOString()
      };
      byId.set(b.id, merged);
      sender.send(IpcChannels.Library.IngestProgress, {
        type: "book",
        bookId: merged.id,
        displayName: merged.displayName,
        countDone,
        totalFiles
      } satisfies IngestProgressPayload);

      // Save in batches to keep UI responsive and library durable.
      const now = Date.now();
      if (byId.size % 20 === 0 || now - lastSaveAt > 750) {
        void flushSave();
      }
      return;
    }
    if (msg.type === "done") {
      countDone = msg.countDone ?? countDone;
      totalFiles = msg.totalFiles ?? totalFiles;
      void (async () => {
        await flushSave();
        // eslint-disable-next-line no-console
        console.log("[library:ingest] done", { countDone, totalFiles, libraryCount: byId.size });
        sender.send(IpcChannels.Library.IngestProgress, {
          type: "done",
          libraryCount: byId.size,
          countDone,
          totalFiles
        } satisfies IngestProgressPayload);
        worker.terminate().catch(() => {});
      })();
      return;
    }
    if (msg.type === "error") {
      // eslint-disable-next-line no-console
      console.error("[library:ingest] worker error", { message: msg.message });
      sender.send(IpcChannels.Library.IngestProgress, {
        type: "error",
        message: String(msg.message ?? "Ingest failed")
      } satisfies IngestProgressPayload);
      worker.terminate().catch(() => {});
    }
  });

  worker.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[library:ingest] worker failed", err);
    sender.send(IpcChannels.Library.IngestProgress, {
      type: "error",
      message: String(err?.message ?? err ?? "Worker failed")
    } satisfies IngestProgressPayload);
  });
}

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
      // Fire-and-forget ingestion so the renderer stays responsive.
      void startIngestToLibrary(filePaths ?? [], _event.sender).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[library:add-files] ingest failed", err);
        _event.sender.send(IpcChannels.Library.IngestProgress, {
          type: "error",
          message: String(err?.message ?? err ?? "Ingest failed")
        } satisfies IngestProgressPayload);
      });
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
        if (persisted.lastAudiobookId === audiobookId) {
          persisted.lastAudiobookId = undefined;
        }
        const q = persisted.queue ?? null;
        if (q?.audiobookIds?.length) {
          const oldIds = q.audiobookIds;
          const removedIdx = oldIds.indexOf(audiobookId);
          const nextIds = oldIds.filter((id) => id !== audiobookId);
          if (nextIds.length === 0) {
            persisted.queue = null;
          } else {
            let idx = q.index ?? 0;
            if (removedIdx >= 0 && removedIdx <= idx) idx = Math.max(0, idx - 1);
            if (idx >= nextIds.length) idx = nextIds.length - 1;
            persisted.queue = { ...q, audiobookIds: nextIds, index: idx };
          }
        }
        await savePlayback(persisted);
      } catch {
        // ignore
      }
    }
  );

  ipcMain.handle(IpcChannels.Library.Clear, async (): Promise<void> => {
    // Clear library + playback + extracted covers. Best-effort; ignore missing files.
    try {
      await saveLibrary([]);
    } catch {
      // ignore
    }
    try {
      await savePlayback({ byAudiobookId: {}, lastAudiobookId: undefined, queue: null });
    } catch {
      // ignore
    }
    try {
      await fs.rm(path.join(app.getPath("userData"), "covers"), { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  ipcMain.handle(
    IpcChannels.Library.AddFolders,
    async (
      _event: IpcMainInvokeEvent,
      _folderPaths: string[]
    ): Promise<void> => {
      void startIngestToLibrary(_folderPaths ?? [], _event.sender).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[library:add-folders] ingest failed", err);
        _event.sender.send(IpcChannels.Library.IngestProgress, {
          type: "error",
          message: String(err?.message ?? err ?? "Ingest failed")
        } satisfies IngestProgressPayload);
      });
    }
  );

  ipcMain.handle(
    IpcChannels.Library.SetFavorite,
    async (_event: IpcMainInvokeEvent, audiobookId: string, isFavorite: boolean): Promise<void> => {
      const existing = await loadLibrary();
      const next = existing.map((b) => (b.id === audiobookId ? { ...b, isFavorite: !!isFavorite } : b));
      await saveLibrary(next);
    }
  );

  ipcMain.handle(
    IpcChannels.Library.SetDuration,
    async (_event: IpcMainInvokeEvent, audiobookId: string, durationSeconds: number): Promise<void> => {
      const dur = Number(durationSeconds);
      if (!Number.isFinite(dur) || dur <= 0) return;
      const existing = await loadLibrary();
      const next = existing.map((b) =>
        b.id === audiobookId ? { ...b, durationSeconds: dur, chapters: b.chapters } : b
      );
      await saveLibrary(next);
    }
  );

  ipcMain.handle(
    IpcChannels.Library.UpdateMetadata,
    async (
      _event: IpcMainInvokeEvent,
      audiobookId: string,
      patch: { title?: string; authors?: string[] }
    ): Promise<void> => {
      const existing = await loadLibrary();
      const next = existing.map((b) => {
        if (b.id !== audiobookId) return b;
        const metadata = { ...(b.metadata ?? {}) };
        if (typeof patch?.title === "string") {
          metadata.title = patch.title.trim() || undefined;
        }
        if (Array.isArray(patch?.authors)) {
          const authors = patch.authors
            .map((a) => String(a).trim())
            .filter((a) => a.length > 0);
          metadata.authors = authors.length ? authors : [];
        }
        return { ...b, metadata };
      });
      await saveLibrary(next);
    }
  );

  ipcMain.handle(IpcChannels.Collections.List, async (): Promise<Collection[]> => {
    return await loadCollections();
  });

  ipcMain.handle(
    IpcChannels.Collections.Create,
    async (_event: IpcMainInvokeEvent, name: string): Promise<Collection> => {
      const existing = await loadCollections();
      const now = new Date().toISOString();
      const id = `${now}:${name}`;
      const c: Collection = { id, name: name.trim() || "Untitled", createdAt: now, audiobookIds: [] };
      const next = [...existing, c].sort((a, b) => a.name.localeCompare(b.name));
      await saveCollections(next);
      return c;
    }
  );

  ipcMain.handle(
    IpcChannels.Collections.Rename,
    async (_event: IpcMainInvokeEvent, collectionId: string, name: string): Promise<void> => {
      const existing = await loadCollections();
      const next = existing.map((c) => (c.id === collectionId ? { ...c, name: name.trim() || c.name } : c));
      await saveCollections(next);
    }
  );

  ipcMain.handle(
    IpcChannels.Collections.Remove,
    async (_event: IpcMainInvokeEvent, collectionId: string): Promise<void> => {
      const existing = await loadCollections();
      const next = existing.filter((c) => c.id !== collectionId);
      await saveCollections(next);
    }
  );

  ipcMain.handle(
    IpcChannels.Collections.SetBooks,
    async (
      _event: IpcMainInvokeEvent,
      collectionId: string,
      audiobookIds: string[]
    ): Promise<void> => {
      const existing = await loadCollections();
      const ids = Array.from(new Set(audiobookIds ?? []));
      const next = existing.map((c) => (c.id === collectionId ? { ...c, audiobookIds: ids } : c));
      await saveCollections(next);
    }
  );

  ipcMain.handle(IpcChannels.Playback.GetState, async (): Promise<PlaybackState> => {
    // Return the most recently opened/updated state we have (best-effort).
    const persisted = await loadPlayback();
    const last = persisted.lastAudiobookId
      ? persisted.byAudiobookId[persisted.lastAudiobookId]
      : undefined;
    return { ...(last ?? { isPlaying: false, rate: 1 }), queue: persisted.queue ?? null };
  });

  ipcMain.handle(IpcChannels.Settings.Get, async (): Promise<UserSettings> => {
    return await loadSettings();
  });

  ipcMain.handle(
    IpcChannels.Settings.Set,
    async (_event: IpcMainInvokeEvent, settings: UserSettings): Promise<void> => {
      await saveSettings(settings);
    }
  );

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
        persisted.lastAudiobookId = state.position.audiobookId;
        if (typeof state.queue !== "undefined") {
          persisted.queue = state.queue ?? null;
        }
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


