import React from "react";
import type { Audiobook } from "@/src/shared/models/audiobook";
import { toFileUrl } from "@/src/renderer/shared/toFileUrl";
import { usePlayer } from "@/src/renderer/features/player/PlayerContext";

const INTERNAL_DND_BOOK_TYPE = "application/x-playr-audiobook-id";
const INTERNAL_MULTI_DND_BOOKS_TYPE = "application/x-playr-audiobook-ids";
const INTERNAL_REORDER_TYPE = "application/x-playr-reorder-audiobook";
const TRANSPARENT_GIF =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

function debugReorderEnabled() {
  try {
    return localStorage.getItem("debugReorder") === "1";
  } catch {
    return false;
  }
}

function logReorder(...args: any[]) {
  if (!debugReorderEnabled()) return;
  // eslint-disable-next-line no-console
  console.log("[REORDER]", ...args);
}

export function AudiobookGrid({
  books,
  subtitle,
  onPlay,
  onOpenBook,
  onShiftSelect,
  selectedIds,
  onContextMenu,
  onToggleFavorite,
  playbackById,
  onReorderPreview,
  onReorderCommit
}: {
  books: Audiobook[];
  subtitle?: (b: Audiobook) => React.ReactNode;
  onPlay: (b: Audiobook) => void;
  onOpenBook: (b: Audiobook) => void;
  onShiftSelect?: (bookId: string) => void;
  selectedIds?: Set<string>;
  onContextMenu?: (e: React.MouseEvent, b: Audiobook) => void;
  onToggleFavorite?: (b: Audiobook, next: boolean) => void;
  playbackById?: Record<string, { secondsIntoChapter?: number } | null>;
  onReorderPreview?: (dragId: string, targetId: string) => void;
  onReorderCommit?: (dragId: string, targetId: string) => void;
}) {
  const { state } = usePlayer();
  const lastReorderOverIdRef = React.useRef<string | null>(null);
  const sawReorderHoverRef = React.useRef(false);
  return (
    <div className="grid grid-cols-5 gap-6">
      {books.map((b, idx) => {
        const isFav = !!b.isFavorite;
        const isNowPlaying = state.nowPlaying?.book?.id === b.id;
        const isSelected = !!selectedIds?.has(b.id);
        const seconds = isNowPlaying
          ? state.currentTime
          : playbackById?.[b.id]?.secondsIntoChapter ?? 0;
        const dur = (isNowPlaying && state.duration > 0 ? state.duration : 0) || b.durationSeconds || 0;
        const pct = dur > 0 ? Math.max(0, Math.min(1, seconds / dur)) : 0;
        const showPct = pct > 0.001;
        const isDone = pct >= 0.995;
        return (
          <div
            key={b.id}
            className="audiobook-card group cursor-pointer"
            title={b.displayName}
            draggable={true}
            onDragStart={(e) => {
              logReorder("dragstart", { id: b.id, title: b.metadata?.title ?? b.displayName });
              (window as any).__playrReorderDragId = b.id;
              e.dataTransfer.effectAllowed = "copyMove";
              const multiIds =
                selectedIds && selectedIds.size > 1 && selectedIds.has(b.id)
                  ? Array.from(selectedIds)
                  : null;
              if (multiIds && multiIds.length > 1) {
                const payload = JSON.stringify(multiIds);
                e.dataTransfer.setData(INTERNAL_MULTI_DND_BOOKS_TYPE, payload);
                // Fallback: some environments drop custom DataTransfer types; stash on window too.
                (window as any).__playrDnDBookIds = payload;
              } else {
                (window as any).__playrDnDBookIds = JSON.stringify([b.id]);
              }
              e.dataTransfer.setData(INTERNAL_DND_BOOK_TYPE, b.id);
              e.dataTransfer.setData(INTERNAL_REORDER_TYPE, b.id);
              e.dataTransfer.setData("text/plain", b.id);
              // Prevent large cover-image ghost obscuring the UI.
              const img = new Image();
              img.src = TRANSPARENT_GIF;
              e.dataTransfer.setDragImage(img, 0, 0);
            }}
            onDragEnd={(e) => {
              logReorder("dragend", { id: b.id });
              const dropEffect = e.dataTransfer?.dropEffect ?? "none";
              const lastOverId = lastReorderOverIdRef.current;
              const dragId = (window as any).__playrReorderDragId || b.id;

              // If we showed a preview reorder but the user released outside an item drop-target,
              // persist to the last hovered target so the order doesn't "snap back" on reload.
              //
              // Avoid committing when the user was doing a copy-drop (e.g. dragging into a collection).
              if (sawReorderHoverRef.current && lastOverId && dropEffect !== "copy") {
                if (dragId && dragId !== lastOverId) onReorderCommit?.(dragId, lastOverId);
              }
              (window as any).__playrReorderDragId = null;
              lastReorderOverIdRef.current = null;
              sawReorderHoverRef.current = false;
            }}
            onDragOver={(e) => {
              const types = Array.from(e.dataTransfer?.types ?? []);
              if (!types.includes(INTERNAL_REORDER_TYPE)) return;
              const dragId =
                (window as any).__playrReorderDragId ||
                e.dataTransfer.getData(INTERNAL_REORDER_TYPE) ||
                e.dataTransfer.getData(INTERNAL_DND_BOOK_TYPE) ||
                e.dataTransfer.getData("text/plain");
              if (!dragId || dragId === b.id) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              logReorder("dragover", { dragId, overId: b.id, types });
              sawReorderHoverRef.current = true;
              lastReorderOverIdRef.current = b.id;
              onReorderPreview?.(dragId, b.id);
            }}
            onDrop={(e) => {
              const types = Array.from(e.dataTransfer?.types ?? []);
              if (!types.includes(INTERNAL_REORDER_TYPE)) return;
              const dragId =
                (window as any).__playrReorderDragId ||
                e.dataTransfer.getData(INTERNAL_REORDER_TYPE) ||
                e.dataTransfer.getData(INTERNAL_DND_BOOK_TYPE) ||
                e.dataTransfer.getData("text/plain");
              if (!dragId || dragId === b.id) return;
              e.preventDefault();
              logReorder("drop", { dragId, targetId: b.id, types });
              onReorderCommit?.(dragId, b.id);
              (window as any).__playrReorderDragId = null;
              lastReorderOverIdRef.current = null;
              sawReorderHoverRef.current = false;
            }}
            onContextMenu={(e) => onContextMenu?.(e, b)}
            onClick={(e) => {
              if (e.shiftKey) {
                onShiftSelect?.(b.id);
                return;
              }
              onOpenBook(b);
            }}
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

              {isSelected ? (
                <div className="absolute top-2 left-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
              ) : null}

              <button
                className={[
                  "absolute top-2 w-8 h-8 bg-gray-900 bg-opacity-70 rounded-full flex items-center justify-center hover:bg-opacity-90 transition-all opacity-0 group-hover:opacity-100",
                  isSelected ? "left-11" : "left-2"
                ].join(" ")}
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(b);
                }}
                title="Play"
              >
                <i className="fas fa-play text-white text-sm"></i>
              </button>

              {showPct ? (
                <div
                  className={[
                    "absolute bottom-2 left-2 text-xs px-2 py-1 rounded",
                    isDone ? "bg-green-600" : "bg-blue-600"
                  ].join(" ")}
                  title={isDone ? "Completed" : `${Math.round(pct * 100)}%`}
                >
                  {isDone ? "100%" : `${Math.round(pct * 100)}%`}
                </div>
              ) : null}

              {onToggleFavorite ? (
                <button
                  className={[
                    "absolute top-2 right-2 w-8 h-8 bg-gray-900 bg-opacity-70 rounded-full flex items-center justify-center hover:bg-opacity-90 transition-all",
                    isFav ? "" : "opacity-0 group-hover:opacity-100"
                  ].join(" ")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(b, !isFav);
                  }}
                  title={isFav ? "Unfavorite" : "Favorite"}
                >
                  <i
                    className={[
                      isFav ? "fas fa-heart text-red-500" : "far fa-heart text-white",
                      "text-sm"
                    ].join(" ")}
                  ></i>
                </button>
              ) : null}
            </div>

            <h3 className="font-semibold text-sm mb-1 whitespace-normal break-words">
              {b.metadata?.title ?? b.displayName}
            </h3>

            {b.metadata?.authors?.length ? (
              <p className="text-gray-400 text-xs mb-1">{b.metadata.authors.join(", ")}</p>
            ) : null}

            {subtitle ? <div className="text-gray-500 text-xs">{subtitle(b)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}


