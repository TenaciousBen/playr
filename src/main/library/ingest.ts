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
 * - A single audio file represents a single Audiobook.
 * - Dropped folders are scanned recursively for supported audio files and each file becomes its own Audiobook.
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

  // 2) Folder drops => recursively scan and add every supported audio file as a single-file audiobook
  for (const folder of folderInputs) {
    const files = await listAudioFilesRecursive(folder);
    for (const f of files) {
      books.push(fileToAudiobook(f));
    }
  }

  // 3) Populate metadata (best-effort) using first chapter file.
  await Promise.all(
    books.map(async (b) => {
      const first = b.chapters[0]?.filePath;
      if (!first) return;
      const res = await extractAudiobookMetadata(b.id, first);
      if (typeof res.durationSeconds === "number" && Number.isFinite(res.durationSeconds) && res.durationSeconds > 0) {
        b.durationSeconds = res.durationSeconds;
        // If we don't have chapter markers, treat "chapter 0" as full-file duration.
        if (b.chapters[0] && !res.chapters?.length) b.chapters[0].durationSeconds = res.durationSeconds;
      }
      if (res.chapters && res.chapters.length > 0) {
        b.chapters = res.chapters;
      }
      if (res.metadata) {
        b.metadata = res.metadata;
        // Prefer metadata title for display.
        if (res.metadata.title) b.displayName = res.metadata.title;
      }
    })
  );

  // Stable ordering (useful for UI)
  books.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true }));
  return books;
}



