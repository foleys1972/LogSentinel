/**
 * Server-side file monitoring for web browser clients.
 * Runs chokidar watchers and broadcasts log entries via WebSocket.
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const watchers = new Map();
const filePositions = new Map();

function getEffectiveFolderPaths(sites) {
  const entries = [];
  for (const site of sites || []) {
    if (!site.folderMonitoringEnabled || !site.folderMonitoringTypes?.length) {
      if (site.monitoringConfig?.folderPath?.trim()) {
        entries.push({ path: site.monitoringConfig.folderPath.trim(), siteId: site.id, siteName: site.name });
      }
      continue;
    }
    for (const folderType of site.folderMonitoringTypes) {
      const folderPath = (site.folderMonitoringPaths?.[folderType] ?? '').trim();
      if (folderPath) {
        entries.push({
          path: folderPath,
          siteId: site.id,
          siteName: site.name,
          watcherKey: `${site.id}_${folderType}`,
          folderType
        });
      }
    }
  }
  return entries;
}

function processLogLine(line, filePath, siteId, siteName, folderType, broadcast) {
  try {
    let level = 'info';
    const upperLine = line.toUpperCase();
    if (upperLine.includes('FATAL') || upperLine.includes('CRITICAL')) level = 'critical';
    else if (upperLine.includes('ERROR') || upperLine.includes('SEVERE')) level = 'high';
    else if (upperLine.includes('WARN') || upperLine.includes('WARNING')) level = 'medium';
    else if (upperLine.includes('DEBUG') || upperLine.includes('TRACE')) level = 'low';
    else if (upperLine.includes('INFO')) level = 'info';

    const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);
    const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();
    const ipMatch = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    const errorCodeMatch = line.match(/\b[A-Z]{2,}\d{3,}\b/);

    const logEntry = {
      id: `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: timestamp.toISOString(),
      siteId,
      siteName,
      level,
      message: line.trim(),
      source: path.basename(filePath),
      ip: ipMatch ? ipMatch[0] : undefined,
      errorCode: errorCodeMatch ? errorCodeMatch[0] : undefined,
      folderType: folderType || undefined,
      fileInfo: {
        fileName: path.basename(filePath),
        filePath,
        lineNumber: 0,
        fileSize: 0,
        lastModified: new Date().toISOString()
      }
    };
    broadcast(logEntry);
  } catch (e) {
    console.error('Error processing log line:', e);
  }
}

function isFileLockedError(e) {
  return e && (e.code === 'EBUSY' || e.code === 'EACCES' || e.errno === -4082 || (e.message && /EBUSY|EACCES|busy|locked/i.test(e.message)));
}

function processExistingFile(filePath, siteId, siteName, folderType, broadcast) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    lines.slice(-3).forEach(line => processLogLine(line, filePath, siteId, siteName, folderType, broadcast));
  } catch (e) {
    if (isFileLockedError(e)) return;
    console.error('Error processing file:', e);
  }
}

function handleFileChange(filePath, siteId, siteName, folderType, positions, broadcast) {
  try {
    const stats = fs.statSync(filePath);
    const current = positions.get(filePath) || 0;
    if (stats.size <= current) return;

    const stream = fs.createReadStream(filePath, { start: current, encoding: 'utf8' });
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach(line => line.trim() && processLogLine(line, filePath, siteId, siteName, folderType, broadcast));
    });
    stream.on('end', () => positions.set(filePath, stats.size));
    stream.on('error', e => {
      if (!isFileLockedError(e)) console.error('Read error:', e);
    });
  } catch (e) {
    console.error('Error handling file change:', e);
  }
}

function startWatching(entry, broadcast) {
  const { path: folderPath, siteId, siteName, watcherKey, folderType } = entry;
  const key = watcherKey || siteId;

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    console.warn(`Path not found or not a directory: ${folderPath}`);
    return;
  }

  if (watchers.has(key)) {
    watchers.get(key).close();
    watchers.delete(key);
  }

  const patterns = [path.join(folderPath, '**', '*.log'), path.join(folderPath, '**', '*.txt')];
  const positions = new Map();
  filePositions.set(key, positions);

  const watcher = chokidar.watch(patterns, {
    ignored: ['**/.*', '**/*.tmp', '**/*.bak'],
    persistent: true,
    ignoreInitial: false
  });

  watcher
    .on('add', (filePath) => processExistingFile(filePath, siteId, siteName, folderType, broadcast))
    .on('change', (filePath) => handleFileChange(filePath, siteId, siteName, folderType, positions, broadcast))
    .on('unlink', (filePath) => positions.delete(filePath))
    .on('error', e => console.error(`Watcher error for ${key}:`, e));

  watchers.set(key, watcher);
  console.log(`[Web] Started monitoring ${folderPath} for ${siteName}`);
}

function stopAll() {
  watchers.forEach((w, k) => {
    w.close();
    filePositions.delete(k);
  });
  watchers.clear();
  console.log('[Web] Stopped all file watchers');
}

function applyConfig(sites, broadcast) {
  stopAll();
  const entries = getEffectiveFolderPaths(sites);
  for (const entry of entries) {
    if (entry.path) startWatching(entry, broadcast);
  }
}

module.exports = { applyConfig, stopAll };
