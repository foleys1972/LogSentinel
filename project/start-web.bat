@echo off
setlocal EnableDelayedExpansion
title LogSentinel Enterprise - Build Web App EXE

echo.
echo ========================================
echo   LogSentinel Enterprise - Web App EXE
echo ========================================
echo.
echo Builds the web app into an executable.
echo Run the EXE to start the server - multiple users can browse to it.
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo [2/4] Building Vite app...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Vite build failed.
    pause
    exit /b 1
)

echo.
echo [3/4] Building web app executable...
call npx electron-builder --win -c electron-builder-web.json
if %ERRORLEVEL% neq 0 (
    echo ERROR: electron-builder failed.
    pause
    exit /b 1
)

echo.
echo [4/4] Done!
echo.
echo EXE output: dist-web-exe\win-unpacked\LogSentinel Enterprise Web.exe
echo Installer: dist-web-exe\LogSentinel Enterprise Web 1.0.0 Setup.exe
echo.
echo Run the EXE to start the web server. Multiple users can browse to:
echo   http://localhost:3000  (on this PC)
echo   http://YOUR-IP:3000  (from other PCs on the network)
echo.
pause
