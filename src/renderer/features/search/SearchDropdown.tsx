import React, { useEffect, useMemo, useRef } from "react";
import type { Audiobook } from "@/src/shared/models/audiobook";
import { toFileUrl } from "@/src/renderer/shared/toFileUrl";

export type AuthorHit = {
  name: string;
  count: number;
};

export function SearchDropdown({
  open,
  query,
  matchCount,
  collectionHits,
  authorHits,
  titleHits,
  onClose,
  onClearSearch,
  onBrowseLibrary,
  onViewMatches,
  onSelectCollection,
  onSelectAuthor,
  onSelectTitle,
  onPlayTitle
}: {
  open: boolean;
  query: string;
  matchCount: number;
  collectionHits: Array<{ id: string; name: string; count: number }>;
  authorHits: AuthorHit[];
  titleHits: Audiobook[];
  onClose: () => void;
  onClearSearch: () => void;
  onBrowseLibrary: () => void;
  onViewMatches: () => void;
  onSelectCollection: (collectionId: string) => void;
  onSelectAuthor: (authorName: string) => void;
  onSelectTitle: (bookId: string) => void;
  onPlayTitle: (bookId: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && ref.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  const hasAny = matchCount > 0 || collectionHits.length > 0 || authorHits.length > 0 || titleHits.length > 0;

  const matchesSection = useMemo(() => {
    if (matchCount <= 0) return null;
    return (
      <div className="border-b border-gray-700">
        <div className="px-4 py-3 bg-gray-750">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Matches</h3>
            <span className="text-xs text-gray-500">{matchCount} audiobook(s)</span>
          </div>
        </div>
        <div className="py-2">
          <div
            className="px-4 py-3 hover:bg-gray-700 cursor-pointer transition-colors flex items-center space-x-3"
            onClick={onViewMatches}
          >
            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-search text-gray-200 text-sm"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">View matches for “{query}”</p>
              <p className="text-xs text-gray-400">Titles, authors, and file paths</p>
            </div>
            <i className="fas fa-chevron-right text-gray-500 text-xs"></i>
          </div>
        </div>
      </div>
    );
  }, [matchCount, onViewMatches, query]);

  const collectionsSection = useMemo(() => {
    if (collectionHits.length === 0) return null;
    return (
      <div className="border-b border-gray-700">
        <div className="px-4 py-3 bg-gray-750">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Collections</h3>
            <span className="text-xs text-gray-500">{collectionHits.length} matches</span>
          </div>
        </div>
        <div className="py-2">
          {collectionHits.map((c) => (
            <div
              key={c.id}
              className="px-4 py-3 hover:bg-gray-700 cursor-pointer transition-colors flex items-center space-x-3"
              onClick={() => onSelectCollection(c.id)}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-layer-group text-white text-sm"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{c.name}</p>
                <p className="text-xs text-gray-400">{c.count} audiobook(s)</p>
              </div>
              <i className="fas fa-chevron-right text-gray-500 text-xs"></i>
            </div>
          ))}
        </div>
      </div>
    );
  }, [collectionHits, onSelectCollection]);

  const authorsSection = useMemo(() => {
    if (authorHits.length === 0) return null;
    return (
      <div className="border-b border-gray-700">
        <div className="px-4 py-3 bg-gray-750">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Authors</h3>
            <span className="text-xs text-gray-500">{authorHits.length} matches</span>
          </div>
        </div>
        <div className="py-2">
          {authorHits.map((a, idx) => (
            <div
              key={a.name}
              className="px-4 py-3 hover:bg-gray-700 cursor-pointer transition-colors flex items-center space-x-3"
              onClick={() => onSelectAuthor(a.name)}
            >
              <div
                className={[
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  idx % 3 === 0
                    ? "bg-gradient-to-br from-blue-500 to-blue-700"
                    : idx % 3 === 1
                      ? "bg-gradient-to-br from-purple-500 to-purple-700"
                      : "bg-gradient-to-br from-green-500 to-green-700"
                ].join(" ")}
              >
                <i className="fas fa-user text-white text-sm"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{a.name}</p>
                <p className="text-xs text-gray-400">{a.count} audiobook(s)</p>
              </div>
              <i className="fas fa-chevron-right text-gray-500 text-xs"></i>
            </div>
          ))}
        </div>
      </div>
    );
  }, [authorHits, onSelectAuthor]);

  const titlesSection = useMemo(() => {
    if (titleHits.length === 0) return null;
    return (
      <div>
        <div className="px-4 py-3 bg-gray-750">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Titles</h3>
            <span className="text-xs text-gray-500">{titleHits.length} matches</span>
          </div>
        </div>

        <div className="py-2">
          {titleHits.map((b, idx) => (
            <div
              key={b.id}
              className="px-4 py-3 hover:bg-gray-700 cursor-pointer transition-colors flex items-center space-x-3"
              onClick={() => onSelectTitle(b.id)}
            >
              {b.metadata?.coverImagePath ? (
                <img
                  className="w-12 h-16 object-cover rounded shadow-md flex-shrink-0"
                  src={toFileUrl(b.metadata.coverImagePath)}
                  alt="cover"
                />
              ) : (
                <div className="w-12 h-16 bg-gray-700 rounded shadow-md flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-book text-gray-300 text-sm"></i>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white whitespace-normal break-words">
                  {b.metadata?.title ?? b.displayName}
                </p>
                <p className="text-xs text-gray-400">{b.metadata?.authors?.join(", ") ?? ""}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-gray-500">{b.chapters.length} file(s)</span>
                  <span className="text-xs text-gray-600">•</span>
                  <span className="text-xs text-gray-500">Not started</span>
                </div>
              </div>

              <button
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                  idx === 0 ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-700 hover:bg-gray-600"
                ].join(" ")}
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayTitle(b.id);
                }}
                title="Play"
              >
                <i className="fas fa-play text-white text-xs ml-0.5"></i>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }, [onPlayTitle, onSelectTitle, titleHits]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-h-[500px] overflow-y-auto z-50"
    >
      {hasAny ? (
        <>
          {matchesSection}
          {collectionsSection}
          {authorsSection}
          {titlesSection}
          <div className="px-4 py-3 bg-gray-750 border-t border-gray-700">
            <button
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center space-x-2"
              onClick={onViewMatches}
            >
              <span>View all matches</span>
              <i className="fas fa-arrow-right text-xs"></i>
            </button>
          </div>
        </>
      ) : (
        <div className="py-12 px-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center">
              <i className="fas fa-search text-gray-500 text-3xl"></i>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-white mb-2">No Results Found</h3>
          <p className="text-gray-400 text-sm mb-1">We couldn't find any audiobooks matching</p>
          <p className="text-blue-400 font-medium text-sm mb-4">"{query}"</p>

          {/* Intentionally omitting the “Search Tips” section per requirements */}
          <div className="mt-6 flex items-center justify-center space-x-3">
            <button
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center space-x-2"
              onClick={onClearSearch}
            >
              <i className="fas fa-redo text-xs"></i>
              <span>Clear Search</span>
            </button>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center space-x-2"
              onClick={onBrowseLibrary}
            >
              <i className="fas fa-book text-xs"></i>
              <span>Browse Library</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


