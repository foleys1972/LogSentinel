/**
 * LogSentinel Watchdog Service - Start, Stop, Restart, Status
 *
 * Usage:
 *   node watchdog-service.cjs start     - Start watchdog (spawns app, restarts on crash)
 *   node watchdog-service.cjs stop      - Stop watchdog and app
 *   node watchdog-service.cjs restart   - Restart watchdog
 *   node watchdog-service.cjs status    - Show running status
 *
 * Add --exe to spawn the packaged LogSentinel exe instead of node server.cjs
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const RESTART_DELAY_MS = 5000;
const MAX_RESTARTS_PER_HOUR = 12;

// When packaged with pkg, __dirname is the exe's dir; process.execPath is the exe
const isPkg = !!process.pkg;
const APP_DIR = isPkg ? path.dirname(process.execPath) : __dirname;
const LOG_DIR = APP_DIR;
const LOG_FILE = path.join(LOG_DIR, 'watchdog.log');
const PID_FILE = path.join(LOG_DIR, 'watchdog.pid');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {
    console.error('Watchdog log error:', e.message);
  }
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

function writePid(pid) {
  try {
    fs.writeFileSync(PID_FILE, String(pid), 'utf8');
  } catch (e) {
    log('Failed to write PID file: ' + e.message);
  }
}

function readPid() {
  try {
    if (fs.existsSync(PID_FILE)) {
      return parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
    }
  } catch (_) {}
  return null;
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
      const { execSync } = require('child_process');
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    return true;
  } catch (e) {
    log('Kill failed: ' + e.message);
    return false;
  }
}

function runWatchdog() {
  let child;
  let restartsThisHour = 0;
  let hourStart = Date.now();

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
      log('ERROR: LogSentinel Enterprise Web.exe not found. Place it in the same folder as the Watchdog.');
      process.exit(1);
    }
    const [exe, ...args] = exeInfo;
    child = spawn(exe, args, { stdio: 'inherit', cwd: path.dirname(exe) });

    child.on('exit', (code, signal) => {
      child = null;
      resetHourlyCount();
      if (restartsThisHour >= MAX_RESTARTS_PER_HOUR) {
        log(`FATAL: Too many restarts (${restartsThisHour}/hour). Stopping watchdog.`);
        removePidFile();
        process.exit(1);
      }
      restartsThisHour++;
      log(`Process exited (code=${code}, signal=${signal}). Restarting in ${RESTART_DELAY_MS / 1000}s...`);
      setTimeout(spawnApp, RESTART_DELAY_MS);
    });

    child.on('error', (err) => {
      log(`Process error: ${err.message}`);
    });
  }

  writePid(process.pid);
  log('LogSentinel Watchdog starting...');
  spawnApp();
}

function cmdStart() {
  const pid = readPid();
  if (pid && isProcessRunning(pid)) {
    console.log('Watchdog is already running (PID ' + pid + ')');
    return;
  }
  removePidFile();
  runWatchdog();
}

function cmdStop() {
  const pid = readPid();
  if (!pid) {
    console.log('Watchdog is not running (no PID file)');
    return;
  }
  if (!isProcessRunning(pid)) {
    console.log('Watchdog process not found (stale PID file removed)');
    removePidFile();
    return;
  }
  console.log('Stopping watchdog (PID ' + pid + ')...');
  killProcess(pid);
  removePidFile();
  console.log('Watchdog stopped.');
}

function cmdRestart() {
  cmdStop();
  setTimeout(() => cmdStart(), 2000);
}

function cmdStatus() {
  const pid = readPid();
  if (!pid) {
    console.log('Status: STOPPED (no PID file)');
    return;
  }
  if (isProcessRunning(pid)) {
    console.log('Status: RUNNING (PID ' + pid + ')');
    return;
  }
  console.log('Status: STOPPED (stale PID ' + pid + ' - process not found)');
  removePidFile();
}

const cmd = process.argv[2]?.toLowerCase() || 'start';

switch (cmd) {
  case 'start':
    cmdStart();
    break;
  case 'stop':
    cmdStop();
    break;
  case 'restart':
    cmdRestart();
    break;
  case 'status':
    cmdStatus();
    break;
  default:
    console.log('LogSentinel Watchdog Service');
    console.log('');
    console.log('Usage: LogSentinel-Watchdog.exe [command] [--exe]');
    console.log('');
    console.log('Commands:');
    console.log('  start    Start the watchdog (spawns LogSentinel Web exe, restarts on crash)');
    console.log('  stop     Stop the watchdog and app');
    console.log('  restart  Stop then start');
    console.log('  status   Show running status');
    console.log('');
    console.log('Place LogSentinel Enterprise Web.exe in the same folder as this exe.');
    console.log('');
    if (process.platform === 'win32') {
      console.log('Press Enter to close...');
      process.stdin.setRawMode(false);
      process.stdin.resume();
      process.stdin.once('data', () => process.exit(cmd ? 1 : 0));
    } else {
      process.exit(cmd ? 1 : 0);
    }
}
