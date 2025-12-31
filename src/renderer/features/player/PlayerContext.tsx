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
};

export type PlayerActions = {
  playBook: (book: Audiobook) => Promise<void>;
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

  const persistTimer = useRef<number | null>(null);

  const persistState = useCallback(
    async (
      override?: Partial<Omit<PlaybackState, "position">> & {
        position?: Partial<PlaybackPosition>;
      }
    ) => {
      if (!nowPlaying || !audioRef.current) return;
      const a = audioRef.current;

      const basePosition: PlaybackPosition = {
        audiobookId: nowPlaying.book.id,
        chapterIndex: nowPlaying.chapterIndex,
        secondsIntoChapter: a.currentTime
      };

      const base: PlaybackState = {
        isPlaying,
        rate,
        position: basePosition
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
    [isPlaying, nowPlaying, rate]
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
            a.currentTime = Math.max(0, resumeSeconds);
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
        } catch {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }

      void persistState();
    },
    [ensureAudio, persistState, rate]
  );

  const playBook = useCallback(
    async (book: Audiobook) => {
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
    },
    [loadChapter]
  );

  // Allow other parts of the UI (e.g. search dropdown) to request playback without
  // direct access to this context instance.
  useEffect(() => {
    const onPlayRequested = (e: Event) => {
      const ce = e as CustomEvent<{ bookId?: string }>;
      const bookId = ce.detail?.bookId;
      if (!bookId) return;
      void (async () => {
        const lib = await window.audioplayer.library.list();
        const book = lib.find((b) => b.id === bookId);
        if (!book) return;
        await playBook(book);
      })();
    };
    window.addEventListener("audioplayer:play-book", onPlayRequested as EventListener);
    return () => window.removeEventListener("audioplayer:play-book", onPlayRequested as EventListener);
  }, [playBook]);

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
      if (!nowPlaying) return;
      void (async () => {
        const list = await window.audioplayer.library.list();
        const updated = list.find((b) => b.id === nowPlaying.book.id);
        if (!updated) return;
        setNowPlaying({ book: updated, chapterIndex: nowPlaying.chapterIndex });
      })();
    };
    window.addEventListener("audioplayer:library-changed", onChanged);
    return () => window.removeEventListener("audioplayer:library-changed", onChanged);
  }, [nowPlaying]);

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
      try {
        a.currentTime = Math.max(0, seconds);
      } catch {
        // ignore
      }
      setCurrentTime(a.currentTime);
      void persistState();
    },
    [ensureAudio, persistState]
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
    if (nextIdx >= nowPlaying.book.chapters.length) {
      pause();
      return;
    }
    await loadChapter(nowPlaying.book, nextIdx, 0, true);
  }, [loadChapter, nowPlaying, pause]);

  const prevChapter = useCallback(async () => {
    if (!nowPlaying) return;
    const prevIdx = Math.max(0, nowPlaying.chapterIndex - 1);
    await loadChapter(nowPlaying.book, prevIdx, 0, true);
  }, [loadChapter, nowPlaying]);

  // Attach audio element listeners once.
  useEffect(() => {
    const a = ensureAudio();

    const onTime = () => {
      setCurrentTime(a.currentTime || 0);
      setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    };
    const onDuration = () => {
      const dur = Number.isFinite(a.duration) ? a.duration : 0;
      setDuration(dur);
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
    const onEnded = () => {
      // Auto-advance chapter if possible.
      void nextChapter();
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onTime);
    a.addEventListener("loadedmetadata", onDuration);
    a.addEventListener("durationchange", onDuration);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onTime);
      a.removeEventListener("loadedmetadata", onDuration);
      a.removeEventListener("durationchange", onDuration);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [ensureAudio, nextChapter, nowPlaying]);

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
    () => ({ nowPlaying, isPlaying, rate, volume, isMuted, currentTime, duration }),
    [currentTime, duration, isMuted, isPlaying, nowPlaying, rate, volume]
  );
  const actions = useMemo<PlayerActions>(
    () => ({
      playBook,
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


