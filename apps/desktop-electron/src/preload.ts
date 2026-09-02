import { contextBridge, ipcRenderer } from 'electron';

/** The same surface the Tauri shell exposes: subscribe to menu actions. */
contextBridge.exposeInMainWorld('masDesktop', {
  onMenu: (handler: (action: string) => void) => {
    const listener = (_event: unknown, action: string) => handler(action);
    ipcRenderer.on('mas-menu', listener);
    return () => ipcRenderer.removeListener('mas-menu', listener);
  },
  shell: 'electron',
});
