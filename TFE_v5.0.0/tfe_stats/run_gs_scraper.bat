@echo off
cd /d "%~dp0"

echo ============================================================
echo  TFE Stats Model - GreyhoundStats Scraper
echo ============================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install from https://www.python.org/downloads/
    echo Make sure to tick "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)

python -c "import playwright" >nul 2>&1
if errorlevel 1 (
    echo Installing playwright...
    pip install playwright
    playwright install chromium
    echo.
)

python -c "import bs4" >nul 2>&1
if errorlevel 1 (
    echo Installing beautifulsoup4...
    pip install beautifulsoup4
    echo.
)

echo Choose a mode:
echo   1. Fetch from today.json  (default location: ..\tfe-data\today.json)
echo   2. Fetch from a CSV file  (paste the full path)
echo   3. Fetch a single dog by name
echo.
set /p MODE="Enter 1, 2 or 3: "

if "%MODE%"=="1" (
    python gs_scraper.py --today
) else if "%MODE%"=="2" (
    echo.
    echo Paste the full path to your CSV file e.g.
    echo   C:\Users\Proform\Downloads\tfe_backtest_full_2026-05-16.csv
    echo.
    set /p CSVFILE="CSV path: "
    python gs_scraper.py --csv "%CSVFILE%"
) else if "%MODE%"=="3" (
    echo.
    set /p DOGNAME="Dog name: "
    python gs_scraper.py --dog "%DOGNAME%"
) else (
    echo Invalid choice.
)

echo.
pause
