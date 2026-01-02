import path from "path";
import { app, BrowserWindow } from "electron";

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    show: true,
    icon: path.join(app.getAppPath(), "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Remove the default application menu bar (File/Edit/View/Window/Help) on Windows/Linux.
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      // eslint-disable-next-line no-console
      console.error("Renderer failed to load:", {
        errorCode,
        errorDescription,
        validatedURL
      });
    }
  );

  // electron-vite sets this env var in dev; in production we load the built files.
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    // In production, electron-vite outputs the renderer to `dist/`.
    // When packaged, `__dirname` is typically: <app.asar>/dist-electron/main
    // so we can reliably reach: <app.asar>/dist/index.html
    void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}


