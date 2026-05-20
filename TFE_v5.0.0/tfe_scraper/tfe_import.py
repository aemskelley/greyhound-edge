#!/usr/bin/env python3
"""
tfe_import.py  —  TFE Race Log Importer
=========================================
Reads daily backtest CSV exports and builds a cumulative race_log.db.
Optionally enriches with GS history (Chester rating, calc_time, going, sectional).

Usage:
  python tfe_import.py                          # import yesterday's CSV
  python tfe_import.py --date 2026-05-19        # import specific date
  python tfe_import.py --backfill               # import ALL CSVs in tfe-data/
  python tfe_import.py --stats                  # show database summary
  python tfe_import.py --report                 # full cumulative P&L report

File naming convention:
  tfe-data/tfe_backtest_full_YYYY-MM-DD.csv

Output:
  tfe-data/race_log.db

Requirements:
  pip install pandas
"""

import sqlite3
import pandas as pd
import numpy as np
import argparse
import re
import sys
from pathlib import Path
from datetime import date, timedelta, datetime


# ── Paths ──────────────────────────────────────────────────────────────────────
DATA_DIR    = Path(__file__).parent / "tfe-data"
GS_DB_PATH  = DATA_DIR / "gs_history.db"
LOG_DB_PATH = DATA_DIR / "race_log.db"


# ── Schema ─────────────────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS runners (
    -- Identity
    race_id         INTEGER NOT NULL,
    date            TEXT NOT NULL,
    time            TEXT NOT NULL,
    venue           TEXT NOT NULL,
    track_key       TEXT,
    grade           TEXT,
    distance        TEXT,
    dog_name        TEXT NOT NULL,
    trap            INTEGER,
    trainer         TEXT,
    url             TEXT,

    -- Model output
    model_score     REAL,
    rank_in_field   INTEGER,
    n_dogs          INTEGER,
    confidence      REAL,
    n_form_rows     INTEGER,
    same_dist_rows  INTEGER,

    -- Form inputs
    avg_tf_time     REAL,
    par_time_delta  REAL,
    avg_rtg         REAL,
    avg_sec_rtg     REAL,
    consistency_sd  REAL,
    trap_win_pct    REAL,
    trap_source     TEXT,
    form_trend      REAL,
    grade_suit      REAL,
    clean_run_pct   REAL,
    momentum        REAL,
    trainer_edge_pnl  REAL,
    trainer_edge_win  REAL,

    -- Raw scores (RS) — 0-1 normalised
    rs_speed        REAL,
    rs_rating       REAL,
    rs_sectional    REAL,
    rs_consistency  REAL,
    rs_trap         REAL,
    rs_trend        REAL,
    rs_grade        REAL,
    rs_clean        REAL,
    rs_momentum     REAL,
    rs_trainer      REAL,

    -- Points (PTS) — weighted contribution
    pts_speed       REAL,
    pts_rating      REAL,
    pts_sectional   REAL,
    pts_consistency REAL,
    pts_trap        REAL,
    pts_trend       REAL,
    pts_grade       REAL,
    pts_clean       REAL,
    pts_momentum    REAL,
    pts_trainer     REAL,

    -- Weights (W) — fixed per model version
    w_speed         REAL,
    w_rating        REAL,
    w_sectional     REAL,
    w_consistency   REAL,
    w_trap          REAL,
    w_trend         REAL,
    w_grade         REAL,
    w_clean         REAL,
    w_momentum      REAL,
    w_trainer       REAL,

    -- Market & EV
    tf_forecast_odds    TEXT,
    tf_forecast_pct     REAL,
    model_implied_pct   REAL,
    ev_pct              REAL,

    -- Result
    actual_position INTEGER,
    won             INTEGER,
    placed          INTEGER,
    bsp             REAL,
    isp             REAL,
    best_price      REAL,
    price_source    TEXT,
    pnl             REAL,
    was_top_pick    INTEGER,

    -- GS enrichment (joined from gs_history.db)
    gs_actual_time  REAL,
    gs_calc_time    REAL,
    gs_sectional    REAL,
    gs_going        INTEGER,
    gs_chester      INTEGER,
    gs_matched      INTEGER DEFAULT 0,

    -- Deduplication key
    PRIMARY KEY (race_id, dog_name)
);

CREATE INDEX IF NOT EXISTS idx_date       ON runners(date);
CREATE INDEX IF NOT EXISTS idx_venue      ON runners(venue);
CREATE INDEX IF NOT EXISTS idx_dog        ON runners(dog_name);
CREATE INDEX IF NOT EXISTS idx_top_pick   ON runners(was_top_pick);
CREATE INDEX IF NOT EXISTS idx_won        ON runners(won);
CREATE INDEX IF NOT EXISTS idx_grade      ON runners(grade);
"""

# Column mapping: CSV name -> DB column name
COL_MAP = {
    'Race ID':               'race_id',
    'Date':                  'date',
    'Time':                  'time',
    'Venue':                 'venue',
    'TrackKey':              'track_key',
    'Grade':                 'grade',
    'Distance':              'distance',
    'Dog Name':              'dog_name',
    'Trap':                  'trap',
    'Trainer':               'trainer',
    'URL':                   'url',
    'Model Score':           'model_score',
    'Rank in Field':         'rank_in_field',
    'N Dogs in Race':        'n_dogs',
    'Confidence':            'confidence',
    'N Form Rows Used':      'n_form_rows',
    'Same-Dist Rows':        'same_dist_rows',
    'Avg TFTime':            'avg_tf_time',
    'Par Time Delta':        'par_time_delta',
    'Avg Rtg':               'avg_rtg',
    'Avg SecRtg':            'avg_sec_rtg',
    'Consistency (σ)':       'consistency_sd',
    'Trap Win %':            'trap_win_pct',
    'Trap Source':           'trap_source',
    'Form Trend':            'form_trend',
    'Grade Suit':            'grade_suit',
    'Clean Run %':           'clean_run_pct',
    'Momentum':              'momentum',
    'Trainer Edge PnL':      'trainer_edge_pnl',
    'Trainer Edge Win%':     'trainer_edge_win',
    'RS Speed':              'rs_speed',
    'RS Rating':             'rs_rating',
    'RS Sectional':          'rs_sectional',
    'RS Consistency':        'rs_consistency',
    'RS Trap':               'rs_trap',
    'RS Trend':              'rs_trend',
    'RS Grade':              'rs_grade',
    'RS Clean':              'rs_clean',
    'RS Momentum':           'rs_momentum',
    'RS Trainer':            'rs_trainer',
    'PTS Speed':             'pts_speed',
    'PTS Rating':            'pts_rating',
    'PTS Sectional':         'pts_sectional',
    'PTS Consistency':       'pts_consistency',
    'PTS Trap':              'pts_trap',
    'PTS Trend':             'pts_trend',
    'PTS Grade':             'pts_grade',
    'PTS Clean':             'pts_clean',
    'PTS Momentum':          'pts_momentum',
    'PTS Trainer':           'pts_trainer',
    'W Speed':               'w_speed',
    'W Rating':              'w_rating',
    'W Sectional':           'w_sectional',
    'W Consistency':         'w_consistency',
    'W Trap':                'w_trap',
    'W Trend':               'w_trend',
    'W Grade':               'w_grade',
    'W Clean':               'w_clean',
    'W Momentum':            'w_momentum',
    'W Trainer':             'w_trainer',
    'TF Forecast Odds':      'tf_forecast_odds',
    'TF Forecast Implied %': 'tf_forecast_pct',
    'Model Implied %':       'model_implied_pct',
    'EV %':                  'ev_pct',
    'Actual Position':       'actual_position',
    'Won':                   'won',
    'Placed (1-2)':          'placed',
    'BSP':                   'bsp',
    'ISP':                   'isp',
    'Best Price':            'best_price',
    'Price Source':          'price_source',
    'PnL':                   'pnl',
    'Was Top Pick':          'was_top_pick',
}


# ── DB helpers ─────────────────────────────────────────────────────────────────
def open_log_db():
    LOG_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(LOG_DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def open_gs_db():
    if not GS_DB_PATH.exists():
        return None
    conn = sqlite3.connect(str(GS_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


# ── Date parsing ───────────────────────────────────────────────────────────────
def parse_date_field(raw):
    """Convert '19 May 26' -> '2026-05-19'"""
    try:
        return datetime.strptime(str(raw).strip(), "%d %b %y").strftime("%Y-%m-%d")
    except Exception:
        try:
            return datetime.strptime(str(raw).strip(), "%Y-%m-%d").strftime("%Y-%m-%d")
        except Exception:
            return str(raw)


# ── GS enrichment ──────────────────────────────────────────────────────────────
def build_gs_lookup(gs_conn, iso_date):
    """
    Build a dict: {normalised_name -> run row} for a specific date.
    Much faster than per-dog queries.
    """
    if gs_conn is None:
        return {}

    rows = gs_conn.execute("""
        SELECT d.name, r.actual_time, r.calc_time, r.sectional,
               r.going, r.chester_rating, r.track
        FROM runs r
        JOIN dogs d ON r.dog_id = d.id
        WHERE r.run_date = ?
    """, (iso_date,)).fetchall()

    lookup = {}
    for row in rows:
        key = re.sub(r"[^A-Z0-9]", "", row["name"].upper())
        lookup[key] = dict(row)
    return lookup


def gs_match(dog_name, gs_lookup):
    """Exact normalised match first, then partial."""
    key = re.sub(r"[^A-Z0-9]", "", dog_name.upper())
    if key in gs_lookup:
        return gs_lookup[key]
    # Try prefix match for names with suffixes
    for k, v in gs_lookup.items():
        if k.startswith(key[:8]) or key.startswith(k[:8]):
            return v
    return None


# ── CSV importer ───────────────────────────────────────────────────────────────
def import_csv(csv_path: Path, log_conn, gs_conn, verbose=False):
    """
    Import one backtest CSV into race_log.db.
    Returns (rows_inserted, rows_skipped, gs_hits)
    """
    if not csv_path.exists():
        print(f"  ✗  File not found: {csv_path}")
        return 0, 0, 0

    df = pd.read_csv(csv_path)

    # Parse date
    iso_date = parse_date_field(df['Date'].iloc[0])

    # Build GS lookup for this date
    gs_lookup = build_gs_lookup(gs_conn, iso_date) if gs_conn else {}

    # Rename columns
    df = df.rename(columns=COL_MAP)

    # Normalise date field
    df['date'] = iso_date

    # Replace NaN with None for SQLite
    df = df.where(pd.notnull(df), None)

    inserted = skipped = gs_hits = 0

    for _, row in df.iterrows():
        # GS enrichment
        gs_data = gs_match(str(row.get('dog_name', '')), gs_lookup)
        gs_actual  = gs_data['actual_time']    if gs_data else None
        gs_calc    = gs_data['calc_time']      if gs_data else None
        gs_sect    = gs_data['sectional']      if gs_data else None
        gs_going   = gs_data['going']          if gs_data else None
        gs_chester = gs_data['chester_rating'] if gs_data else None
        gs_matched = 1 if gs_data else 0
        if gs_matched:
            gs_hits += 1

        try:
            log_conn.execute("""
                INSERT OR IGNORE INTO runners (
                    race_id, date, time, venue, track_key, grade, distance,
                    dog_name, trap, trainer, url,
                    model_score, rank_in_field, n_dogs, confidence,
                    n_form_rows, same_dist_rows,
                    avg_tf_time, par_time_delta, avg_rtg, avg_sec_rtg,
                    consistency_sd, trap_win_pct, trap_source,
                    form_trend, grade_suit, clean_run_pct, momentum,
                    trainer_edge_pnl, trainer_edge_win,
                    rs_speed, rs_rating, rs_sectional, rs_consistency,
                    rs_trap, rs_trend, rs_grade, rs_clean, rs_momentum, rs_trainer,
                    pts_speed, pts_rating, pts_sectional, pts_consistency,
                    pts_trap, pts_trend, pts_grade, pts_clean, pts_momentum, pts_trainer,
                    w_speed, w_rating, w_sectional, w_consistency,
                    w_trap, w_trend, w_grade, w_clean, w_momentum, w_trainer,
                    tf_forecast_odds, tf_forecast_pct, model_implied_pct, ev_pct,
                    actual_position, won, placed, bsp, isp, best_price,
                    price_source, pnl, was_top_pick,
                    gs_actual_time, gs_calc_time, gs_sectional,
                    gs_going, gs_chester, gs_matched
                ) VALUES (
                    ?,?,?,?,?,?,?,?,?,?,?,
                    ?,?,?,?,?,?,
                    ?,?,?,?,?,?,?,?,?,?,?,?,?,
                    ?,?,?,?,?,?,?,?,?,?,
                    ?,?,?,?,?,?,?,?,?,?,
                    ?,?,?,?,?,?,?,?,?,?,
                    ?,?,?,?,
                    ?,?,?,?,?,?,?,?,?,
                    ?,?,?,?,?,?
                )
            """, (
                row.get('race_id'), row.get('date'), row.get('time'),
                row.get('venue'), row.get('track_key'), row.get('grade'),
                row.get('distance'), row.get('dog_name'), row.get('trap'),
                row.get('trainer'), row.get('url'),
                row.get('model_score'), row.get('rank_in_field'), row.get('n_dogs'),
                row.get('confidence'), row.get('n_form_rows'), row.get('same_dist_rows'),
                row.get('avg_tf_time'), row.get('par_time_delta'), row.get('avg_rtg'),
                row.get('avg_sec_rtg'), row.get('consistency_sd'), row.get('trap_win_pct'),
                row.get('trap_source'), row.get('form_trend'), row.get('grade_suit'),
                row.get('clean_run_pct'), row.get('momentum'),
                row.get('trainer_edge_pnl'), row.get('trainer_edge_win'),
                row.get('rs_speed'), row.get('rs_rating'), row.get('rs_sectional'),
                row.get('rs_consistency'), row.get('rs_trap'), row.get('rs_trend'),
                row.get('rs_grade'), row.get('rs_clean'), row.get('rs_momentum'),
                row.get('rs_trainer'),
                row.get('pts_speed'), row.get('pts_rating'), row.get('pts_sectional'),
                row.get('pts_consistency'), row.get('pts_trap'), row.get('pts_trend'),
                row.get('pts_grade'), row.get('pts_clean'), row.get('pts_momentum'),
                row.get('pts_trainer'),
                row.get('w_speed'), row.get('w_rating'), row.get('w_sectional'),
                row.get('w_consistency'), row.get('w_trap'), row.get('w_trend'),
                row.get('w_grade'), row.get('w_clean'), row.get('w_momentum'),
                row.get('w_trainer'),
                row.get('tf_forecast_odds'), row.get('tf_forecast_pct'),
                row.get('model_implied_pct'), row.get('ev_pct'),
                row.get('actual_position'), row.get('won'), row.get('placed'),
                row.get('bsp'), row.get('isp'), row.get('best_price'),
                row.get('price_source'), row.get('pnl'), row.get('was_top_pick'),
                gs_actual, gs_calc, gs_sect, gs_going, gs_chester, gs_matched,
            ))
            inserted += 1
        except Exception as e:
            skipped += 1
            if verbose:
                print(f"    ⚠  {row.get('dog_name')}: {e}")

    log_conn.commit()
    return inserted, skipped, gs_hits


# ── Stats ──────────────────────────────────────────────────────────────────────
def print_stats(conn):
    total    = conn.execute("SELECT COUNT(*) FROM runners").fetchone()[0]
    if total == 0:
        print("  Database is empty.")
        return

    dates    = conn.execute("SELECT MIN(date), MAX(date) FROM runners").fetchone()
    n_days   = conn.execute("SELECT COUNT(DISTINCT date) FROM runners").fetchone()[0]
    n_races  = conn.execute("SELECT COUNT(DISTINCT race_id) FROM runners").fetchone()[0]
    gs_pct   = conn.execute("SELECT ROUND(AVG(gs_matched)*100,1) FROM runners").fetchone()[0]
    bsp_pct  = conn.execute(
        "SELECT ROUND(AVG(CASE WHEN bsp IS NOT NULL THEN 1.0 ELSE 0 END)*100,1) FROM runners"
    ).fetchone()[0]

    top = conn.execute("SELECT COUNT(*) FROM runners WHERE was_top_pick=1").fetchone()[0]
    top_wins = conn.execute("SELECT COUNT(*) FROM runners WHERE was_top_pick=1 AND won=1").fetchone()[0]
    top_pnl  = conn.execute("SELECT SUM(pnl) FROM runners WHERE was_top_pick=1").fetchone()[0] or 0
    top_wr   = top_wins / top * 100 if top else 0
    top_roi  = top_pnl / top * 100 if top else 0

    print(f"""
╔══════════════════════════════════════════════════════╗
║            race_log.db  —  Summary                  ║
╠══════════════════════════════════════════════════════╣
║  Date range   : {str(dates[0]):<12} → {str(dates[1]):<12}    ║
║  Days loaded  : {n_days:<36} ║
║  Races        : {n_races:<36,} ║
║  Runners      : {total:<36,} ║
╠══════════════════════════════════════════════════════╣
║  GS enriched  : {str(gs_pct)+'%':<36} ║
║  BSP coverage : {str(bsp_pct)+'%':<36} ║
╠══════════════════════════════════════════════════════╣
║  TOP PICKS                                          ║
║  Selections   : {top:<36,} ║
║  Winners      : {top_wins:<36,} ║
║  Win rate     : {str(round(top_wr,1))+'%':<36} ║
║  Total P&L    : {'£'+str(round(top_pnl,2)):<36} ║
║  ROI          : {str(round(top_roi,1))+'%':<36} ║
╚══════════════════════════════════════════════════════╝
""")


def print_report(conn):
    """Full cumulative P&L report across all days."""
    print_stats(conn)

    # Daily breakdown
    print("Daily P&L (top picks):")
    print(f"  {'Date':<12} {'Bets':>5} {'Wins':>5} {'Win%':>6} {'P&L':>8} {'ROI':>7} {'Cumul P&L':>10}")
    print("  " + "-" * 58)
    rows = conn.execute("""
        SELECT date,
               COUNT(*) bets,
               SUM(won) wins,
               SUM(pnl) pnl
        FROM runners
        WHERE was_top_pick = 1
        GROUP BY date
        ORDER BY date
    """).fetchall()
    cumul = 0
    for r in rows:
        wr  = r['wins'] / r['bets'] * 100 if r['bets'] else 0
        roi = r['pnl'] / r['bets'] * 100 if r['bets'] else 0
        cumul += r['pnl']
        print(f"  {r['date']:<12} {r['bets']:>5} {r['wins']:>5} "
              f"{wr:>5.1f}% {r['pnl']:>+8.2f} {roi:>+6.1f}%  {cumul:>+10.2f}")

    # Score threshold table
    print(f"\nScore threshold (all days, top picks):")
    print(f"  {'Min Score':<12} {'Bets':>5} {'Wins':>5} {'Win%':>6} {'P&L':>8} {'ROI':>7}")
    print("  " + "-" * 46)
    for threshold in [0, 50, 60, 70, 80, 90]:
        r = conn.execute("""
            SELECT COUNT(*) bets, SUM(won) wins, SUM(pnl) pnl
            FROM runners
            WHERE was_top_pick=1 AND model_score >= ?
        """, (threshold,)).fetchone()
        if not r['bets']: continue
        wr  = r['wins'] / r['bets'] * 100
        roi = r['pnl'] / r['bets'] * 100
        print(f"  {threshold:<12} {r['bets']:>5} {r['wins']:>5} {wr:>5.1f}% "
              f"{r['pnl']:>+8.2f} {roi:>+6.1f}%")

    # Venue breakdown
    print(f"\nVenue breakdown (all days, top picks):")
    print(f"  {'Venue':<16} {'Bets':>5} {'Win%':>6} {'P&L':>8} {'ROI':>7}")
    print("  " + "-" * 46)
    rows = conn.execute("""
        SELECT venue, COUNT(*) bets, SUM(won) wins, SUM(pnl) pnl
        FROM runners WHERE was_top_pick=1
        GROUP BY venue ORDER BY SUM(pnl) DESC
    """).fetchall()
    for r in rows:
        wr  = r['wins'] / r['bets'] * 100
        roi = r['pnl'] / r['bets'] * 100
        print(f"  {r['venue']:<16} {r['bets']:>5} {wr:>5.1f}% {r['pnl']:>+8.2f} {roi:>+6.1f}%")

    # Grade breakdown
    print(f"\nGrade breakdown (all days, top picks):")
    print(f"  {'Grade':<8} {'Bets':>5} {'Win%':>6} {'P&L':>8} {'ROI':>7}")
    print("  " + "-" * 38)
    rows = conn.execute("""
        SELECT grade, COUNT(*) bets, SUM(won) wins, SUM(pnl) pnl
        FROM runners WHERE was_top_pick=1 AND grade IS NOT NULL
        GROUP BY grade ORDER BY SUM(pnl) DESC
    """).fetchall()
    for r in rows:
        wr  = r['wins'] / r['bets'] * 100
        roi = r['pnl'] / r['bets'] * 100
        print(f"  {r['grade']:<8} {r['bets']:>5} {wr:>5.1f}% {r['pnl']:>+8.2f} {roi:>+6.1f}%")


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="TFE Importer — loads daily backtest CSVs into race_log.db"
    )
    parser.add_argument("--date",     help="Date to import (YYYY-MM-DD). Default: yesterday.")
    parser.add_argument("--backfill", action="store_true",
                        help="Import ALL tfe_backtest_full_*.csv files in tfe-data/")
    parser.add_argument("--stats",    action="store_true",
                        help="Show database summary and exit.")
    parser.add_argument("--report",   action="store_true",
                        help="Show full cumulative P&L report and exit.")
    parser.add_argument("--verbose",  action="store_true",
                        help="Show per-row warnings.")
    args = parser.parse_args()

    log_conn = open_log_db()
    gs_conn  = open_gs_db()

    if gs_conn:
        print(f"  GS database found — enrichment enabled")
    else:
        print(f"  GS database not found — importing without enrichment")

    if args.stats:
        print_stats(log_conn)
        log_conn.close()
        return

    if args.report:
        print_report(log_conn)
        log_conn.close()
        return

    # Determine files to import
    if args.backfill:
        csv_files = sorted(DATA_DIR.glob("tfe_backtest_full_*.csv"))
        print(f"\nBackfill mode: {len(csv_files)} CSV files found")
    else:
        if args.date:
            target = args.date
        else:
            target = str(date.today() - timedelta(days=1))
        csv_files = [DATA_DIR / f"tfe_backtest_full_{target}.csv"]

    # Import each file
    total_inserted = total_skipped = total_gs = 0
    for csv_path in csv_files:
        print(f"\n── {csv_path.name} ──────────────────────────────")
        inserted, skipped, gs_hits = import_csv(
            csv_path, log_conn, gs_conn, args.verbose
        )
        total = inserted + skipped
        gs_pct = round(gs_hits / inserted * 100, 1) if inserted else 0
        print(f"  Imported : {inserted}  |  Skipped: {skipped}  |  GS matched: {gs_pct}%")
        total_inserted += inserted
        total_skipped  += skipped
        total_gs       += gs_hits

    print(f"""
══════════════════════════════════════════════════════
  Import complete
  Files processed  : {len(csv_files)}
  Rows inserted    : {total_inserted:,}
  Rows skipped     : {total_skipped:,}
  Output           : {LOG_DB_PATH.resolve()}
══════════════════════════════════════════════════════
""")
    print_stats(log_conn)
    log_conn.close()
    if gs_conn:
        gs_conn.close()


if __name__ == "__main__":
    main()
