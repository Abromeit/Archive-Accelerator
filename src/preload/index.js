import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    onProviderAction: (callback) => {
        ipcRenderer.on('provider-action', (_event, data) => callback(data));
    },
});
