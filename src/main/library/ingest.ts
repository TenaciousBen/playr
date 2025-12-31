import fs from "fs/promises";
import path from "path";
import type { Audiobook, AudiobookChapter } from "@/src/shared/models/audiobook";
import { AUDIO_FILE_EXTENSIONS } from "@/src/main/library/audioExtensions";
import { extractAudiobookMetadata } from "@/src/main/library/metadata";

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function listAudioFilesRecursive(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [root];

  while (stack.length) {
    const dir = stack.pop()!;
    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(p);
        continue;
      }
      if (ent.isFile() && AUDIO_FILE_EXTENSIONS.has(path.extname(ent.name).toLowerCase())) {
        out.push(p);
      }
    }
  }

  return out;
}

function chaptersFromFiles(files: string[]): AudiobookChapter[] {
  const sorted = [...files].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return sorted.map((filePath, index) => ({
    index,
    title: path.basename(filePath, path.extname(filePath)),
    filePath
  }));
}

function folderToAudiobook(rootFolderPath: string, files: string[]): Audiobook {
  const folderName = path.basename(rootFolderPath);
  const chapters = chaptersFromFiles(files);

  return {
    // Stable id: root folder path
    id: rootFolderPath,
    displayName: folderName,
    rootFolderPath,
    chapters
  };
}

function fileToAudiobook(filePath: string): Audiobook {
  const base = path.basename(filePath, path.extname(filePath));
  const folder = path.dirname(filePath);
  return {
    // Stable id: file path (a single-file audiobook)
    id: filePath,
    displayName: base,
    rootFolderPath: folder,
    chapters: [
      {
        index: 0,
        title: base,
        filePath
      }
    ]
  };
}

/**
 * Ingest dropped paths (files and/or folders) into Audiobook entities.
 *
 * - Dropped files become single-file "audiobooks" (so a single `.m4b` doesn't show as the parent folder name).
 * - Folders are scanned recursively for supported audio files.
 */
export async function ingestPathsToAudiobooks(
  inputPaths: string[]
): Promise<Audiobook[]> {
  const fileInputs: string[] = [];
  const folderInputs: string[] = [];

  for (const p of inputPaths) {
    if (await isDirectory(p)) {
      folderInputs.push(p);
    } else if (AUDIO_FILE_EXTENSIONS.has(path.extname(p).toLowerCase())) {
      fileInputs.push(p);
    }
  }

  const books: Audiobook[] = [];

  // 1) Explicit file drops => single-file audiobooks
  for (const f of fileInputs) {
    books.push(fileToAudiobook(f));
  }

  // 2) Folder drops => scan + group by folder containing audio files
  const scannedAudioFiles: string[] = [];
  for (const folder of folderInputs) {
    scannedAudioFiles.push(...(await listAudioFilesRecursive(folder)));
  }
  const byFolder = new Map<string, string[]>();
  for (const f of scannedAudioFiles) {
    const folder = path.dirname(f);
    const arr = byFolder.get(folder) ?? [];
    arr.push(f);
    byFolder.set(folder, arr);
  }
  for (const [folder, files] of byFolder) {
    books.push(folderToAudiobook(folder, files));
  }

  // 3) Populate metadata (best-effort) using first chapter file.
  await Promise.all(
    books.map(async (b) => {
      const first = b.chapters[0]?.filePath;
      if (!first) return;
      const md = await extractAudiobookMetadata(b.id, first);
      if (md) {
        b.metadata = md;
        // Prefer metadata title for display.
        if (md.title) b.displayName = md.title;
      }
    })
  );

  // Stable ordering (useful for UI)
  books.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true }));
  return books;
}



