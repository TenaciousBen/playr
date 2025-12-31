import { readJsonFile, writeJsonFile } from "@/src/main/persistence/jsonStore";
import { getUserDataFilePath } from "@/src/main/persistence/paths";
import type { Collection } from "@/src/shared/models/collection";

const COLLECTIONS_FILE = "collections.json";

export async function loadCollections(): Promise<Collection[]> {
  return await readJsonFile<Collection[]>(getUserDataFilePath(COLLECTIONS_FILE), []);
}

export async function saveCollections(collections: Collection[]): Promise<void> {
  await writeJsonFile(getUserDataFilePath(COLLECTIONS_FILE), collections);
}


