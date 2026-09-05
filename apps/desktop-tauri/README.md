# Desktop shell (Tauri 2)

Loads `apps/web/out` (the Next.js static export) in a system WebView with a native menu: About, Reset demo data, Toggle theme, Zoom. Menu actions are emitted to the web app as the `mas-menu` event; the app handles them in `apps/web/lib/desktop.ts`.

## Build on macOS

```
rustup default stable
pnpm install
pnpm desktop:tauri:build      # produces src-tauri/target/release/bundle/dmg/Platform_0.1.0_*.dmg
```

## Build on Windows

Install the Rust toolchain (MSVC) and run `pnpm desktop:tauri:build`. The bundle embeds the WebView2 bootstrapper so locked-down machines without WebView2 still install.

## Linux (not used for the mockup)

Needs `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` and `build-essential`. The CI container for this repository does not have them, so the Tauri binary is built on macOS or Windows.

## Icons

`src-tauri/icons` holds the placeholder lantern. Regenerate every size from `icon.svg` with `pnpm exec tauri icon src-tauri/icons/icon.svg`.

## Capabilities

`src-tauri/capabilities/default.json` grants the main window only: core defaults, theme and title setting, zoom, events, the store plugin and window state. No shell, filesystem or network permissions.
