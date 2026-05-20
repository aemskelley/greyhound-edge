@echo off
REM TFE Setup Checker
REM Run this first to diagnose any issues before running run_tfe.bat

cd /d "%~dp0"
echo ============================================
echo  TFE Setup Checker
echo  Working directory: %CD%
echo ============================================
echo.

REM 1. Python
echo [1] Checking Python...
python --version
if errorlevel 1 (
    echo     FAIL: Python not found.
    echo     Fix:  Install from https://www.python.org/downloads/
    echo           Make sure to tick "Add Python to PATH" during install.
) else (
    echo     OK
)
echo.

REM 2. pip
echo [2] Checking pip...
pip --version
if errorlevel 1 (
    echo     FAIL: pip not found.
    echo     Fix:  Reinstall Python with pip included.
) else (
    echo     OK
)
echo.

REM 3. Playwright
echo [3] Checking Playwright...
python -c "from playwright.async_api import async_playwright; print('    OK')"
if errorlevel 1 (
    echo     FAIL: Playwright not installed.
    echo     Fix:  Run:  pip install playwright
    echo           Then: playwright install chromium
)
echo.

REM 4. Playwright chromium browser
echo [4] Checking Playwright Chromium browser...
python -c "from playwright.sync_api import sync_playwright; p = sync_playwright().start(); b = p.chromium.launch(); b.close(); p.stop(); print('    OK')"
if errorlevel 1 (
    echo     FAIL: Chromium not installed.
    echo     Fix:  Run:  playwright install chromium
)
echo.

REM 5. Script files present
echo [5] Checking script files...
if exist "tfe_morning_scraper.py" (
    echo     OK - tfe_morning_scraper.py found
) else (
    echo     FAIL - tfe_morning_scraper.py not found in %CD%
)
if exist "tfe_server.py" (
    echo     OK - tfe_server.py found
) else (
    echo     FAIL - tfe_server.py not found in %CD%
)
echo.

REM 6. tfe-data folder and today.json
echo [6] Checking data folder...
if exist "tfe-data\" (
    echo     OK - tfe-data folder exists
    if exist "tfe-data\today.json" (
        echo     OK - today.json found
        for %%A in (tfe-data\today.json) do echo     Size: %%~zA bytes
    ) else (
        echo     NOTE - today.json not found yet - run scraper first
    )
) else (
    echo     NOTE - tfe-data folder does not exist yet - created by scraper on first run
)
echo.

REM 7. Browser profile (login session)
echo [7] Checking browser profile (saved Timeform login)...
if exist "tfe-browser-profile\" (
    echo     OK - browser profile folder exists - login should be saved
) else (
    echo     NOTE - No browser profile yet.
    echo     On first run you will need to log in to Timeform manually.
)
echo.

echo ============================================
echo  Check complete. Fix any FAIL items above,
echo  then run run_tfe.bat to start.
echo ============================================
echo.
pause