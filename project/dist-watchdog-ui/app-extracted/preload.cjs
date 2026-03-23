const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('watchdog', {
  start: () => ipcRenderer.invoke('watchdog-start'),
  stop: () => ipcRenderer.invoke('watchdog-stop'),
  restart: () => ipcRenderer.invoke('watchdog-restart'),
  getStatus: () => ipcRenderer.invoke('watchdog-status'),
  getLogs: (n) => ipcRenderer.invoke('watchdog-logs', n),
  onStatus: (fn) => {
    const handler = (_, ...args) => fn(...args);
    ipcRenderer.on('watchdog-status-change', handler);
    return () => ipcRenderer.removeListener('watchdog-status-change', handler);
  },
  onLog: (fn) => {
    const handler = (_, ...args) => fn(...args);
    ipcRenderer.on('watchdog-log', handler);
    return () => ipcRenderer.removeListener('watchdog-log', handler);
  },
  openDashboard: () => shell.openExternal('http://localhost:3000')
});
