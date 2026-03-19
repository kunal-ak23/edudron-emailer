import { contextBridge, ipcRenderer } from 'electron';
import type { IElectronAPI, SendProgress, SendStatus } from '../shared/ipc-types';

const api: IElectronAPI = {
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getStatus: () => ipcRenderer.invoke('auth:status'),
  },
  csv: {
    parse: (filePath: string) => ipcRenderer.invoke('csv:parse', filePath),
    selectFile: () => ipcRenderer.invoke('csv:select-file'),
  },
  send: {
    start: (rows, delayMs) => ipcRenderer.invoke('send:start', rows, delayMs),
    pause: () => ipcRenderer.invoke('send:pause'),
    resume: () => ipcRenderer.invoke('send:resume'),
    cancel: () => ipcRenderer.invoke('send:cancel'),
    onProgress: (callback: (progress: SendProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: SendProgress) => callback(progress);
      ipcRenderer.on('send:progress', handler);
      return () => ipcRenderer.removeListener('send:progress', handler);
    },
    onStatusChange: (callback: (status: SendStatus) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: SendStatus) => callback(status);
      ipcRenderer.on('send:status', handler);
      return () => ipcRenderer.removeListener('send:status', handler);
    },
    exportLog: () => ipcRenderer.invoke('send:export-log'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
