import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { app } from "electron";
import { parseFile } from "music-metadata";
import type { AudiobookChapter, AudiobookMetadata } from "@/src/shared/models/audiobook";

function coversDir() {
  return path.join(app.getPath("userData"), "covers");
}

function hashId(id: string) {
  return crypto.createHash("sha1").update(id).digest("hex");
}

async function writeCoverImage(audiobookId: string, picture: { data: Uint8Array; format?: string }) {
  await fs.mkdir(coversDir(), { recursive: true });
  const ext =
    picture.format?.toLowerCase().includes("png") ? "png" : "jpg";
  const fileName = `${hashId(audiobookId)}.${ext}`;
  const fullPath = path.join(coversDir(), fileName);
  await fs.writeFile(fullPath, Buffer.from(picture.data));
  return fullPath;
}

export async function extractAudiobookMetadata(
  audiobookId: string,
  filePath: string
): Promise<{ metadata?: AudiobookMetadata; durationSeconds?: number; chapters?: AudiobookChapter[] }> {
  try {
    const mm = await parseFile(filePath, { includeChapters: true });
    const title = mm.common.album || mm.common.title || undefined;
    const subtitle = (mm.common as unknown as { subtitle?: string }).subtitle;
    const authors =
      (mm.common.artists && mm.common.artists.length > 0
        ? mm.common.artists
        : mm.common.artist
          ? [mm.common.artist]
          : undefined) ?? undefined;

    let coverImagePath: string | undefined;
    const pic = mm.common.picture?.[0];
    if (pic?.data) {
      coverImagePath = await writeCoverImage(audiobookId, {
        data: pic.data,
        format: pic.format
      });
    }

    const durationSeconds =
      typeof mm.format.duration === "number" && Number.isFinite(mm.format.duration)
        ? mm.format.duration
        : undefined;

    let chapters: AudiobookChapter[] | undefined;
    const mmChapters = (mm.format as unknown as { chapters?: Array<{ title: string; start: number; timeScale: number }> })
      .chapters;
    if (Array.isArray(mmChapters) && mmChapters.length > 0) {
      const starts = mmChapters
        .map((c) => {
          const start = Number(c?.start);
          const scale = Number(c?.timeScale);
          if (!Number.isFinite(start) || !Number.isFinite(scale) || scale <= 0) return 0;
          return start / scale;
        })
        .map((s) => Math.max(0, s));

      chapters = mmChapters.map((c, idx) => {
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

    const hasAny = !!title || !!subtitle || !!(authors && authors.length > 0) || !!coverImagePath;
    return {
      metadata: hasAny ? { title, subtitle, authors, coverImagePath } : undefined,
      durationSeconds,
      chapters
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[metadata] failed to parse", { filePath, err });
    return {};
  }
}


