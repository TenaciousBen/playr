import type { Audiobook } from "@/src/shared/models/audiobook";
import { readJsonFile, writeJsonFile } from "@/src/main/persistence/jsonStore";
import { getUserDataFilePath } from "@/src/main/persistence/paths";

const LIBRARY_FILE = "library.json";

export async function loadLibrary(): Promise<Audiobook[]> {
  return await readJsonFile<Audiobook[]>(getUserDataFilePath(LIBRARY_FILE), []);
}

export async function saveLibrary(library: Audiobook[]): Promise<void> {
  await writeJsonFile(getUserDataFilePath(LIBRARY_FILE), library);
}


