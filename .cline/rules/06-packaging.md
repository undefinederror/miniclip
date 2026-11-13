# Packaging & Release

- **Targets**: AppImage, .deb, Snap (Linux only — no macOS/Windows).
- **CI**: GitHub Actions, triggered on tag push (`*`).
- **Publishing policy** (in `scripts/build.mjs`):
  - Prerelease versions (containing `-`) → Snap Store `edge` + GitHub pre-release.
  - Release versions → Snap Store `stable` + GitHub release.
  - Override with `SNAP_CHANNEL=<channel>` env var.
- **Snap**: core24 base, strict confinement, LXD builds.
- **Version bumping**: update `package.json` version; `prebuild` hook auto-updates metainfo XML.

# Important Caveats

- **No tests exist** — there is no test framework configured.
- **Linux-only** — no macOS or Windows support.
- **No router** — multi-window hash routing is manual.
- **better-sqlite3 is native** — marked as `external` in Vite config and must be rebuilt for the target Electron version (handled in CI).
- **Snap has special constraints** — desktop file naming, StartupWMClass, environment variables. Read the comments in `electron/main.ts` and `electron-builder.json5` before changing snap-related config.
- **Images use a custom protocol** (`miniclip-img://`) — not base64 data URLs. Protocol handler registered in main process.