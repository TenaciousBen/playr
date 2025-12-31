type Route = "library" | "settings" | "recent" | "reading" | "favorites";

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

async function refreshLibraryCount() {
  const el = document.getElementById("library-count");
  if (!el) return;

  try {
    const books = await window.audioplayer.library.list();
    el.textContent = `${books.length} audiobook(s)`;
  } catch {
    el.textContent = "Unable to load library.";
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
        await refreshLibraryCount();
        return;
      }
      // TODO: replace design grid with real search results
      void window.audioplayer.library.search(q);
    }, 150);
  });
}

async function main() {
  wireNavigation();
  wireSearch();

  setActiveRoute(getRouteFromLocation());
  await refreshLibraryCount();
}

void main();


