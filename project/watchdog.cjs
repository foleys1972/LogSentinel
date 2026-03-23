/**
 * LogSentinel Watchdog - Keeps the app running, restarts on crash.
 * Place LogSentinel Enterprise Web.exe in the same folder.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const RESTART_DELAY_MS = 5000;
const MAX_RESTARTS_PER_HOUR = 12;
const LOG_FILE = path.join(__dirname, 'watchdog.log');

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
  const dir = __dirname;
  const isWatchdog = (n) => (n || '').toLowerCase().includes('watchdog');
  const candidates = [
    path.join(dir, 'LogSentinel Enterprise Web.exe'),
    path.join(dir, '..', 'LogSentinel Enterprise Web.exe')
  ];
  try {
    const files = fs.readdirSync(dir);
    const exe = files.find((f) => f.startsWith('LogSentinel') && f.endsWith('.exe') && !isWatchdog(f));
    if (exe) candidates.unshift(path.join(dir, exe));
  } catch (_) {}
  for (const p of candidates) {
    if (fs.existsSync(p) && !isWatchdog(path.basename(p))) return [p, '--headless'];
  }
  return null;
}

function main() {
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
      log('ERROR: LogSentinel Enterprise Web.exe not found. Place it in the same folder.');
      process.exit(1);
    }
    const [exe, ...args] = exeInfo;
    child = spawn(exe, args, { stdio: 'inherit', cwd: path.dirname(exe) });

    child.on('exit', (code, signal) => {
      child = null;
      resetHourlyCount();
      if (restartsThisHour >= MAX_RESTARTS_PER_HOUR) {
        log(`FATAL: Too many restarts (${restartsThisHour}/hour). Stopping watchdog.`);
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

  log('LogSentinel Watchdog starting...');
  spawnApp();
}

main();
