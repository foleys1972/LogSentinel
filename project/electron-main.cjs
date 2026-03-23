const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

console.log('🚀 Electron Main Process Starting with NODE.JS INTEGRATION...');

let mainWindow;
let fileWatchers = new Map();
let monitoringPaths = new Map(); // Store paths for each site

function createWindow() {
  console.log('🪟 Creating window with Node.js integration enabled...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,        // ✅ CRITICAL: Enable Node.js
      contextIsolation: false,      // ✅ CRITICAL: Disable isolation
      webSecurity: false,           // ✅ Allow local file access
      enableRemoteModule: true      // ✅ Enable remote module
    },
    title: 'LogSentinel Enterprise - Node.js Enabled'
  });

  console.log('📄 Loading React app with Node.js access...');
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Test Node.js integration after page loads
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('✅ Page loaded - testing Node.js integration...');
    
    setTimeout(() => {
      mainWindow.webContents.executeJavaScript(`
        console.log('🔧 NODE.JS INTEGRATION TEST:');
        console.log('window.require type:', typeof window.require);
        console.log('process available:', typeof process);
        
        if (typeof window.require === 'function') {
          console.log('✅ SUCCESS: Node.js integration working!');
          try {
            const { ipcRenderer } = window.require('electron');
            console.log('✅ IPC renderer accessible');
          } catch (e) {
            console.error('❌ IPC error:', e);
          }
        } else {
          console.error('❌ FAILED: window.require not available');
        }
      `).catch(err => console.error('❌ Script execution error:', err));
    }, 2000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('⚡ Electron app ready, creating window...');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers for WebSocket log-to-file

ipcMain.handle('select-ws-log-file', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
      title: 'Select WebSocket Log File',
      defaultPath: 'websocket-logs.txt',
      filters: [{ name: 'Log Files', extensions: ['txt', 'log'] }, { name: 'All Files', extensions: ['*'] }]
    });
    if (!result.canceled && result.filePath) {
      return { success: true, filePath: result.filePath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error selecting log file:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
      title: 'Select Folder to Monitor',
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths?.[0]) {
      return { success: true, folderPath: result.filePaths[0] };
    }
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error selecting folder:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('append-ws-log-file', async (event, filePath, content) => {
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${content}\n`;
    fs.appendFileSync(filePath, line);
    return { success: true };
  } catch (error) {
    console.error('Error appending to log file:', error);
    return { success: false, error: String(error) };
  }
});

// SNMP trap forwarding
let sendSnmpTrapMain;
try {
  sendSnmpTrapMain = require('./snmp-trap-sender.cjs').sendTrap;
} catch (e) {
  sendSnmpTrapMain = null;
}
ipcMain.handle('send-snmp-trap', async (event, config, payload) => {
  if (!sendSnmpTrapMain) {
    return { success: false, error: 'SNMP trap forwarding not available (net-snmp required)' };
  }
  try {
    await sendSnmpTrapMain(config, payload);
    return { success: true };
  } catch (err) {
    console.error('SNMP trap error:', err);
    return { success: false, error: err.message };
  }
});

// IPC Handlers for file monitoring

// Check if path exists
ipcMain.handle('check-path-exists', async (event, filePath) => {
  console.log(`🔍 Checking path: ${filePath}`);
  try {
    const exists = fs.existsSync(filePath);
    console.log(`📁 Path ${filePath} exists: ${exists}`);
    return exists;
  } catch (error) {
    console.error(`❌ Error checking path ${filePath}:`, error);
    return false;
  }
});

// Get directory contents
ipcMain.handle('get-directory-contents', async (event, dirPath) => {
  console.log(`📂 Reading directory: ${dirPath}`);
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const contents = items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      isFile: item.isFile(),
      fullPath: path.join(dirPath, item.name)
    }));
    console.log(`✅ Found ${contents.length} items in ${dirPath}`);
    return contents;
  } catch (error) {
    console.error(`❌ Error reading directory ${dirPath}:`, error);
    return [];
  }
});

// Start monitoring with FULL logging (recursive subfolders, real-time tail)
ipcMain.handle('start-monitoring', async (event, watcherKey, folderPath, options = {}) => {
  const siteName = options.siteInfo?.siteName || watcherKey;
  const siteId = options.siteInfo?.siteId || watcherKey;
  console.log('🎯 === STARTING FILE MONITORING ===');
  console.log(`Site: ${siteName}`);
  console.log(`Path: ${folderPath}`);
  console.log(`Options:`, options);
  
  try {
    // Validate path
    if (!fs.existsSync(folderPath)) {
      console.error(`❌ Path does not exist: ${folderPath}`);
      return { success: false, error: `Path does not exist: ${folderPath}` };
    }

    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      console.error(`❌ Path is not a directory: ${folderPath}`);
      return { success: false, error: `Path is not a directory: ${folderPath}` };
    }

    console.log(`✅ Path validated: ${folderPath}`);

    // Stop existing watcher
    if (fileWatchers.has(watcherKey)) {
      console.log(`🛑 Stopping existing watcher for ${watcherKey}`);
      await fileWatchers.get(watcherKey).watcher.close();
    }

    // Set up file patterns - recursive: watch folder and all child folders
    const recursive = options.recursive !== false;
    const filePatterns = options.filePatterns || ['*.log', '*.txt'];
    const watchPaths = recursive
      ? filePatterns.map(p => path.join(folderPath, '**', p))
      : filePatterns.map(p => path.join(folderPath, p));
    
    console.log(`👁️ Watching ${recursive ? 'recursively' : 'top-level'}: ${watchPaths.join(', ')}`);

    // Count existing files for statistics (recursive if needed)
    let fileCount = 0;
    function countLogFiles(dir, depth = 0) {
      if (depth > 20) return;
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory() && recursive) {
            countLogFiles(fullPath, depth + 1);
          } else if (item.isFile() && (item.name.endsWith('.log') || item.name.endsWith('.txt'))) {
            fileCount++;
          }
        }
      } catch (e) { /* ignore */ }
    }
    countLogFiles(folderPath);

    const baseIgnore = ['**/.*', '**/*.tmp', '**/*.bak'];
    const winSystemIgnore = [
      '**/System32/**', '**/SysWOW64/**', '**/Tasks/**',
      '**/WinSxS/**', '**/servicing/**', '**/SoftwareDistribution/**'
    ];
    const normalizedFolder = folderPath.replace(/\//g, path.sep).toLowerCase();
    const isWindowsSystem = normalizedFolder.includes('\\windows') || normalizedFolder.includes('/windows');
    const ignored = [...(options.excludePatterns || baseIgnore), ...(isWindowsSystem ? winSystemIgnore : [])];

    const watcher = chokidar.watch(watchPaths, {
      ignored,
      persistent: true,
      usePolling: true,
      interval: 1000,
      depth: recursive ? undefined : 1,
      ignoreInitial: false
    });

    const filePositions = new Map();
    const folderType = options.siteInfo?.folderType || (watcherKey.endsWith('_verint') ? 'verint' : watcherKey.endsWith('_bt') ? 'bt' : undefined);

    watcher
      .on('ready', () => {
        console.log(`✅ 🎉 WATCHER READY FOR ${watcherKey}`);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('monitoring-status', {
            siteName: watcherKey,
            status: 'active',
            message: 'Monitoring started (recursive, tail)'
          });
        }
      })
      .on('add', (filePath) => {
        console.log(`📄 🆕 NEW FILE: ${filePath}`);
        processExistingFile(filePath, siteId, siteName, folderType, filePositions);
      })
      .on('change', (filePath) => {
        console.log(`📝 🔄 FILE CHANGED: ${filePath}`);
        handleFileChange(filePath, siteId, siteName, folderType, filePositions);
      })
      .on('unlink', (filePath) => {
        console.log(`🗑️ FILE DELETED: ${filePath}`);
        filePositions.delete(filePath);
      })
      .on('error', (error) => {
        console.error(`❌ WATCHER ERROR for ${watcherKey}:`, error);
        
        // Send error to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('monitoring-error', {
            siteName: watcherKey,
            error: error.message
          });
        }
      });

    // Store watcher info with path and file count
    fileWatchers.set(watcherKey, {
      watcher,
      filePositions,
      path: folderPath,
      fileCount: fileCount,
      folderType,
      options: options
    });
    
    monitoringPaths.set(watcherKey, folderPath);

    console.log(`✅ 🎉 MONITORING STARTED FOR ${watcherKey} (${fileCount} files, recursive, tail)`);
    
    return { success: true, message: 'Monitoring started successfully' };

  } catch (error) {
    console.error(`❌ FAILED to start monitoring for ${watcherKey}:`, error);
    return { success: false, error: error.message };
  }
});

// Stop monitoring (supports stopping all watchers for a site, e.g. siteId, siteId_verint, siteId_bt)
ipcMain.handle('stop-monitoring', async (event, siteNameOrPrefix) => {
  console.log(`🛑 Stopping monitoring for: ${siteNameOrPrefix}`);
  
  try {
    const toStop = [];
    if (siteNameOrPrefix.includes('_')) {
      toStop.push(siteNameOrPrefix);
    } else {
      fileWatchers.forEach((_, key) => {
        if (key === siteNameOrPrefix || key.startsWith(siteNameOrPrefix + '_')) {
          toStop.push(key);
        }
      });
    }
    
    for (const key of toStop) {
      const watcherInfo = fileWatchers.get(key);
      if (watcherInfo) {
        await watcherInfo.watcher.close();
        fileWatchers.delete(key);
        monitoringPaths.delete(key);
        console.log(`✅ Stopped watcher: ${key}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('monitoring-status', { siteName: key, status: 'stopped', message: 'Monitoring stopped' });
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`❌ Error stopping monitoring:`, error);
    return { success: false, error: error.message };
  }
});

// Get monitoring statistics
ipcMain.handle('get-monitoring-stats', async () => {
  console.log('📊 Getting monitoring statistics...');
  
  const stats = {
    activeSites: fileWatchers.size,
    monitoredPaths: [],
    totalFiles: 0
  };

  // Collect info about each monitored site
  fileWatchers.forEach((watcherInfo, siteName) => {
    try {
      const fileCount = watcherInfo.fileCount || 0;
      
      stats.monitoredPaths.push({
        siteName,
        path: watcherInfo.path || '[Unknown Path]',
        fileCount: fileCount
      });
      
      stats.totalFiles += fileCount;
    } catch (error) {
      console.error(`Error getting stats for ${siteName}:`, error);
    }
  });

  console.log('📊 Monitoring stats:', stats);
  return stats;
});

// Directory selection dialog
ipcMain.handle('select-directory', async () => {
  console.log('📁 Directory selection requested');
  
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Log Directory to Monitor'
    });

    if (result.canceled) {
      console.log('ℹ️ Directory selection cancelled');
      return null;
    }

    const selectedPath = result.filePaths[0];
    console.log('✅ Directory selected:', selectedPath);
    return selectedPath;
  } catch (error) {
    console.error('❌ Error in directory selection:', error);
    return null;
  }
});

// Open log file in default application (e.g. Notepad)
ipcMain.handle('open-log-file', async (event, filePath) => {
  if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Invalid path' };
  try {
    const normalized = path.resolve(filePath);
    if (!fs.existsSync(normalized)) return { success: false, error: 'File not found' };
    await shell.openPath(normalized);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// File selection dialog
ipcMain.handle('select-file', async () => {
  console.log('📄 File selection requested');
  
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Log Files', extensions: ['log', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Select Log File to Monitor'
    });

    if (result.canceled) {
      console.log('ℹ️ File selection cancelled');
      return null;
    }

    const selectedPath = result.filePaths[0];
    console.log('✅ File selected:', selectedPath);
    return selectedPath;
  } catch (error) {
    console.error('❌ Error in file selection:', error);
    return null;
  }
});

// Process existing file (initial read) and initialize tail position so new lines are picked up
function processExistingFile(filePath, siteId, siteName, folderType, filePositions) {
  console.log(`📖 Processing existing file: ${filePath}`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    console.log(`📊 File has ${lines.length} lines`);
    
    const recentLines = lines.slice(-3);
    recentLines.forEach((line) => {
      if (line.trim()) {
        processLogLine(line, filePath, siteId, siteName, folderType);
      }
    });

    const stats = fs.statSync(filePath);
    if (filePositions) {
      filePositions.set(filePath, stats.size);
      console.log(`📌 Tail position set to ${stats.size} for ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`❌ Error processing file ${filePath}:`, error);
  }
}

// Handle file changes (real-time tail)
function handleFileChange(filePath, siteId, siteName, folderType, filePositions) {
  console.log(`🔄 Handling file change: ${filePath}`);
  try {
    const stats = fs.statSync(filePath);
    const currentPosition = filePositions.get(filePath) || 0;
    
    if (stats.size <= currentPosition) {
      return; // No new content
    }

    console.log(`📖 Reading new content (${stats.size - currentPosition} bytes)`);

    const stream = fs.createReadStream(filePath, {
      start: currentPosition,
      encoding: 'utf8'
    });

    let buffer = '';
    
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      lines.forEach((line) => {
        if (line.trim()) {
          processLogLine(line, filePath, siteId, siteName, folderType);
        }
      });
    });

    stream.on('end', () => {
      filePositions.set(filePath, stats.size);
    });

    stream.on('error', (error) => {
      console.error(`❌ Error reading file ${filePath}:`, error);
    });

  } catch (error) {
    console.error(`❌ Error handling file change:`, error);
  }
}

// Process a log line
function processLogLine(line, filePath, siteId, siteName, folderType) {
  console.log(`📨 PROCESSING LOG: ${line.substring(0, 80)}...`);
  
  try {
    let level = 'info';
    const upperLine = line.toUpperCase();
    
    if (upperLine.includes('FATAL') || upperLine.includes('CRITICAL')) {
      level = 'critical';
    } else if (upperLine.includes('ERROR') || upperLine.includes('SEVERE')) {
      level = 'high';
    } else if (upperLine.includes('WARN') || upperLine.includes('WARNING')) {
      level = 'medium';
    } else if (upperLine.includes('DEBUG') || upperLine.includes('TRACE')) {
      level = 'low';
    } else if (upperLine.includes('INFO')) {
      level = 'info';
    }

    const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);
    let timestamp = new Date();
    if (timestampMatch) {
      try {
        timestamp = new Date(timestampMatch[1]);
      } catch (e) {
        timestamp = new Date();
      }
    }

    const ipMatch = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    const ip = ipMatch ? ipMatch[0] : undefined;

    const errorCodeMatch = line.match(/\b[A-Z]{2,}\d{3,}\b/);
    const errorCode = errorCodeMatch ? errorCodeMatch[0] : undefined;

    const logEntry = {
      id: `electron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: timestamp.toISOString(),
      siteId,
      siteName,
      level,
      message: line.trim(),
      source: path.basename(filePath),
      ip,
      errorCode,
      folderType: folderType || undefined,
      fileInfo: {
        fileName: path.basename(filePath),
        filePath,
        lineNumber: 0,
        fileSize: fs.statSync(filePath).size,
        lastModified: fs.statSync(filePath).mtime.toISOString()
      }
    };

    console.log(`📤 SENDING TO REACT: [${level.toUpperCase()}] ${logEntry.message.substring(0, 60)}...`);

    // Send to React app
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('new-log-entry', logEntry);
    }

  } catch (error) {
    console.error(`❌ Error processing log line:`, error);
  }
}

// Cleanup on app quit
app.on('before-quit', () => {
  console.log('🔄 App shutting down - cleaning up file watchers...');
  
  fileWatchers.forEach(async (watcherInfo, siteName) => {
    try {
      await watcherInfo.watcher.close();
      console.log(`✅ Closed watcher for ${siteName}`);
    } catch (error) {
      console.error(`❌ Error closing watcher for ${siteName}:`, error);
    }
  });
  
  fileWatchers.clear();
  monitoringPaths.clear();
  console.log('✅ All file watchers cleaned up');
});

console.log('✅ Electron main process initialized with FULL Node.js integration and monitoring');