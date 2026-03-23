/**
 * Shared watchdog logic - used by CLI and Electron UI
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RESTART_DELAY_MS = 5000;
const MAX_RESTARTS_PER_HOUR = 12;

function getAppDir() {
  const isPkg = !!process.pkg;
  const isElectron = !!process.versions.electron;
  // When packaged (pkg or Electron), use the exe's directory so user can put both exes together
  if (isPkg || isElectron) return path.dirname(process.execPath);
  return __dirname;
}

const APP_DIR = getAppDir();
const LOG_FILE = path.join(APP_DIR, 'watchdog.log');
const PID_FILE = path.join(APP_DIR, 'watchdog.pid');

function log(msg, onLog) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {
    /* ignore */
  }
  if (onLog) onLog(msg, line);
}

function getExePath() {
  const dir = APP_DIR;
  const isWatchdog = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('watchdog')) return true;
    const fullPath = path.resolve(dir, name || n);
    return fullPath.toLowerCase() === process.execPath.toLowerCase();
  };
  const candidates = [
    path.join(dir, 'LogSentinel Enterprise Web.exe'),
    path.join(dir, '..', 'LogSentinel Enterprise Web.exe')
  ];
  try {
    const files = fs.readdirSync(dir);
    const exe = files.find(
      (f) =>
        f.startsWith('LogSentinel') &&
        f.endsWith('.exe') &&
        !isWatchdog(f) &&
        path.resolve(dir, f) !== path.resolve(process.execPath)
    );
    if (exe) candidates.unshift(path.join(dir, exe));
  } catch (_) {}
  for (const p of candidates) {
    if (fs.existsSync(p) && !isWatchdog(path.basename(p))) return [p, '--headless'];
  }
  return null;
}

function readPid() {
  try {
    if (fs.existsSync(PID_FILE)) {
      return parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
    }
  } catch (_) {}
  return null;
}

function writePid(pid) {
  try {
    fs.writeFileSync(PID_FILE, String(pid), 'utf8');
  } catch (_) {}
}

function removePidFile() {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch (_) {}
}

function isProcessRunning(pid) {
  if (!pid || isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function killProcess(pid) {
  if (!pid || isNaN(pid)) return false;
  const isWin = process.platform === 'win32';
  try {
    if (isWin) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    return true;
  } catch (e) {
    return false;
  }
}

function getLastLogLines(n = 50) {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      const lines = content.trim().split('\n');
      return lines.slice(-n).join('\n');
    }
  } catch (_) {}
  return '';
}

/**
 * Find a running LogSentinel process (not the watchdog). Returns { pid } or null.
 * Used when watchdog starts after the app was launched externally.
 */
function findRunningLogSentinelProcess() {
  const isWin = process.platform === 'win32';
  const ourPid = process.pid;
  try {
    if (isWin) {
      const out = execSync('tasklist /FO CSV /NH', { encoding: 'utf8', windowsHide: true });
      const lines = out.trim().split('\n');
      for (const line of lines) {
        const match = line.match(/^"([^"]+)","(\d+)"/);
        if (!match) continue;
        const [, name, pidStr] = match;
        const pid = parseInt(pidStr, 10);
        if (pid === ourPid || isNaN(pid)) continue;
        const n = (name || '').toLowerCase();
        if (n.includes('watchdog')) continue;
        if (n.includes('logsentinel') && n.endsWith('.exe')) {
          return { pid };
        }
      }
    } else {
      const out = execSync('ps -eo pid,comm', { encoding: 'utf8' });
      const lines = out.trim().split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[0], 10);
        const comm = (parts[1] || '').toLowerCase();
        if (pid === ourPid || isNaN(pid)) continue;
        if (comm.includes('watchdog')) continue;
        if (comm.includes('logsentinel')) return { pid };
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Create a watchdog controller. Keeps the app running, restarts if it crashes.
 */
function createWatchdogController(onStatusChange, onLog) {
  let child = null;
  let restartsThisHour = 0;
  let hourStart = Date.now();
  let restartTimeout = null;
  let userStopped = false;

  function resetHourlyCount() {
    const now = Date.now();
    if (now - hourStart > 60 * 60 * 1000) {
      restartsThisHour = 0;
      hourStart = now;
    }
  }

  function spawnApp() {
    const exeInfo = getExePath();
    if (!exeInfo) {
      const msg = 'LogSentinel Enterprise Web.exe not found. Place it in the same folder as the Watchdog.';
      log(msg, onLog);
      onStatusChange?.('error', msg);
      return;
    }
    const [exe, ...args] = exeInfo;
    child = spawn(exe, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(exe)
    });

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        log(text.trim(), onLog);
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        log('[stderr] ' + text.trim(), onLog);
      });
    }

    child.on('exit', (code, signal) => {
      child = null;
      onStatusChange?.('stopped', { code, signal });
      resetHourlyCount();
      if (userStopped) {
        userStopped = false;
        return;
      }
      if (restartsThisHour >= MAX_RESTARTS_PER_HOUR) {
        const msg = `FATAL: Too many restarts (${restartsThisHour}/hour)`;
        log(msg, onLog);
        onStatusChange?.('error', msg);
        return;
      }
      restartsThisHour++;
      const msg = `Process exited (code=${code}, signal=${signal}). Restarting in ${RESTART_DELAY_MS / 1000}s...`;
      log(msg, onLog);
      onStatusChange?.('restarting', msg);
      restartTimeout = setTimeout(spawnApp, RESTART_DELAY_MS);
    });

    child.on('error', (err) => {
      log('Process error: ' + err.message, onLog);
      onStatusChange?.('error', err.message);
    });

    onStatusChange?.('running', null);
    log('LogSentinel server started', onLog);
  }

  return {
    start() {
      userStopped = false;
      if (child) {
        onStatusChange?.('running', 'Already running');
        return;
      }
      const existing = findRunningLogSentinelProcess();
      if (existing) {
        log('LogSentinel already running (started externally). Adopting process.', onLog);
        onStatusChange?.('running', 'Started externally');
        return;
      }
      restartsThisHour = 0;
      hourStart = Date.now();
      spawnApp();
    },

    stop() {
      userStopped = true;
      if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
      }
      if (child) {
        child.kill('SIGTERM');
        child = null;
        onStatusChange?.('stopped', null);
        log('Server stopped by user', onLog);
      } else {
        onStatusChange?.('stopped', 'Not running');
      }
    },

    restart() {
      if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
      }
      if (child) {
        child.kill('SIGTERM');
        child = null;
      }
      restartsThisHour = 0;
      hourStart = Date.now();
      setTimeout(() => spawnApp(), 2000);
      onStatusChange?.('restarting', 'Restarting in 2 seconds...');
      log('Restart requested', onLog);
    },

    getStatus() {
      if (child) return 'running';
      if (findRunningLogSentinelProcess()) return 'running';
      return 'stopped';
    },

    getLogs(n) {
      return getLastLogLines(n);
    }
  };
}

module.exports = {
  createWatchdogController,
  getLastLogLines,
  getAppDir,
  LOG_FILE,
  PID_FILE
};
