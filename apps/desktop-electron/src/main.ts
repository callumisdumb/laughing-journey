/**
 * Thin Electron shell (fallback to Tauri). Serves apps/web/out over a privileged app:// protocol
 * with index.html fallback so client-side routes deep-link correctly, and adds the same native
 * menu as the Tauri shell (About, Reset demo data, Toggle theme, Zoom). Menu and About text come
 * from the message catalogue, with any saved overrides applied, so both shells read identically.
 */
import { app, BrowserWindow, ipcMain, Menu, net, protocol, safeStorage, shell, type MenuItemConstructorOptions } from 'electron';
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

/** Message overrides live beside the other app data, only the keys someone changed. */
function overridesPath(): string {
  return join(app.getPath('userData'), 'message-overrides.json');
}

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else flatten(value, path, out);
  }
  return out;
}

/**
 * The catalogue: packages/messages/src/en-GB.json in development, resources/en-GB.json when
 * packaged (electron-builder copies it). Saved overrides win. Shell messages take only simple
 * {name} arguments, which is all the desktop namespace uses.
 */
function loadMessages(): (key: string, args?: Record<string, string>) => string {
  const candidates = [join(process.resourcesPath ?? '', 'en-GB.json'), join(__dirname, '..', '..', '..', 'packages', 'messages', 'src', 'en-GB.json')];
  let messages: Record<string, string> = {};
  for (const c of candidates) {
    if (existsSync(c)) {
      messages = flatten(JSON.parse(readFileSync(c, 'utf8')) as Tree);
      break;
    }
  }
  try {
    const path = overridesPath();
    if (existsSync(path)) Object.assign(messages, JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>);
  } catch {
    /* a corrupt overrides file must not stop the shell */
  }
  return (key, args = {}) => (messages[key] ?? key).replace(/\{(\w+)\}/g, (_m, name: string) => args[name] ?? `{${name}}`);
}

function send(win: BrowserWindow, action: string): void {
  win.webContents.send('mas-menu', action);
}

function buildMenu(win: BrowserWindow): void {
  const t = loadMessages();
  const isMac = process.platform === 'darwin';
  const appName = t('product.name');
  const template: MenuItemConstructorOptions[] = [
    {
      label: appName,
      submenu: [
        { label: t('desktop.about.title', { app: appName }), click: () => app.showAboutPanel() },
        { type: 'separator' },
        { label: t('desktop.menu.resetDemo'), click: () => send(win, 'reset-demo') },
        { type: 'separator' },
        { role: 'quit', label: isMac ? t('desktop.menu.quit') : t('desktop.menu.exit') },
      ],
    },
    {
      label: t('desktop.menu.edit'),
      submenu: [
        { role: 'undo', label: t('desktop.menu.undo') },
        { role: 'redo', label: t('desktop.menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: t('desktop.menu.cut') },
        { role: 'copy', label: t('desktop.menu.copy') },
        { role: 'paste', label: t('desktop.menu.paste') },
        { role: 'selectAll', label: t('desktop.menu.selectAll') },
      ],
    },
    {
      label: t('desktop.menu.view'),
      submenu: [
        { label: t('desktop.menu.toggleTheme'), accelerator: 'CmdOrCtrl+Shift+T', click: () => send(win, 'toggle-theme') },
        { type: 'separator' },
        { label: t('desktop.menu.zoomIn'), accelerator: 'CmdOrCtrl+=', click: () => send(win, 'zoom-in') },
        { label: t('desktop.menu.zoomOut'), accelerator: 'CmdOrCtrl+-', click: () => send(win, 'zoom-out') },
        { label: t('desktop.menu.actualSize'), accelerator: 'CmdOrCtrl+0', click: () => send(win, 'zoom-reset') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('desktop.menu.fullScreen') },
      ],
    },
    {
      label: t('desktop.menu.window'),
      submenu: [
        { role: 'minimize', label: t('desktop.menu.minimise') },
        { role: 'close', label: t('desktop.menu.close') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  app.setAboutPanelOptions({ applicationName: appName, applicationVersion: app.getVersion(), credits: t('desktop.about.credits') });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    title: loadMessages()('product.name'),
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

/**
 * The device key, protected by the OS keychain.
 *
 * `safeStorage` is backed by the Keychain on macOS, DPAPI on Windows and the Secret Service on
 * Linux, so the key on disk is bound to the OS user account and, on most platforms, to hardware. The
 * renderer never sees the encrypted form: it asks for the key, the main process unseals it, and the
 * local store is encrypted under a key derived from it. Close the app, open the data file, and there
 * is nothing to read.
 *
 * Where the platform has no keychain available, the key is refused rather than written in the clear.
 * A device key sitting in plaintext beside the data it protects is worse than no device key at all,
 * because it looks like protection.
 */
function deviceKeyPath(): string {
  return join(app.getPath('userData'), 'device-key.bin');
}

ipcMain.handle('mas-device-key-load', () => {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const path = deviceKeyPath();
  if (!existsSync(path)) return null;
  try {
    return safeStorage.decryptString(readFileSync(path));
  } catch {
    // A key sealed by a different OS user or a reinstalled keychain: start clean rather than refuse
    // to launch, which for a safeguarding product is the worse failure.
    return null;
  }
});

ipcMain.handle('mas-device-key-save', (_event, base64: string) => {
  if (!safeStorage.isEncryptionAvailable()) return;
  writeFileSync(deviceKeyPath(), safeStorage.encryptString(base64));
});

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
