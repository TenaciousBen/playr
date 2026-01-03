import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ConfirmModal } from "@/src/renderer/shared/ConfirmModal";
import { useMultiSelect } from "@/src/renderer/shared/useMultiSelect";
import { moveIdsInList } from "@/src/renderer/shared/moveIdsInList";

function rangeLabel(r: UserSettings["recentlyAddedRange"]) {
  return r === "today"
    ? "Today"
    : r === "week"
      ? "Past Week"
      : r === "month"
        ? "Past Month"
        : r === "quarter"
          ? "Past Quarter"
          : "Past Year";
}

function rangeStart(r: UserSettings["recentlyAddedRange"]) {
  const now = new Date();
  if (r === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = r === "week" ? 7 : r === "month" ? 30 : r === "quarter" ? 90 : 365;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function LibraryFeature({
  mode = "library"
}: {
  mode?: "library" | "recent" | "reading" | "favorites";
}) {
  const navigate = useNavigate();
  const player = usePlayer();
  const [books, setBooks] = useState<Audiobook[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [timeMenuOpen, setTimeMenuOpen] = useState(false);
  const [playbackById, setPlaybackById] = useState<Record<string, PlaybackState | null>>({});

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBook, setDetailsBook] = useState<Audiobook | null>(null);
  const [detailsPlayback, setDetailsPlayback] = useState<PlaybackState | null>(null);
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);
  const [addToCollectionBook, setAddToCollectionBook] = useState<Audiobook | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

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
    const onChanged = () => void refresh();
    window.addEventListener("audioplayer:library-changed", onChanged);
    return () => window.removeEventListener("audioplayer:library-changed", onChanged);
  }, [refresh]);

  // Cache playback state (used by "Currently Reading" filter and collection/author stats).
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

  const shown = useMemo(() => {
    // TODO: implement real mode filtering (reading)
    if (mode === "favorites") return books.filter((b) => !!b.isFavorite);
    if (mode === "recent") {
      const start = rangeStart(settings.recentlyAddedRange);
      return books.filter((b) => {
        if (!b.addedAt) return false;
        const d = new Date(b.addedAt);
        if (!Number.isFinite(d.getTime())) return false;
        return d >= start;
      });
    }
    if (mode === "reading") {
      return books.filter((b) => {
        const st = playbackById[b.id];
        const pos = st?.position;
        if (!pos) return false;
        if (!(pos.secondsIntoChapter > 0)) return false; // >0%
        const dur = b.durationSeconds;
        if (!dur || !Number.isFinite(dur) || dur <= 0) return false; // need runtime to be correct
        return pos.secondsIntoChapter < dur * 0.995; // <100%
      });
    }
    return books;
  }, [books, mode, playbackById, settings.recentlyAddedRange]);

  const playbackSecondsById = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, st] of Object.entries(playbackById)) out[id] = st?.position?.secondsIntoChapter ?? 0;
    return out;
  }, [playbackById]);

  const sortedShown = useMemo(
    () => sortAudiobooks(shown, settings.sortBy, playbackSecondsById, settings.libraryOrder),
    [playbackSecondsById, settings.libraryOrder, settings.sortBy, shown]
  );

  const orderedIds = useMemo(() => sortedShown.map((b) => b.id), [sortedShown]);
  const selection = useMultiSelect(orderedIds);

  const applyReorderPreview = useCallback(
    (dragId: string, targetId: string) => {
      // eslint-disable-next-line no-console
      if (localStorage.getItem("debugReorder") === "1") console.log("[REORDER][library] preview", { dragId, targetId });
      const current = (settings.libraryOrder ?? []).length ? (settings.libraryOrder ?? []) : sortedShown.map((b) => b.id);
      const ids = Array.from(new Set([...current, ...sortedShown.map((b) => b.id)]));
      const next = moveIdsInList(
        ids,
        Array.from(selection.selectedSet.has(dragId) ? selection.selectedSet : new Set([dragId])),
        targetId
      );
      if (next.join("|") === ids.join("|")) return;
      setSettings((s) => ({ ...s, sortBy: "userOrder", libraryOrder: next }));
    },
    [selection.selectedSet, settings.libraryOrder, sortedShown]
  );

  const commitReorder = useCallback(
    (dragId: string, targetId: string) => {
      // eslint-disable-next-line no-console
      if (localStorage.getItem("debugReorder") === "1") console.log("[REORDER][library] commit", { dragId, targetId });
      const current = (settings.libraryOrder ?? []).length ? (settings.libraryOrder ?? []) : sortedShown.map((b) => b.id);
      const ids = Array.from(new Set([...current, ...sortedShown.map((b) => b.id)]));
      const nextIds = moveIdsInList(
        ids,
        Array.from(selection.selectedSet.has(dragId) ? selection.selectedSet : new Set([dragId])),
        targetId
      );
      if (nextIds.join("|") === ids.join("|")) return;
      void (async () => {
        const current = await window.audioplayer.settings.get();
        const next: UserSettings = { ...current, sortBy: "userOrder", libraryOrder: nextIds };
        setSettings(next);
        await window.audioplayer.settings.set(next);
        window.dispatchEvent(new Event("audioplayer:settings-changed"));
      })();
    },
    [selection.selectedSet, settings, sortedShown]
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

  const removeBook = useCallback(
    async (id: string) => {
      await window.audioplayer.library.remove(id);
      window.dispatchEvent(new Event("audioplayer:library-changed"));
    },
    []
  );

  const setFavorite = useCallback(async (id: string, isFavorite: boolean) => {
    await window.audioplayer.library.setFavorite(id, isFavorite);
    window.dispatchEvent(new Event("audioplayer:library-changed"));
  }, []);

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
          <p className="text-gray-400 mt-1">{loading ? "Loading…" : `${shown.length} audiobook(s)`}</p>
        </div>
        <div className="flex items-center space-x-3">
          {selection.hasSelection ? (
            <button
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center space-x-2"
              onClick={selection.clearSelection}
              title="Clear selection"
            >
              <i className="fas fa-times-circle text-xs"></i>
              <span>Clear selection</span>
            </button>
          ) : null}
          {mode === "recent" ? (
            <div className="relative" id="time-filter-dropdown">
              <button
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-2 hover:bg-gray-600 transition-colors"
                onClick={() => setTimeMenuOpen((v) => !v)}
              >
                <i className="fas fa-calendar-alt text-gray-400"></i>
                <span id="selected-time-filter">{rangeLabel(settings.recentlyAddedRange)}</span>
                <i className="fas fa-chevron-down text-gray-400 text-xs"></i>
              </button>

              {timeMenuOpen ? (
                <div
                  id="time-filter-menu"
                  className="absolute right-0 mt-2 w-48 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10"
                >
                  <div className="py-1">
                    {(
                      ["today", "week", "month", "quarter", "year"] as Array<
                        UserSettings["recentlyAddedRange"]
                      >
                    ).map((r) => {
                      const active = settings.recentlyAddedRange === r;
                      return (
                        <button
                          key={r}
                          className={[
                            "w-full text-left px-4 py-2 text-sm transition-colors",
                            active ? "bg-gray-600 text-white" : "text-gray-300 hover:bg-gray-600"
                          ].join(" ")}
                          onClick={() => {
                            void (async () => {
                              const current = await window.audioplayer.settings.get();
                              const next: UserSettings = { ...current, recentlyAddedRange: r };
                              setSettings(next);
                              setTimeMenuOpen(false);
                              await window.audioplayer.settings.set(next);
                              window.dispatchEvent(new Event("audioplayer:settings-changed"));
                            })();
                          }}
                        >
                          {rangeLabel(r)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <select
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={settings.sortBy}
            onChange={(e) => {
              void (async () => {
                const current = await window.audioplayer.settings.get();
                const next: UserSettings = { ...current, sortBy: e.target.value as UserSettings["sortBy"] };
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

      {sortedShown.length === 0 && !loading ? (
        <div className="border border-gray-700 bg-gray-800/40 rounded-xl p-8 text-center">
          <div className="text-xl font-semibold">Your library is empty</div>
          <div className="text-gray-400 mt-2">Drag and drop audio files or a folder here to add an audiobook.</div>
        </div>
      ) : (
        settings.viewMode === "list" ? (
          <AudiobookList
            books={sortedShown}
            onPlay={(b) => void player.actions.playBook(b)}
            onOpenBook={(b) => navigate(`/book/${encodeURIComponent(b.id)}`)}
            onShiftSelect={(bookId) => selection.toggleSelect(bookId, true)}
            selectedIds={selection.selectedSet}
            onContextMenu={(e, b) => {
              e.preventDefault();
              setSelectedId(b.id);
              setMenuPos({ x: e.clientX, y: e.clientY });
              setMenuOpen(true);
            }}
            onToggleFavorite={(b, next) => void setFavorite(b.id, next)}
            onReorderPreview={applyReorderPreview}
            onReorderCommit={commitReorder}
            playbackById={Object.fromEntries(
              Object.entries(playbackById).map(([id, st]) => [
                id,
                st ? { secondsIntoChapter: st.position?.secondsIntoChapter } : null
              ])
            )}
          />
        ) : (
          <AudiobookGrid
            books={sortedShown}
            subtitle={(b) => `${b.chapters.length} file(s)`}
            onPlay={(b) => void player.actions.playBook(b)}
            onOpenBook={(b) => navigate(`/book/${encodeURIComponent(b.id)}`)}
            onShiftSelect={(bookId) => selection.toggleSelect(bookId, true)}
            selectedIds={selection.selectedSet}
            onContextMenu={(e, b) => {
              e.preventDefault();
              setSelectedId(b.id);
              setMenuPos({ x: e.clientX, y: e.clientY });
              setMenuOpen(true);
            }}
            onToggleFavorite={(b, next) => void setFavorite(b.id, next)}
            onReorderPreview={applyReorderPreview}
            onReorderCommit={commitReorder}
            playbackById={Object.fromEntries(
              Object.entries(playbackById).map(([id, st]) => [
                id,
                st ? { secondsIntoChapter: st.position?.secondsIntoChapter } : null
              ])
            )}
          />
        )
      )}

      <ContextMenu
        open={menuOpen}
        x={menuPos.x}
        y={menuPos.y}
        onClose={() => setMenuOpen(false)}
        onClearSelection={selection.hasSelection ? selection.clearSelection : undefined}
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
          if (!selectedId) return;
          setConfirmRemoveOpen(true);
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
        books={addToCollectionBook ? [addToCollectionBook] : null}
        onClose={() => setAddToCollectionOpen(false)}
      />

      <ConfirmModal
        open={confirmRemoveOpen}
        title="Remove from Playr?"
        message={
          <div className="space-y-2">
            <div>
              This will remove{" "}
              <span className="font-semibold text-white">
                {selectedId ? books.find((b) => b.id === selectedId)?.metadata?.title ?? books.find((b) => b.id === selectedId)?.displayName ?? "this audiobook" : "this audiobook"}
              </span>{" "}
              from your library.
            </div>
            <div className="text-gray-400">It will also be removed from any collections and queues.</div>
          </div>
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive={true}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={() => {
          if (!selectedId) return;
          void (async () => {
            await removeBook(selectedId);
            setConfirmRemoveOpen(false);
          })();
        }}
      />
    </section>
  );
}


