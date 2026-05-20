# Greyhound Edge — Statistical Model Handover
**Session date:** 2026-05-20  
**Extension version:** v5.1.3  
**GitHub:** github.com/aemskelley/greyhound-edge

---

## What Was Done This Session

### 1. gs_history.db Analysis
- Uploaded and inspected the GS history database: **1,320 dogs, 59,613 runs** (2011–2026-05-15)
- Confirmed data is **dog-centric** — populated by scraping Greyhound Stats per runner on race day
- Key field completeness: trainer 100%, Chester rating 85%, sectional 65.6%

### 2. Statistical Analysis of gs_history.db
Full analysis run across the dataset. Key findings:

**Trap bias by track** — significant variation confirmed:
- Strong T6 venues: The Valley (22.6%), Crayford (26.3%), Central Park (21.7%)
- Strong T1/T3 venues: Perry Barr T1 (25.2%), Sheffield T3 (21.6%)
- Balanced (trap bias minimal): Sunderland, Newcastle, Yarmouth

**Grade change win rates** — counterintuitive finding:
- Dogs **raised in grade** win at 19.98% (+3.31% vs expected) ← positive signal
- Dogs **dropped in grade** win at 16.09% (-0.58% vs expected) ← market overcorrects

**Days since last run:**
- Sweet spot: 5–7 days (+1.81% vs expected)
- Avoid: 36–60 days (-3.59% vs expected)
- 60d+: recovers to +0.82%

**Chester rating rank in race — the dominant signal:**
- #1 ranked Chester dog wins **58.64%** of races (expected: 16.7%)
- #2 ranked: 23.19%
- #3 and below: essentially no-hopers

**SP calibration:** ROI collapses at long prices (-69.93% at 20/1+). Edge is at short/mid prices.

**Recency predictiveness:** Raw form (win/loss) has near-zero correlation with outcomes. Quality-adjusted ratings (Chester, TF time) are the signal.

**Trainer strike rates:** S A Howard (32.4%), L G Tuffin (31.1%), K G Crew (27.1%) significantly above average.

### 3. Chester Rating Reverse Engineering
Tested hypothesis: Chester rating = f(calc_time vs track/distance par)

Results by track:
- Newcastle R² = **0.9915** (MAE 0.57 pts) — near perfect
- Romford R² = 0.9586
- Sheffield R² = 0.9116
- The Valley R² = 0.3920 — outlier, treat with caution

**Conclusion:** Chester rating is a going-adjusted time-vs-par score with venue-specific scaling coefficients (~−47 to −55 rating points per second). We can derive Chester ratings for the 15% of unrated runs using per-track coefficients. (Added to build list.)

### 4. Data Architecture Decision
**Race-centric pipeline adopted** over dog-centric.

Identified that three data sources exist in parallel and were never joined:
- `today.json` — Timeform racecard (morning, pre-race)
- `results_YYYY-MM-DD.json` — Timeform results (BSP, finish pos, retrospective TFR)
- `gs_history.db` — GS historical depth per dog

**Critical finding:** The retrospective TFR in the results JSON is a post-race performance rating, NOT a pre-race form rating. It appeared to show 89.9% top-rated win rate — this is an artefact of Timeform assigning the highest rating to the best performance after the race. Pre-race TFR from today.json racecard is the predictive variable.

**BSP vs ISP finding from results analysis (2026-05-19):**
- BSP > ISP in 98.7% of cases (exchange almost always longer)
- ISP ROI: -33.86% (bookmaker margin heavy)
- BSP ROI: -9.39% (exchange fair, use BSP for all model testing)

### 5. Backtest CSV — Primary Data Source Identified
Discovered the **daily backtest CSV export** (`tfe_backtest_full_YYYY-MM-DD.csv`) is the richest single source — contains all model scores, sub-scores, EV%, pre-race form inputs, AND settled BSP/positions once exported the morning after.

This replaces the complex three-way merge approach. The results JSON is only needed for the extension's P&L tracker.

**2026-05-19 backtest results:**
- 101 races, 563 runners, 101 top picks
- Top pick win rate: 34.7%
- Total P&L: **£+25.72**, ROI: **+25.5%** (£1 level stake to BSP)
- Score 70+: 77 bets, 39.0% win rate, +42.7% ROI
- Score 80+: 31 bets, 41.9% win rate, **+71.9% ROI**

**Key observations:**
- EV% not yet calibrated (high EV% bands underperforming) — needs more data
- D grades outperforming (D4: 83.3%, D3: 50%)
- Sunderland struggling (1/12 top picks)
- Trainer Edge metric identified as too blunt — added to build list

### 6. New Scripts Built
See **New Files** section below.

---

## Current Daily Pipeline

```
Each morning:
  1. run_results.bat              → settles BSP/positions into extension
  2. run_gs_scraper.bat           → updates gs_history.db with yesterday's runners
  3. Export backtest CSV manually → tfe_backtest_full_YYYY-MM-DD.csv into tfe-data/
  4. run_import.bat               → appends to race_log.db (NEW)
```

**Note:** BSP capture issue (scraping too early before Betfair settles figures) resolved — scrape next morning only.

---

## race_log.db Schema

Single table `runners` — one row per runner per race. Primary key: `(race_id, dog_name)`.

Fields include all 73 backtest CSV columns plus GS enrichment:
- `gs_actual_time`, `gs_calc_time`, `gs_sectional`, `gs_going`, `gs_chester`, `gs_matched`

GS enrichment matches on normalised dog name + run date. Currently 0% match rate for 2026-05-19 because GS db only goes to 2026-05-15 — will populate as `gs_scraper.py` runs daily.

Name matching: 545/563 (96.8%) of yesterday's dogs found in GS by name — matching is working correctly.

---

## Things to Build (Backlog)

1. **Trainer multi-dimensional profiles** — replace single P&L metric with:
   - Track-specific strike rate
   - Grade-specific strike rate  
   - DSLR band strike rates (0–7d, 8–14d, 15–28d, 28d+)
   - Last-30-day in-form rate
   - Track debut win rate
   - Grade drop/raise pattern
   - Output as JSON lookup, regenerated weekly from gs_history.db

2. **derive_filters.py** — context-aware filter matrix per venue/grade/distance
   Generated automatically from race_log.db once 2–3 months of data accumulated

3. **Chester rating gap-filler** — derive ratings for unrated runs using per-track linear coefficients (R² established per venue)

4. **Benter Stage 2 market blend** — blend model probability with BSP implied probability
   Requires ~3 months of joined data minimum

5. **Betfair live key activation** (£499) — autonomous betting pipeline
   Only once model edge is proven over sufficient sample

---

## Data Status

| Source | Status | Coverage |
|--------|--------|----------|
| gs_history.db | ✅ Active | 1,320 dogs, 59,613 runs to 2026-05-15 |
| today.json | ✅ Daily | Overwrites each morning (no bloat) |
| results_YYYY-MM-DD.json | ✅ Daily | ~50–100KB per day, keep all |
| tfe_backtest_full_YYYY-MM-DD.csv | ✅ Daily | Export manually each morning |
| race_log.db | ✅ New | 563 rows (1 day), growing daily |

**Timeline to meaningful model validation:**
- 4 weeks → ~8,000 rows, early patterns
- 3 months → ~20,000 rows, model validation possible
- 6 months → ~40,000 rows, segment-level analysis reliable

---

## New Files This Session

| File | Location | Purpose |
|------|----------|---------|
| `tfe_import.py` | `tfe_scraper/` | Daily backtest CSV → race_log.db importer |
| `run_import.bat` | root | Import yesterday's CSV |
| `run_import_backfill.bat` | root | Import all CSVs in tfe-data/ |
| `run_report.bat` | root | Cumulative P&L report |

**Deprecated/replaced:**
- `tfe_merge.py` — replaced by `tfe_import.py` (backtest CSV is the source of truth, not results JSON)
- `run_merge.bat`, `run_merge_backfill.bat` — replaced by import equivalents

---

## Repo Structure

```
TFE_v5.0.0/
├── greyhound-edge/           ← Chrome extension
│   ├── manifest.json
│   ├── content.js
│   ├── background.js
│   ├── popup.html / popup.js
│   ├── results_tracker.js
│   ├── styles.css / tracker.css
│   └── icons/
├── tfe_scraper/              ← Python scrapers
│   ├── tfe_morning_scraper.py
│   ├── tfe_results_scraper.py
│   ├── tfe_server.py
│   ├── tfe_import.py         ← NEW
│   ├── run_tfe.bat
│   ├── run_results.bat
│   ├── run_server.bat
│   └── check_setup.bat
├── tfe_stats/                ← GS analysis scripts
│   ├── gs_scraper.py
│   ├── gs_derive_lookups.py
│   ├── requirements.txt
│   └── run_gs_scraper.bat / run_derive_lookups.bat
├── tfe-data/                 ← Data files (gitignored except JSONs)
│   ├── today.json
│   ├── results_YYYY-MM-DD.json
│   ├── tfe_backtest_full_YYYY-MM-DD.csv
│   ├── gs_history.db
│   ├── race_log.db           ← NEW
│   ├── derived_chester_ratings.json
│   ├── derived_par_times.json
│   ├── derived_trap_bias.json
│   └── derived_lookups.js
├── run_import.bat            ← NEW
├── run_import_backfill.bat   ← NEW
├── run_report.bat            ← NEW
└── README.txt
```

---

## Key Decisions & Rationale

**Why backtest CSV over results JSON as primary source?**
The backtest CSV contains all model scores, sub-scores, EV%, pre-race form inputs AND settled results in one file. The results JSON only has finish position, BSP, ISP and the retrospective TFR. The CSV is the complete record.

**Why race_log.db over flat CSV files?**
Enables SQL queries across all days — cumulative P&L by venue/grade/score threshold, time-series analysis, model calibration. Flat CSVs would require pandas merging every time.

**Why not use the GS data as the primary pipeline source?**
GS is dog-centric. Building a race-centric database from GS alone would require scraping every dog that ran in every race, not just today's runners. The backtest CSV already captures all runners in race context.

**Decay model decision:**
Calendar-year decay not implemented — GS data is too recent and concentrated (most runs 2024–2026) for year-based decay to be meaningful. Use run-count window (last 6 runs) with exponential day-weighting instead. Chester rating already implicitly handles quality-over-time.

---

## Next Session Starting Points

1. Run backfill: `run_import_backfill.bat` on existing 2–3 days of CSVs
2. Check `run_report.bat` output — verify multi-day P&L and GS match rate
3. Begin accumulating data daily — revisit model analysis at 4-week mark
4. Consider trainer profile script when 4+ weeks of race_log.db data available
