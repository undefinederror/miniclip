# Changelog

All notable changes to this project will be documented in this file.

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
