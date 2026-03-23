# LogSentinel Watchdog Deployment

## Important: Keep Watchdog and Web in Separate Folders

**Do NOT copy both exes into the same folder.** Each app needs its own `resources` folder. If you put both exes in one folder, they share the same `resources/app.asar` and both will run the same app (whichever was copied last).

## Correct Deployment Structure

```
LogSentinel/
├── Watchdog/                    ← Copy entire dist-watchdog-ui/win-unpacked/ here
│   ├── LogSentinel Watchdog.exe
│   ├── resources/
│   └── ... (all other files)
│
└── Web/                         ← Copy entire dist-web-exe/win-unpacked/ here
    ├── LogSentinel Enterprise Web.exe
    ├── resources/
    └── ... (all other files)
```

## Steps

1. **Build both apps:**
   ```bash
   npm run electron:build:web
   npm run watchdog:ui:build
   ```

2. **Create deployment folder** (e.g. `C:\LogSentinel\`)

3. **Copy Watchdog** – Copy the **entire** `dist-watchdog-ui/win-unpacked/` folder contents into `LogSentinel/Watchdog/`

4. **Copy Web** – Copy the **entire** `dist-web-exe/win-unpacked/` folder contents into `LogSentinel/Web/`

5. **Run Watchdog** – Double-click `LogSentinel/Watchdog/LogSentinel Watchdog.exe`

6. **Place Web exe for Watchdog to find** – The Watchdog looks for `LogSentinel Enterprise Web.exe` in:
   - Same folder as Watchdog
   - Parent folder
   - `../LogSentinel Enterprise Web/`
   - `../win-unpacked/`

   So you can put a copy of `LogSentinel Enterprise Web.exe` in the Watchdog folder, or keep the Web folder as a sibling.

## Alternative: Use the Portable Exe

The build also creates `dist-watchdog-ui/LogSentinel Watchdog 1.0.0.exe` (portable). This single exe is self-contained – run it from anywhere. It will look for `LogSentinel Enterprise Web.exe` in the same folder or parent.
