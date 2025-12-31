import type { Audiobook } from "@/src/shared/models/audiobook";
import { readJsonFile, writeJsonFile } from "@/src/main/persistence/jsonStore";
import { getUserDataFilePath } from "@/src/main/persistence/paths";

const LIBRARY_FILE = "library.json";

export async function loadLibrary(): Promise<Audiobook[]> {
  const raw = await readJsonFile<Audiobook[]>(getUserDataFilePath(LIBRARY_FILE), []);
  // Normalize for forward compatibility (new fields may be missing).
  return (raw ?? []).map((b) => {
    const md = b.metadata ? { ...b.metadata } : undefined;
    if (md) {
      if (typeof (md as any).title !== "undefined" && typeof md.title !== "string") {
        md.title = String((md as any).title);
      }
      if (typeof (md as any).subtitle !== "undefined" && typeof md.subtitle !== "string") {
        md.subtitle = String((md as any).subtitle);
      }
      const a = (md as any).authors;
      if (Array.isArray(a)) {
        md.authors = a.map((x) => String(x)).filter((s) => s.length > 0);
      } else if (typeof a === "string") {
        md.authors = a
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      } else if (typeof a !== "undefined") {
        md.authors = [];
      }
    }
    return {
      ...b,
      metadata: md,
      isFavorite: b.isFavorite ?? false
    };
  });
}

export async function saveLibrary(library: Audiobook[]): Promise<void> {
  await writeJsonFile(getUserDataFilePath(LIBRARY_FILE), library);
}


