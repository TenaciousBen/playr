import React from "react";
import type { Audiobook } from "@/src/shared/models/audiobook";
import { toFileUrl } from "@/src/renderer/shared/toFileUrl";
import { usePlayer } from "@/src/renderer/features/player/PlayerContext";

const INTERNAL_DND_BOOK_TYPE = "application/x-playr-audiobook-id";

export function AudiobookGrid({
  books,
  subtitle,
  onPlay,
  onOpenDetails,
  onContextMenu,
  onToggleFavorite,
  playbackById
}: {
  books: Audiobook[];
  subtitle?: (b: Audiobook) => React.ReactNode;
  onPlay: (b: Audiobook) => void;
  onOpenDetails?: (b: Audiobook) => void;
  onContextMenu?: (e: React.MouseEvent, b: Audiobook) => void;
  onToggleFavorite?: (b: Audiobook, next: boolean) => void;
  playbackById?: Record<string, { secondsIntoChapter?: number } | null>;
}) {
  const { state } = usePlayer();
  return (
    <div className="grid grid-cols-5 gap-6">
      {books.map((b) => {
        const isFav = !!b.isFavorite;
        const isNowPlaying = state.nowPlaying?.book?.id === b.id;
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
              e.dataTransfer.effectAllowed = "copy";
              e.dataTransfer.setData(INTERNAL_DND_BOOK_TYPE, b.id);
              e.dataTransfer.setData("text/plain", b.id);
            }}
            onContextMenu={(e) => onContextMenu?.(e, b)}
            onClick={() => onPlay(b)}
            onDoubleClick={() => onOpenDetails?.(b)}
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

              {showPct ? (
                <div
                  className={[
                    "absolute bottom-2 left-2 text-xs px-2 py-1 rounded",
                    isDone ? "bg-green-600" : "bg-blue-600"
                  ].join(" ")}
                  title={isDone ? "Completed" : `${Math.round(pct * 100)}%`}
                >
                  {isDone ? "Done" : `${Math.round(pct * 100)}%`}
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


