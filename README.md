# Playr

Playr is an Electron-based audio player for the purpose of playing audiobooks.

## Project goals

- Present a library of audiobooks based on folders and files the user drags into the Library window of the application
- Keep track of last played location of audiobooks
- Present the title, subtitle, author(s) and imagery of the audiobook from the file metadata
- Allow searching of the library by any of the textual tags above
- Provide a fully featured audio media player supporting:
  - Pausing
  - Skipping chapters
  - Adjusting play speed
  - Skipping forward or backwards by 10 seconds

## Source layout

- `src/main/`: Electron **main process** (windows, IPC handlers, library scanning, persistence)
- `src/preload/`: Electron **preload** scripts (safe bridge APIs via `contextBridge`)
- `src/renderer/`: Electron **renderer** UI (Library + Player windows)
- `src/shared/`: Shared types/constants used by main/preload/renderer

## Technical details

- Node version: see `.nvmrc`
- TypeScript with root-relative imports, where `@` is the repo root (see `tsconfig.json`)


