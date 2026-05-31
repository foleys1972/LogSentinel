# Push LogSentinel to https://github.com/foleys1972/LogSentinel.git
# Run from repo root in PowerShell (requires Git for Windows).

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git is not installed. Install from https://git-scm.com/download/win then re-run this script." -ForegroundColor Red
  exit 1
}

$remote = "https://github.com/foleys1972/LogSentinel.git"

if (-not (Test-Path ".git")) {
  git init
  git branch -M main
}

$existingRemote = git remote get-url origin 2>$null
if (-not $existingRemote) {
  git remote add origin $remote
} elseif ($existingRemote -ne $remote) {
  Write-Host "Updating origin to $remote"
  git remote set-url origin $remote
}

Write-Host "Fetching from GitHub..."
cmd /c "git fetch origin 2>nul"

Write-Host "Staging changes (secrets excluded via .gitignore)..."
git add -A
git status

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  $porcelain = git status --porcelain
  if (-not $porcelain) {
    Write-Host "Working tree clean - nothing to commit." -ForegroundColor Yellow
  }
} else {
  git commit -m "Sync LogSentinel: TradeSense, MCP integration, UI and dev fixes"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed." -ForegroundColor Red
    exit 1
  }
}

Write-Host "Pulling remote changes (if any)..."
cmd /c "git pull origin main --rebase 2>nul"

Write-Host "Pushing to origin main..."
git push -u origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host "Done: https://github.com/foleys1972/LogSentinel" -ForegroundColor Green
} else {
  Write-Host "Push failed. Resolve conflicts then run: git push -u origin main" -ForegroundColor Red
  exit 1
}
