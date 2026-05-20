@echo off
cd /d "%~dp0"
echo ================================================
echo  TFE Importer - BACKFILL (all CSV files)
echo ================================================
echo.
python tfe_scraper\tfe_import.py --backfill
echo.
pause
