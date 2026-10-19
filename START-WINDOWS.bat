@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 LTS from https://nodejs.org/ and reopen this file.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])!==24){console.error('FOODIO requires Node.js 24.x LTS.');process.exit(1)}"
if errorlevel 1 (
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  echo Installing dependencies. Internet access is needed for this first step.
  call npm.cmd ci
  if errorlevel 1 goto failed
)
echo Building FOODIO...
call npm.cmd run build
if errorlevel 1 goto failed
echo Open http://localhost:3000 after the server reports it is running.
echo Keep this window open. Press Ctrl+C to stop.
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0
:failed
echo Setup or startup did not finish. Read the error above and the README troubleshooting section.
pause
exit /b 1
