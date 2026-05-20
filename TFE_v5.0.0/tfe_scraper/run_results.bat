@echo off
cd /d "%~dp0"

echo ============================================
echo  TFE Results Scraper
echo ============================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install from python.org.
    pause & exit /b 1
)

echo Fetching today's results...
echo This may take a few minutes depending on how many races have finished.
echo.

python tfe_results_scraper.py

echo.
echo Done. You can now refresh the results tracker in Chrome.
pause
