import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectories: () => ipcRenderer.invoke('select-directories'),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
}); 