type Route = "library" | "settings" | "recent" | "reading" | "favorites";

import type { Audiobook } from "@/src/shared/models/audiobook";
import type { PlaybackState } from "@/src/shared/models/playback";

function isDndDebugEnabled() {
  try {
    return window.localStorage.getItem("debugDnd") === "1";
  } catch {
    return false;
  }
}

function formatDt(dt: DataTransfer | null) {
  if (!dt) return { dt: null as null };
  return {
    types: Array.from(dt.types ?? []),
    filesLength: dt.files?.length ?? 0,
    effectAllowed: dt.effectAllowed,
    dropEffect: dt.dropEffect
  };
}

function setActiveRoute(route: Route) {
  const libraryView = document.getElementById("library-view");
  const settingsView = document.getElementById("settings-view");
  const playerFooter = document.getElementById("media-controls");

  if (!libraryView || !settingsView || !playerFooter) return;

  if (route === "settings") {
    libraryView.classList.add("hidden");
    settingsView.classList.remove("hidden");
    playerFooter.classList.add("hidden");
    return;
  }

  // All other pages keep the player visible (per requirements).
  libraryView.classList.remove("hidden");
  settingsView.classList.add("hidden");
  playerFooter.classList.remove("hidden");
}

function getRouteFromLocation(): Route {
  const hash = window.location.hash || "#/library";
  const route = hash.replace(/^#\//, "") as Route;
  return route || "library";
}

let cachedBooks: Audiobook[] = [];
let contextAudiobookId: string | null = null;

function formatSeconds(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function setElText(id: string, value: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
}

function showContextMenuAt(x: number, y: number) {
  const menu = document.getElementById("context-menu");
  if (!menu) return;

  menu.classList.remove("hidden");

  // Clamp to viewport
  const rect = menu.getBoundingClientRect();
  const pad = 8;
  const maxX = window.innerWidth - rect.width - pad;
  const maxY = window.innerHeight - rect.height - pad;

  const left = Math.max(pad, Math.min(x, maxX));
  const top = Math.max(pad, Math.min(y, maxY));

  (menu as HTMLElement).style.left = `${left}px`;
  (menu as HTMLElement).style.top = `${top}px`;
}

function hideContextMenu() {
  const menu = document.getElementById("context-menu");
  if (!menu) return;
  menu.classList.add("hidden");
  contextAudiobookId = null;
}

function showDetailsModal() {
  const overlay = document.getElementById("details-modal-overlay");
  const modal = document.getElementById("details-modal");
  overlay?.classList.remove("hidden");
  modal?.classList.remove("hidden");
}

function hideDetailsModal() {
  const overlay = document.getElementById("details-modal-overlay");
  const modal = document.getElementById("details-modal");
  overlay?.classList.add("hidden");
  modal?.classList.add("hidden");
}

function renderLibrary(books: Audiobook[]) {
  const grid = document.getElementById("audiobook-grid");
  const empty = document.getElementById("library-empty");
  const count = document.getElementById("library-count");
  if (!grid || !empty || !count) return;

  count.textContent = `${books.length} audiobook(s)`;

  grid.replaceChildren();

  if (books.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  for (const b of books) {
    const card = document.createElement("div");
    card.className = "audiobook-card group cursor-pointer";
    card.title = b.displayName;
    card.dataset.audiobookId = b.id;

    const imgWrap = document.createElement("div");
    imgWrap.className = "relative mb-3";

    if (b.metadata?.coverImagePath) {
      const imgEl = document.createElement("img");
      imgEl.className = "w-full h-48 object-cover rounded-lg shadow-lg";
      const p = b.metadata.coverImagePath.replace(/\\/g, "/");
      imgEl.src = `file:///${encodeURI(p)}`;
      imgEl.alt = b.metadata?.title ?? b.displayName;
      imgWrap.appendChild(imgEl);
    } else {
      const img = document.createElement("div");
      img.className =
        "w-full h-48 rounded-lg shadow-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center";
      img.innerHTML = '<i class="fas fa-book text-gray-400 text-3xl"></i>';
      imgWrap.appendChild(img);
    }

    const hover = document.createElement("div");
    hover.className =
      "absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 rounded-lg flex items-center justify-center";
    hover.innerHTML =
      '<i class="fas fa-play text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></i>';
    imgWrap.appendChild(hover);

    const title = document.createElement("h3");
    title.className = "font-semibold text-sm mb-1 line-clamp-2";
    title.textContent = b.metadata?.title ?? b.displayName;

    const author = document.createElement("p");
    author.className = "text-gray-400 text-xs mb-1";
    author.textContent = b.metadata?.authors?.join(", ") ?? "";

    const meta = document.createElement("p");
    meta.className = "text-gray-500 text-xs";
    meta.textContent = `${b.chapters.length} file(s)`;

    card.appendChild(imgWrap);
    card.appendChild(title);
    if (author.textContent) card.appendChild(author);
    card.appendChild(meta);

    grid.appendChild(card);
  }
}

async function loadLibrary() {
  try {
    cachedBooks = await window.audioplayer.library.list();
    renderLibrary(cachedBooks);
  } catch {
    const count = document.getElementById("library-count");
    if (count) count.textContent = "Unable to load library.";
  }
}

function wireNavigation() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-route]"));
  for (const link of links) {
    link.addEventListener("click", () => {
      const route = (link.dataset.route || "library") as Route;
      setActiveRoute(route);
    });
  }

  window.addEventListener("hashchange", () => {
    setActiveRoute(getRouteFromLocation());
  });
}

function wireSearch() {
  const input = document.getElementById("search-input") as HTMLInputElement | null;
  if (!input) return;

  let t: number | undefined;
  input.addEventListener("input", () => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(async () => {
      const q = input.value.trim();
      if (q.length === 0) {
        renderLibrary(cachedBooks);
        return;
      }

      // Prefer main-process search (future-proof), but fall back to local filter if needed.
      try {
        const results = await window.audioplayer.library.search(q);
        renderLibrary(results);
      } catch {
        const qq = q.toLowerCase();
        renderLibrary(
          cachedBooks.filter((b) => {
            const hay = [
              b.displayName,
              b.metadata?.title,
              b.metadata?.subtitle,
              ...(b.metadata?.authors ?? [])
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(qq);
          })
        );
      }
    }, 150);
  });
}

function wireContextMenuAndDetails() {
  const grid = document.getElementById("audiobook-grid");
  if (!grid) return;

  grid.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement | null;
    const card = target?.closest<HTMLElement>(".audiobook-card");
    if (!card) return;

    e.preventDefault();
    contextAudiobookId = card.dataset.audiobookId ?? null;
    showContextMenuAt(e.clientX, e.clientY);
  });

  // Hide menu on outside click
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("context-menu");
    if (!menu || menu.classList.contains("hidden")) return;
    const t = e.target as HTMLElement | null;
    if (t && menu.contains(t)) return;
    hideContextMenu();
  });

  // Hide menu/modal on escape
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    hideContextMenu();
    hideDetailsModal();
  });

  const detailsBtn = document.getElementById("context-menu-details");
  const removeBtn = document.getElementById("context-menu-remove");

  detailsBtn?.addEventListener("click", async () => {
    const id = contextAudiobookId;
    hideContextMenu();
    if (!id) return;

    const book = cachedBooks.find((b) => b.id === id);
    if (!book) return;

    let playback: PlaybackState | null = null;
    try {
      playback = await window.audioplayer.playback.getStateForAudiobook(id);
    } catch {
      playback = null;
    }

    // Cover
    const cover = document.getElementById("details-cover") as HTMLImageElement | null;
    if (cover) {
      if (book.metadata?.coverImagePath) {
        const p = book.metadata.coverImagePath.replace(/\\/g, "/");
        cover.src = `file:///${encodeURI(p)}`;
      } else {
        cover.removeAttribute("src");
      }
    }

    setElText("details-title", book.metadata?.title ?? book.displayName);
    setElText("details-subtitle", book.metadata?.subtitle ?? "");
    setElText("details-authors", book.metadata?.authors?.join(", ") ?? "");
    setElText("details-meta-title", book.metadata?.title ?? "");
    setElText("details-meta-subtitle", book.metadata?.subtitle ?? "");
    setElText("details-meta-authors", book.metadata?.authors?.join(", ") ?? "");

    setElText("details-file-location", book.chapters[0]?.filePath ?? book.rootFolderPath);
    setElText("details-chapters-pill", `${book.chapters.length} file(s)`);

    // Playback bits (best-effort)
    if (!playback?.position || playback.position.secondsIntoChapter === 0) {
      setElText("details-progress-pill", "Not started");
      setElText("details-last-chapter", "—");
      setElText("details-last-chapter-title", "");
      setElText("details-last-position", "—");
      setElText("details-last-position-sub", "");
    } else {
      const idx = playback.position.chapterIndex;
      setElText("details-progress-pill", `Paused • ${playback.rate}x`);
      setElText("details-last-chapter", `Chapter ${idx + 1}`);
      setElText("details-last-chapter-title", book.chapters[idx]?.title ?? "");
      setElText("details-last-position", formatSeconds(playback.position.secondsIntoChapter));
      setElText("details-last-position-sub", "");
    }

    // Chapters list
    const list = document.getElementById("details-chapters-list");
    if (list) {
      list.replaceChildren();
      for (const ch of book.chapters) {
        const row = document.createElement("div");
        row.textContent = `${ch.index + 1}. ${ch.title} — ${ch.filePath}`;
        list.appendChild(row);
      }
    }

    showDetailsModal();
  });

  removeBtn?.addEventListener("click", async () => {
    const id = contextAudiobookId;
    hideContextMenu();
    if (!id) return;

    try {
      await window.audioplayer.library.remove(id);
    } finally {
      await loadLibrary();
      hideDetailsModal();
    }
  });

  document.getElementById("details-close")?.addEventListener("click", hideDetailsModal);
  document.getElementById("details-close-bottom")?.addEventListener("click", hideDetailsModal);
  document.getElementById("details-modal-overlay")?.addEventListener("click", hideDetailsModal);
}

function setDropOverlayVisible(visible: boolean) {
  const overlay = document.getElementById("library-drop-overlay");
  if (!overlay) return;
  overlay.classList.toggle("hidden", !visible);
}

function extractDroppedPaths(dt: DataTransfer): string[] {
  const fromFiles = Array.from(dt.files ?? [])
    .map((f) => (f as unknown as { path?: string; name?: string }).path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  if (fromFiles.length > 0) return fromFiles;

  // Best-effort fallback: some environments populate items first.
  const fromItems = Array.from(dt.items ?? [])
    .filter((it) => it.kind === "file")
    .map((it) => it.getAsFile())
    .filter((f): f is File => !!f)
    .map((f) => (f as unknown as { path?: string }).path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);

  return fromItems;
}

function wireDndDebug() {
  const enabled = isDndDebugEnabled();

  // eslint-disable-next-line no-console
  console.log(
    `[DND] debugDnd=${enabled ? "1" : "0"}. Enable: localStorage.setItem('debugDnd','1'); location.reload();`
  );

  if (!enabled) {
    // Still emit a one-time signal so we can tell whether drag events are reaching the renderer at all.
    const once = (e: DragEvent) => {
      // eslint-disable-next-line no-console
      console.log("[DND] dragenter seen (debugDnd=0)", {
        defaultPrevented: e.defaultPrevented,
        cancelable: e.cancelable,
        ...formatDt(e.dataTransfer ?? null)
      });
      window.removeEventListener("dragenter", once, true);
    };
    window.addEventListener("dragenter", once, true);
    return;
  }

  const targets: Array<{ name: string; el: EventTarget }> = [
    { name: "window", el: window },
    { name: "document", el: document },
    { name: "body", el: document.body }
  ];

  const events: Array<keyof WindowEventMap> = [
    "dragenter",
    "dragover",
    "dragleave",
    "drop"
  ];

  let lastOverLogAt = 0;

  for (const { name, el } of targets) {
    for (const evt of events) {
      el.addEventListener(
        evt,
        (e) => {
          const de = e as DragEvent;
          if (evt === "dragover") {
            const now = Date.now();
            if (now - lastOverLogAt < 250) return;
            lastOverLogAt = now;
          }
          // eslint-disable-next-line no-console
          console.log(`[DND] ${name} ${evt}`, {
            defaultPrevented: de.defaultPrevented,
            cancelable: de.cancelable,
            ...formatDt(de.dataTransfer ?? null)
          });
        },
        true
      );
    }
  }
}

function wireLibraryDropTarget() {
  const libraryView = document.getElementById("library-view");
  if (!libraryView) return;

  const canShowOverlay = () => getRouteFromLocation() !== "settings";
  const canHandleDrop = () => getRouteFromLocation() !== "settings";

  // Prevent the browser from navigating away on drop and ensure Chromium shows an "allowed" cursor.
  // On Windows, Explorer drags often need `dragenter` + `dragover` prevented (and doing it at window
  // capture phase is the most reliable).
  const allowDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    if (canShowOverlay()) setDropOverlayVisible(true);
  };

  window.addEventListener("dragenter", allowDrop, true);
  window.addEventListener("dragover", allowDrop, true);
  window.addEventListener(
    "dragleave",
    (e) => {
      // When leaving the window entirely, relatedTarget is often null.
      if (!(e as DragEvent).relatedTarget) setDropOverlayVisible(false);
    },
    true
  );
  window.addEventListener(
    "drop",
    async (e) => {
      e.preventDefault();
      setDropOverlayVisible(false);
      if (!canHandleDrop()) return;

      const dt = (e as DragEvent).dataTransfer;
      if (!dt) return;

      // eslint-disable-next-line no-console
      console.log("[DND] drop", {
        filesLength: dt.files?.length ?? 0,
        types: Array.from(dt.types ?? []),
        // Renderer often has no native paths; we primarily ingest via preload/webUtils.
        extractedPathsInRenderer: extractDroppedPaths(dt).length,
        firstFile: dt.files?.[0]
          ? {
              name: dt.files[0].name,
              type: dt.files[0].type,
              size: dt.files[0].size
            }
          : null
      });

      try {
        // Prefer preload-assisted extraction (works even when renderer `File.path` is unavailable).
        await window.audioplayer.library.addDroppedFiles(Array.from(dt.files ?? []));
        await loadLibrary();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[DND] addFiles failed:", err);
      }
    },
    true
  );

  let dragDepth = 0;

  libraryView.addEventListener("dragenter", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    dragDepth += 1;
    setDropOverlayVisible(true);
  });

  libraryView.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    setDropOverlayVisible(true);
  });

  libraryView.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragDepth -= 1;
    if (dragDepth <= 0) {
      dragDepth = 0;
      setDropOverlayVisible(false);
    }
  });

  // Note: actual ingestion is handled by the window-level drop listener so drops
  // on header/sidebar/etc are also accepted. This handler is just for overlay depth.
  libraryView.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    setDropOverlayVisible(false);
  });
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("[renderer] boot", new Date().toISOString());

  wireDndDebug();
  wireNavigation();
  wireSearch();
  wireLibraryDropTarget();
  wireContextMenuAndDetails();

  setActiveRoute(getRouteFromLocation());
  await loadLibrary();
}

void main();


