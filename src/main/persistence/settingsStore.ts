import { readJsonFile, writeJsonFile } from "@/src/main/persistence/jsonStore";
import { getUserDataFilePath } from "@/src/main/persistence/paths";
import type { UserSettings } from "@/src/shared/models/userSettings";
import { DEFAULT_USER_SETTINGS } from "@/src/shared/models/userSettings";

const SETTINGS_FILE = "settings.json";

export async function loadSettings(): Promise<UserSettings> {
  return await readJsonFile<UserSettings>(getUserDataFilePath(SETTINGS_FILE), DEFAULT_USER_SETTINGS);
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await writeJsonFile(getUserDataFilePath(SETTINGS_FILE), settings);
}


