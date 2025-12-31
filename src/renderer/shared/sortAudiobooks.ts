import type { Audiobook } from "@/src/shared/models/audiobook";
import type { UserSettings } from "@/src/shared/models/userSettings";

export function sortAudiobooks(
  books: Audiobook[],
  sortBy: UserSettings["sortBy"],
  playbackSecondsById?: Record<string, number>
) {
  const arr = [...books];
  const lower = (s: string) => s.toLowerCase();

  const seconds = (b: Audiobook) => playbackSecondsById?.[b.id] ?? 0;
  const pct = (b: Audiobook) => {
    const dur = b.durationSeconds ?? 0;
    if (!dur || dur <= 0) return 0;
    return Math.max(0, Math.min(1, seconds(b) / dur));
  };

  arr.sort((a, b) => {
    if (sortBy === "title") {
      const at = lower(a.metadata?.title ?? a.displayName);
      const bt = lower(b.metadata?.title ?? b.displayName);
      return at.localeCompare(bt);
    }
    if (sortBy === "author") {
      const aa = lower(a.metadata?.authors?.[0] ?? "");
      const ba = lower(b.metadata?.authors?.[0] ?? "");
      return aa.localeCompare(ba) || lower(a.displayName).localeCompare(lower(b.displayName));
    }
    if (sortBy === "dateAdded") {
      const ad = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      const bd = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return bd - ad;
    }
    if (sortBy === "duration") {
      const ad = a.durationSeconds ?? 0;
      const bd = b.durationSeconds ?? 0;
      return bd - ad;
    }
    // progress
    return pct(b) - pct(a);
  });

  return arr;
}


