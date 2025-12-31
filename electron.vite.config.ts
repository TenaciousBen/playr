import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  main: {
    plugins: [tsconfigPaths()],
    build: {
      outDir: "dist-electron/main"
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


