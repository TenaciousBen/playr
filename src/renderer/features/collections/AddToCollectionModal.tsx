import React, { useEffect, useMemo, useState } from "react";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { Collection } from "@/src/shared/models/collection";
import { toFileUrl } from "@/src/renderer/shared/toFileUrl";
import appIcon from "@/assets/icon.png";

export function AddToCollectionModal({
  open,
  book,
  onClose
}: {
  open: boolean;
  book: Audiobook | null;
  onClose: () => void;
}) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const list = await window.audioplayer.collections.list();
        if (!alive) return;
        setCollections(list);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const title = useMemo(() => book?.metadata?.title ?? book?.displayName ?? "Audiobook", [book]);

  const addTo = async (collectionId: string) => {
    if (!book) return;
    const current = collections.find((c) => c.id === collectionId);
    if (!current) return;
    if (current.audiobookIds.includes(book.id)) {
      onClose();
      return;
    }
    const nextIds = [...current.audiobookIds, book.id];
    await window.audioplayer.collections.setBooks(collectionId, nextIds);
    window.dispatchEvent(new Event("audioplayer:collections-changed"));
    onClose();
  };

  const createAndAdd = async () => {
    if (!book) return;
    const name = newName.trim();
    if (!name) return;
    const created = await window.audioplayer.collections.create(name);
    await window.audioplayer.collections.setBooks(created.id, [book.id]);
    window.dispatchEvent(new Event("audioplayer:collections-changed"));
    onClose();
  };

  if (!open || !book) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[160]" onClick={onClose}></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-[680px] max-h-[80vh] overflow-y-auto z-[165]">
        <div className="flex items-start justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
          <div className="flex items-start space-x-5">
            {book.metadata?.coverImagePath ? (
              <img className="w-20 h-28 object-cover rounded-lg shadow-lg" src={toFileUrl(book.metadata.coverImagePath)} alt="cover" />
            ) : (
              <div className="w-20 h-28 rounded-lg bg-gray-700 flex items-center justify-center">
                <img src={appIcon} alt="Playr" className="w-8 h-8 opacity-90" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-xl font-bold mb-1">Add to Collection</h2>
              <div className="text-sm text-gray-300 truncate">{title}</div>
              <div className="text-xs text-gray-400 mt-1">{(book.metadata?.authors ?? []).join(", ")}</div>
            </div>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors" onClick={onClose} title="Close">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-lg p-4 border border-gray-700 bg-gray-900/40">
            <div className="text-sm font-semibold text-gray-300 mb-3">Create new collection</div>
            <div className="flex items-center space-x-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New collection name…"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-60"
                disabled={!newName.trim()}
                onClick={() => void createAndAdd()}
              >
                <i className="fas fa-plus mr-2"></i>Create
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-300">Existing collections</div>
              <div className="text-xs text-gray-500">{loading ? "Loading…" : `${collections.length}`}</div>
            </div>
            <div className="divide-y divide-gray-800">
              {collections.length === 0 && !loading ? (
                <div className="p-4 text-sm text-gray-400">No collections yet.</div>
              ) : (
                collections.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors flex items-center justify-between"
                    onClick={() => void addTo(c.id)}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-layer-group text-white text-xs"></i>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.audiobookIds.length} audiobook(s)</div>
                      </div>
                    </div>
                    <i className="fas fa-plus text-gray-400 text-xs"></i>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


