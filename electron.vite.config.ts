import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  main: {
    plugins: [tsconfigPaths()],
    build: {
      outDir: "dist-electron/main",
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/main/main.ts"),
          ingestWorker: path.resolve(__dirname, "src/main/workers/ingestWorker.ts")
        }
      }
    }
  },
  preload: {
    plugins: [tsconfigPaths()],
    build: {
      outDir: "dist-electron/preload"
    }
  },
  renderer: {
    plugins: [tsconfigPaths(), react()],
    build: {
      outDir: "dist"
    }
  }
});


