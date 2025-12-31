import { app } from "electron";
import path from "path";

export function getUserDataFilePath(fileName: string) {
  return path.join(app.getPath("userData"), fileName);
}


