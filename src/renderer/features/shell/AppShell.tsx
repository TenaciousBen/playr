import React, { useCallback, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PlayerProvider } from "@/src/renderer/features/player/PlayerContext";
import { PlayerFooter } from "@/src/renderer/features/player/PlayerFooter";
import { DropOverlay } from "@/src/renderer/features/shell/DropOverlay";
import { SearchDropdown } from "@/src/renderer/features/search/SearchDropdown";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { Collection } from "@/src/shared/models/collection";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/src/shared/models/userSettings";
import { ConfirmModal } from "@/src/renderer/shared/ConfirmModal";
import appIcon from "@/assets/icon.png";

const INTERNAL_DND_BOOK_TYPE = "application/x-playr-audiobook-id";

function NavItem({
  to,
  icon,
  children
}: {
  to: string;
  icon: string;
  children: React.ReactNode;
}) {
  const className = useCallback(
    ({ isActive }: { isActive: boolean }) =>
      [
        "flex items-center space-x-3 p-2 rounded-lg transition-colors",
        isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
      ].join(" "),
    []
  );

  return (
    <NavLink to={to} className={className}>
      <i className={`fas ${icon}`}></i>
      <span>{children}</span>
    </NavLink>
  );
}

export function AppShell() {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collectionHits, setCollectionHits] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [authorHits, setAuthorHits] = useState<Array<{ name: string; count: number }>>([]);
  const [titleHits, setTitleHits] = useState<Audiobook[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [addingCollection, setAddingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [collectionMenuPos, setCollectionMenuPos] = useState({ x: 0, y: 0 });
  const [collectionMenuId, setCollectionMenuId] = useState<string | null>(null);
  const [confirmRemoveCollectionOpen, setConfirmRemoveCollectionOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [ingest, setIngest] = useState<{
    active: boolean;
    totalFiles?: number;
    countDone: number;
    lastName?: string;
  }>({ active: false, totalFiles: undefined, countDone: 0, lastName: undefined });
  const location = useLocation();
  const navigate = useNavigate();

  const showFooter = useMemo(() => location.pathname !== "/settings", [location.pathname]);

  React.useEffect(() => {
    let lastLibraryRefresh = 0;
    const onProgress = (e: Event) => {
      const detail = (e as CustomEvent).detail as any;
      if (!detail || typeof detail.type !== "string") return;
      if (detail.type === "started") {
        setIngest({ active: true, totalFiles: undefined, countDone: 0, lastName: undefined });
      } else if (detail.type === "scanned") {
        setIngest((s) => ({ ...s, active: true, totalFiles: detail.totalFiles, countDone: s.countDone }));
      } else if (detail.type === "book") {
        setIngest((s) => ({
          ...s,
          active: true,
          totalFiles: detail.totalFiles ?? s.totalFiles,
          countDone: detail.countDone ?? s.countDone,
          lastName: detail.displayName ?? s.lastName
        }));
        const now = Date.now();
        if (now - lastLibraryRefresh > 500) {
          lastLibraryRefresh = now;
          window.dispatchEvent(new Event("audioplayer:library-changed"));
        }
      } else if (detail.type === "saved") {
        // Nudge views to refresh.
        window.dispatchEvent(new Event("audioplayer:library-changed"));
      } else if (detail.type === "done") {
        window.dispatchEvent(new Event("audioplayer:library-changed"));
        setIngest((s) => ({ ...s, active: false }));
      } else if (detail.type === "error") {
        setIngest((s) => ({ ...s, active: false }));
      }
    };
    window.addEventListener("audioplayer:ingest-progress", onProgress);
    return () => window.removeEventListener("audioplayer:ingest-progress", onProgress);
  }, []);

  const onDroppedFiles = useCallback(
    async (files: File[]) => {
      await window.audioplayer.library.addDroppedFiles(files);
      window.dispatchEvent(new Event("audioplayer:library-changed"));
      navigate("/library");
    },
    [navigate]
  );

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const q = search.trim();
      if (!q) {
        if (!alive) return;
        setCollectionHits([]);
        setAuthorHits([]);
        setTitleHits([]);
        return;
      }

      // 1) Author matches: compute from full library (match author names).
      let lib: Audiobook[] = [];
      try {
        lib = await window.audioplayer.library.list();
      } catch {
        lib = [];
      }
      if (!alive) return;

      const qq = q.toLowerCase();
      const counts = new Map<string, number>();
      for (const b of lib) {
        for (const a of (b.metadata?.authors ?? []) as any[]) {
          const name = String(a ?? "");
          if (name.toLowerCase().includes(qq)) {
            counts.set(name, (counts.get(name) ?? 0) + 1);
          }
        }
      }
      const authors = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      // 2) Title matches: ask main process (title/subtitle/authors) and then filter to titles-only.
      let results: Audiobook[] = [];
      try {
        results = await window.audioplayer.library.search(q);
      } catch {
        results = [];
      }
      if (!alive) return;

      const titlesOnly = results.filter((b) => {
        const title = String(b.metadata?.title ?? b.displayName ?? "").toLowerCase();
        const subtitle = String(b.metadata?.subtitle ?? "").toLowerCase();
        return title.includes(qq) || subtitle.includes(qq);
      });

      // 3) Collection matches: compute from collections list
      let colls: Collection[] = [];
      try {
        colls = await window.audioplayer.collections.list();
      } catch {
        colls = [];
      }
      if (!alive) return;
      const collectionMatches = colls
        .filter((c) => c.name.toLowerCase().includes(qq))
        .map((c) => ({ id: c.id, name: c.name, count: c.audiobookIds.length }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setCollectionHits(collectionMatches);
      setAuthorHits(authors);
      setTitleHits(titlesOnly);
    })();

    return () => {
      alive = false;
    };
  }, [search]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await window.audioplayer.collections.list();
        if (!alive) return;
        setCollections(list);
      } finally {
        if (alive) setCollectionsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    const onChanged = () => {
      void (async () => {
        const list = await window.audioplayer.collections.list();
        setCollections(list);
      })();
    };
    window.addEventListener("audioplayer:collections-changed", onChanged);
    return () => window.removeEventListener("audioplayer:collections-changed", onChanged);
  }, []);

  React.useEffect(() => {
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

  React.useEffect(() => {
    const onChanged = () => {
      void (async () => {
        const s = await window.audioplayer.settings.get();
        setSettings(s);
      })();
    };
    window.addEventListener("audioplayer:settings-changed", onChanged);
    return () => window.removeEventListener("audioplayer:settings-changed", onChanged);
  }, []);

  React.useEffect(() => {
    const clear = () => setDragOverCollectionId(null);
    document.addEventListener("dragend", clear);
    document.addEventListener("drop", clear);
    return () => {
      document.removeEventListener("dragend", clear);
      document.removeEventListener("drop", clear);
    };
  }, []);

  const addBookToCollection = useCallback(
    async (collectionId: string, audiobookId: string) => {
      const current = collections.find((c) => c.id === collectionId);
      if (!current) return;
      if (current.audiobookIds.includes(audiobookId)) return;
      const nextIds = [...current.audiobookIds, audiobookId];
      await window.audioplayer.collections.setBooks(collectionId, nextIds);
      const list = await window.audioplayer.collections.list();
      setCollections(list);
      window.dispatchEvent(new Event("audioplayer:collections-changed"));
    },
    [collections]
  );

  const commitRenameCollection = useCallback(async (collectionId: string, nextName: string) => {
    const name = nextName.trim();
    if (!name) return;
    await window.audioplayer.collections.rename(collectionId, name);
    window.dispatchEvent(new Event("audioplayer:collections-changed"));
    setRenamingCollectionId(null);
    setRenameValue("");
  }, []);

  const openCollectionMenu = useCallback((e: React.MouseEvent, collectionId: string) => {
    e.preventDefault();
    setCollectionMenuId(collectionId);
    setCollectionMenuPos({ x: e.clientX, y: e.clientY });
    setCollectionMenuOpen(true);
  }, []);

  React.useEffect(() => {
    if (!collectionMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("#collections-context-menu")) return;
      setCollectionMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCollectionMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [collectionMenuOpen]);

  return (
    <PlayerProvider>
      <div id="app-container" className="h-screen w-screen flex flex-col">
        <DropOverlay enabled={true} onDroppedFiles={onDroppedFiles} />

        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src={appIcon} alt="Playr" className="w-7 h-7" />
            <h1 className="text-xl font-semibold">Playr</h1>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-8 relative">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Search audiobooks, authors, titles..."
                onFocus={() => setSearchOpen(true)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 pl-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            </div>

            <SearchDropdown
              open={searchOpen && search.trim().length > 0}
              query={search.trim()}
              collectionHits={collectionHits}
              authorHits={authorHits}
              titleHits={titleHits}
              onClose={() => setSearchOpen(false)}
              onClearSearch={() => {
                setSearch("");
                setSearchOpen(false);
              }}
              onBrowseLibrary={() => {
                navigate("/library");
                setSearchOpen(false);
              }}
              onSelectCollection={(collectionId) => {
                navigate(`/collections/${encodeURIComponent(collectionId)}`);
                setSearchOpen(false);
              }}
              onSelectAuthor={(name) => {
                navigate(`/author/${encodeURIComponent(name)}`);
                setSearchOpen(false);
              }}
              onSelectTitle={(bookId) => {
                // Navigate to library (we don't have a separate details route yet)
                // and keep playback on user click in grid.
                navigate("/library");
                setSearchOpen(false);
              }}
              onPlayTitle={(bookId) => {
                window.dispatchEvent(
                  new CustomEvent("audioplayer:play-book", {
                    detail: { bookId }
                  })
                );
                navigate("/library");
                setSearchOpen(false);
              }}
            />
          </div>

          {/* View Options (not wired yet) */}
          <div className="flex items-center space-x-2">
            <button
              className={[
                "p-2 rounded-lg transition-colors",
                settings.viewMode === "grid" ? "bg-gray-700" : "hover:bg-gray-700"
              ].join(" ")}
              title="Grid view"
              onClick={() => {
                void (async () => {
                  const next: UserSettings = { ...settings, viewMode: "grid" };
                  setSettings(next);
                  await window.audioplayer.settings.set(next);
                  window.dispatchEvent(new Event("audioplayer:settings-changed"));
                })();
              }}
            >
              <i className={`fas fa-th-large ${settings.viewMode === "grid" ? "text-blue-500" : "text-gray-400"}`}></i>
            </button>
            <button
              className={[
                "p-2 rounded-lg transition-colors",
                settings.viewMode === "list" ? "bg-gray-700" : "hover:bg-gray-700"
              ].join(" ")}
              title="List view"
              onClick={() => {
                void (async () => {
                  const next: UserSettings = { ...settings, viewMode: "list" };
                  setSettings(next);
                  await window.audioplayer.settings.set(next);
                  window.dispatchEvent(new Event("audioplayer:settings-changed"));
                })();
              }}
            >
              <i className={`fas fa-list ${settings.viewMode === "list" ? "text-blue-500" : "text-gray-400"}`}></i>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
            <nav className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Library
              </div>
              <NavItem to="/library" icon="fa-book">
                All Audiobooks
              </NavItem>
              <NavItem to="/recent" icon="fa-clock">
                Recently Added
              </NavItem>
              <NavItem to="/reading" icon="fa-play-circle">
                Currently Reading
              </NavItem>
              <NavItem to="/favorites" icon="fa-heart">
                Favorites
              </NavItem>
            </nav>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Collections
                </div>
                <button
                  id="add-collection-btn"
                  className="text-blue-500 hover:text-blue-400 transition-colors"
                  title="Add collection"
                  onClick={() => {
                    setAddingCollection(true);
                    setNewCollectionName("");
                  }}
                >
                  <i className="fas fa-plus text-sm"></i>
                </button>
              </div>

              <div className="space-y-1">
                {addingCollection ? (
                  <div
                    id="new-collection-input"
                    className="flex items-center p-2 bg-gray-700 rounded-lg mb-2"
                  >
                    <input
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="New collection name..."
                      className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-400"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (!newCollectionName.trim()) return;
                          void (async () => {
                            const created = await window.audioplayer.collections.create(newCollectionName);
                            const list = await window.audioplayer.collections.list();
                            setCollections(list);
                            setAddingCollection(false);
                            setNewCollectionName("");
                            navigate(`/collections/${encodeURIComponent(created.id)}`);
                          })();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setAddingCollection(false);
                          setNewCollectionName("");
                        }
                      }}
                    />
                    <button
                      className="text-green-500 hover:text-green-400 transition-colors ml-2"
                      title="Create"
                      onClick={() => {
                        void (async () => {
                          const created = await window.audioplayer.collections.create(newCollectionName);
                          const list = await window.audioplayer.collections.list();
                          setCollections(list);
                          setAddingCollection(false);
                          setNewCollectionName("");
                          navigate(`/collections/${encodeURIComponent(created.id)}`);
                        })();
                      }}
                    >
                      <i className="fas fa-check text-sm"></i>
                    </button>
                    <button
                      className="text-red-500 hover:text-red-400 transition-colors ml-2"
                      title="Cancel"
                      onClick={() => {
                        setAddingCollection(false);
                        setNewCollectionName("");
                      }}
                    >
                      <i className="fas fa-times text-sm"></i>
                    </button>
                  </div>
                ) : null}

                {collectionsLoading ? (
                  <div className="p-2 text-gray-500 text-sm">Loading…</div>
                ) : collections.length === 0 ? (
                  <div className="p-2 text-gray-500 text-sm">No collections</div>
                ) : (
                  collections.map((c) => (
                    renamingCollectionId === c.id ? (
                      <div key={c.id} className="flex items-center p-2 bg-gray-700 rounded-lg mb-1">
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          placeholder="Collection name..."
                          className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-400"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void commitRenameCollection(c.id, renameValue);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setRenamingCollectionId(null);
                              setRenameValue("");
                            }
                          }}
                        />
                        <button
                          className="text-green-500 hover:text-green-400 transition-colors ml-2 disabled:opacity-60"
                          title="Save"
                          onClick={() => void commitRenameCollection(c.id, renameValue)}
                          disabled={!renameValue.trim()}
                        >
                          <i className="fas fa-check text-sm"></i>
                        </button>
                        <button
                          className="text-red-500 hover:text-red-400 transition-colors ml-2"
                          title="Cancel"
                          onClick={() => {
                            setRenamingCollectionId(null);
                            setRenameValue("");
                          }}
                        >
                          <i className="fas fa-times text-sm"></i>
                        </button>
                      </div>
                    ) : (
                      <div
                        key={c.id}
                        className={[
                          "flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer",
                          dragOverCollectionId === c.id ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
                        ].join(" ")}
                        onClick={() => navigate(`/collections/${encodeURIComponent(c.id)}`)}
                        onDoubleClick={() => {
                          setRenamingCollectionId(c.id);
                          setRenameValue(c.name);
                        }}
                        onContextMenu={(e) => openCollectionMenu(e, c.id)}
                        onDragEnter={(e) => {
                          const types = Array.from(e.dataTransfer?.types ?? []);
                          if (!types.includes(INTERNAL_DND_BOOK_TYPE)) return;
                          e.preventDefault();
                          setDragOverCollectionId(c.id);
                        }}
                        onDragOver={(e) => {
                          const types = Array.from(e.dataTransfer?.types ?? []);
                          if (!types.includes(INTERNAL_DND_BOOK_TYPE)) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                          setDragOverCollectionId(c.id);
                        }}
                        onDragLeave={() => {
                          setDragOverCollectionId((prev) => (prev === c.id ? null : prev));
                        }}
                        onDrop={(e) => {
                          const id = e.dataTransfer.getData(INTERNAL_DND_BOOK_TYPE);
                          if (!id) return;
                          e.preventDefault();
                          setDragOverCollectionId(null);
                          void addBookToCollection(c.id, id);
                        }}
                      >
                        <span className="text-sm">{c.name}</span>
                        <span className={dragOverCollectionId === c.id ? "text-xs text-white/90" : "text-xs text-gray-500"}>
                          {c.audiobookIds.length}
                        </span>
                      </div>
                    )
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700">
              <NavItem to="/settings" icon="fa-gear">
                Settings
              </NavItem>
            </div>
          </aside>

          {/* Feature slot */}
          <div className="flex-1 overflow-hidden flex">
            {ingest.active ? (
              <div className="absolute top-[64px] left-64 right-0 z-[150] px-6 pt-4 pointer-events-none">
                <div className="bg-gray-800/90 border border-gray-700 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-spinner fa-spin text-blue-400"></i>
                    <div className="text-sm text-gray-200">
                      Importing…{" "}
                      <span className="text-gray-400">
                        {typeof ingest.totalFiles === "number"
                          ? `${ingest.countDone}/${ingest.totalFiles}`
                          : `${ingest.countDone}`}
                      </span>
                      {ingest.lastName ? (
                        <span className="text-gray-500"> · {ingest.lastName}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <Outlet />
          </div>
        </main>

        {/* Keep engine alive even when UI hidden */}
        {showFooter ? <PlayerFooter /> : null}
      </div>

      {/* Collections context menu */}
      {collectionMenuOpen ? (
        <div
          id="collections-context-menu"
          className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-2 z-[220] min-w-[180px]"
          style={{
            left: Math.max(8, Math.min(collectionMenuPos.x, window.innerWidth - 200)),
            top: Math.max(8, Math.min(collectionMenuPos.y, window.innerHeight - 120))
          }}
        >
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900 hover:text-red-300 transition-colors flex items-center space-x-3"
            onClick={() => {
              setCollectionMenuOpen(false);
              setConfirmRemoveCollectionOpen(true);
            }}
          >
            <i className="fas fa-trash text-sm"></i>
            <span>Remove Collection</span>
          </button>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmRemoveCollectionOpen}
        title="Remove collection?"
        message={
          <div>
            This will remove the collection from Playr. Audiobooks in your library will not be deleted.
          </div>
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive={true}
        onClose={() => setConfirmRemoveCollectionOpen(false)}
        onConfirm={() => {
          const id = collectionMenuId;
          if (!id) return;
          void (async () => {
            await window.audioplayer.collections.remove(id);
            window.dispatchEvent(new Event("audioplayer:collections-changed"));
            setConfirmRemoveCollectionOpen(false);
            // If user is currently viewing this collection, bounce to library.
            if (location.pathname.startsWith(`/collections/${encodeURIComponent(id)}`)) {
              navigate("/library");
            }
          })();
        }}
      />
    </PlayerProvider>
  );
}


