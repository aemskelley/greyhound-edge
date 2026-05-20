@echo off
cd /d "%~dp0"

echo ============================================================
echo  TFE Stats Model - Derive Lookup Tables from GS History
echo ============================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found.
    pause & exit /b 1
)

python -c "from dateutil.relativedelta import relativedelta" >nul 2>&1
if errorlevel 1 (
    echo Installing python-dateutil...
    pip install python-dateutil --break-system-packages
)

echo Running derivation (24-month window, min 20 samples per cell)...
echo.
python gs_derive_lookups.py --months 24 --min-n 20

echo.
echo Output saved to: ..\tfe-data\derived_lookups.js
echo.
echo To update the extension with new values:
echo   1. Open tfe-data\derived_lookups.js
echo   2. Copy the CHESTER_RATINGS, PAR_TIMES and TRAP_BIAS blocks
echo   3. Paste into timeform-enhancer4\content.js (replacing existing constants)
echo   4. Paste into timeform-enhancer4\results_tracker.js (replacing _CHESTER_RATINGS, _PAR_TIMES, _TRAP_BIAS)
echo   5. Reload extension in Chrome (chrome://extensions)
echo.
pause
