@echo off
cd /d "%~dp0"
echo ================================================
echo  TFE Importer - Loading yesterday's backtest
echo ================================================
echo.
python tfe_scraper\tfe_import.py
echo.
pause
