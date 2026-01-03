import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";
import { usePlayer } from "@/src/renderer/features/player/PlayerContext";
import { AudiobookGrid } from "@/src/renderer/features/audiobooks/AudiobookGrid";
import { AudiobookList } from "@/src/renderer/features/audiobooks/AudiobookList";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/src/shared/models/userSettings";
import { sortAudiobooks } from "@/src/renderer/shared/sortAudiobooks";
import { AddToCollectionModal } from "@/src/renderer/features/collections/AddToCollectionModal";
import { DropdownButton } from "@/src/renderer/shared/DropdownButton";

function formatHoursMinutes(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const totalMinutes = Math.floor(s / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function MatchesFeature() {
  const { query } = useParams();
  const q = decodeURIComponent(query ?? "").trim();
  const navigate = useNavigate();
  const player = usePlayer();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  const [books, setBooks] = useState<Audiobook[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenedSeconds, setListenedSeconds] = useState(0);
  const [playbackById, setPlaybackById] = useState<Record<string, PlaybackState | null>>({});
  const [creating, setCreating] = useState(false);
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!q) return;
    setLoading(true);
    try {
      const lib = await window.audioplayer.library.list();
      const qq = q.toLowerCase();
      const matched = lib.filter((b) => {
        const title = String(b.metadata?.title ?? b.displayName ?? "");
        const subtitle = String(b.metadata?.subtitle ?? "");
        const authors = (b.metadata?.authors ?? []).join(", ");
        const root = String(b.rootFolderPath ?? "");
        const files = (b.chapters ?? []).map((c) => c.filePath).join("\n");
        const hay = `${title}\n${subtitle}\n${authors}\n${root}\n${files}`.toLowerCase();
        return hay.includes(qq);
      });
      setBooks(matched);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => void refresh();
    window.addEventListener("audioplayer:library-changed", onChanged);
    return () => window.removeEventListener("audioplayer:library-changed", onChanged);
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await window.audioplayer.settings.get();
        if (alive) setSettings(s);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onChanged = () => {
      void (async () => {
        const s = await window.audioplayer.settings.get();
        setSettings(s);
      })();
    };
    window.addEventListener("audioplayer:settings-changed", onChanged);
    return () => window.removeEventListener("audioplayer:settings-changed", onChanged);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = books.map((b) => b.id);
      if (ids.length === 0) {
        if (alive) setPlaybackById({});
        return;
      }
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const st = await window.audioplayer.playback.getStateForAudiobook(id);
            return [id, st] as const;
          } catch {
            return [id, null] as const;
          }
        })
      );
      if (!alive) return;
      const next: Record<string, PlaybackState | null> = {};
      for (const [id, st] of entries) next[id] = st;
      setPlaybackById(next);
    })();
    return () => {
      alive = false;
    };
  }, [books]);

  const playbackSecondsById = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, st] of Object.entries(playbackById)) out[id] = st?.position?.secondsIntoChapter ?? 0;
    return out;
  }, [playbackById]);

  const sortedBooks = useMemo(
    () => sortAudiobooks(books, settings.sortBy, playbackSecondsById),
    [books, playbackSecondsById, settings.sortBy]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      if (books.length === 0) {
        if (alive) setListenedSeconds(0);
        return;
      }
      const states = await Promise.all(
        books.map(async (b) => {
          try {
            return await window.audioplayer.playback.getStateForAudiobook(b.id);
          } catch {
            return null;
          }
        })
      );
      if (!alive) return;
      const total = states.reduce((acc, st) => acc + (st?.position?.secondsIntoChapter ?? 0), 0);
      setListenedSeconds(total);
    })();
    return () => {
      alive = false;
    };
  }, [books]);

  const createMatchesCollection = useCallback(async () => {
    if (creating) return;
    if (!q) return;
    if (books.length === 0) return;

    setCreating(true);
    try {
      const existing = await window.audioplayer.collections.list();
      const existingNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));

      const base = `Matches: ${q}`.trim() || "New Collection";
      let name = base;
      for (let i = 2; existingNames.has(name.trim().toLowerCase()); i++) {
        name = `${base} (${i})`;
      }

      const created = await window.audioplayer.collections.create(name);
      await window.audioplayer.collections.setBooks(created.id, books.map((b) => b.id));
      window.dispatchEvent(new Event("audioplayer:collections-changed"));
      navigate(`/collections/${encodeURIComponent(created.id)}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[matches] failed to create collection", e);
    } finally {
      setCreating(false);
    }
  }, [books, creating, navigate, q]);

  const title = useMemo(() => (q ? `Matches for “${q}”` : "Matches"), [q]);
  const subtitle = useMemo(() => (loading ? "Loading…" : `${books.length} audiobook(s)`), [books.length, loading]);

  return (
    <section className="flex-1 p-6 overflow-y-auto">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 mb-6">
        <button
          className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
          onClick={() => navigate("/library")}
        >
          All Audiobooks
        </button>
        <i className="fas fa-chevron-right text-gray-500 text-xs"></i>
        <span className="text-gray-300 text-sm font-medium">Matches</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-gray-400 mt-1">{subtitle}</p>
          <div className="flex items-center space-x-4 text-sm mt-2">
            <div className="flex items-center space-x-2">
              <i className="fas fa-book text-blue-400"></i>
              <span className="text-gray-300">{books.length} audiobook(s)</span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-clock text-blue-400"></i>
              <span className="text-gray-300">{formatHoursMinutes(listenedSeconds)} listened</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <DropdownButton
            label={creating ? "Creating…" : "Create Collection"}
            title="Collection actions"
            primaryDisabled={creating || books.length === 0}
            onPrimaryClick={() => void createMatchesCollection()}
            secondaryActions={[
              {
                label: "Add to existing collection…",
                iconClassName: "fas fa-layer-group",
                onClick: () => setAddToCollectionOpen(true)
              }
            ]}
          />
          <select
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={settings.sortBy}
            onChange={(e) => {
              void (async () => {
                const next: UserSettings = { ...settings, sortBy: e.target.value as UserSettings["sortBy"] };
                setSettings(next);
                await window.audioplayer.settings.set(next);
                window.dispatchEvent(new Event("audioplayer:settings-changed"));
              })();
            }}
          >
            <option value="userOrder">Sort by User Order</option>
            <option value="title">Sort by Title</option>
            <option value="author">Sort by Author</option>
            <option value="dateAdded">Sort by Date Added</option>
            <option value="progress">Sort by Progress</option>
            <option value="duration">Sort by Duration</option>
          </select>
        </div>
      </div>

      {books.length === 0 && !loading ? (
        <div className="border border-gray-700 bg-gray-800/40 rounded-xl p-8 text-center">
          <div className="text-xl font-semibold">No matches found</div>
          <div className="text-gray-400 mt-2">Try a different search term.</div>
        </div>
      ) : (
        settings.viewMode === "list" ? (
          <AudiobookList
            books={sortedBooks}
            onPlay={(b) => void player.actions.playBook(b)}
            onOpenBook={(b) => navigate(`/book/${encodeURIComponent(b.id)}`)}
            onToggleFavorite={(b, next) => void window.audioplayer.library.setFavorite(b.id, next).then(() => window.dispatchEvent(new Event("audioplayer:library-changed")))}
            playbackById={Object.fromEntries(
              Object.entries(playbackById).map(([id, st]) => [
                id,
                st ? { secondsIntoChapter: st.position?.secondsIntoChapter } : null
              ])
            )}
          />
        ) : (
          <AudiobookGrid
            books={sortedBooks}
            subtitle={(b) => `${b.chapters.length} file(s)`}
            onPlay={(b) => void player.actions.playBook(b)}
            onOpenBook={(b) => navigate(`/book/${encodeURIComponent(b.id)}`)}
            onToggleFavorite={(b, next) => void window.audioplayer.library.setFavorite(b.id, next).then(() => window.dispatchEvent(new Event("audioplayer:library-changed")))}
            playbackById={Object.fromEntries(
              Object.entries(playbackById).map(([id, st]) => [
                id,
                st ? { secondsIntoChapter: st.position?.secondsIntoChapter } : null
              ])
            )}
          />
        )
      )}

      <AddToCollectionModal open={addToCollectionOpen} books={books} onClose={() => setAddToCollectionOpen(false)} />
    </section>
  );
}


