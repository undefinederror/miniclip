# Coding Conventions

## TypeScript

- **Strict mode**: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- Target ES2020, module ESNext, bundler module resolution.
- JSX: `react-jsx` (automatic runtime).
- Prefer interfaces for data shapes, types for unions/function signatures.

## React

- Functional components only, hooks-based.
- `useState`, `useEffect`, `useRef`, `useCallback` — standard hooks.
- No class components, no Redux/external state management.
- Components are in flat `src/` directory (no deep nesting).
- Event handlers named `handle*` (e.g., `handleSelectItem`, `handleDeleteItem`).

## Styling

- Tailwind CSS utility classes exclusively — no CSS modules or styled-components.
- Use GNOME theme color tokens (`text-gnome-text`, `bg-gnome-surface`, etc.) — not raw colors.
- Dark mode handled automatically via CSS variables + `prefers-color-scheme`.

## Electron Main Process

- Use `electron-log` for all logging (not `console.log`).
- All IPC handlers registered in `main.ts` using `ipcMain.handle()`.
- Database operations are synchronous (better-sqlite3 API).
- Wrap DB operations in try/catch, log errors with `log.error()`.
- Global error handlers for `uncaughtException` and `unhandledRejection`.

## File Organization

- Shared types/interfaces between main and renderer go in `src/shared/`.
- Type declarations for the renderer go in `src/vite-env.d.ts`.
- Build scripts go in `scripts/` as ESM (`.mjs`).