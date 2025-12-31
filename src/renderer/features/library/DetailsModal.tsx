import React, { useEffect } from "react";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";

function toFileUrl(p: string) {
  const norm = p.replace(/\\/g, "/");
  return `file:///${encodeURI(norm)}`;
}

function formatSeconds(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function DetailsModal({
  open,
  book,
  playback,
  onClose
}: {
  open: boolean;
  book: Audiobook | null;
  playback: PlaybackState | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !book) return null;

  const pos = playback?.position;
  const chapter = typeof pos?.chapterIndex === "number" ? book.chapters[pos.chapterIndex] : undefined;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[110]" onClick={onClose}></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-[720px] max-h-[80vh] overflow-y-auto z-[115]">
        <div className="flex items-start justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
          <div className="flex items-start space-x-5">
            {book.metadata?.coverImagePath ? (
              <img
                className="w-32 h-44 object-cover rounded-lg shadow-lg"
                src={toFileUrl(book.metadata.coverImagePath)}
                alt="cover"
              />
            ) : (
              <div className="w-32 h-44 rounded-lg bg-gray-700 flex items-center justify-center">
                <i className="fas fa-book text-gray-300 text-3xl"></i>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold mb-2">{book.metadata?.title ?? book.displayName}</h2>
              <p className="text-gray-400 text-sm mb-1">{book.metadata?.subtitle ?? ""}</p>
              <p className="text-blue-400 text-sm mb-3">{book.metadata?.authors?.join(", ") ?? ""}</p>
              <div className="flex items-center space-x-3">
                <span className="bg-blue-600 text-xs px-3 py-1 rounded-full">
                  {pos?.secondsIntoChapter ? `Paused • ${playback?.rate ?? 1}x` : "Not started"}
                </span>
                <span className="text-gray-400 text-xs">{book.chapters.length} file(s)</span>
              </div>
            </div>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors" onClick={onClose} title="Close">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-lg p-4 border border-gray-700 bg-gray-900/40">
            <div className="flex items-start space-x-3">
              <i className="fas fa-folder-open text-blue-400 text-lg mt-1"></i>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">File Location</h3>
                <p className="text-xs text-gray-400 font-mono bg-gray-900 p-3 rounded border border-gray-700 break-all">
                  {book.chapters[0]?.filePath ?? book.rootFolderPath}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg p-4 border border-gray-700 bg-gray-900/40">
            <div className="flex items-start space-x-3">
              <i className="fas fa-bookmark text-green-400 text-lg mt-1"></i>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Last Played Position</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Chapter</p>
                    <p className="text-lg font-semibold text-white">
                      {chapter ? `Chapter ${chapter.index + 1}` : "—"}
                    </p>
                    <p className="text-xs text-gray-400">{chapter?.title ?? ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Position in Chapter</p>
                    <p className="text-lg font-semibold text-white">
                      {pos?.secondsIntoChapter ? formatSeconds(pos.secondsIntoChapter) : "—"}
                    </p>
                    <p className="text-xs text-gray-400"></p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg p-4 border border-gray-700 bg-gray-900/40">
            <div className="flex items-start space-x-3 mb-4">
              <i className="fas fa-info-circle text-purple-400 text-lg mt-1"></i>
              <h3 className="text-sm font-semibold text-gray-300">Audio Metadata</h3>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Title</p>
                  <p className="text-sm text-white">{book.metadata?.title ?? ""}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Subtitle</p>
                  <p className="text-sm text-white">{book.metadata?.subtitle ?? ""}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Author(s)</p>
                <p className="text-sm text-white">{book.metadata?.authors?.join(", ") ?? ""}</p>
              </div>

              <div className="border-t border-gray-700 pt-3 mt-3">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Chapters / Files</p>
                  <div className="text-xs text-gray-400 font-mono bg-gray-900 p-3 rounded border border-gray-700 space-y-1">
                    {book.chapters.map((ch) => (
                      <div key={ch.index}>
                        {ch.index + 1}. {ch.title} — {ch.filePath}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              Close
            </button>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm flex items-center space-x-2"
              title="Not wired yet"
            >
              <i className="fas fa-play text-xs"></i>
              <span>Continue Playing</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


