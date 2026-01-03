import { parseFile } from "music-metadata";
import path from "path";

const filePath = process.argv.slice(2).join(" ").trim();
if (!filePath) {
  console.error("Usage: node scripts/inspect-metadata.mjs <path-to-audio-file>");
  process.exit(2);
}

const p = path.resolve(filePath);
const mm = await parseFile(p, { includeChapters: true });

const title = mm.common.album || mm.common.title || "";
const authors = mm.common.artists?.length ? mm.common.artists : mm.common.artist ? [mm.common.artist] : [];

console.log(JSON.stringify(
  {
    file: p,
    common: {
      title,
      subtitle: mm.common.subtitle ?? "",
      authors
    },
    format: {
      container: mm.format.container,
      codec: mm.format.codec,
      durationSeconds: mm.format.duration,
      hasChapters: Array.isArray(mm.format.chapters) && mm.format.chapters.length > 0,
      chapterCount: mm.format.chapters?.length ?? 0,
      chaptersPreview: (mm.format.chapters ?? []).slice(0, 10).map((c) => ({
        title: c.title,
        startSeconds: c.timeScale ? c.start / c.timeScale : null,
        timeScale: c.timeScale
      }))
    }
  },
  null,
  2
));


