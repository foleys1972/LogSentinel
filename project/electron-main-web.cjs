/**
 * LogSentinel Enterprise - Web App EXE
 * Starts the Express web server and opens a browser window.
 * Multiple users can browse to http://<your-ip>:3000
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let serverModule;

// Prevent multiple instances - only allow one app window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.focus();
      mainWindow.show();
    }
  });
}

// IPC handlers for WebSocket log-to-file
ipcMain.handle('select-ws-log-file', async () => {
  try {
    const win = mainWindow || BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win || {}, {
      title: 'Select WebSocket Log File',
      defaultPath: 'websocket-logs.txt',
      filters: [{ name: 'Log Files', extensions: ['txt', 'log'] }, { name: 'All Files', extensions: ['*'] }]
    });
    if (!result.canceled && result.filePath) {
      return { success: true, filePath: result.filePath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('select-folder', async () => {
  try {
    const win = mainWindow || BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win || {}, {
      title: 'Select Folder to Monitor',
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths?.[0]) {
      return { success: true, folderPath: result.filePaths[0] };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('append-ws-log-file', async (event, filePath, content) => {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(filePath, `[${timestamp}] ${content}\n`);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

const isHeadless = process.argv.includes('--headless');

function createWindow(port = 3000) {
  if (isHeadless) return;
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'LogSentinel Enterprise - Web App',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-ws-log.cjs')
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL(`http://localhost:${port}`).catch((err) => {
    console.error('Failed to load app:', err);
    mainWindow.loadURL('about:blank');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  try {
    const serverPath = path.join(__dirname, 'server.cjs');
    serverModule = require(serverPath);
  } catch (err) {
    console.error('Failed to start server:', err);
    const errWin = new BrowserWindow({ width: 500, height: 300 });
    errWin.loadURL(`data:text/html,<h2>Server failed to start</h2><pre>${encodeURIComponent(String(err))}</pre>`);
    return;
  }

  serverModule.serverReady.once('ready', (port) => {
    createWindow(port);
    if (isHeadless) {
      console.log(`LogSentinel server running at http://localhost:${port}`);
      console.log('Remote access: http://<this-machine-ip>:' + port);
    }
  });
});

app.on('window-all-closed', () => {
  if (isHeadless) return;
  if (serverModule && serverModule.server) {
    serverModule.server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverModule && serverModule.server) {
    serverModule.server.close();
  }
});
