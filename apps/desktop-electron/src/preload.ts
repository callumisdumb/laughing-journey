import { contextBridge, ipcRenderer } from 'electron';

/** The same surface the Tauri shell exposes: subscribe to menu actions. */
contextBridge.exposeInMainWorld('masDesktop', {
  onMenu: (handler: (action: string) => void) => {
    const listener = (_event: unknown, action: string) => handler(action);
    ipcRenderer.on('mas-menu', listener);
    return () => ipcRenderer.removeListener('mas-menu', listener);
  },
  overrides: {
    load: (): Promise<string | null> => ipcRenderer.invoke('mas-overrides-load') as Promise<string | null>,
    save: (json: string): Promise<void> => ipcRenderer.invoke('mas-overrides-save', json) as Promise<void>,
  },
  /**
   * The device key, held by the OS keychain. The renderer receives the key itself and never the
   * sealed form: unsealing is the main process's job because only it can reach safeStorage.
   */
  deviceKey: {
    load: (): Promise<string | null> => ipcRenderer.invoke('mas-device-key-load') as Promise<string | null>,
    save: (base64: string): Promise<void> => ipcRenderer.invoke('mas-device-key-save', base64) as Promise<void>,
  },
  shell: 'electron',
});
