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
  shell: 'electron',
});
