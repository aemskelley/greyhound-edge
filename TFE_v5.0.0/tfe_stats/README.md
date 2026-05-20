# TFE Stats Model — Phase 1: Data Collection

Pure statistics greyhound model, completely independent of pricing.
Lives alongside the TFE extension without touching it.

---

## Setup

```bash
cd tfe_stats
pip install -r requirements.txt
playwright install chromium
```

---

## Usage

### Fetch dogs from today's TFE scraper run
```bash
python gs_scraper.py --today
```
Reads dog names from `tfe-data/today.json` (written by `tfe_morning_scraper.py`).
Run this **after** the morning scraper each day.

### Fetch from a backtest CSV
```bash
python gs_scraper.py --csv path/to/tfe_backtest_full_2026-05-16.csv
```
Reads the `Dog Name` column. Good for bulk-loading historical dogs.

### Single / ad-hoc lookup
```bash
python gs_scraper.py --dog "ASHWAY CHARLIE"
python gs_scraper.py --dog "ASHWAY CHARLIE" "LENNIES TANK" "SWIFT QUILL"
```

---

## Output

**Database:** `tfe-data/gs_history.db` (SQLite)

### `dogs` table
| Column | Description |
|--------|-------------|
| name | Normalised uppercase dog name (unique key) |
| gs_name | Name as returned by GreyhoundStats |
| total_runs | Career runs |
| total_wins | Career wins |
| win_pct | Career win % |
| fetched_at | Last fetch timestamp |

### `runs` table
| Column | Description |
|--------|-------------|
| run_date | YYYY-MM-DD |
| track | Venue name |
| trap | Trap number (1–6) |
| grade | Race grade (A1–A11, OR, B1–B3, D, S, HP…) |
| distance_m | Race distance in metres |
| sp | Starting price (raw: "7/2", "11/4F", "EVS") |
| finish_pos | Finishing position |
| won | 1 if winner, 0 otherwise |
| sectional | First-bend sectional time (seconds) |
| actual_time | Raw finish time |
| going | Track condition adjustment (e.g. -10 = fast, +20 = slow, 0 = normal) |
| **calc_time** | **Going-adjusted finish time — comparable across conditions** |
| chester_rating | GreyhoundStats Chester quality rating |
| trainer | Trainer name |

The **calc_time** column is the key field for speed modelling — it's
already going-adjusted, so you can directly compare runs across
different conditions and tracks without further normalisation.

---

## Smart caching

Dogs already fetched today are skipped automatically.
Re-running `--today` daily only fetches new/unseen dogs and adds new runs.
Existing run rows are never duplicated (UNIQUE constraint on dog+date+track+grade).

---

## What comes next (Phase 2)

Once the database has a few weeks of data, Phase 2 builds the scoring engine:

- **Calc-time speed figure** — going-adjusted time vs track/grade par
- **Track win rate** — wins at this venue / runs at this venue
- **Distance win rate** — wins at this distance / runs at this distance
- **Trap win rate** — personal trap history (more granular than structural bias)
- **Layoff days** — days since last run
- **Grade trajectory** — rising/falling through grades
- **Chester rating trend** — quality trend across recent runs
- **Best calc_time ever** — ceiling speed at this distance

Each component rank-scored within the field → weighted sum → Stats Model Score.
No prices anywhere. Completely independent of TFE EV signal.

Final integration: Stats Model top pick appears as a second column in the
TFE extension sidebar. Triple-lock = TFE top pick + Stats top pick + Betfair market agree.
