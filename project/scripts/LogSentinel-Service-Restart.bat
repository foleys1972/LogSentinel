@echo off
cd /d "%~dp0.."
node watchdog-service.cjs restart
pause
