import type { IElectronAPI } from '../shared/ipc-types';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
