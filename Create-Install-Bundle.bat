@echo off
setlocal EnableExtensions EnableDelayedExpansion

title LogSentinel - Create Install Bundle

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"`) do set "TS=%%I"
set "OUT_DIR=%REPO_ROOT%\install_bundle_%TS%"

echo.
echo ========================================
echo   LogSentinel - Create Install Bundle
echo ========================================
echo.
echo Repo: %REPO_ROOT%
echo Out : %OUT_DIR%
echo.

mkdir "%OUT_DIR%" 2>nul
if errorlevel 1 (
  echo ERROR: Unable to create output folder.
  echo %OUT_DIR%
  exit /b 1
)

rem If this is a git checkout with LFS pointers, ensure files are present
if exist "%REPO_ROOT%\.git" (
  where git >nul 2>nul
  if not errorlevel 1 (
    git -C "%REPO_ROOT%" lfs pull
    git -C "%REPO_ROOT%" lfs checkout
  )
)

set "INSTALLERS_DIR=%OUT_DIR%\Installers"
set "PORTABLE_DIR=%OUT_DIR%\Portable"
set "SCRIPTS_DIR=%OUT_DIR%\Scripts"

mkdir "%INSTALLERS_DIR%" 2>nul
mkdir "%PORTABLE_DIR%" 2>nul
mkdir "%SCRIPTS_DIR%" 2>nul

echo.
echo [1/5] Copying portable apps...

if exist "%REPO_ROOT%\Watchdog\LogSentinel Watchdog.exe" (
  echo   - Watchdog portable (Watchdog\)
  robocopy "%REPO_ROOT%\Watchdog" "%PORTABLE_DIR%\Watchdog" /E /R:2 /W:2 /NFL /NDL /NJH /NJS
) else if exist "%REPO_ROOT%\project\dist-watchdog-ui\win-unpacked\LogSentinel Watchdog.exe" (
  echo   - Watchdog portable (dist-watchdog-ui\win-unpacked\)
  robocopy "%REPO_ROOT%\project\dist-watchdog-ui\win-unpacked" "%PORTABLE_DIR%\Watchdog" /E /R:2 /W:2 /NFL /NDL /NJH /NJS
) else (
  echo   - Watchdog portable not found
)

if exist "%REPO_ROOT%\Web\LogSentinel Enterprise Web.exe" (
  echo   - Enterprise Web portable (Web\)
  robocopy "%REPO_ROOT%\Web" "%PORTABLE_DIR%\EnterpriseWeb" /E /R:2 /W:2 /NFL /NDL /NJH /NJS
) else if exist "%REPO_ROOT%\project\dist-web-exe\win-unpacked\LogSentinel Enterprise Web.exe" (
  echo   - Enterprise Web portable (dist-web-exe\win-unpacked\)
  robocopy "%REPO_ROOT%\project\dist-web-exe\win-unpacked" "%PORTABLE_DIR%\EnterpriseWeb" /E /R:2 /W:2 /NFL /NDL /NJH /NJS
) else (
  echo   - Enterprise Web portable not found
)

if exist "%REPO_ROOT%\project\dist-electron\win-unpacked\LogSentinel Enterprise.exe" (
  echo   - Enterprise portable (dist-electron\win-unpacked\)
  robocopy "%REPO_ROOT%\project\dist-electron\win-unpacked" "%PORTABLE_DIR%\Enterprise" /E /R:2 /W:2 /NFL /NDL /NJH /NJS
) else (
  echo   - Enterprise portable not found
)

echo.
echo [2/5] Copying installers...

for %%F in (
  "%REPO_ROOT%\project\dist-electron\*Setup*.exe"
  "%REPO_ROOT%\project\dist-electron\*.exe"
  "%REPO_ROOT%\project\dist-web-exe\*Setup*.exe"
  "%REPO_ROOT%\project\dist-web-exe\*.exe"
  "%REPO_ROOT%\project\dist-watchdog-ui\*.exe"
) do (
  if exist "%%~fF" (
    copy /Y "%%~fF" "%INSTALLERS_DIR%\" >nul
  )
)

echo.
echo [3/5] Copying service/start scripts...

if exist "%REPO_ROOT%\project\scripts" (
  robocopy "%REPO_ROOT%\project\scripts" "%SCRIPTS_DIR%\scripts" /E /R:2 /W:2 /NFL /NDL /NJH /NJS
)

if exist "%REPO_ROOT%\project\dist-watchdog" (
  robocopy "%REPO_ROOT%\project\dist-watchdog" "%SCRIPTS_DIR%\dist-watchdog" /E /R:2 /W:2 /NFL /NDL /NJH /NJS
)

echo.
echo [4/5] Creating convenience launchers...

(
  echo @echo off
  echo start "" "%%~dp0..\Portable\Watchdog\LogSentinel Watchdog.exe"
) > "%SCRIPTS_DIR%\Run-Watchdog-Portable.bat"

(
  echo @echo off
  echo start "" "%%~dp0..\Portable\Enterprise\LogSentinel Enterprise.exe"
) > "%SCRIPTS_DIR%\Run-Enterprise-Portable.bat"

(
  echo @echo off
  echo start "" "%%~dp0..\Portable\EnterpriseWeb\LogSentinel Enterprise Web.exe"
) > "%SCRIPTS_DIR%\Run-EnterpriseWeb-Portable.bat"

echo.
echo [5/5] Done
echo.
echo Bundle created:
echo   %OUT_DIR%
echo.
echo Copy that folder to the new server and run the EXEs from:
echo   %OUT_DIR%\Portable\...
echo.
pause
