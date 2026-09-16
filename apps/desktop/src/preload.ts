import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sozialzync', {
  version:        () => ipcRenderer.invoke('app-version') as Promise<string>,
  platform:       () => ipcRenderer.invoke('platform') as Promise<string>,
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  onUpdateAvailable: (cb: () => void) => {
    ipcRenderer.on('update-available', cb);
    return () => ipcRenderer.removeListener('update-available', cb);
  },
});
