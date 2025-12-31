import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { app } from "electron";
import { parseFile } from "music-metadata";
import type { AudiobookMetadata } from "@/src/shared/models/audiobook";

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
): Promise<AudiobookMetadata | undefined> {
  try {
    const mm = await parseFile(filePath);
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

    if (!title && !subtitle && !authors && !coverImagePath) return undefined;
    return { title, subtitle, authors, coverImagePath };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[metadata] failed to parse", { filePath, err });
    return undefined;
  }
}


