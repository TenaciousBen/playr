import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackPosition, PlaybackState } from "@/src/shared/models/playback";

function toFileUrl(p: string) {
  const norm = p.replace(/\\/g, "/");
  return `file:///${encodeURI(norm)}`;
}

export type PlayerNowPlaying = {
  book: Audiobook;
  chapterIndex: number;
};

export type PlayerState = {
  nowPlaying: PlayerNowPlaying | null;
  isPlaying: boolean;
  rate: number;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  queue:
    | {
        collectionId: string;
        collectionName: string;
        audiobookIds: string[];
        index: number;
      }
    | null;
};

export type PlayerActions = {
  playBook: (book: Audiobook) => Promise<void>;
  playBookFromStart: (book: Audiobook) => Promise<void>;
  playBookFromChapter: (book: Audiobook, chapterIndex: number) => Promise<void>;
  playCollection: (collectionId: string, audiobookIds: string[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  skipBy: (deltaSeconds: number) => void;
  setRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
};

const PlayerCtx = createContext<{ state: PlayerState; actions: PlayerActions } | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer must be used within <PlayerProvider />");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [nowPlaying, setNowPlaying] = useState<PlayerNowPlaying | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(0.75);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<PlayerState["queue"]>(null);

  const persistTimer = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  const isEmbeddedChaptersBook = useCallback((book: Audiobook | null | undefined) => {
    const chapters = book?.chapters ?? [];
    if (chapters.length <= 1) return false;
    const fp = chapters[0]?.filePath;
    if (!fp) return false;
    return chapters.every((c) => c.filePath === fp) && chapters.some((c) => (c.startSeconds ?? 0) > 0);
  }, []);

  const chapterIndexAtTime = useCallback((book: Audiobook, secondsAbs: number) => {
    const t = Math.max(0, secondsAbs);
    const chs = book.chapters ?? [];
    if (chs.length <= 1) return 0;
    let idx = 0;
    for (let i = 0; i < chs.length; i++) {
      const s = chs[i]?.startSeconds ?? 0;
      if (s <= t + 0.01) idx = i;
      else break;
    }
    return Math.max(0, Math.min(idx, chs.length - 1));
  }, []);

  const persistState = useCallback(
    async (
      override?: Partial<Omit<PlaybackState, "position">> & {
        position?: Partial<PlaybackPosition>;
      }
    ) => {
      if (!nowPlaying || !audioRef.current) return;
      const a = audioRef.current;
      const chStart = nowPlaying.book.chapters[nowPlaying.chapterIndex]?.startSeconds ?? 0;
      const secondsIntoChapter = Math.max(0, (a.currentTime || 0) - chStart);

      const basePosition: PlaybackPosition = {
        audiobookId: nowPlaying.book.id,
        chapterIndex: nowPlaying.chapterIndex,
        secondsIntoChapter
      };

      const base: PlaybackState = {
        isPlaying,
        rate,
        position: basePosition,
        queue: queue
          ? { collectionId: queue.collectionId, audiobookIds: queue.audiobookIds, index: queue.index }
          : null
      };

      const mergedPosition: PlaybackPosition = {
        audiobookId: basePosition.audiobookId,
        chapterIndex: override?.position?.chapterIndex ?? basePosition.chapterIndex,
        secondsIntoChapter: override?.position?.secondsIntoChapter ?? basePosition.secondsIntoChapter
      };

      const merged: PlaybackState = {
        ...base,
        ...(override ?? {}),
        position: mergedPosition
      };
      try {
        await window.audioplayer.playback.setState(merged);
      } catch {
        // ignore (best-effort persistence)
      }
    },
    [isPlaying, nowPlaying, queue, rate]
  );

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "metadata";
      a.volume = volume;
      a.muted = isMuted;
      audioRef.current = a;
    }
    return audioRef.current!;
  }, [isMuted, volume]);

  const loadChapter = useCallback(
    async (book: Audiobook, chapterIndex: number, resumeSeconds?: number, autoplay?: boolean) => {
      const ch = book.chapters[chapterIndex];
      if (!ch) return;

      const a = ensureAudio();
      a.pause();
      a.src = toFileUrl(ch.filePath);
      a.playbackRate = rate;
      a.volume = volume;
      a.muted = isMuted;
      a.load();

      setNowPlaying({ book, chapterIndex });
      setCurrentTime(0);
      setDuration(0);

      const applyResume = () => {
        if (typeof resumeSeconds === "number" && Number.isFinite(resumeSeconds)) {
          try {
            const start = ch.startSeconds ?? 0;
            a.currentTime = Math.max(0, start + Math.max(0, resumeSeconds));
          } catch {
            // ignore
          }
        }
      };

      // If metadata isn't loaded yet, wait for it before seeking.
      if (a.readyState >= 1) {
        applyResume();
      } else {
        const onMeta = () => {
          applyResume();
          a.removeEventListener("loadedmetadata", onMeta);
        };
        a.addEventListener("loadedmetadata", onMeta);
      }

      if (autoplay) {
        try {
          await a.play();
          setIsPlaying(true);
          isPlayingRef.current = true;
        } catch {
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
      }

      void persistState();
    },
    [ensureAudio, persistState, rate]
  );

  const playBook = useCallback(
    async (book: Audiobook) => {
      // Playing a single book replaces any existing queue.
      if (queue) setQueue(null);
      // Resume from stored position for this audiobook (best-effort).
      let resume: PlaybackState | null = null;
      try {
        resume = await window.audioplayer.playback.getStateForAudiobook(book.id);
      } catch {
        resume = null;
      }

      const idx = resume?.position?.chapterIndex ?? 0;
      const seconds = resume?.position?.secondsIntoChapter ?? 0;

      setRateState(resume?.rate ?? 1);
      await loadChapter(book, Math.max(0, Math.min(idx, book.chapters.length - 1)), seconds, true);
      void persistState({ queue: null });
    },
    [loadChapter, persistState, queue]
  );

  const playBookFromChapter = useCallback(
    async (book: Audiobook, chapterIndex: number) => {
      if (queue) setQueue(null);
      setRateState(1);
      await loadChapter(book, Math.max(0, Math.min(chapterIndex, book.chapters.length - 1)), 0, true);
      void persistState({ queue: null });
    },
    [loadChapter, persistState, queue]
  );

  const playBookFromStart = useCallback(
    async (book: Audiobook) => {
      await playBookFromChapter(book, 0);
    },
    [playBookFromChapter]
  );

  const playCollection = useCallback(
    async (collectionId: string, audiobookIds: string[]) => {
      const ids = (audiobookIds ?? []).filter(Boolean);
      if (ids.length === 0) return;
      // Resolve collection name best-effort.
      let collectionName = "Collection";
      try {
        const list = await window.audioplayer.collections.list();
        collectionName = list.find((c) => c.id === collectionId)?.name ?? collectionName;
      } catch {
        // ignore
      }

      // Resume if the last persisted playback was in this collection.
      let resumeIdx = 0;
      let resumeChapterIndex = 0;
      let resumeSeconds = 0;
      let resumeRate = 1;
      try {
        const last = await window.audioplayer.playback.getState();
        resumeRate = last?.rate ?? 1;
        if (last?.queue?.collectionId === collectionId) {
          const posId = last?.position?.audiobookId;
          const byIdIdx = posId ? ids.indexOf(posId) : -1;
          const idx = byIdIdx >= 0 ? byIdIdx : (last?.queue?.index ?? 0);
          resumeIdx = Math.max(0, Math.min(idx, ids.length - 1));
          resumeChapterIndex = last?.position?.chapterIndex ?? 0;
          resumeSeconds = last?.position?.secondsIntoChapter ?? 0;
        }
      } catch {
        // ignore
      }

      const q = { collectionId, collectionName, audiobookIds: ids, index: resumeIdx };
      setQueue(q);

      const lib = await window.audioplayer.library.list();
      const byId = new Map(lib.map((b) => [b.id, b] as const));
      let startIdx = resumeIdx;
      let book = byId.get(ids[startIdx]);
      if (!book || !book.chapters?.length) {
        // Collection may reference removed items; find first present audiobook to avoid a stale footer.
        startIdx = ids.findIndex((id) => {
          const b = byId.get(id);
          return !!b && !!b.chapters?.length;
        });
        book = startIdx >= 0 ? byId.get(ids[startIdx]) : undefined;
      }
      if (!book || !book.chapters?.length) {
        // Nothing playable left in this collection.
        setQueue(null);
        return;
      }

      setRateState(resumeRate);
      await loadChapter(
        book,
        Math.max(0, Math.min(resumeChapterIndex, book.chapters.length - 1)),
        Math.max(0, resumeSeconds),
        true
      );
      void persistState({ queue: { collectionId, audiobookIds: ids, index: startIdx } });
    },
    [loadChapter, persistState]
  );

  // Allow other parts of the UI (e.g. search dropdown) to request playback without
  // direct access to this context instance.
  useEffect(() => {
    const onPlayRequested = (e: Event) => {
      const ce = e as CustomEvent<{ bookId?: string; chapterIndex?: number }>;
      const bookId = ce.detail?.bookId;
      if (!bookId) return;
      const chapterIndex = ce.detail?.chapterIndex;
      void (async () => {
        const lib = await window.audioplayer.library.list();
        const book = lib.find((b) => b.id === bookId);
        if (!book) return;
        if (typeof chapterIndex === "number" && Number.isFinite(chapterIndex)) {
          await playBookFromChapter(book, chapterIndex);
        } else {
          await playBook(book);
        }
      })();
    };
    window.addEventListener("audioplayer:play-book", onPlayRequested as EventListener);
    return () => window.removeEventListener("audioplayer:play-book", onPlayRequested as EventListener);
  }, [playBook, playBookFromChapter]);

  // Allow the sidebar (or other UI) to request collection playback without direct access to this context instance.
  useEffect(() => {
    const onPlayCollectionRequested = (e: Event) => {
      const ce = e as CustomEvent<{ collectionId?: string }>;
      const collectionId = ce.detail?.collectionId;
      if (!collectionId) return;
      void (async () => {
        const list = await window.audioplayer.collections.list();
        const c = list.find((x) => x.id === collectionId);
        if (!c) return;
        await playCollection(collectionId, c.audiobookIds ?? []);
      })();
    };
    window.addEventListener("audioplayer:play-collection", onPlayCollectionRequested as EventListener);
    return () => window.removeEventListener("audioplayer:play-collection", onPlayCollectionRequested as EventListener);
  }, [playCollection]);

  // On startup, initialize the player to the last opened audiobook (paused).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (nowPlaying) return;
      let last: PlaybackState | null = null;
      try {
        last = await window.audioplayer.playback.getState();
      } catch {
        last = null;
      }
      const lastId = last?.position?.audiobookId;
      if (!lastId) return;

      let list: Audiobook[] = [];
      try {
        list = await window.audioplayer.library.list();
      } catch {
        list = [];
      }
      const book = list.find((b) => b.id === lastId);
      if (!book) return;
      if (cancelled) return;

      // Restore queue context if present.
      const q = last?.queue ?? null;
      if (q && q.audiobookIds?.length) {
        let collectionName = "Collection";
        try {
          const list = await window.audioplayer.collections.list();
          collectionName = list.find((c) => c.id === q.collectionId)?.name ?? collectionName;
        } catch {
          // ignore
        }
        setQueue({ collectionId: q.collectionId, collectionName, audiobookIds: q.audiobookIds, index: q.index ?? 0 });
      } else {
        setQueue(null);
      }

      setRateState(last?.rate ?? 1);
      await loadChapter(
        book,
        last?.position?.chapterIndex ?? 0,
        last?.position?.secondsIntoChapter ?? 0,
        false
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [loadChapter, nowPlaying]);

  // If the library changes (e.g. favoriting), refresh the nowPlaying book snapshot so the footer reflects updates.
  useEffect(() => {
    const onChanged = () => {
      void (async () => {
        const list = await window.audioplayer.library.list();
        if (nowPlaying) {
          const updated = list.find((b) => b.id === nowPlaying.book.id);
          if (!updated) {
            // The currently playing book was removed from the library.
            const a = ensureAudio();
            a.pause();
            a.src = "";
            setIsPlaying(false);
            setNowPlaying(null);
            setCurrentTime(0);
            setDuration(0);
            setQueue(null);
            return;
          }
          setNowPlaying({ book: updated, chapterIndex: nowPlaying.chapterIndex });
        }

        // If we have a queue, prune any removed audiobook ids (best-effort UI sync; persistence is handled in main).
        if (queue?.audiobookIds?.length) {
          const present = new Set(list.map((b) => b.id));
          const filtered = queue.audiobookIds.filter((id) => present.has(id));
          if (filtered.length === 0) {
            setQueue(null);
          } else if (filtered.length !== queue.audiobookIds.length) {
            const removedBeforeOrAt = queue.audiobookIds
              .slice(0, queue.index + 1)
              .filter((id) => !present.has(id)).length;
            let idx = Math.max(0, queue.index - removedBeforeOrAt);
            if (idx >= filtered.length) idx = filtered.length - 1;
            setQueue({ ...queue, audiobookIds: filtered, index: idx });
          }
        }
      })();
    };
    window.addEventListener("audioplayer:library-changed", onChanged);
    return () => window.removeEventListener("audioplayer:library-changed", onChanged);
  }, [ensureAudio, nowPlaying, queue]);

  const play = useCallback(async () => {
    const a = ensureAudio();
    try {
      await a.play();
      setIsPlaying(true);
      void persistState({ isPlaying: true });
    } catch {
      setIsPlaying(false);
    }
  }, [ensureAudio, persistState]);

  const pause = useCallback(() => {
    const a = ensureAudio();
    a.pause();
    setIsPlaying(false);
    void persistState({ isPlaying: false });
  }, [ensureAudio, persistState]);

  const togglePlayPause = useCallback(async () => {
    if (isPlaying) {
      pause();
      return;
    }
    await play();
  }, [isPlaying, pause, play]);

  const seek = useCallback(
    (seconds: number) => {
      const a = ensureAudio();
      const nextAbs = Math.max(0, seconds);
      try {
        a.currentTime = nextAbs;
      } catch {
        // ignore
      }
      setCurrentTime(a.currentTime || 0);

      // If this is an embedded-chapters book, update chapterIndex based on the absolute time.
      const np = nowPlaying;
      if (np && isEmbeddedChaptersBook(np.book)) {
        const idx = chapterIndexAtTime(np.book, a.currentTime || 0);
        if (idx !== np.chapterIndex) {
          setNowPlaying({ book: np.book, chapterIndex: idx });
          const start = np.book.chapters[idx]?.startSeconds ?? 0;
          void persistState({ position: { chapterIndex: idx, secondsIntoChapter: Math.max(0, (a.currentTime || 0) - start) } });
          return;
        }
      }

      void persistState();
    },
    [chapterIndexAtTime, ensureAudio, isEmbeddedChaptersBook, nowPlaying, persistState]
  );

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      const a = ensureAudio();
      seek(a.currentTime + deltaSeconds);
    },
    [ensureAudio, seek]
  );

  const setRate = useCallback(
    (next: number) => {
      const clamped = Math.max(0.5, Math.min(3, next));
      setRateState(clamped);
      const a = ensureAudio();
      a.playbackRate = clamped;
      void persistState({ rate: clamped });
    },
    [ensureAudio, persistState]
  );

  const setVolume = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(1, Number(next)));
      setVolumeState(clamped);
      const a = ensureAudio();
      a.volume = clamped;
      if (clamped > 0 && isMuted) {
        setIsMuted(false);
        a.muted = false;
      }
    },
    [ensureAudio, isMuted]
  );

  const toggleMute = useCallback(() => {
    const a = ensureAudio();
    const next = !isMuted;
    setIsMuted(next);
    a.muted = next;
  }, [ensureAudio, isMuted]);

  const nextChapter = useCallback(async () => {
    if (!nowPlaying) return;
    const nextIdx = nowPlaying.chapterIndex + 1;
    if (nextIdx < nowPlaying.book.chapters.length) {
      if (isEmbeddedChaptersBook(nowPlaying.book)) {
        const a = ensureAudio();
        const start = nowPlaying.book.chapters[nextIdx]?.startSeconds ?? 0;
        try {
          a.currentTime = Math.max(0, start);
        } catch {
          // ignore
        }
        setNowPlaying({ book: nowPlaying.book, chapterIndex: nextIdx });
        setCurrentTime(a.currentTime || 0);
        if (isPlayingRef.current) {
          try {
            await a.play();
            setIsPlaying(true);
          } catch {
            setIsPlaying(false);
            isPlayingRef.current = false;
          }
        }
        void persistState({ position: { chapterIndex: nextIdx, secondsIntoChapter: 0 } });
        return;
      }

      await loadChapter(nowPlaying.book, nextIdx, 0, true);
      return;
    }

    // No next chapter: if queue has a next book, advance.
    if (queue && queue.index < queue.audiobookIds.length - 1) {
      const nextBookId = queue.audiobookIds[queue.index + 1];
      const lib = await window.audioplayer.library.list();
      const nextBook = lib.find((b) => b.id === nextBookId);
      if (!nextBook) return;
      const nextQueue = { ...queue, index: queue.index + 1 };
      setQueue(nextQueue);
      await loadChapter(nextBook, 0, 0, true);
      void persistState({ queue: { collectionId: nextQueue.collectionId, audiobookIds: nextQueue.audiobookIds, index: nextQueue.index } });
      return;
    }

    pause();
  }, [loadChapter, nowPlaying, pause, persistState, queue]);

  const prevChapter = useCallback(async () => {
    if (!nowPlaying) return;
    const prevIdx = nowPlaying.chapterIndex - 1;
    if (prevIdx >= 0) {
      if (isEmbeddedChaptersBook(nowPlaying.book)) {
        const a = ensureAudio();
        const start = nowPlaying.book.chapters[prevIdx]?.startSeconds ?? 0;
        try {
          a.currentTime = Math.max(0, start);
        } catch {
          // ignore
        }
        setNowPlaying({ book: nowPlaying.book, chapterIndex: prevIdx });
        setCurrentTime(a.currentTime || 0);
        if (isPlayingRef.current) {
          try {
            await a.play();
            setIsPlaying(true);
          } catch {
            setIsPlaying(false);
            isPlayingRef.current = false;
          }
        }
        void persistState({ position: { chapterIndex: prevIdx, secondsIntoChapter: 0 } });
        return;
      }

      await loadChapter(nowPlaying.book, prevIdx, 0, true);
      return;
    }
    // At first chapter: if queue has a previous book, go back.
    if (queue && queue.index > 0) {
      const prevBookId = queue.audiobookIds[queue.index - 1];
      const lib = await window.audioplayer.library.list();
      const prevBook = lib.find((b) => b.id === prevBookId);
      if (!prevBook) return;
      const nextQueue = { ...queue, index: queue.index - 1 };
      setQueue(nextQueue);
      await loadChapter(prevBook, Math.max(0, prevBook.chapters.length - 1), 0, true);
      void persistState({ queue: { collectionId: nextQueue.collectionId, audiobookIds: nextQueue.audiobookIds, index: nextQueue.index } });
      return;
    }
    await loadChapter(nowPlaying.book, 0, 0, true);
  }, [loadChapter, nowPlaying, persistState, queue]);

  // Attach audio element listeners once.
  useEffect(() => {
    const a = ensureAudio();

    const onTime = () => {
      setCurrentTime(a.currentTime || 0);
      setDuration(Number.isFinite(a.duration) ? a.duration : 0);

      // Embedded-chapters: update chapterIndex as playback crosses chapter boundaries.
      const np = nowPlaying;
      if (np && isEmbeddedChaptersBook(np.book)) {
        const idx = chapterIndexAtTime(np.book, a.currentTime || 0);
        if (idx !== np.chapterIndex) {
          setNowPlaying({ book: np.book, chapterIndex: idx });
        }
      }
    };
    const onDuration = () => {
      const dur = Number.isFinite(a.duration) ? a.duration : 0;
      // Duration shown in UI is chapter-relative; we compute it in onTime(). Keep this handler for persistence only.
      // Best-effort: persist full runtime so grids can compute accurate % progress.
      if (nowPlaying && dur > 0) {
        const existing = nowPlaying.book.durationSeconds ?? 0;
        if (!existing || Math.abs(existing - dur) > 1) {
          void window.audioplayer.library.setDuration(nowPlaying.book.id, dur);
          // Also refresh local snapshot so footer/derived UIs see it immediately.
          setNowPlaying({ book: { ...nowPlaying.book, durationSeconds: dur }, chapterIndex: nowPlaying.chapterIndex });
        }
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onPlayRef = () => {
      isPlayingRef.current = true;
      onPlay();
    };
    const onPauseRef = () => {
      isPlayingRef.current = false;
      onPause();
    };
    const onEnded = () => {
      // Auto-advance chapter if possible.
      void nextChapter();
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onTime);
    a.addEventListener("loadedmetadata", onDuration);
    a.addEventListener("durationchange", onDuration);
    a.addEventListener("play", onPlayRef);
    a.addEventListener("pause", onPauseRef);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onTime);
      a.removeEventListener("loadedmetadata", onDuration);
      a.removeEventListener("durationchange", onDuration);
      a.removeEventListener("play", onPlayRef);
      a.removeEventListener("pause", onPauseRef);
      a.removeEventListener("ended", onEnded);
    };
  }, [chapterIndexAtTime, ensureAudio, isEmbeddedChaptersBook, nextChapter, nowPlaying]);

  // Throttled persistence while playing.
  useEffect(() => {
    if (persistTimer.current) {
      window.clearInterval(persistTimer.current);
      persistTimer.current = null;
    }
    if (!isPlaying) return;
    persistTimer.current = window.setInterval(() => {
      void persistState();
    }, 2000);
    return () => {
      if (persistTimer.current) {
        window.clearInterval(persistTimer.current);
        persistTimer.current = null;
      }
    };
  }, [isPlaying, persistState]);

  const state = useMemo<PlayerState>(
    () => ({ nowPlaying, isPlaying, rate, volume, isMuted, currentTime, duration, queue }),
    [currentTime, duration, isMuted, isPlaying, nowPlaying, queue, rate, volume]
  );
  const actions = useMemo<PlayerActions>(
    () => ({
      playBook,
      playBookFromStart,
      playBookFromChapter,
      playCollection,
      togglePlayPause,
      play,
      pause,
      seek,
      skipBy,
      setRate,
      setVolume,
      toggleMute,
      nextChapter,
      prevChapter
    }),
    [
      nextChapter,
      pause,
      play,
      playBook,
      playBookFromChapter,
      playBookFromStart,
      playCollection,
      prevChapter,
      seek,
      setRate,
      setVolume,
      skipBy,
      toggleMute,
      togglePlayPause
    ]
  );

  return <PlayerCtx.Provider value={{ state, actions }}>{children}</PlayerCtx.Provider>;
}


