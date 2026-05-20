# TFE Morning Scraper — Setup & Usage

## What this does

Scrapes all of today's Timeform greyhound racecards and full dog career
histories (up to 25 runs per dog) before racing starts, then serves the
data to your TFE Chrome extension via a local server.

**Result:** When you open a racecard in Chrome, the extension reads the
pre-fetched data instantly — no tabs open, no waiting, full history
available immediately.

---

## One-time setup

### 1. Install Python dependencies

```
pip install playwright
playwright install chromium
```

### 2. First login

Run the scraper once manually to log in to Timeform:

```
python tfe_morning_scraper.py
```

A Chrome window will open. Log in to your Timeform account.
The session is saved in the `tfe-browser-profile/` folder —
you won't need to log in again unless you clear it.

### 3. Schedule with Windows Task Scheduler

- Open Task Scheduler → Create Basic Task
- Name: `TFE Morning Scraper`
- Trigger: Daily at 09:00
- Action: Start a Program
  - Program: `python`
  - Arguments: `C:\path\to\tfe_morning_scraper.py`
  - Start in: `C:\path\to\` (folder containing the scripts)
- Finish

The scraper runs silently each morning. It opens a browser window,
fetches all races (~50-60 on a full BAGS day), fetches full history
for each dog (~300-360 dogs), saves `tfe-data/today.json`, then closes.
Total time: approximately 10-15 minutes.

---

## Daily usage

### Option A — Run manually (simpler)

1. Double-click `run_tfe.bat`
   - This runs the scraper, then starts the server
   - Keep the terminal window open

2. Open Chrome and visit Timeform racecards as normal

### Option B — Scheduled scraper + manual server

1. Task Scheduler runs the scraper at 09:00 automatically
2. When you're ready to use the extension, run:
   ```
   python tfe_server.py
   ```
3. Keep that terminal open

---

## How it works

```
tfe_morning_scraper.py    — scrapes Timeform, saves tfe-data/today.json
tfe_server.py             — serves today.json at http://localhost:7329
TFE extension             — reads from localhost first, falls back to tab fetch
```

The extension always falls back gracefully:
- If the server is running → instant data, no tabs opened
- If the server isn't running → existing tab-based fetch (same as before)

---

## Track filtering

By default the scraper fetches all tracks. To limit to specific tracks,
edit `tfe_morning_scraper.py` and change:

```python
TRACK_FILTER = None   # all tracks
```

to e.g.:

```python
TRACK_FILTER = ["sheffield", "kinsley", "nottingham", "central-park",
                "monmore", "sunderland", "newcastle"]
```

Track slugs match the Timeform URL — lowercase, hyphens for spaces.

---

## Files

```
tfe_morning_scraper.py   — main scraper
tfe_server.py            — local HTTP server
run_tfe.bat              — runs both in sequence (double-click to use)
tfe-data/
  today.json             — today's data (overwritten each morning)
tfe-browser-profile/     — saved Timeform login session (don't delete)
```
