/**
 * Watchdog logic - spawns and monitors LogSentinel Web exe
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const RESTART_DELAY_MS = 5000;
const MAX_RESTARTS_PER_HOUR = 12;

function getAppDir() {
  const isPkg = !!process.pkg;
  const isElectron = !!process.versions.electron;
  if (isPkg || isElectron) return path.dirname(process.execPath);
  return __dirname;
}

const APP_DIR = getAppDir();
const LOG_FILE = path.join(APP_DIR, 'watchdog.log');
const PID_FILE = path.join(APP_DIR, 'watchdog.pid');

function log(msg, onLog) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (e) { /* ignore */ }
  if (onLog) onLog(msg, line);
}

function getExePath() {
  const dir = APP_DIR;
  const isWatchdog = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('watchdog')) return true;
    return path.resolve(dir, name || n).toLowerCase() === process.execPath.toLowerCase();
  };
  const parent = path.join(dir, '..');
  const candidates = [
    path.join(dir, 'LogSentinel Enterprise Web.exe'),
    path.join(parent, 'LogSentinel Enterprise Web.exe'),
    path.join(parent, 'LogSentinel Enterprise Web', 'LogSentinel Enterprise Web.exe'),
    path.join(parent, 'Web', 'LogSentinel Enterprise Web.exe'),
    path.join(parent, 'win-unpacked', 'LogSentinel Enterprise Web.exe'),
    path.join(parent, 'dist-web-exe', 'win-unpacked', 'LogSentinel Enterprise Web.exe'),
    path.join(parent, '..', 'dist-web-exe', 'win-unpacked', 'LogSentinel Enterprise Web.exe')
  ];
  try {
    const files = fs.readdirSync(dir);
    const exe = files.find((f) =>
      f.startsWith('LogSentinel') && f.endsWith('.exe') && !isWatchdog(f) &&
      path.resolve(dir, f) !== path.resolve(process.execPath)
    );
    if (exe) candidates.unshift(path.join(dir, exe));
    try {
      for (const f of fs.readdirSync(parent)) {
        if (f.startsWith('LogSentinel') && f.endsWith('.exe') && !isWatchdog(f)) {
          candidates.push(path.join(parent, f));
        }
      }
    } catch (_) {}
  } catch (_) {}
  for (const p of candidates) {
    if (fs.existsSync(p) && !isWatchdog(path.basename(p))) return [p, '--headless'];
  }
  return null;
}

function getLastLogLines(n) {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
      return lines.slice(-(n || 50)).join('\n');
    }
  } catch (_) {}
  return '';
}

function createWatchdogController(onStatusChange, onLog) {
  let child = null;
  let restartsThisHour = 0;
  let hourStart = Date.now();
  let restartTimeout = null;
  let userStopped = false;

  function resetHourlyCount() {
    if (Date.now() - hourStart > 3600000) { restartsThisHour = 0; hourStart = Date.now(); }
  }

  function spawnApp() {
    const exeInfo = getExePath();
    if (!exeInfo) {
      const msg = 'LogSentinel Enterprise Web.exe not found. Place it in the same folder as the Watchdog, or in a sibling Web/ folder.';
      log(msg + ' (Watchdog folder: ' + APP_DIR + ')', onLog);
      onStatusChange?.('error', msg);
      return;
    }
    const [exe, ...args] = exeInfo;
    child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: path.dirname(exe) });
    if (child.stdout) child.stdout.on('data', (c) => log(c.toString().trim(), onLog));
    if (child.stderr) child.stderr.on('data', (c) => log('[stderr] ' + c.toString().trim(), onLog));
    child.on('exit', (code, signal) => {
      child = null;
      onStatusChange?.('stopped', { code, signal });
      resetHourlyCount();
      if (userStopped) { userStopped = false; return; }
      if (restartsThisHour >= MAX_RESTARTS_PER_HOUR) {
        log('FATAL: Too many restarts', onLog);
        onStatusChange?.('error', 'Too many restarts');
        return;
      }
      restartsThisHour++;
      log(`Process exited. Restarting in ${RESTART_DELAY_MS / 1000}s...`, onLog);
      onStatusChange?.('restarting', 'Restarting...');
      restartTimeout = setTimeout(spawnApp, RESTART_DELAY_MS);
    });
    child.on('error', (err) => { log('Process error: ' + err.message, onLog); onStatusChange?.('error', err.message); });
    onStatusChange?.('running', null);
    log('LogSentinel server started', onLog);
  }

  return {
    start() {
      userStopped = false;
      if (child) { onStatusChange?.('running', 'Already running'); return; }
      restartsThisHour = 0;
      hourStart = Date.now();
      spawnApp();
    },
    stop() {
      userStopped = true;
      if (restartTimeout) { clearTimeout(restartTimeout); restartTimeout = null; }
      if (child) { child.kill('SIGTERM'); child = null; onStatusChange?.('stopped', null); log('Server stopped by user', onLog); }
      else { onStatusChange?.('stopped', 'Not running'); }
    },
    restart() {
      if (restartTimeout) { clearTimeout(restartTimeout); restartTimeout = null; }
      if (child) { child.kill('SIGTERM'); child = null; }
      restartsThisHour = 0;
      hourStart = Date.now();
      setTimeout(spawnApp, 2000);
      onStatusChange?.('restarting', 'Restarting in 2 seconds...');
      log('Restart requested', onLog);
    },
    getStatus() { return child ? 'running' : 'stopped'; },
    getLogs(n) { return getLastLogLines(n); }
  };
}

module.exports = { createWatchdogController, getLastLogLines, getAppDir, LOG_FILE, PID_FILE };
