# LogSentinel Watchdog

Keeps the server running and restarts it on crash. Two modes: **Interactive UI** (recommended) or **CLI/Service**.

---

## Interactive Watchdog UI (Recommended)

A desktop app with Start, Stop, Restart buttons and a log viewer.

**Run:**
```bash
npm run watchdog:ui
```

**Build as exe:**
```bash
npm run watchdog:ui:build
```
Output: `dist-watchdog-ui/` – double-click **LogSentinel Watchdog** to start.

---

## CLI / Service Mode

### Using npm scripts (from project folder)

```bash
npm run service:start      # Start (spawns node server.cjs)
npm run service:stop       # Stop
npm run service:restart    # Restart
npm run service:status     # Show status
```

### Using batch files (Windows)

Double-click or run from Command Prompt:

| File | Action |
|------|--------|
| `scripts/LogSentinel-Service-Start.bat` | Start watchdog |
| `scripts/LogSentinel-Service-Stop.bat` | Stop watchdog |
| `scripts/LogSentinel-Service-Restart.bat` | Restart watchdog |
| `scripts/LogSentinel-Service-Status.bat` | Show status |

### Using node directly

```bash
node watchdog-service.cjs start
node watchdog-service.cjs stop
node watchdog-service.cjs restart
node watchdog-service.cjs status
```

Add `--exe` to spawn the packaged LogSentinel exe instead of `node server.cjs`:

```bash
node watchdog-service.cjs start --exe
```

---

## Commands

| Command | Description |
|---------|-------------|
| **start** | Start the watchdog. Spawns the app and restarts it if it crashes. |
| **stop** | Stop the watchdog and the app. |
| **restart** | Stop, wait 2 seconds, then start. |
| **status** | Show whether the watchdog is running (with PID) or stopped. |

---

## Building the Watchdog exe

```bash
npm install
npm run watchdog:build
```

Output: `dist-watchdog/LogSentinel-Watchdog.exe`

**Requirements:** Node.js must be installed and on PATH (the exe spawns `node server.cjs`).

**Run from project folder** (so `server.cjs` is found):
```cmd
cd C:\Projects\LogSentinel\project
dist-watchdog\LogSentinel-Watchdog.exe start
dist-watchdog\LogSentinel-Watchdog.exe stop
dist-watchdog\LogSentinel-Watchdog.exe restart
dist-watchdog\LogSentinel-Watchdog.exe status
```

**Double-click:** Use `dist-watchdog\LogSentinel-Watchdog-Start.bat` – it starts the watchdog and keeps the window open.

---

## Windows Service (NSSM)

For automatic start on boot, use [NSSM](https://nssm.cc/):

```cmd
nssm install LogSentinel "C:\path\to\node.exe" "C:\path\to\watchdog-service.cjs" start
nssm set LogSentinel AppDirectory "C:\path\to\project"
nssm start LogSentinel
nssm stop LogSentinel
nssm restart LogSentinel
nssm status LogSentinel
```

---

## Files

| File | Purpose |
|------|---------|
| `watchdog-service.cjs` | Main service script with start/stop/restart/status |
| `watchdog.cjs` | Simple watchdog (no stop/restart) |
| `watchdog.pid` | Created when running; stores process ID |
| `watchdog.log` | Log file |
