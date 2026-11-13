# Overview

Miniclip is a minimal clipboard manager for Linux (Wayland/X11), built with Electron and React. It monitors the system clipboard, persists history (text + images) to a local SQLite database, and provides a compact popup window for searching and restoring previous clipboard entries. It runs as a system-tray application and is distributed as a Snap, .deb, and AppImage.

- **License**: GPL-3.0-only
- **App ID**: `com.miniclip.app`
- **Desktop name / executable**: `miniclip`

# Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Electron | 44.x |
| UI Framework | React | 18.x |
| Language | TypeScript (strict) | 5.x |
| Build tool | Vite | 5.x |
| Styling | Tailwind CSS v4 (via `@tailwindcss/postcss`) | 4.x |
| Database | better-sqlite3 (native, synchronous) | 13.x |
| Logging | electron-log | 5.x |
| Packaging | electron-builder | 26.x |
| Linting | ESLint + @typescript-eslint | 8.x / 7.x |