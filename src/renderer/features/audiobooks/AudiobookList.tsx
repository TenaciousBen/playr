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

function formatDuration(seconds?: number) {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function AudiobookList({
  books,
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
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-750 border-b border-gray-700 text-sm font-semibold text-gray-400">
        <div className="col-span-1 text-center">Play</div>
        <div className="col-span-4">Title</div>
        <div className="col-span-3">Author</div>
        <div className="col-span-2">Duration</div>
        <div className="col-span-1 text-center">Progress</div>
        <div className="col-span-1 text-center">Favorite</div>
      </div>

      {books.map((b) => {
        const isFav = !!b.isFavorite;
        const isNowPlaying = state.nowPlaying?.book?.id === b.id;
        const isSelected = !!selectedIds?.has(b.id);
        const seconds = isNowPlaying ? state.currentTime : playbackById?.[b.id]?.secondsIntoChapter ?? 0;
        const dur = (isNowPlaying && state.duration > 0 ? state.duration : 0) || b.durationSeconds || 0;
        const pct = dur > 0 ? Math.max(0, Math.min(1, seconds / dur)) : 0;
        const pctLabel = `${Math.round(pct * 100)}%`;
        const pctClass = pct >= 0.995 ? "bg-green-600" : pct > 0 ? "bg-blue-600" : "bg-gray-600";

        return (
          <div
            key={b.id}
            className="audiobook-list-item group grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer items-center"
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
            <div className="col-span-1 text-center">
              <button
                className="text-blue-500 hover:text-blue-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(b);
                }}
                title="Play"
              >
                <i className="fas fa-play-circle text-xl"></i>
              </button>
            </div>
            <div className="col-span-4 flex items-center space-x-3">
              <div className="relative">
                {b.metadata?.coverImagePath ? (
                  <img className="w-12 h-12 object-cover rounded" src={toFileUrl(b.metadata.coverImagePath)} alt="cover" />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center">
                    <i className="fas fa-book text-gray-300"></i>
                  </div>
                )}
                {isSelected ? (
                  <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                    <i className="fas fa-check text-white text-xs"></i>
                  </div>
                ) : null}
              </div>
              <span className="font-medium">{b.metadata?.title ?? b.displayName}</span>
            </div>
            <div className="col-span-3 text-gray-400">{b.metadata?.authors?.[0] ?? ""}</div>
            <div className="col-span-2 text-gray-400">{formatDuration(dur || b.durationSeconds)}</div>
            <div className="col-span-1 text-center">
              <span className={`inline-block ${pctClass} text-xs px-2 py-1 rounded`}>{pctLabel}</span>
            </div>
            <div className="col-span-1 text-center">
              {onToggleFavorite ? (
                <button
                  className={[
                    "transition-colors",
                    isFav ? "text-red-500 hover:text-red-400" : "text-gray-500 hover:text-red-400",
                    isFav ? "" : "opacity-0 group-hover:opacity-100"
                  ].join(" ")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(b, !isFav);
                  }}
                  title={isFav ? "Unfavorite" : "Favorite"}
                >
                  <i className={isFav ? "fas fa-heart" : "far fa-heart"}></i>
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}


