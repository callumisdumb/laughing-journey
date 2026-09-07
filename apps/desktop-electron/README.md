# Desktop shell (Electron, fallback)

Loads the same `apps/web/out` export as the Tauri shell through a privileged `app://` protocol with `index.html` fallback, and exposes the same `mas-menu` actions through a preload bridge.

```
pnpm desktop:electron:dev     # loads http://localhost:3000 from `pnpm dev`
pnpm desktop:electron:build   # dmg on macOS, nsis and msi on Windows, into apps/desktop-electron/release
```

The renderer runs with context isolation and the sandbox on; Node is not exposed.
