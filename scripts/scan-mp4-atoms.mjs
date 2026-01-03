import fs from "fs";
import path from "path";

const filePath = process.argv.slice(2).join(" ").trim();
if (!filePath) {
  console.error("Usage: node scripts/scan-mp4-atoms.mjs <path-to-m4a/m4b/mp4>");
  process.exit(2);
}

const p = path.resolve(filePath);
const buf = fs.readFileSync(p);

function findAscii(needle) {
  const n = Buffer.from(needle, "ascii");
  const hits = [];
  for (let i = 0; i <= buf.length - n.length; i++) {
    let ok = true;
    for (let j = 0; j < n.length; j++) {
      if (buf[i + j] !== n[j]) {
        ok = false;
        break;
      }
    }
    if (ok) hits.push(i);
  }
  return hits;
}

const needles = ["chap", "chpl", "ctts", "stts", "udta", "meta", "moov", "mdat"];
const out = {};
for (const s of needles) out[s] = findAscii(s).slice(0, 50);

console.log(
  JSON.stringify(
    {
      file: p,
      sizeBytes: buf.length,
      hits: out
    },
    null,
    2
  )
);


