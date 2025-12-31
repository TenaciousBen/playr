import type { Audiobook } from "@/src/shared/models/audiobook";
import { readJsonFile, writeJsonFile } from "@/src/main/persistence/jsonStore";
import { getUserDataFilePath } from "@/src/main/persistence/paths";

const LIBRARY_FILE = "library.json";

export async function loadLibrary(): Promise<Audiobook[]> {
  const raw = await readJsonFile<Audiobook[]>(getUserDataFilePath(LIBRARY_FILE), []);
  // Normalize for forward compatibility (new fields may be missing).
  return (raw ?? []).map((b) => ({
    ...b,
    isFavorite: b.isFavorite ?? false
  }));
}

export async function saveLibrary(library: Audiobook[]): Promise<void> {
  await writeJsonFile(getUserDataFilePath(LIBRARY_FILE), library);
}


