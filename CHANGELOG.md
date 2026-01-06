# Changelog

All notable changes to this project will be documented in this file.

## [1.0.3] - 2026-01-06

### Changed
- **Optimization**: Significant reduction in AppImage size by moving build-time dependencies to `devDependencies`.
- **UI Refinement**: Increased contrast of footer keybinding hints for better readability.

## [1.0.2] - 2026-01-06

### Added
- **Start Hidden**: Application now launches minimized to the system tray by default.
- **External Keybindings**: Support for `miniclip show` command to trigger the window externally (ideal for Wayland system shortcuts).
- **Version Display**: Version number is now shown in the native window title bar for both main and preferences windows.
- **Assets**: Added application screenshot to documentation.

### Changed
- **Shortcut Logic**: Removed internal global shortcut registration in favor of system-level shortcuts for better compatibility.
- **UI Polishing**: Refined search placeholder visibility for a more consistent GNOME-inspired look.
- **Window Size**: Unified main window and preferences window dimensions for a consistent experience.
- **Documentation**: Completely updated `README.md` with installation guides and shortcut setup instructions.

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
