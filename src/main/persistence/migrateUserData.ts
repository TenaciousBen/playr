import fs from "fs/promises";
import path from "path";
import { app } from "electron";

async function exists(p: string) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDirIfExists(src: string, dst: string) {
  if (!(await exists(src))) return;
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const sp = path.join(src, e.name);
    const dp = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyDirIfExists(sp, dp);
    } else if (e.isFile()) {
      if (!(await exists(dp))) {
        await fs.copyFile(sp, dp);
      }
    }
  }
}

/**
 * When renaming the app (Audioplayer -> Playr), Electron will change the userData folder.
 * This migrates existing persisted data forward (best-effort).
 */
export async function migrateUserDataIfNeeded() {
  const newUserData = app.getPath("userData");

  // If Playr already has a library file, we assume migration isn't needed.
  const newLibrary = path.join(newUserData, "library.json");
  if (await exists(newLibrary)) return;

  const appData = app.getPath("appData");
  const candidates = [
    path.join(appData, "Audioplayer"),
    path.join(appData, "audioplayer"),
    path.join(appData, "playr") // dev variants
  ];

  const oldUserData = (await (async () => {
    for (const c of candidates) {
      if (await exists(path.join(c, "library.json"))) return c;
    }
    return null;
  })());

  if (!oldUserData) return;

  await fs.mkdir(newUserData, { recursive: true });

  // Copy key JSON files.
  for (const f of ["library.json", "playback.json", "settings.json", "collections.json"]) {
    const src = path.join(oldUserData, f);
    const dst = path.join(newUserData, f);
    if ((await exists(src)) && !(await exists(dst))) {
      await fs.copyFile(src, dst);
    }
  }

  // Copy extracted covers.
  await copyDirIfExists(path.join(oldUserData, "covers"), path.join(newUserData, "covers"));
}


