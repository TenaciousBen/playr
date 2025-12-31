import { defineConfig } from "electron-vite";
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
    plugins: [tsconfigPaths()],
    build: {
      outDir: "dist"
    }
  }
});


