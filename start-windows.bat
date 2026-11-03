@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Please install Node.js 22 LTS from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules\three (
  echo Installing dependencies. An internet connection is required for first setup.
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check your network and try again.
    pause
    exit /b 1
  )
)
echo Little Haven is starting at http://localhost:5188/
echo Press Ctrl+C to stop the game server.
call npm run dev
pause
