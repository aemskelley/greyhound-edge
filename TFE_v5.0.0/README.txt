TFE SYSTEM - CLEAN INSTALL v5.1.3
==================================

FOLDER STRUCTURE
----------------
TFE_CleanInstall/
    timeform-enhancer4/     <- Chrome extension (load this in Chrome)
    tfe_scraper/            <- Morning/evening data scraper
    tfe_stats/              <- GreyhoundStats history scraper (Phase 1)
    tfe-data/               <- Shared data folder (auto-created by scrapers)


INSTALL ORDER
-------------

STEP 1 - Install the Chrome Extension
    1. Open Chrome and go to: chrome://extensions
    2. Enable "Developer mode" (top right toggle)
    3. Click "Load unpacked"
    4. Select the "timeform-enhancer4" folder
    5. The extension icon will appear in your toolbar


STEP 2 - Set up the TFE Scraper (existing workflow)
    1. Open tfe_scraper/ folder
    2. Double-click check_setup.bat to verify Python and Playwright are installed
    3. Each morning: double-click run_tfe.bat to scrape today's races
    4. Leave tfe_server.py running in the background while betting
    The scraper writes to tfe-data/today.json


STEP 3 - Set up the Stats Scraper (new)
    1. Open tfe_stats/ folder
    2. Double-click run_gs_scraper.bat
    3. First run will install playwright and beautifulsoup4 automatically
    4. Run AFTER the morning scraper each day (choose option 1)
    The stats scraper writes to tfe-data/gs_history.db


DAILY WORKFLOW
--------------
Morning (before racing):
    1. Run tfe_scraper/run_tfe.bat  (scrapes today's racecards)
    2. Run tfe_stats/run_gs_scraper.bat -> option 1  (fetches dog histories)
    3. Keep tfe_server.py running
    4. Open Timeform in Chrome - extension loads automatically

Evening (after racing):
    Results scraper runs automatically via run_tfe.bat


WHAT'S IN THIS VERSION  (v5.1.3)
---------------------------------
Extension fixes since original:
- Full component breakdown now stored on every scored dog (RS_/PTS_ columns populated in backtests)
- BET signal now excludes no-edge conditions: Monmore, 480m, 400m, D-grades
- Track map expanded - Star Pelaw, Central Park, Dunstall Park now resolve correctly
- Rank normalisation unified between sidebar and tracker (0 to 1 scale)
- Sectional decay now applied consistently (matches rating decay)
- PAR_TIMES expanded: OR, OR1-4, B1-3, HP, S grades added for all venues
- CHESTER_RATINGS expanded: same grade coverage as PAR_TIMES
- scoreScraperDogs now stores full breakdown + all raw stats for CSV export

Stats model (Phase 1):
- gs_scraper.py: fetches full run history from greyhoundstats.co.uk
- Captures: calc_time (going-adjusted), sectional, chester_rating, going, trainer
- SQLite database at tfe-data/gs_history.db
- Smart caching: dogs already fetched today are skipped
