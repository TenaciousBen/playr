import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { Collection } from "@/src/shared/models/collection";
import type { PlaybackState } from "@/src/shared/models/playback";
import { AudiobookGrid } from "@/src/renderer/features/audiobooks/AudiobookGrid";
import { ContextMenu } from "@/src/renderer/features/library/ContextMenu";
import { DetailsModal } from "@/src/renderer/features/library/DetailsModal";
import { usePlayer } from "@/src/renderer/features/player/PlayerContext";

function formatHoursMinutes(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const totalMinutes = Math.floor(s / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function CollectionFeature() {
  const { collectionId } = useParams();
  const id = decodeURIComponent(collectionId ?? "");
  const navigate = useNavigate();
  const player = usePlayer();

  const [collection, setCollection] = useState<Collection | null>(null);
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

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [collections, lib] = await Promise.all([
        window.audioplayer.collections.list(),
        window.audioplayer.library.list()
      ]);
      const c = collections.find((x) => x.id === id) ?? null;
      setCollection(c);
      if (!c) {
        setBooks([]);
        return;
      }
      const byId = new Map(lib.map((b) => [b.id, b] as const));
      const ordered = (c.audiobookIds ?? []).map((bid) => byId.get(bid)).filter(Boolean) as Audiobook[];
      setBooks(ordered);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => void refresh();
    window.addEventListener("audioplayer:library-changed", onChanged);
    return () => window.removeEventListener("audioplayer:library-changed", onChanged);
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => void refresh();
    window.addEventListener("audioplayer:collections-changed", onChanged);
    return () => window.removeEventListener("audioplayer:collections-changed", onChanged);
  }, [refresh]);

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

  // Total listened time for books in collection (best-effort).
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

  const openDetails = useCallback(
    async (bookId: string) => {
      const book = books.find((b) => b.id === bookId) ?? null;
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

  const removeBook = useCallback(async (bookId: string) => {
    await window.audioplayer.library.remove(bookId);
    window.dispatchEvent(new Event("audioplayer:library-changed"));
  }, []);

  const removeFromCollection = useCallback(
    async (bookId: string) => {
      if (!collection) return;
      const nextIds = (collection.audiobookIds ?? []).filter((id) => id !== bookId);
      await window.audioplayer.collections.setBooks(collection.id, nextIds);
      window.dispatchEvent(new Event("audioplayer:collections-changed"));
      void refresh();
    },
    [collection, refresh]
  );

  const setFavorite = useCallback(async (bookId: string, isFavorite: boolean) => {
    await window.audioplayer.library.setFavorite(bookId, isFavorite);
    window.dispatchEvent(new Event("audioplayer:library-changed"));
  }, []);

  const title = useMemo(() => collection?.name ?? "Collection", [collection?.name]);

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
        <span className="text-gray-300 text-sm font-medium">{title}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-gray-400 mt-1">{loading ? "Loading…" : `${books.length} audiobook(s)`}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium">
            <i className="fas fa-edit mr-2"></i>Edit Collection
          </button>
          <select className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Sort by Title</option>
            <option>Sort by Author</option>
            <option>Sort by Date Added</option>
            <option>Sort by Progress</option>
            <option>Sort by Duration</option>
          </select>
        </div>
      </div>

      {/* Collection info (no description/breakdowns yet) */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
        <div className="flex items-start space-x-6">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="fas fa-layer-group text-white text-3xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <i className="fas fa-book text-purple-400"></i>
                <span className="text-gray-300">{books.length} audiobook(s)</span>
              </div>
              <div className="flex items-center space-x-2">
                <i className="fas fa-clock text-purple-400"></i>
                <span className="text-gray-300">{formatHoursMinutes(listenedSeconds)} listened</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {collection && books.length === 0 && !loading ? (
        <div className="border border-gray-700 bg-gray-800/40 rounded-xl p-8 text-center">
          <div className="text-xl font-semibold">This collection is empty</div>
          <div className="text-gray-400 mt-2">We’ll add ways to organize books into collections soon.</div>
          <div className="mt-6">
            <button
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              onClick={() => navigate("/library")}
            >
              Browse Library
            </button>
          </div>
        </div>
      ) : (
        <AudiobookGrid
          books={books}
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
      )}

      <ContextMenu
        open={menuOpen}
        x={menuPos.x}
        y={menuPos.y}
        onClose={() => setMenuOpen(false)}
        onDetails={() => {
          if (selectedId) void openDetails(selectedId);
        }}
        onRemoveFromCollection={() => {
          if (selectedId) void removeFromCollection(selectedId);
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
    </section>
  );
}


