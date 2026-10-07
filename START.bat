@echo off
cd /d "%~dp0"
echo Starting ROBLOX Classic server...
echo.
py -3 run.py 2>nul
if errorlevel 1 python run.py 2>nul
if errorlevel 1 python3 run.py 2>nul
if errorlevel 1 (
  echo.
  echo Python was not found.
  echo Install Python from https://www.python.org/downloads/
  echo During install, CHECK "Add Python to PATH".
  echo.
  pause
)
