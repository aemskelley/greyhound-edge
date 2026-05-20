@echo off
cd /d "%~dp0"
echo ================================================
echo  TFE Report - Cumulative P&L
echo ================================================
echo.
python tfe_scraper\tfe_import.py --report
echo.
pause
