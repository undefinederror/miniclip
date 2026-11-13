# Architecture & Key Patterns

## Process Model

- **Main process** (`electron/main.ts`): All system interaction — clipboard polling (500ms interval), SQLite DB, tray, window management, settings (JSON file), IPC handlers.
- **Preload** (`electron/preload.ts`): Exposes typed `window.electronAPI` via `contextBridge`. All renderer↔main communication goes through this.
- **Renderer** (`src/`): Pure React UI. No direct Node/Electron imports. Communicates exclusively through `window.electronAPI`.

## IPC Pattern

- **Events (main → renderer)**: `clipboard-change`, `settings-changed`, `window-hidden` — subscribed via `ipcRenderer.on`, return cleanup functions.
- **Invoke (renderer → main)**: `get-history`, `copy-to-clipboard`, `delete-history-item`, `clear-history`, `toggle-pin`, `hide-window`, `minimize-window`, `close-window`, `get-settings`, `set-settings`, `get-version`, `open-external`.

## Database

- SQLite via `better-sqlite3` (synchronous API).
- DB file: `clipboard_history.db` in `app.getPath('userData')`.
- Table `clipboard_history`: `id`, `content`, `content_type` ('text'|'image'), `original_format`, `created_at`, `hash`, `pinned`, `sort_time`.
- Images stored on disk in `userData/images/`, referenced via custom protocol `miniclip-img://`.
- History trimmed by `maxHistorySize`; pinned items excluded from trimming.

## Settings

- Stored as JSON in user data directory.
- `Settings` interface in `src/shared/settings.ts` — imported by both main and renderer.
- Changes broadcast via `settings-changed` IPC event.

## Routing (Renderer)

- No router library. Hash-based: `#preferences` → Preferences, `#about` → About, default → App.
- Each "page" is a separate BrowserWindow with the appropriate hash.

## Theming

- GNOME-inspired design with CSS custom properties for light/dark themes.
- Theme switches via `prefers-color-scheme` media query.
- Custom Tailwind colors: `gnome-bg`, `gnome-surface`, `gnome-accent`, `gnome-text`, `gnome-text-dim`, `gnome-border`, `gnome-input`.
- Custom utilities: `draggable` / `no-drag` (for Electron window drag regions).

## Single Instance

- Uses `app.requestSingleInstanceLock()`. Second instance with `show` arg focuses existing window.

## Wayland Compatibility

- Global shortcuts NOT registered in-app — users set them via system settings (`miniclip show` CLI).
- On Wayland sessions the app forces the X11 (XWayland) backend via `--ozone-platform=x11` (self-relaunch at the top of `electron/main.ts`; dev flag in `vite.config.ts`). Wayland's core clipboard protocol only serves the focused client, so an unfocused clipboard manager can't read the clipboard reliably without it.