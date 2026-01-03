import fs from "fs/promises";
import path from "path";

function u32(buf, off) {
  return buf.readUInt32BE(off);
}

function u64(buf, off) {
  const hi = buf.readUInt32BE(off);
  const lo = buf.readUInt32BE(off + 4);
  return hi * 2 ** 32 + lo;
}

function readBoxHeaderFromBuffer(buf, off) {
  if (off + 8 > buf.length) return null;
  const size32 = u32(buf, off);
  const type = buf.toString("ascii", off + 4, off + 8);
  if (size32 === 1) {
    if (off + 16 > buf.length) return null;
    const size = u64(buf, off + 8);
    return { type, size, headerSize: 16 };
  }
  if (size32 === 0) {
    return { type, size: buf.length - off, headerSize: 8 };
  }
  return { type, size: size32, headerSize: 8 };
}

async function findMoovAtom(filePath) {
  const fh = await fs.open(filePath, "r");
  try {
    const st = await fh.stat();
    const fileSize = st.size;
    let pos = 0;
    const hdr = Buffer.alloc(16);
    while (pos + 8 <= fileSize) {
      await fh.read(hdr, 0, 8, pos);
      const size32 = hdr.readUInt32BE(0);
      const type = hdr.toString("ascii", 4, 8);
      let size = size32;
      let headerSize = 8;
      if (size32 === 1) {
        await fh.read(hdr, 0, 16, pos);
        size = Number(u64(hdr, 8));
        headerSize = 16;
      } else if (size32 === 0) {
        size = fileSize - pos;
      }
      if (!Number.isFinite(size) || size <= headerSize) return null;
      if (type === "moov") return { offset: pos, size };
      pos += size;
    }
    return null;
  } finally {
    await fh.close();
  }
}

function findChildBoxes(buf, start, end, type) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    const h = readBoxHeaderFromBuffer(buf, p);
    if (!h || h.size <= h.headerSize) break;
    const boxEnd = p + h.size;
    if (boxEnd > end) break;
    if (h.type === type) out.push({ off: p, size: h.size, headerSize: h.headerSize });
    p = boxEnd;
  }
  return out;
}

function firstChild(buf, start, end, type) {
  return findChildBoxes(buf, start, end, type)[0] ?? null;
}

function parseFullBoxVersion(buf, off) {
  return { version: buf.readUInt8(off) };
}

function parseTkhdTrackId(buf, boxOff, boxSize, headerSize) {
  const payloadOff = boxOff + headerSize;
  const { version } = parseFullBoxVersion(buf, payloadOff);
  const trackIdOff = version === 1 ? payloadOff + 20 : payloadOff + 12;
  if (trackIdOff + 4 > boxOff + boxSize) return null;
  return u32(buf, trackIdOff);
}

function parseMdhdTimescale(buf, boxOff, boxSize, headerSize) {
  const payloadOff = boxOff + headerSize;
  const { version } = parseFullBoxVersion(buf, payloadOff);
  const timeScaleOff = version === 1 ? payloadOff + 20 : payloadOff + 12;
  if (timeScaleOff + 4 > boxOff + boxSize) return null;
  return u32(buf, timeScaleOff);
}

function parseChapRefIds(buf, boxOff, boxSize, headerSize) {
  const payloadOff = boxOff + headerSize;
  const end = boxOff + boxSize;
  const ids = [];
  for (let p = payloadOff; p + 4 <= end; p += 4) ids.push(u32(buf, p));
  return ids;
}

function parseStts(buf, boxOff, boxSize, headerSize) {
  const payloadOff = boxOff + headerSize;
  const entryCount = u32(buf, payloadOff + 4);
  const entries = [];
  let p = payloadOff + 8;
  for (let i = 0; i < entryCount && p + 8 <= boxOff + boxSize; i++) {
    entries.push({ count: u32(buf, p), duration: u32(buf, p + 4) });
    p += 8;
  }
  return entries;
}

function parseStsc(buf, boxOff, boxSize, headerSize) {
  const payloadOff = boxOff + headerSize;
  const entryCount = u32(buf, payloadOff + 4);
  const entries = [];
  let p = payloadOff + 8;
  for (let i = 0; i < entryCount && p + 12 <= boxOff + boxSize; i++) {
    entries.push({ firstChunk: u32(buf, p), samplesPerChunk: u32(buf, p + 4) });
    p += 12;
  }
  return entries;
}

function parseStsz(buf, boxOff, boxSize, headerSize) {
  const payloadOff = boxOff + headerSize;
  const sampleSize = u32(buf, payloadOff + 4);
  const sampleCount = u32(buf, payloadOff + 8);
  const sizes = [];
  if (sampleSize === 0) {
    let p = payloadOff + 12;
    for (let i = 0; i < sampleCount && p + 4 <= boxOff + boxSize; i++) {
      sizes.push(u32(buf, p));
      p += 4;
    }
  }
  return { sampleSize, sizes };
}

function parseStco(buf, boxOff, boxSize, headerSize) {
  const payloadOff = boxOff + headerSize;
  const entryCount = u32(buf, payloadOff + 4);
  const offsets = [];
  let p = payloadOff + 8;
  for (let i = 0; i < entryCount && p + 4 <= boxOff + boxSize; i++) {
    offsets.push(u32(buf, p));
    p += 4;
  }
  return offsets;
}

function parseCo64(buf, boxOff, boxSize, headerSize) {
  const payloadOff = boxOff + headerSize;
  const entryCount = u32(buf, payloadOff + 4);
  const offsets = [];
  let p = payloadOff + 8;
  for (let i = 0; i < entryCount && p + 8 <= boxOff + boxSize; i++) {
    offsets.push(u64(buf, p));
    p += 8;
  }
  return offsets;
}

function parseTracksFromMoov(moov) {
  const moovHdr = readBoxHeaderFromBuffer(moov, 0);
  if (!moovHdr || moovHdr.type !== "moov") return [];
  const moovStart = moovHdr.headerSize;
  const moovEnd = moovHdr.size;
  const traks = findChildBoxes(moov, moovStart, moovEnd, "trak");
  const tracks = [];

  for (const trak of traks) {
    const trakStart = trak.off + trak.headerSize;
    const trakEnd = trak.off + trak.size;
    const tkhd = firstChild(moov, trakStart, trakEnd, "tkhd");
    if (!tkhd) continue;
    const trackId = parseTkhdTrackId(moov, tkhd.off, tkhd.size, tkhd.headerSize);
    if (!trackId) continue;

    const info = { trackId };

    const tref = firstChild(moov, trakStart, trakEnd, "tref");
    if (tref) {
      const trefStart = tref.off + tref.headerSize;
      const trefEnd = tref.off + tref.size;
      const chap = firstChild(moov, trefStart, trefEnd, "chap");
      if (chap) info.chapterRefIds = parseChapRefIds(moov, chap.off, chap.size, chap.headerSize);
    }

    const mdia = firstChild(moov, trakStart, trakEnd, "mdia");
    if (mdia) {
      const mdiaStart = mdia.off + mdia.headerSize;
      const mdiaEnd = mdia.off + mdia.size;
      const mdhd = firstChild(moov, mdiaStart, mdiaEnd, "mdhd");
      if (mdhd) info.timeScale = parseMdhdTimescale(moov, mdhd.off, mdhd.size, mdhd.headerSize);

      const minf = firstChild(moov, mdiaStart, mdiaEnd, "minf");
      if (minf) {
        const minfStart = minf.off + minf.headerSize;
        const minfEnd = minf.off + minf.size;
        const stbl = firstChild(moov, minfStart, minfEnd, "stbl");
        if (stbl) {
          const stblStart = stbl.off + stbl.headerSize;
          const stblEnd = stbl.off + stbl.size;
          const stts = firstChild(moov, stblStart, stblEnd, "stts");
          if (stts) info.stts = parseStts(moov, stts.off, stts.size, stts.headerSize);
          const stsc = firstChild(moov, stblStart, stblEnd, "stsc");
          if (stsc) info.stsc = parseStsc(moov, stsc.off, stsc.size, stsc.headerSize);
          const stsz = firstChild(moov, stblStart, stblEnd, "stsz");
          if (stsz) info.stsz = parseStsz(moov, stsz.off, stsz.size, stsz.headerSize);
          const stco = firstChild(moov, stblStart, stblEnd, "stco");
          const co64 = firstChild(moov, stblStart, stblEnd, "co64");
          if (stco) info.stco = parseStco(moov, stco.off, stco.size, stco.headerSize);
          else if (co64) info.stco = parseCo64(moov, co64.off, co64.size, co64.headerSize);
        }
      }
    }

    tracks.push(info);
  }

  return tracks;
}

function samplesPerChunkFor(chunkIndex1, stsc) {
  for (let i = 0; i < stsc.length - 1; i++) {
    if (chunkIndex1 >= stsc[i].firstChunk && chunkIndex1 < stsc[i + 1].firstChunk) return stsc[i].samplesPerChunk;
  }
  return stsc[stsc.length - 1]?.samplesPerChunk ?? 1;
}

function buildSampleOffsets(chunkOffsets, stsc, sizes) {
  const out = [];
  let sampleIdx = 0;
  for (let chunkIdx0 = 0; chunkIdx0 < chunkOffsets.length && sampleIdx < sizes.length; chunkIdx0++) {
    const chunkIndex1 = chunkIdx0 + 1;
    const spc = samplesPerChunkFor(chunkIndex1, stsc);
    let intra = 0;
    for (let j = 0; j < spc && sampleIdx < sizes.length; j++) {
      out[sampleIdx] = chunkOffsets[chunkIdx0] + intra;
      intra += sizes[sampleIdx] ?? 0;
      sampleIdx++;
    }
  }
  return out;
}

function buildStartTimesSeconds(stts, timeScale, sampleCount) {
  const starts = new Array(sampleCount).fill(0);
  let t = 0;
  let idx = 0;
  for (const e of stts) {
    for (let i = 0; i < e.count && idx < sampleCount; i++) {
      starts[idx] = t / timeScale;
      t += e.duration;
      idx++;
    }
  }
  for (; idx < sampleCount; idx++) starts[idx] = t / timeScale;
  return starts;
}

async function readChapterTitleAt(fh, offset, size) {
  if (!Number.isFinite(offset) || offset < 0 || !Number.isFinite(size) || size < 2) return "";
  const buf = Buffer.alloc(size);
  await fh.read(buf, 0, size, offset);
  const titleLen = buf.readUInt16BE(0);
  if (titleLen <= 0) return "";
  const end = Math.min(2 + titleLen, buf.length);
  return buf.toString("utf8", 2, end).trim();
}

async function extractChaptersFromMp4ChapTrack(filePath) {
  const moov = await findMoovAtom(filePath);
  if (!moov) return null;
  const fh = await fs.open(filePath, "r");
  try {
    const moovBuf = Buffer.alloc(moov.size);
    await fh.read(moovBuf, 0, moov.size, moov.offset);
    const tracks = parseTracksFromMoov(moovBuf);
    const refTrack = tracks.find((t) => Array.isArray(t.chapterRefIds) && t.chapterRefIds.length > 0);
    const chapId = refTrack?.chapterRefIds?.[0];
    if (!chapId) return null;
    const chapterTrack = tracks.find((t) => t.trackId === chapId);
    if (!chapterTrack?.timeScale || !chapterTrack?.stts || !chapterTrack?.stsc || !chapterTrack?.stsz || !chapterTrack?.stco) return null;
    const sampleCount = chapterTrack.stsz.sampleSize > 0 ? chapterTrack.stco.length : chapterTrack.stsz.sizes.length;
    const sizes = chapterTrack.stsz.sampleSize > 0 ? new Array(sampleCount).fill(chapterTrack.stsz.sampleSize) : chapterTrack.stsz.sizes.slice(0, sampleCount);
    const offsets = buildSampleOffsets(chapterTrack.stco, chapterTrack.stsc, sizes);
    const starts = buildStartTimesSeconds(chapterTrack.stts, chapterTrack.timeScale, sizes.length);
    const out = [];
    for (let i = 0; i < sizes.length; i++) {
      const title = await readChapterTitleAt(fh, offsets[i] ?? 0, sizes[i] ?? 0);
      out.push({ title: title || `Chapter ${i + 1}`, startSeconds: starts[i] ?? 0 });
    }
    for (let i = 0; i < out.length; i++) {
      const cur = out[i];
      const next = out[i + 1];
      if (next && next.startSeconds > cur.startSeconds) cur.durationSeconds = next.startSeconds - cur.startSeconds;
    }
    return out;
  } finally {
    await fh.close();
  }
}

const filePath = process.argv.slice(2).join(" ").trim();
if (!filePath) {
  console.error("Usage: node scripts/extract-chapters-fallback.mjs <path-to-m4b>");
  process.exit(2);
}

const p = path.resolve(filePath);
const chapters = await extractChaptersFromMp4ChapTrack(p);
console.log(JSON.stringify({ file: p, chapterCount: chapters?.length ?? 0, preview: (chapters ?? []).slice(0, 10) }, null, 2));


