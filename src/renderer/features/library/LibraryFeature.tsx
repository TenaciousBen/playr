import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";
import { ContextMenu } from "@/src/renderer/features/library/ContextMenu";
import { DetailsModal } from "@/src/renderer/features/library/DetailsModal";

type OutletCtx = { search: string };

function toFileUrl(p: string) {
  const norm = p.replace(/\\/g, "/");
  return `file:///${encodeURI(norm)}`;
}

export function LibraryFeature({
  mode = "library"
}: {
  mode?: "library" | "recent" | "reading" | "favorites";
}) {
  const { search } = useOutletContext<OutletCtx>();
  const [books, setBooks] = useState<Audiobook[]>([]);
  const [loading, setLoading] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBook, setDetailsBook] = useState<Audiobook | null>(null);
  const [detailsPlayback, setDetailsPlayback] = useState<PlaybackState | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.audioplayer.library.list();
      setBooks(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => void refresh();
    window.addEventListener("audioplayer:library-changed", onChanged);
    return () => window.removeEventListener("audioplayer:library-changed", onChanged);
  }, [refresh]);

  const filtered = useMemo(() => {
    // TODO: implement real mode filtering (recent/reading/favorites)
    if (mode !== "library") return books;
    const q = search.trim();
    if (!q) return books;
    return books.filter((b) => {
      const hay = [
        b.displayName,
        b.metadata?.title,
        b.metadata?.subtitle,
        ...(b.metadata?.authors ?? [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [books, mode, search]);

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

  const removeBook = useCallback(
    async (id: string) => {
      await window.audioplayer.library.remove(id);
      window.dispatchEvent(new Event("audioplayer:library-changed"));
    },
    []
  );

  return (
    <section className="relative flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">
            {mode === "library"
              ? "All Audiobooks"
              : mode === "recent"
                ? "Recently Added"
                : mode === "reading"
                  ? "Currently Reading"
                  : "Favorites"}
          </h2>
          <p className="text-gray-400 mt-1">{loading ? "Loading…" : `${filtered.length} audiobook(s)`}</p>
        </div>
        <div className="flex items-center space-x-3">
          <select className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Sort by Title</option>
            <option>Sort by Author</option>
            <option>Sort by Date Added</option>
            <option>Sort by Progress</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 && !loading ? (
        <div className="border border-gray-700 bg-gray-800/40 rounded-xl p-8 text-center">
          <div className="text-xl font-semibold">Your library is empty</div>
          <div className="text-gray-400 mt-2">Drag and drop audio files or a folder here to add an audiobook.</div>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-6">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="audiobook-card group cursor-pointer"
              title={b.displayName}
              onContextMenu={(e) => {
                e.preventDefault();
                setSelectedId(b.id);
                setMenuPos({ x: e.clientX, y: e.clientY });
                setMenuOpen(true);
              }}
              onDoubleClick={() => void openDetails(b.id)}
            >
              <div className="relative mb-3">
                {b.metadata?.coverImagePath ? (
                  <img
                    className="w-full h-48 object-cover rounded-lg shadow-lg"
                    src={toFileUrl(b.metadata.coverImagePath)}
                    alt={b.metadata?.title ?? b.displayName}
                  />
                ) : (
                  <div className="w-full h-48 rounded-lg shadow-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <i className="fas fa-book text-gray-400 text-3xl"></i>
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 rounded-lg flex items-center justify-center">
                  <i className="fas fa-play text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></i>
                </div>
              </div>
              <h3 className="font-semibold text-sm mb-1 line-clamp-2">{b.metadata?.title ?? b.displayName}</h3>
              {b.metadata?.authors?.length ? (
                <p className="text-gray-400 text-xs mb-1">{b.metadata.authors.join(", ")}</p>
              ) : null}
              <p className="text-gray-500 text-xs">{b.chapters.length} file(s)</p>
            </div>
          ))}
        </div>
      )}

      <ContextMenu
        open={menuOpen}
        x={menuPos.x}
        y={menuPos.y}
        onClose={() => setMenuOpen(false)}
        onDetails={() => {
          if (selectedId) void openDetails(selectedId);
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


