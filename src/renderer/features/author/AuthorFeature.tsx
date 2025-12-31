import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";
import { ContextMenu } from "@/src/renderer/features/library/ContextMenu";
import { DetailsModal } from "@/src/renderer/features/library/DetailsModal";
import { usePlayer } from "@/src/renderer/features/player/PlayerContext";
import { AudiobookGrid } from "@/src/renderer/features/audiobooks/AudiobookGrid";
import { AudiobookList } from "@/src/renderer/features/audiobooks/AudiobookList";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/src/shared/models/userSettings";
import { sortAudiobooks } from "@/src/renderer/shared/sortAudiobooks";
import { AddToCollectionModal } from "@/src/renderer/features/collections/AddToCollectionModal";

function formatHoursMinutes(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const totalMinutes = Math.floor(s / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function hashColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const idx = h % 4;
  return idx === 0
    ? "from-blue-500 to-blue-700"
    : idx === 1
      ? "from-purple-500 to-purple-700"
      : idx === 2
        ? "from-green-500 to-green-700"
        : "from-yellow-500 to-yellow-700";
}

export function AuthorFeature() {
  const { authorName } = useParams();
  const author = decodeURIComponent(authorName ?? "");
  const navigate = useNavigate();
  const player = usePlayer();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  const [books, setBooks] = useState<Audiobook[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenedSeconds, setListenedSeconds] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBook, setDetailsBook] = useState<Audiobook | null>(null);
  const [detailsPlayback, setDetailsPlayback] = useState<PlaybackState | null>(null);
  const [playbackById, setPlaybackById] = useState<Record<string, PlaybackState | null>>({});
  const [creating, setCreating] = useState(false);
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);
  const [addToCollectionBook, setAddToCollectionBook] = useState<Audiobook | null>(null);

  const refresh = useCallback(async () => {
    if (!author) return;
    setLoading(true);
    try {
      const lib = await window.audioplayer.library.list();
      const filtered = lib.filter((b) =>
        (b.metadata?.authors ?? []).some((a) => String(a ?? "").toLowerCase() === author.toLowerCase())
      );
      setBooks(filtered);
    } finally {
      setLoading(false);
    }
  }, [author]);

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

  const openDetails = useCallback(
    async (id: string) => {
      const book = books.find((b) => b.id === id) ?? null;
      setDetailsBook(book);
      setDetailsPlayback(null);
      setDetailsOpen(true);
      if (!book) return;
      try {
        const st = await window.audioplayer.playback.getStateForAudiobook(book.id);
        setDetailsPlayback(st);
      } catch {
        // ignore
      }
    },
    [books]
  );

  const removeBook = useCallback(async (id: string) => {
    await window.audioplayer.library.remove(id);
    window.dispatchEvent(new Event("audioplayer:library-changed"));
  }, []);

  const setFavorite = useCallback(async (id: string, isFavorite: boolean) => {
    await window.audioplayer.library.setFavorite(id, isFavorite);
    window.dispatchEvent(new Event("audioplayer:library-changed"));
  }, []);

  // Compute total listened time (best-effort) from persisted playback state positions.
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

  const title = useMemo(() => (author ? `Audiobooks by ${author}` : "Author"), [author]);
  const subtitle = useMemo(
    () => (loading ? "Loading…" : `${books.length} audiobook(s)`),
    [books.length, loading]
  );

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
        <span className="text-gray-300 text-sm font-medium">{author}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-60"
            disabled={creating || books.length === 0}
            onClick={() => {
              if (books.length === 0) return;
              void (async () => {
                setCreating(true);
                try {
                  const name = `Books by ${author}`;
                  const created = await window.audioplayer.collections.create(name);
                  await window.audioplayer.collections.setBooks(
                    created.id,
                    books.map((b) => b.id)
                  );
                  window.dispatchEvent(new Event("audioplayer:collections-changed"));
                  navigate(`/collections/${encodeURIComponent(created.id)}`);
                } finally {
                  setCreating(false);
                }
              })();
            }}
          >
            <i className="fas fa-plus mr-2"></i>Create Collection
          </button>
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
            <option value="title">Sort by Title</option>
            <option value="author">Sort by Author</option>
            <option value="dateAdded">Sort by Date Added</option>
            <option value="progress">Sort by Progress</option>
            <option value="duration">Sort by Duration</option>
          </select>
        </div>
      </div>

      {/* Author info */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
        <div className="flex items-start space-x-6">
          <div
            className={`w-24 h-24 bg-gradient-to-br ${hashColor(author)} rounded-full flex items-center justify-center flex-shrink-0`}
          >
            <i className="fas fa-user text-white text-3xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2">{author}</h3>

            {/* Description omitted per requirements */}

            <div className="flex items-center space-x-4 text-sm">
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
        </div>
      </div>

      {/* Books grid */}
      {books.length === 0 && !loading ? (
        <div className="border border-gray-700 bg-gray-800/40 rounded-xl p-8 text-center">
          <div className="text-xl font-semibold">No audiobooks found for this author</div>
          <div className="text-gray-400 mt-2">Try searching for a different author.</div>
        </div>
      ) : (
        settings.viewMode === "list" ? (
          <AudiobookList
            books={sortedBooks}
            onPlay={(b) => void player.actions.playBook(b)}
            onContextMenu={(e, b) => {
              e.preventDefault();
              setSelectedId(b.id);
              setMenuPos({ x: e.clientX, y: e.clientY });
              setMenuOpen(true);
            }}
            onToggleFavorite={(b, next) => void setFavorite(b.id, next)}
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
            onOpenDetails={(b) => void openDetails(b.id)}
            onContextMenu={(e, b) => {
              e.preventDefault();
              setSelectedId(b.id);
              setMenuPos({ x: e.clientX, y: e.clientY });
              setMenuOpen(true);
            }}
            onToggleFavorite={(b, next) => void setFavorite(b.id, next)}
            playbackById={Object.fromEntries(
              Object.entries(playbackById).map(([id, st]) => [
                id,
                st ? { secondsIntoChapter: st.position?.secondsIntoChapter } : null
              ])
            )}
          />
        )
      )}

      {/* Similar authors section omitted per requirements */}

      <ContextMenu
        open={menuOpen}
        x={menuPos.x}
        y={menuPos.y}
        onClose={() => setMenuOpen(false)}
        onDetails={() => {
          if (selectedId) void openDetails(selectedId);
        }}
        onAddToCollection={() => {
          if (!selectedId) return;
          const b = books.find((x) => x.id === selectedId) ?? null;
          setAddToCollectionBook(b);
          setAddToCollectionOpen(true);
        }}
        onRemove={() => {
          if (selectedId) void removeBook(selectedId);
        }}
      />

      <DetailsModal
        open={detailsOpen}
        book={detailsBook}
        playback={detailsPlayback}
        onClose={() => setDetailsOpen(false)}
      />

      <AddToCollectionModal
        open={addToCollectionOpen}
        book={addToCollectionBook}
        onClose={() => setAddToCollectionOpen(false)}
      />
    </section>
  );
}


