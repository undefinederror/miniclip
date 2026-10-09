# Changelog

All notable changes to this project will be documented in this file.

## [1.3.3] - 2026-10-07

### Fixed
- **Snap build**: Fixed the Snap build by removing an invalid Electron Builder 26.x desktop-file mapping. The workaround is applied in scripts/build.mjs; upstream fix tracked in electron-builder #10077 / #10176.
- **CI**: added `canonical/setup-lxd` so core24 snap builds run in a managed LXD instance.
- - **Snap (dock icon / app name)**: fixed the dock icon and name. The snap's desktop file is now named after the app (`miniclip.desktop`) so GNOME can link snap windows to it; `StartupWMClass` keeps X11 sessions matched too.
- **Snap builds**: dropped the `{ provider: "github" }` entry from `snapcraft.publish`, it was inert for snaps and confusing.

### Changed
- **Releases**: prerelease versions (any version with a `-`, e.g. `1.3.3-alpha.0`) now publish to the Snap Store `edge` channel and are flagged as GitHub pre-releases. Full releases keep going to `stable` as a normal release. The channel/release-type selection is derived from the version in `scripts/build.mjs`.

## [1.3.2] - 2026-09-30

### Fixed
- **Snap build**: use canonical/setup-lxd to enable proper core24 LXD builds. 

## [1.3.1] - 2026-09-29

### Added
- **Upgraded packages**: migrated to core24, updated better-sqlite and Electron.

## [1.3.0] - 2026-06-11

### Added
- **Persistent history**: sqlite on disk, also images get stored on disk rather than in memory.

## [1.2.0] - 2026-06-10

### Added
- **Electron log**: Persistent log file in app.getPath('userData')/logs/main.log.

## [1.1.7] - 2026-04-16

### Fixed
- **Autostart option**: Removed option from snap since it can't be optional.

## [1.1.6] - 2026-04-13

### Fixed
- **Snap Autostart**: Fixed .desktop file path for snap.

## [1.1.5] - 2026-04-13

### Fixed
- **AppImage Tests**: Force-show the main window on first launch to satisfy AppImage integration tests.

## [1.1.4] - 2026-03-12

### Fixed
- **Linux Dock Integration**: Resolved issues with the Linux dock. Standardized `StartupWMClass` across all build formats.
- **Snap Stability**: Fixed "Permission Denied" crashes in Snap builds by adding essential plugs
- **Release Identity**: Unified application identity and versioning

### Added
- **Automated Release Pipeline**: Integrated GitHub Actions to automatically build and publish AppImage, .deb, and Snap packages.
- **Better-SQLite3 Prebuilds**: Integrated native dependency rebuilding in CI,

## [1.1.3] - 2026-03-11

### Added
- **GitHub Actions**: Automated the release process via CI.
- **AppStream Metadata**: Added metainfo file for better integration with software centers (Flathub/GNOME Software).

## [1.1.2] - 2026-03-06

### Fixed
- **Snap Build**: Resolved build-time errors when generating snap packages.

## [1.1.1] - 2026-03-05

### Fixed
- **About Link**: Ensured the project link in the About window opens in the system's default browser instead of a new Electron window.

## [1.1.0] - 2026-03-04

### Added
- **Image Support**: Screenshots are now stored in history.
- **Size Badges**: Added human-readable size labels to all clipboard items.

## [1.0.3] - 2026-01-06

### Changed
- **Optimization**: Significant reduction in AppImage size by moving build-time dependencies to `devDependencies`.

## [1.0.2] - 2026-01-06

### Added
- **Start Hidden**: Application now launches minimized to the system tray by default.
- **External Keybindings**: Support for `miniclip show` command to trigger the window externally (ideal for Wayland system shortcuts).

### Fixed
- **AppImage Icons**: Resolved issues with generic icons appearing in some desktop environments.

### Removed
- **Unused Dependencies**: Cleaned up `sharp`, `lucide-react`, `clsx`, and `tailwind-merge` to reduce bundle size.

## [1.0.0] - 2026-01-05

### Added
- Initial release of Miniclip.
- Clipboard monitoring and history management.
- GNOME-inspired dark theme UI.
- System tray integration.
- Session-based SQLite history storage.
- Settings for autostart, max history, and autoclose on select.
