import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectories: () => ipcRenderer.invoke('select-directories'),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  platform: process.platform, // 暴露系统平台信息
}); 