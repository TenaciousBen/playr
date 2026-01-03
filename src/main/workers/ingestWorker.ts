import { parentPort, workerData } from "worker_threads";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { Audiobook } from "@/src/shared/models/audiobook";

type WorkerData = {
  inputPaths: string[];
  userDataDir: string;
};

type Outgoing =
  | { type: "scanned"; totalFiles: number }
  | { type: "book"; book: any; countDone: number; totalFiles: number }
  | { type: "done"; countDone: number; totalFiles: number }
  | { type: "error"; message: string };

const AUDIO_EXTS = new Set([".mp3", ".m4a", ".m4b", ".flac", ".ogg", ".wav", ".aac", ".opus"]);

function post(msg: Outgoing) {
  parentPort?.postMessage(msg);
}

function hashId(id: string) {
  return crypto.createHash("sha1").update(id).digest("hex");
}

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
      if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (AUDIO_EXTS.has(ext)) out.push(p);
      }
    }
  }
  return out;
}

async function writeCoverImage(audiobookId: string, picture: { data: Uint8Array; format?: string }) {
  const { userDataDir } = workerData as WorkerData;
  const dir = path.join(userDataDir, "covers");
  await fs.mkdir(dir, { recursive: true });
  const ext = picture.format?.toLowerCase().includes("png") ? "png" : "jpg";
  const fileName = `${hashId(audiobookId)}.${ext}`;
  const fullPath = path.join(dir, fileName);
  await fs.writeFile(fullPath, Buffer.from(picture.data));
  return fullPath;
}

function fileToAudiobook(filePath: string): Audiobook {
  const base = path.basename(filePath, path.extname(filePath));
  const folder = path.dirname(filePath);
  return {
    id: filePath,
    displayName: base,
    rootFolderPath: folder,
    chapters: [{ index: 0, title: base, filePath }]
  };
}

let parseFileFn: null | ((filePath: string, opts?: any) => Promise<any>) = null;
async function getParseFile() {
  if (parseFileFn) return parseFileFn;
  // Keep compatibility with ESM-only versions of music-metadata.
  const mm = await import("music-metadata");
  parseFileFn = mm.parseFile as unknown as (filePath: string, opts?: any) => Promise<any>;
  return parseFileFn!;
}

async function parseMetadata(audiobookId: string, filePath: string) {
  try {
    const parseFile = await getParseFile();
    const mm = await parseFile(filePath, { includeChapters: true });

    const title = mm.common.album || mm.common.title || undefined;
    const subtitle = mm.common.subtitle;
    const rawAuthors =
      (mm.common.artists && mm.common.artists.length > 0
        ? mm.common.artists
        : mm.common.artist
          ? [mm.common.artist]
          : undefined) ?? undefined;
    const authors = Array.isArray(rawAuthors)
      ? rawAuthors
          .map((a: any) => (typeof a === "string" ? a : a?.name ? String(a.name) : String(a)))
          .map((s) => String(s).trim())
          .filter((s) => s.length > 0)
      : undefined;

    let coverImagePath: string | undefined;
    const pic = mm.common.picture?.[0];
    if (pic?.data) {
      coverImagePath = await writeCoverImage(audiobookId, { data: pic.data, format: pic.format });
    }

    const durationSeconds =
      typeof mm.format.duration === "number" && Number.isFinite(mm.format.duration) ? mm.format.duration : undefined;

    let chapters: any[] | undefined;
    if (Array.isArray(mm.format?.chapters) && mm.format.chapters.length > 0) {
      const starts = mm.format.chapters
        .map((c: any) => {
          const start = Number(c?.start);
          const scale = Number(c?.timeScale);
          if (!Number.isFinite(start) || !Number.isFinite(scale) || scale <= 0) return 0;
          return start / scale;
        })
        .map((s: number) => Math.max(0, s));

      chapters = mm.format.chapters.map((c: any, idx: number) => {
        const startSeconds = starts[idx] ?? 0;
        const nextStart = starts[idx + 1];
        const dur =
          typeof nextStart === "number"
            ? Math.max(0, nextStart - startSeconds)
            : typeof durationSeconds === "number"
              ? Math.max(0, durationSeconds - startSeconds)
              : undefined;
        const rawTitle = String(c?.title ?? "").trim();
        return {
          index: idx,
          title: rawTitle || `Chapter ${idx + 1}`,
          filePath,
          startSeconds,
          durationSeconds: typeof dur === "number" && Number.isFinite(dur) && dur > 0 ? dur : undefined
        };
      });
    }

    const hasAny = !!title || !!subtitle || !!(authors && authors.length) || !!coverImagePath;
    return {
      metadata: hasAny ? { title, subtitle, authors, coverImagePath } : undefined,
      durationSeconds,
      chapters
    };
  } catch {
    return {};
  }
}

async function run() {
  const { inputPaths } = workerData as WorkerData;
  const fileInputs: string[] = [];
  const folderInputs: string[] = [];

  for (const p of inputPaths ?? []) {
    if (await isDirectory(p)) folderInputs.push(p);
    else if (AUDIO_EXTS.has(path.extname(p).toLowerCase())) fileInputs.push(p);
  }

  const files: string[] = [...fileInputs];
  for (const folder of folderInputs) {
    const nested = await listAudioFilesRecursive(folder);
    files.push(...nested);
  }

  post({ type: "scanned", totalFiles: files.length });

  let done = 0;
  for (const f of files) {
    const b = fileToAudiobook(f);
    const res = await parseMetadata(b.id, f);
    if (typeof res.durationSeconds === "number" && Number.isFinite(res.durationSeconds) && res.durationSeconds > 0) {
      b.durationSeconds = res.durationSeconds;
      if (b.chapters?.[0] && !(res as any).chapters?.length) b.chapters[0].durationSeconds = res.durationSeconds;
    }
    const extracted = (res as any).chapters;
    if (Array.isArray(extracted) && extracted.length > 0) {
      b.chapters = extracted;
    }
    if (res.metadata) {
      b.metadata = res.metadata;
      if (res.metadata.title) b.displayName = res.metadata.title;
    }
    done += 1;
    post({ type: "book", book: b, countDone: done, totalFiles: files.length });
  }

  post({ type: "done", countDone: done, totalFiles: files.length });
}

run().catch((err: any) => {
  post({ type: "error", message: String(err?.message ?? err ?? "Worker failed") });
});


