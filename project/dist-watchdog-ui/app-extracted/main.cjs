/**
 * LogSentinel Watchdog - Start, stop, restart the LogSentinel Web app.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createWatchdogController } = require('./watchdog-core.cjs');

let mainWindow;
let watchdog;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'LogSentinel Watchdog',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

app.whenReady().then(() => {
  watchdog = createWatchdogController(
    (status, msg) => sendToRenderer('watchdog-status-change', status, msg),
    (msg) => sendToRenderer('watchdog-log', msg)
  );

  ipcMain.handle('watchdog-start', () => {
    watchdog.start();
    return watchdog.getStatus();
  });

  ipcMain.handle('watchdog-stop', () => {
    watchdog.stop();
    return watchdog.getStatus();
  });

  ipcMain.handle('watchdog-restart', () => {
    watchdog.restart();
    return 'restarting';
  });

  ipcMain.handle('watchdog-status', () => watchdog.getStatus());
  ipcMain.handle('watchdog-logs', (_, n) => watchdog.getLogs(n ?? 100));

  createWindow();
});

app.on('window-all-closed', () => {
  if (watchdog) watchdog.stop();
  app.quit();
});
