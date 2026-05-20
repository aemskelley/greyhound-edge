@echo off
cd /d "%~dp0"

echo ============================================
echo  TFE Local Server
echo  Keep this window open while betting.
echo  Press Ctrl+C to stop.
echo ============================================
echo.
echo Serving today.json at http://localhost:7329
echo.

python tfe_server.py
pause
