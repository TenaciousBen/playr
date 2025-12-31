import { readJsonFile, writeJsonFile } from "@/src/main/persistence/jsonStore";
import { getUserDataFilePath } from "@/src/main/persistence/paths";
import type { UserSettings } from "@/src/shared/models/userSettings";
import { DEFAULT_USER_SETTINGS } from "@/src/shared/models/userSettings";

const SETTINGS_FILE = "settings.json";

export async function loadSettings(): Promise<UserSettings> {
  // Merge with defaults to allow adding new settings fields without breaking existing user files.
  const stored = await readJsonFile<Partial<UserSettings>>(
    getUserDataFilePath(SETTINGS_FILE),
    DEFAULT_USER_SETTINGS
  );
  return { ...DEFAULT_USER_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await writeJsonFile(getUserDataFilePath(SETTINGS_FILE), settings);
}


