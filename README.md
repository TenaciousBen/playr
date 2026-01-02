# Playr

![Playr author mode](https://raw.githubusercontent.com/TenaciousBen/playr/refs/heads/main/assets/app.png "Playr author mode")

Playr is an Electron-based audio player for the purpose of playing long form audio content, such as audiobooks, radio or podcasts. It is fully portable, so the .exe in [the releases](https://github.com/TenaciousBen/playr/releases) can run as a standalone application.

## Features

- Presenting a library of audiobooks based on folders and files the user drags into the Library window of the application
- Keeping track of last played location of audiobooks
- Presenting the title, subtitle, author(s) and imagery of the audiobook from the file metadata
- Allow searching of the library by any of the textual tags above
- Provide a fully featured audio media player supporting:
  - Pausing
  - Skipping chapters
  - Adjusting play speed
  - Skipping forward or backwards by 10 seconds
  - Playing audio queues (collections of podcast episodes etc)
- Favouriting media and searching by favourites

## Source layout

- `src/main/`: Electron **main process** (windows, IPC handlers, library scanning, persistence)
- `src/preload/`: Electron **preload** scripts (safe bridge APIs via `contextBridge`)
- `src/renderer/`: Electron **renderer** UI (Library + Player windows)
- `src/shared/`: Shared types/constants used by main/preload/renderer

## Technical details

- Node version: see `.nvmrc`
- TypeScript with root-relative imports, where `@` is the repo root (see `tsconfig.json`)


