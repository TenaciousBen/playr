import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Audiobook } from "@/src/shared/models/audiobook";
import { usePlayer } from "@/src/renderer/features/player/PlayerContext";
import { toFileUrl } from "@/src/renderer/shared/toFileUrl";

function formatHoursMinutes(totalSeconds?: number) {
  const s = Math.max(0, Math.floor(totalSeconds ?? 0));
  const totalMinutes = Math.floor(s / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatMinutesSeconds(totalSeconds?: number) {
  const s = Math.max(0, Math.floor(totalSeconds ?? 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function BookFeature() {
  const { bookId } = useParams();
  const id = decodeURIComponent(bookId ?? "");
  const navigate = useNavigate();
  const player = usePlayer();
  const [book, setBook] = useState<Audiobook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const lib = await window.audioplayer.library.list();
        const found = lib.find((b) => b.id === id) ?? null;
        if (!alive) return;
        setBook(found);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const onChanged = () => {
      void (async () => {
        const lib = await window.audioplayer.library.list();
        setBook(lib.find((b) => b.id === id) ?? null);
      })();
    };
    window.addEventListener("audioplayer:library-changed", onChanged);
    return () => window.removeEventListener("audioplayer:library-changed", onChanged);
  }, [id]);

  const title = useMemo(() => book?.metadata?.title ?? book?.displayName ?? "Audiobook", [book]);
  const subtitle = useMemo(() => book?.metadata?.subtitle ?? "", [book]);
  const authors = useMemo(() => book?.metadata?.authors ?? [], [book]);
  const primaryAuthor = authors[0] ?? "";

  const totalDurationSeconds = useMemo(() => {
    if (!book) return 0;
    if (typeof book.durationSeconds === "number" && Number.isFinite(book.durationSeconds) && book.durationSeconds > 0) {
      return book.durationSeconds;
    }
    const sum = (book.chapters ?? []).reduce((acc, ch) => acc + (ch.durationSeconds ?? 0), 0);
    return sum;
  }, [book]);

  const nowPlaying = player.state.nowPlaying;

  if (loading) {
    return (
      <section className="flex-1 p-6 overflow-y-auto">
        <div className="text-gray-400">Loading…</div>
      </section>
    );
  }

  if (!book) {
    return (
      <section className="flex-1 p-6 overflow-y-auto">
        <div className="border border-gray-700 bg-gray-800/40 rounded-xl p-8 text-center">
          <div className="text-xl font-semibold">Audiobook not found</div>
          <div className="text-gray-400 mt-2">It may have been removed from your library.</div>
          <div className="mt-6">
            <button
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              onClick={() => navigate("/library")}
            >
              Back to Library
            </button>
          </div>
        </div>
      </section>
    );
  }

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
        {primaryAuthor ? (
          <>
            <i className="fas fa-chevron-right text-gray-500 text-xs"></i>
            <button
              className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
              onClick={() => navigate(`/author/${encodeURIComponent(primaryAuthor)}`)}
            >
              {primaryAuthor}
            </button>
          </>
        ) : null}
        <i className="fas fa-chevron-right text-gray-500 text-xs"></i>
        <span className="text-gray-300 text-sm font-medium">{title}</span>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
        <div className="flex items-start space-x-6">
          <div className="w-48 h-64 flex-shrink-0">
            {book.metadata?.coverImagePath ? (
              <img
                className="w-full h-full object-cover rounded-lg shadow-2xl"
                src={toFileUrl(book.metadata.coverImagePath)}
                alt="cover"
              />
            ) : (
              <div className="w-full h-full object-cover rounded-lg shadow-2xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                <i className="fas fa-book text-gray-400 text-4xl"></i>
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-3xl font-bold mb-2">{title}</h2>
                {subtitle ? <p className="text-lg text-gray-400 mb-1">{subtitle}</p> : null}
                {primaryAuthor ? (
                  <button
                    className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
                    onClick={() => navigate(`/author/${encodeURIComponent(primaryAuthor)}`)}
                  >
                    {primaryAuthor}
                  </button>
                ) : null}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-60"
                  disabled={book.chapters.length === 0}
                  onClick={() => void player.actions.playBookFromStart(book)}
                  title="Play from start"
                >
                  <i className="fas fa-play"></i>
                  <span className="font-semibold">Play</span>
                </button>
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-lg transition-colors"
                  title={book.isFavorite ? "Unfavorite" : "Favorite"}
                  onClick={(e) => {
                    e.preventDefault();
                    void (async () => {
                      await window.audioplayer.library.setFavorite(book.id, !book.isFavorite);
                      window.dispatchEvent(new Event("audioplayer:library-changed"));
                    })();
                  }}
                >
                  <i className={book.isFavorite ? "fas fa-heart text-red-500" : "far fa-heart"}></i>
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-6 mb-2 text-sm">
              <div className="flex items-center space-x-2">
                <i className="fas fa-clock text-blue-400"></i>
                <span className="text-gray-300">{formatHoursMinutes(totalDurationSeconds)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <i className="fas fa-list-ol text-blue-400"></i>
                <span className="text-gray-300">{book.chapters.length} chapters</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold">Chapters</h3>
          <p className="text-gray-400 text-sm mt-1">
            {book.chapters.length} chapters • {formatHoursMinutes(totalDurationSeconds)} total
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {book.chapters.map((ch) => {
          const isNowPlaying = nowPlaying?.book.id === book.id && nowPlaying.chapterIndex === ch.index;
          return (
            <div
              key={ch.index}
              className={[
                "group bg-gray-800 rounded-lg p-4 border transition-colors",
                isNowPlaying ? "border-2 border-blue-500" : "border-gray-700 hover:border-blue-500"
              ].join(" ")}
            >
              <div className="flex items-center space-x-4">
                <button
                  className={[
                    "flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-colors",
                    isNowPlaying ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-700 text-gray-300 hover:bg-gray-600",
                    "opacity-0 group-hover:opacity-100"
                  ].join(" ")}
                  title="Play from this chapter"
                  onClick={() => void player.actions.playBookFromChapter(book, ch.index)}
                >
                  <i className="fas fa-play"></i>
                </button>
                <div className="flex items-center justify-center w-10 h-10 bg-gray-700 rounded-lg text-gray-400 font-semibold flex-shrink-0">
                  {ch.index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm mb-1">{ch.title}</h4>
                  <p className="text-xs text-gray-400">
                    {typeof ch.durationSeconds === "number" && Number.isFinite(ch.durationSeconds) && ch.durationSeconds > 0
                      ? formatMinutesSeconds(ch.durationSeconds)
                      : ""}
                  </p>
                </div>
                {isNowPlaying ? (
                  <div className="flex items-center space-x-3">
                    <div className="text-xs text-blue-400 font-semibold">Now Playing</div>
                    <i className="fas fa-volume-up text-blue-400"></i>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


