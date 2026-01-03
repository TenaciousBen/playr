import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/src/renderer/features/player/PlayerContext";
import { toFileUrl } from "@/src/renderer/shared/toFileUrl";
import appIcon from "@/assets/icon.ico";

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function PlayerFooter() {
  const { state, actions } = usePlayer();
  const navigate = useNavigate();
  const book = state.nowPlaying?.book ?? null;
  const chapterIndex = state.nowPlaying?.chapterIndex ?? 0;
  const hasNextChapter = !!book && chapterIndex < book.chapters.length - 1;
  const hasNextInQueue = !!state.queue && state.queue.index < state.queue.audiobookIds.length - 1;
  const hasNext = hasNextChapter || hasNextInQueue;
  const isFav = !!book?.isFavorite;
  const isMuted = !!state.isMuted;
  const volumePct = Math.round((state.volume ?? 0) * 100);

  const progressPct = useMemo(() => {
    if (!state.duration || state.duration <= 0) return 0;
    return Math.max(0, Math.min(1, state.currentTime / state.duration));
  }, [state.currentTime, state.duration]);

  const chapterMarkers = useMemo(() => {
    if (!book) return [];
    if (!state.duration || state.duration <= 0) return [];
    const chapters = book.chapters ?? [];
    if (chapters.length <= 1) return [];
    const fp = chapters[0]?.filePath;
    const embedded =
      !!fp && chapters.every((c) => c.filePath === fp) && chapters.some((c) => (c.startSeconds ?? 0) > 0);
    if (!embedded) return [];

    return chapters
      .map((c) => c.startSeconds ?? 0)
      .filter((s) => typeof s === "number" && Number.isFinite(s) && s > 0)
      .map((s) => Math.max(0, Math.min(1, s / state.duration)))
      .filter((pct) => pct > 0.001 && pct < 0.999);
  }, [book, state.duration]);

  const primaryAuthor = book?.metadata?.authors?.[0] ?? "";

  return (
    <footer className="bg-gray-800 border-t border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Currently Playing Info */}
        <div className="flex items-center space-x-4 w-1/3">
          <button
            className="flex-shrink-0"
            title={book ? "Open audiobook" : ""}
            disabled={!book}
            onClick={() => {
              if (!book) return;
              navigate(`/book/${encodeURIComponent(book.id)}`);
            }}
          >
            {book?.metadata?.coverImagePath ? (
              <img
                className="w-12 h-12 object-cover rounded"
                src={toFileUrl(book.metadata.coverImagePath)}
                alt="cover"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center">
                <img src={appIcon} alt="Playr" className="w-7 h-7 opacity-90" />
              </div>
            )}
          </button>
          <div className="flex-1">
            {state.queue ? (
              <div className="flex items-center space-x-2 mb-1">
                <div className="bg-purple-600 px-2 py-0.5 rounded text-xs font-medium">Queue</div>
                <span className="text-xs text-gray-400">{state.queue.collectionName}</span>
              </div>
            ) : null}
            <button
              className="text-sm font-medium text-left hover:underline disabled:opacity-60"
              disabled={!book}
              title={book ? "Open audiobook" : ""}
              onClick={() => {
                if (!book) return;
                navigate(`/book/${encodeURIComponent(book.id)}`);
              }}
            >
              {book ? (book.metadata?.title ?? book.displayName) : "—"}
            </button>
            <p className="text-xs text-gray-400">
              {book
                ? state.queue
                  ? (
                      <>
                        {primaryAuthor ? (
                          <button
                            className="hover:underline"
                            onClick={() => navigate(`/author/${encodeURIComponent(primaryAuthor)}`)}
                            title="Open author"
                          >
                            {primaryAuthor}
                          </button>
                        ) : null}
                        {primaryAuthor ? " · " : null}
                        {`Book ${state.queue.index + 1} of ${state.queue.audiobookIds.length}`}
                      </>
                    )
                  : (
                      <>
                        {primaryAuthor ? (
                          <button
                            className="hover:underline"
                            onClick={() => navigate(`/author/${encodeURIComponent(primaryAuthor)}`)}
                            title="Open author"
                          >
                            {primaryAuthor}
                          </button>
                        ) : null}
                        {primaryAuthor ? " • " : null}
                        {`Chapter ${chapterIndex + 1}`}
                      </>
                    )
                : "Not playing"}
            </p>
          </div>
        </div>

        {/* Media Controls */}
        <div className="flex flex-col items-center w-1/3">
          <div className="flex items-center space-x-4 mb-2">
            <button
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              title="Previous chapter"
              onClick={() => void actions.prevChapter()}
              disabled={!book}
            >
              <i className="fas fa-step-backward"></i>
            </button>
            <button
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              title="Back 10 seconds"
              onClick={() => actions.skipBy(-10)}
              disabled={!book}
            >
              <i className="fas fa-backward text-lg"></i>
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-60"
              title="Play/Pause"
              onClick={() => void actions.togglePlayPause()}
              disabled={!book}
            >
              <i className={`fas ${state.isPlaying ? "fa-pause" : "fa-play"}`}></i>
            </button>
            <button
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              title="Forward 10 seconds"
              onClick={() => actions.skipBy(10)}
              disabled={!book}
            >
              <i className="fas fa-forward text-lg"></i>
            </button>
            <button
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              title="Next chapter"
              onClick={() => void actions.nextChapter()}
              disabled={!hasNext}
            >
              <i className="fas fa-step-forward"></i>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center space-x-3 w-full max-w-md">
            <span className="text-xs text-gray-400">{formatClock(state.currentTime)}</span>
            <div
              className="flex-1 bg-gray-600 h-1 rounded-full cursor-pointer relative"
              onClick={(e) => {
                if (!state.duration || state.duration <= 0) return;
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                actions.seek(pct * state.duration);
              }}
              title="Seek"
            >
              {/* Chapter markers (embedded-chapters books only) */}
              <div className="absolute inset-0 pointer-events-none">
                {chapterMarkers.map((pct, idx) => (
                  <div
                    key={idx}
                    className="absolute top-[-3px] w-[2px] h-[10px] bg-white/35 rounded"
                    style={{ left: `${pct * 100}%`, transform: "translateX(-1px)" }}
                  ></div>
                ))}
              </div>
              <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${progressPct * 100}%` }}></div>
            </div>
            <span className="text-xs text-gray-400">{formatClock(state.duration)}</span>
          </div>
        </div>

        {/* Additional Controls */}
        <div className="flex items-center space-x-4 w-1/3 justify-end">
          <div className="flex items-center space-x-2">
            <i className="fas fa-tachometer-alt text-gray-400 text-sm"></i>
            <select
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white disabled:opacity-40"
              value={String(state.rate)}
              onChange={(e) => actions.setRate(Number(e.target.value))}
              disabled={!book}
            >
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
          <button
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-40"
            title={isFav ? "Unfavorite" : "Favorite"}
            disabled={!book}
            onClick={() => {
              if (!book) return;
              void (async () => {
                await window.audioplayer.library.setFavorite(book.id, !isFav);
                window.dispatchEvent(new Event("audioplayer:library-changed"));
              })();
            }}
          >
            <i className={`${isFav ? "fas fa-heart text-red-500" : "far fa-heart"}`}></i>
          </button>
          <button
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-40"
            title={isMuted ? "Unmute" : "Mute"}
            disabled={!book}
            onClick={() => actions.toggleMute()}
          >
            <i className={`fas ${isMuted ? "fa-volume-xmark" : "fa-volume-up"}`}></i>
          </button>
          <input
            className="w-24 accent-white"
            type="range"
            min={0}
            max={100}
            value={volumePct}
            onChange={(e) => actions.setVolume(Number(e.target.value) / 100)}
            disabled={!book}
            title="Volume"
          />
        </div>
      </div>
    </footer>
  );
}


