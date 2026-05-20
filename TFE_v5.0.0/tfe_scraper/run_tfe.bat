@echo off
REM TFE Morning Runner
REM
REM Usage:
REM   run_tfe.bat           - run morning scraper + start server  (use each morning)
REM   run_tfe.bat server    - start server only, no re-scrape     (use if server was closed)
REM   run_tfe.bat results   - fetch today's results               (run after racing)
REM   run_tfe.bat yesterday - fetch yesterday's results

cd /d "%~dp0"

echo ============================================
echo  TFE Scraper
echo  Working directory: %CD%
echo ============================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install from python.org.
    pause & exit /b 1
)

REM Install dependencies if needed
python -c "import playwright" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install playwright tqdm
    playwright install chromium
    echo.
)
python -c "import tqdm" >nul 2>&1
if errorlevel 1 (
    pip install tqdm >nul 2>&1
)

REM Route to correct script
if /i "%1"=="results"   goto RESULTS
if /i "%1"=="yesterday" goto YESTERDAY
if /i "%1"=="server"    goto SERVER

REM Default: morning scraper + server
echo Step 1: Running morning scraper...
echo.
python tfe_morning_scraper.py
if errorlevel 1 (
    echo.
    echo ERROR: Scraper failed.
    pause & exit /b 1
)

echo.
echo ============================================
echo  Scraper complete. Starting local server...
echo  Keep this window open while racing.
echo  Press Ctrl+C to stop.
echo ============================================
echo.
python tfe_server.py
pause
goto END

:RESULTS
echo Fetching today's results...
echo.
python tfe_results_scraper.py
pause
goto END

:YESTERDAY
echo Fetching yesterday's results...
echo.
python tfe_results_scraper.py yesterday
pause

:SERVER
echo Starting server only (no re-scrape)...
echo.
echo ============================================
echo  TFE Local Server
echo  Keep this window open while betting.
echo  Press Ctrl+C to stop.
echo ============================================
echo.
python tfe_server.py
pause
goto END

:END
