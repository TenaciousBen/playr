import { app } from "electron";
import { registerIpcHandlers } from "@/src/main/ipc/registerIpcHandlers";
import { createMainWindow } from "@/src/main/windows/createMainWindow";

async function bootstrap() {
  registerIpcHandlers();

  await app.whenReady();

  createMainWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window when the dock icon is clicked.
    if (process.platform === "darwin") {
      createMainWindow();
    }
  });
}

app.on("window-all-closed", () => {
  // On macOS apps typically stay open until Cmd+Q.
  if (process.platform !== "darwin") {
    app.quit();
  }
});

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal bootstrap error:", err);
  app.quit();
});


