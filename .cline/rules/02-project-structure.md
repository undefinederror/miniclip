# Project Structure

```
miniclip/
├── electron/                  # Electron main process
│   ├── main.ts                # App lifecycle, IPC handlers, clipboard polling, tray, DB
│   ├── preload.ts             # contextBridge API exposed to renderer
│   └── electron-env.d.ts      # Node/Electron env type augmentations
├── src/                       # Renderer process (React)
│   ├── main.tsx               # Entry point — hash-based routing (#preferences, #about)
│   ├── App.tsx                # Main clipboard history UI
│   ├── Preferences.tsx        # Settings window
│   ├── About.tsx              # About window
│   ├── PinIcon.tsx            # SVG pin icon component
│   ├── index.css              # Tailwind imports, GNOME theme CSS variables, custom utilities
│   ├── vite-env.d.ts          # Global type declarations (ClipboardItem, Window.electronAPI)
│   └── shared/
│       └── settings.ts        # Settings interface + defaults (shared between main & renderer)
├── scripts/
│   ├── build.mjs              # Programmatic electron-builder entry (snap workaround + publish)
│   ├── fix-appimage.mjs       # Pre-pack hook: patches AppImage desktop file version
│   └── update-metainfo.mjs    # Pre-build hook: syncs AppStream metainfo with package.json
├── build/
│   ├── applications/          # .desktop file
│   └── metainfo/              # AppStream appdata XML
├── public/                    # Static assets (icons, tray images)
├── .github/workflows/
│   └── release.yml            # CI: build + publish on tag push
├── electron-builder.json5     # Packaging config (Linux targets: appimage, deb, snap)
├── vite.config.ts             # Vite + electron plugin config
├── tsconfig.json              # TypeScript config (strict, ES2020, react-jsx)
└── .eslintrc.cjs              # ESLint config
```