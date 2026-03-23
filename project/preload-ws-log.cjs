/**
 * Preload script for WebSocket log-to-file.
 * Exposes safe IPC methods to the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wsLogToFile', {
  selectFile: () => ipcRenderer.invoke('select-ws-log-file'),
  appendToFile: (filePath, content) => ipcRenderer.invoke('append-ws-log-file', filePath, content)
});

contextBridge.exposeInMainWorld('selectFolder', () => ipcRenderer.invoke('select-folder'));
