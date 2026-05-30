# YT Downloader

Electron desktop app for downloading YouTube videos. Built with React + MUI + TypeScript. Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp).

## Stack

- **Electron** — desktop shell
- **React + MUI** — UI
- **TypeScript** — throughout (main + renderer)
- **Vite** — renderer bundler
- **yt-dlp** — download engine (auto-downloaded on `npm install`)
- **ffmpeg-static** — bundled ffmpeg for merging video/audio

## Setup

```bash
cd yt-downloader
npm install       # installs deps + auto-downloads yt-dlp binary into bin/
npm run dev       # starts Vite dev server + Electron
```

## Build

```bash
npm run build:mac     # .dmg
npm run build:win     # NSIS installer
npm run build:linux   # AppImage
```

## Publish To GitHub

From the project root:

```bash
git init
git add .
git commit -m "chore: initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/yt-downloader.git
git push -u origin main
```

If your repo already exists locally, skip `git init` and only run the missing commands.

## Project Structure

```
src/
  electron/
    main/
      main.ts       # Electron main process, IPC handlers
      ytdlp.ts      # yt-dlp spawn, fetch info, download, progress parsing
      queue.ts      # Sequential download queue with per-item state
      utils.ts      # DEV_MODE flag, logging
    preload/
      preload.ts    # contextBridge — exposes window.api to renderer
  renderer/
    App.tsx                    # Root component, URL input, tabs
    main.tsx                   # React entry point
    components/
      VideoCard.tsx            # Video metadata + quality selector
      QueuePanel.tsx           # Download queue with progress bars
      LogPanel.tsx             # Live yt-dlp log output
    stores/appStore.ts         # useState-based state management
    theme/theme.ts             # MUI dark theme
    window.d.ts                # window.api type declaration
  shared/
    types.ts                   # Shared types (VideoInfo, QueueItem, etc.)
scripts/
  postinstall.js    # Auto-downloads yt-dlp binary on npm install
bin/                # yt-dlp binary (populated by postinstall)
```

## Features

- Paste URL → Fetch video info with thumbnail, title, duration
- Quality selector: all available resolutions (4K/2K/1080p/720p…) + MP3/M4A audio
- Download queue with per-item progress, speed, ETA
- Retry failed downloads, cancel current/all
- Configurable download folder
- Live log output panel
- Dark theme, macOS vibrancy support
