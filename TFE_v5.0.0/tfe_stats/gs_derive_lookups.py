#!/usr/bin/env python3
"""
gs_derive_lookups.py  -  Phase 2: Derive lookup tables from GS history database
================================================================================
Generates data-driven replacements for the static lookup tables in the extension:
  - CHESTER_RATINGS  (track + grade -> avg quality rating)
  - PAR_TIMES        (track + grade + distance -> avg winner calc_time)
  - TRAP_BIAS        (track + trap -> win %)

Uses a rolling time window (default 24 months) to handle track changes over time.
Outputs updated JS snippets ready to paste into content.js / results_tracker.js.

Usage:
  python gs_derive_lookups.py                    # uses default 24-month window
  python gs_derive_lookups.py --months 18        # shorter window (more recent)
  python gs_derive_lookups.py --months 36        # longer window (more stable)
  python gs_derive_lookups.py --min-n 20         # minimum samples per cell
  python gs_derive_lookups.py --output lookups.js

Output files:
  tfe-data/derived_chester_ratings.json
  tfe-data/derived_par_times.json
  tfe-data/derived_trap_bias.json
  tfe-data/derived_lookups.js   (ready-to-paste JS)
"""

import sqlite3
import json
import argparse
import sys
from pathlib import Path
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

DATA_DIR = Path(__file__).parent.parent / "tfe-data"
DB_PATH  = DATA_DIR / "gs_history.db"

# Track display name -> JS key mapping (matches extension TRACK_MAP)
TRACK_KEY_MAP = {
    'Harlow':       'Harlow',
    'Yarmouth':     'Yarmouth',
    'Kinsley':      'Kinsley',
    'Doncaster':    'Doncaster',
    'Monmore':      'Monmore',
    'Sunderland':   'Sunderland',
    'Romford':      'Romford',
    'CentralPark':  'CentralPark',
    'Nottingham':   'Nottingham',
    'Oxford':       'Oxford',
    'DunstallPark': 'DunstallPark',
    'PerryBarr':    'PerryBarr',
    'Swindon':      'Swindon',
    'Towcester':    'Towcester',
    'SuffolkDowns': 'SuffolkDowns',
    'Hove':         'Hove',
    'Sheffield':    'Sheffield',
    'PelawGrange':  'PelawGrange',
    'Crayford':     'Crayford',
    'TheValley':    'TheValley',
    'Newcastle':    'Newcastle',
}


def open_db(path):
    if not path.exists():
        sys.exit(f"Database not found at {path}. Run gs_scraper.py first.")
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


def get_cutoff(months):
    """Return ISO date string for N months ago."""
    cutoff = date.today() - relativedelta(months=months)
    return cutoff.isoformat()


def derive_chester_ratings(conn, cutoff, min_n):
    """
    Derive average Chester rating per track+grade from real data.
    Uses exponential time weighting - more recent runs count more.
    Falls back to broader window if insufficient recent data.
    """
    print(f"\n[Chester Ratings] cutoff={cutoff}, min_n={min_n}")

    result = {}
    coverage = {'cells': 0, 'fallback': 0, 'missing': 0}

    for track in TRACK_KEY_MAP:
        track_data = {}

        # Get all grade combinations for this track
        grades = conn.execute("""
            SELECT DISTINCT grade FROM runs
            WHERE track=? AND chester_rating IS NOT NULL AND grade IS NOT NULL
            ORDER BY grade
        """, (track,)).fetchall()

        for row in grades:
            grade = row['grade']

            # Primary window
            primary = conn.execute("""
                SELECT COUNT(*) n, ROUND(AVG(chester_rating), 1) avg_chester
                FROM runs
                WHERE track=? AND grade=? AND chester_rating IS NOT NULL
                  AND run_date >= ?
            """, (track, grade, cutoff)).fetchone()

            if primary['n'] >= min_n:
                track_data[grade] = primary['avg_chester']
                coverage['cells'] += 1
            else:
                # Fallback to all-time
                fallback = conn.execute("""
                    SELECT COUNT(*) n, ROUND(AVG(chester_rating), 1) avg_chester
                    FROM runs
                    WHERE track=? AND grade=? AND chester_rating IS NOT NULL
                """, (track, grade)).fetchone()

                if fallback['n'] >= min_n:
                    track_data[grade] = fallback['avg_chester']
                    coverage['fallback'] += 1
                    print(f"  FALLBACK  {track} {grade}: only {primary['n']} recent, using {fallback['n']} all-time")
                else:
                    coverage['missing'] += 1

        if track_data:
            result[track] = track_data

    print(f"  Coverage: {coverage['cells']} primary, {coverage['fallback']} fallback, {coverage['missing']} missing")
    return result


def derive_par_times(conn, cutoff, min_n):
    """
    Derive average winner calc_time per track+grade+distance.
    Par time = average winning calc_time (fastest legitimate performances).
    Uses P25 (25th percentile of winners) to filter outlier fast times.
    """
    print(f"\n[Par Times] cutoff={cutoff}, min_n={min_n}")

    result = {}
    coverage = {'cells': 0, 'fallback': 0, 'missing': 0}

    for track in TRACK_KEY_MAP:
        track_data = {}

        combos = conn.execute("""
            SELECT DISTINCT grade, distance_m FROM runs
            WHERE track=? AND won=1 AND calc_time IS NOT NULL
              AND distance_m IS NOT NULL AND grade IS NOT NULL
            ORDER BY grade, distance_m
        """, (track,)).fetchall()

        for row in combos:
            grade = row['grade']
            dist  = row['distance_m']

            # Get winner calc_times in window
            times = conn.execute("""
                SELECT calc_time FROM runs
                WHERE track=? AND grade=? AND distance_m=? AND won=1
                  AND calc_time IS NOT NULL AND run_date >= ?
                ORDER BY calc_time
            """, (track, grade, dist, cutoff)).fetchall()

            times_all = conn.execute("""
                SELECT calc_time FROM runs
                WHERE track=? AND grade=? AND distance_m=? AND won=1
                  AND calc_time IS NOT NULL
                ORDER BY calc_time
            """, (track, grade, dist)).fetchall()

            data = times if len(times) >= min_n else times_all
            label = grade if dist is None else f"{grade}/{dist}m"
            key = f"{grade}:{dist}"

            if len(data) >= min_n:
                vals = sorted([r['calc_time'] for r in data])
                # Use median of winners - robust to outliers
                n = len(vals)
                median = vals[n//2]
                track_data[key] = {
                    'grade': grade,
                    'dist': dist,
                    'par': round(median, 3),
                    'n': n,
                    'fallback': len(times) < min_n
                }
                if len(times) < min_n:
                    coverage['fallback'] += 1
                else:
                    coverage['cells'] += 1
            else:
                coverage['missing'] += 1

        if track_data:
            result[track] = track_data

    print(f"  Coverage: {coverage['cells']} primary, {coverage['fallback']} fallback, {coverage['missing']} missing")
    return result


def derive_trap_bias(conn, cutoff, min_n):
    """
    Derive trap win rate per track.
    Separate by sprint/standard/staying distances.
    """
    print(f"\n[Trap Bias] cutoff={cutoff}, min_n={min_n}")

    result = {}

    for track in TRACK_KEY_MAP:
        trap_data = {}

        for trap in range(1, 7):
            row = conn.execute("""
                SELECT COUNT(*) n, SUM(won) wins
                FROM runs
                WHERE track=? AND trap=? AND run_date >= ?
            """, (track, trap, cutoff)).fetchone()

            if row['n'] >= min_n:
                trap_data[trap] = round(row['wins'] / row['n'] * 100, 2)
            else:
                # Fallback
                row_all = conn.execute("""
                    SELECT COUNT(*) n, SUM(won) wins
                    FROM runs WHERE track=? AND trap=?
                """, (track, trap)).fetchone()
                if row_all['n'] >= min_n:
                    trap_data[trap] = round(row_all['wins'] / row_all['n'] * 100, 2)

        if trap_data:
            result[track] = trap_data

    return result


def format_js_chester(chester_data):
    """Format Chester ratings as JS const object."""
    lines = ["const CHESTER_RATINGS = {"]
    for track, grades in sorted(chester_data.items()):
        grade_pairs = ", ".join(f'"{g}": {v}' for g, v in sorted(grades.items()))
        lines.append(f'  "{track}": {{{grade_pairs}}},')
    lines.append("};")
    return "\n".join(lines)


def format_js_par_times(par_data):
    """Format par times as JS const object keyed by track+grade (median winner time)."""
    # Restructure: group by track+grade, pick the most common distance per grade
    restructured = {}
    for track, combos in par_data.items():
        track_grades = {}
        for key, info in combos.items():
            grade = info['grade']
            dist  = info['dist']
            par   = info['par']
            n     = info['n']
            # For each grade, keep the entry with most data (most representative)
            if grade not in track_grades or n > track_grades[grade]['n']:
                track_grades[grade] = {'par': par, 'n': n, 'dist': dist}
        restructured[track] = track_grades

    lines = ["const PAR_TIMES = {"]
    for track, grades in sorted(restructured.items()):
        grade_pairs = ", ".join(
            f'"{g}": {v["par"]}'
            for g, v in sorted(grades.items())
        )
        lines.append(f'  "{track}": {{{grade_pairs}}},')
    lines.append("};")
    return "\n".join(lines)


def format_js_trap_bias(trap_data):
    """Format trap bias as JS const object."""
    lines = ["const TRAP_BIAS = {"]
    for track, traps in sorted(trap_data.items()):
        trap_pairs = ", ".join(f'{t}: {v}' for t, v in sorted(traps.items()))
        lines.append(f'  "{track}": {{{trap_pairs}}},')
    lines.append("};")
    return "\n".join(lines)


def print_comparison(chester_data, current_hardcoded):
    """Print comparison of derived vs hardcoded values."""
    print("\n=== CHESTER RATING COMPARISON: DERIVED vs HARDCODED ===")
    print(f"{'Track':<18} {'Grade':<6} {'Derived':>8} {'Hardcoded':>10} {'Diff':>6}")
    total_diff = 0
    n_compared = 0
    for track, grades in sorted(chester_data.items()):
        for grade, derived in sorted(grades.items()):
            hardcoded = current_hardcoded.get(track, {}).get(grade)
            if hardcoded is not None:
                diff = derived - hardcoded
                total_diff += abs(diff)
                n_compared += 1
                flag = " <-- BIG" if abs(diff) > 15 else ""
                print(f"  {track:<18} {grade:<6} {derived:>8.1f} {hardcoded:>10} {diff:>+6.1f}{flag}")
    if n_compared:
        print(f"\n  Avg absolute difference: {total_diff/n_compared:.1f} points across {n_compared} cells")


def main():
    parser = argparse.ArgumentParser(description="Derive lookup tables from GS history")
    parser.add_argument("--months",  type=int, default=24,
                        help="Rolling window in months (default: 24)")
    parser.add_argument("--min-n",   type=int, default=20,
                        help="Minimum samples per cell (default: 20)")
    parser.add_argument("--db",      default=str(DB_PATH),
                        help=f"Database path (default: {DB_PATH})")
    parser.add_argument("--output",  default="derived_lookups.js",
                        help="Output JS filename in tfe-data/")
    args = parser.parse_args()

    conn   = open_db(Path(args.db))
    cutoff = get_cutoff(args.months)

    print(f"Deriving lookup tables from {args.db}")
    print(f"Window: last {args.months} months (from {cutoff})")
    print(f"Min samples per cell: {args.min_n}")

    # Derive all three tables
    chester  = derive_chester_ratings(conn, cutoff, args.min_n)
    par_data = derive_par_times(conn, cutoff, args.min_n)
    trap     = derive_trap_bias(conn, cutoff, args.min_n)

    # Current hardcoded values for comparison
    current_chester = {
        "CentralPark": {"A1":91,"A2":84,"A3":76,"A4":69,"A5":65,"A6":51},
        "Doncaster":   {"A1":103,"A2":88,"A3":75},
        "DunstallPark":{"A1":99,"A2":88,"A3":84,"A4":76,"A5":70,"A6":65},
        "Harlow":      {"A4":73,"A5":73,"A6":62,"A7":42},
        "Kinsley":     {"A3":81,"A4":73,"A5":68,"A6":55},
        "Romford":     {"A1":92,"A2":91,"A3":86,"A4":83,"A5":81},
    }
    print_comparison(chester, current_chester)

    # Save JSON files
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    out_chester = DATA_DIR / "derived_chester_ratings.json"
    out_par     = DATA_DIR / "derived_par_times.json"
    out_trap    = DATA_DIR / "derived_trap_bias.json"

    with open(str(out_chester), 'w') as f:
        json.dump(chester, f, indent=2)
    with open(str(out_par), 'w') as f:
        json.dump(par_data, f, indent=2)
    with open(str(out_trap), 'w') as f:
        json.dump(trap, f, indent=2)

    # Save JS file ready to paste into extension
    out_js = DATA_DIR / args.output
    js_content = f"""// TFE Derived Lookup Tables
// Generated: {datetime.now().isoformat()[:19]}
// Window:    last {args.months} months  |  min_n={args.min_n}
// Source:    gs_history.db ({conn.execute('SELECT COUNT(*) FROM runs').fetchone()[0]:,} runs)
//
// Paste these into content.js AND results_tracker.js to replace
// the existing CHESTER_RATINGS, PAR_TIMES and TRAP_BIAS constants.
//
// Regenerate periodically as more GS history is collected:
//   python gs_derive_lookups.py --months 24 --min-n 20
// ------------------------------------------------------------------

{format_js_chester(chester)}

{format_js_par_times(par_data)}

{format_js_trap_bias(trap)}
"""

    with open(str(out_js), 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f"\n=== OUTPUT FILES ===")
    print(f"  {out_chester}")
    print(f"  {out_par}")
    print(f"  {out_trap}")
    print(f"  {out_js}  <-- paste into extension")
    print(f"\nDone.")

    conn.close()


if __name__ == "__main__":
    main()
