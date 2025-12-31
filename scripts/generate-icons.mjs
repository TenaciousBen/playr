import fs from "node:fs/promises";
import path from "node:path";
import pngToIco from "png-to-ico";

const repoRoot = process.cwd();
const pngPath = path.join(repoRoot, "assets", "icon.png");
const icoPath = path.join(repoRoot, "assets", "icon.ico");

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(pngPath))) {
    console.warn(`[icons] missing ${pngPath} (skipping)`);
    return;
  }

  // If already generated, keep it.
  if (await exists(icoPath)) return;

  const buf = await pngToIco(pngPath);
  await fs.writeFile(icoPath, buf);
  console.log(`[icons] wrote ${icoPath}`);
}

main().catch((err) => {
  console.error("[icons] failed:", err);
  process.exit(1);
});


