import React, { useCallback, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PlayerFooter } from "@/src/renderer/ui/layout/PlayerFooter";
import { DropOverlay } from "@/src/renderer/ui/shared/DropOverlay";

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
  const location = useLocation();
  const navigate = useNavigate();

  const showFooter = useMemo(() => location.pathname !== "/settings", [location.pathname]);

  const onDroppedFiles = useCallback(
    async (files: File[]) => {
      // Ingest via preload
      await window.audioplayer.library.addDroppedFiles(files);
      // Tell any pages that cache the library to refresh.
      window.dispatchEvent(new Event("audioplayer:library-changed"));
      // Always bounce back to library after ingest so the user sees the result.
      navigate("/library");
    },
    [navigate]
  );

  return (
    <div id="app-container" className="h-screen w-screen flex flex-col">
      <DropOverlay enabled={showFooter} onDroppedFiles={onDroppedFiles} />

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <i className="fas fa-headphones text-blue-500 text-2xl"></i>
          <h1 className="text-xl font-semibold">Audioplayer</h1>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audiobooks, authors, titles..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 pl-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
          </div>
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
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Collections
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between p-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
                <span className="text-sm">Fiction</span>
                <span className="text-xs text-gray-500">—</span>
              </div>
              <div className="flex items-center justify-between p-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
                <span className="text-sm">Non-Fiction</span>
                <span className="text-xs text-gray-500">—</span>
              </div>
              <div className="flex items-center justify-between p-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
                <span className="text-sm">Biography</span>
                <span className="text-xs text-gray-500">—</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-700">
            <NavItem to="/settings" icon="fa-gear">
              Settings
            </NavItem>
          </div>
        </aside>

        {/* Pages slot */}
        <div className="flex-1 overflow-hidden">
          <Outlet context={{ search }} />
        </div>
      </main>

      {showFooter ? <PlayerFooter /> : null}
    </div>
  );
}


