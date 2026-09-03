/**
 * Thin Electron shell (fallback to Tauri). Serves apps/web/out over a privileged app:// protocol
 * with index.html fallback so client-side routes deep-link correctly, and adds the same native
 * menu as the Tauri shell (About, Reset demo data, Toggle theme, Zoom).
 */
import { app, BrowserWindow, ipcMain, Menu, net, protocol, shell, type MenuItemConstructorOptions } from 'electron';
import { existsSync, readFileSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEV_URL = process.env.MAS_DEV_URL;
const OUT_DIR = join(__dirname, '..', '..', 'web', 'out');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

function resolveFile(urlPath: string): string {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [join(OUT_DIR, clean), join(OUT_DIR, `${clean}.html`), join(OUT_DIR, clean, 'index.html')];
  for (const c of candidates) {
    if (c.startsWith(OUT_DIR) && existsSync(c) && statSync(c).isFile()) return c;
  }
  return join(OUT_DIR, 'index.html');
}

function send(win: BrowserWindow, action: string): void {
  win.webContents.send('mas-menu', action);
}

function buildMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Platform',
      submenu: [
        { label: 'About Platform', click: () => app.showAboutPanel() },
        { type: 'separator' },
        { label: 'Reset demo data', click: () => send(win, 'reset-demo') },
        { type: 'separator' },
        isMac ? { role: 'quit' } : { role: 'quit', label: 'Exit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle theme', accelerator: 'CmdOrCtrl+Shift+T', click: () => send(win, 'toggle-theme') },
        { type: 'separator' },
        { label: 'Zoom in', accelerator: 'CmdOrCtrl+=', click: () => send(win, 'zoom-in') },
        { label: 'Zoom out', accelerator: 'CmdOrCtrl+-', click: () => send(win, 'zoom-out') },
        { label: 'Actual size', accelerator: 'CmdOrCtrl+0', click: () => send(win, 'zoom-reset') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    title: 'Platform',
    backgroundColor: '#FCFAF5',
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  buildMenu(win);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadURL('app://platform/');
}

app.setAboutPanelOptions({ applicationName: 'Platform', applicationVersion: app.getVersion(), credits: 'Multi-agency public protection platform (Scotland). Demonstration build with synthetic data only.' });

/** Message overrides live beside the other app data, only the keys someone changed. */
function overridesPath(): string {
  return join(app.getPath('userData'), 'message-overrides.json');
}

ipcMain.handle('mas-overrides-load', () => {
  const path = overridesPath();
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
});

ipcMain.handle('mas-overrides-save', (_event, json: string) => {
  const path = overridesPath();
  if (json === '{}') {
    if (existsSync(path)) unlinkSync(path);
    return;
  }
  writeFileSync(path, json);
});

void app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    return net.fetch(pathToFileURL(resolveFile(pathname)).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
