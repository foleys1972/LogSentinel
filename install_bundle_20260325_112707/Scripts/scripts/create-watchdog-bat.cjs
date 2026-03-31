const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'dist-watchdog');
const bat = path.join(dir, 'LogSentinel-Watchdog-Start.bat');
const content = `@echo off
cd /d "%~dp0.."
"%~dp0LogSentinel-Watchdog.exe" start
`;
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(bat, content);
console.log('Created', bat);
