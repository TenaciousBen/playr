import React, { useCallback, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PlayerProvider } from "@/src/renderer/features/player/PlayerContext";
import { PlayerFooter } from "@/src/renderer/features/player/PlayerFooter";
import { DropOverlay } from "@/src/renderer/features/shell/DropOverlay";
import { SearchDropdown } from "@/src/renderer/features/search/SearchDropdown";
import type { Audiobook } from "@/src/shared/models/audiobook";
import type { Collection } from "@/src/shared/models/collection";

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
  const [authorHits, setAuthorHits] = useState<Array<{ name: string; count: number }>>([]);
  const [titleHits, setTitleHits] = useState<Audiobook[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [addingCollection, setAddingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const showFooter = useMemo(() => location.pathname !== "/settings", [location.pathname]);

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
        for (const a of b.metadata?.authors ?? []) {
          if (a.toLowerCase().includes(qq)) {
            counts.set(a, (counts.get(a) ?? 0) + 1);
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
        const title = (b.metadata?.title ?? b.displayName).toLowerCase();
        const subtitle = (b.metadata?.subtitle ?? "").toLowerCase();
        return title.includes(qq) || subtitle.includes(qq);
      });

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

  return (
    <PlayerProvider>
      <div id="app-container" className="h-screen w-screen flex flex-col">
        <DropOverlay enabled={true} onDroppedFiles={onDroppedFiles} />

        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <i className="fas fa-headphones text-blue-500 text-2xl"></i>
            <h1 className="text-xl font-semibold">Audioplayer</h1>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-8 relative">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search audiobooks, authors, titles..."
                onFocus={() => setSearchOpen(true)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 pl-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            </div>

            <SearchDropdown
              open={searchOpen && search.trim().length > 0}
              query={search.trim()}
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
            <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
              <i className="fas fa-th-large text-gray-300"></i>
            </button>
            <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <i className="fas fa-list text-gray-400"></i>
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
                    <div
                      key={c.id}
                      className={[
                        "flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer",
                        dragOverCollectionId === c.id
                          ? "bg-blue-600 text-white"
                          : "text-gray-300 hover:bg-gray-700"
                      ].join(" ")}
                      onClick={() => navigate(`/collections/${encodeURIComponent(c.id)}`)}
                      onDragEnter={() => setDragOverCollectionId(c.id)}
                      onDragOver={(e) => {
                        const id = e.dataTransfer.getData("application/x-playr-audiobook-id");
                        if (!id) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        setDragOverCollectionId(c.id);
                      }}
                      onDragLeave={() => {
                        setDragOverCollectionId((prev) => (prev === c.id ? null : prev));
                      }}
                      onDrop={(e) => {
                        const id = e.dataTransfer.getData("application/x-playr-audiobook-id");
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
            <Outlet />
          </div>
        </main>

        {/* Keep engine alive even when UI hidden */}
        {showFooter ? <PlayerFooter /> : null}
      </div>
    </PlayerProvider>
  );
}


