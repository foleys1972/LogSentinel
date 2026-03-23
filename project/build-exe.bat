@echo off
setlocal EnableDelayedExpansion
title LogSentinel Enterprise - Build EXE

echo.
echo ========================================
echo   LogSentinel Enterprise - Build EXE
echo ========================================
echo.

cd /d "%~dp0"

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
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
echo [3/4] Building Electron executable...
call npx electron-builder --win
if %ERRORLEVEL% neq 0 (
    echo ERROR: electron-builder failed.
    pause
    exit /b 1
)

echo.
echo [4/4] Done!
echo.
echo EXE output: dist-electron\win-unpacked\LogSentinel Enterprise.exe
echo Installer: dist-electron\LogSentinel Enterprise 1.0.0 Setup.exe
echo.
pause
