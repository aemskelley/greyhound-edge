#!/usr/bin/env python3
"""
gs_scraper.py - GreyhoundStats data collector for TFE Stats Model

Fetches full run history from greyhoundstats.co.uk and stores to SQLite.
Uses Playwright (real browser) to load the pages properly.

Usage:
  python gs_scraper.py --today           # read dogs from tfe-data/today.json
  python gs_scraper.py --csv FILE        # read dog names from CSV Dog Name column
  python gs_scraper.py --dog "NAME"      # single dog lookup
  python gs_scraper.py --dog "A" "B"    # multiple dogs

Output: tfe-data/gs_history.db (SQLite)
"""

import asyncio
import argparse
import json
import re
import sqlite3
import sys
import time
import random
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


# ---- Config ------------------------------------------------------------------

BASE_URL     = "https://greyhoundstats.co.uk/complete_runner_stats.php"
DATA_DIR     = Path(__file__).parent.parent / "tfe-data"
TODAY_JSON   = DATA_DIR / "today.json"
DB_PATH      = DATA_DIR / "gs_history.db"

CONCURRENCY  = 2       # parallel browser tabs
DELAY_MIN    = 1.5     # seconds between requests
DELAY_MAX    = 2.5
RETRY_MAX    = 3
PAGE_TIMEOUT = 25000   # ms

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


# ---- Database ----------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS dogs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    gs_name     TEXT,
    total_runs  INTEGER,
    total_wins  INTEGER,
    win_pct     REAL,
    fetched_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dog_id          INTEGER NOT NULL REFERENCES dogs(id),
    run_date        TEXT NOT NULL,
    track           TEXT,
    trap            INTEGER,
    grade           TEXT,
    distance_m      INTEGER,
    sp              TEXT,
    finish_pos      INTEGER,
    won             INTEGER,
    sectional       REAL,
    actual_time     REAL,
    going           INTEGER,
    calc_time       REAL,
    chester_rating  INTEGER,
    trainer         TEXT,
    UNIQUE(dog_id, run_date, track, grade)
);

CREATE INDEX IF NOT EXISTS idx_runs_dog   ON runs(dog_id);
CREATE INDEX IF NOT EXISTS idx_runs_date  ON runs(run_date);
CREATE INDEX IF NOT EXISTS idx_runs_track ON runs(track);
CREATE INDEX IF NOT EXISTS idx_dogs_name  ON dogs(name);
"""


def open_db(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


# ---- Parsing -----------------------------------------------------------------

def _float(s):
    try:
        v = float(str(s).strip())
        return v if v != 0.0 else None
    except (ValueError, AttributeError):
        return None


def _int(s):
    try:
        return int(str(s).strip())
    except (ValueError, AttributeError):
        return None


def _going(s):
    s = str(s).strip()
    if s in ("N", "n", ""):
        return 0
    try:
        return int(s)
    except ValueError:
        return None


def _date(s):
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", str(s).strip())
    if not m:
        return None
    return "{}-{}-{}".format(m.group(3), m.group(2), m.group(1))


def _dist(s):
    m = re.search(r"(\d+)m", str(s))
    return int(m.group(1)) if m else None


def _trap(cell_html):
    m = re.search(r"trap_(\d+)", str(cell_html))
    return int(m.group(1)) if m else None


def parse_page(html, dog_name_queried):
    soup = BeautifulSoup(html, "html.parser")

    # Dog name from "Results for X" heading.
    # GS wraps the name in a child element so get_text(strip=True) produces
    # "Results forDOG NAME" with no space. Use separator=" " to fix this.
    heading = soup.find("h4")
    gs_name = None
    if heading:
        text = re.sub(r"\s+", " ", heading.get_text(separator=" ", strip=True))
        m = re.match(r"Results\s+for\s+(.+)", text, re.IGNORECASE)
        if m:
            gs_name = m.group(1).strip()

    if not gs_name:
        return None

    # Find tables by content, not by index.
    # The full GS page has: nav table, summary table, detail table.
    # Summary table = 3 columns (Runs/Wins/Win%)
    # Detail table = 15 columns (Date/Track/Trap/Dog/Grade/Dist/SP/Finish/...)
    tables = soup.find_all("table")
    total_runs = total_wins = 0
    win_pct = 0.0
    summary_table = None
    detail_table = None

    for tbl in tables:
        rows = tbl.find_all("tr")
        if not rows:
            continue
        # Count cols in first data row (skip header rows with bgcolor)
        for row in rows:
            cells = row.find_all("td")
            if len(cells) == 3:
                # Could be the summary table - check if cells are numeric
                r = _int(cells[0].get_text(strip=True))
                w = _int(cells[1].get_text(strip=True))
                p = _float(cells[2].get_text(strip=True))
                if r and r > 0:
                    total_runs = r
                    total_wins = w or 0
                    win_pct    = p or 0.0
                    summary_table = tbl
                    break
            elif len(cells) >= 14:
                # Could be a detail run row - check if first cell looks like a date
                if _date(cells[0].get_text()):
                    detail_table = tbl
                    break
        if summary_table and detail_table:
            break

    if total_runs == 0:
        return None

    # Detail rows
    runs = []
    if detail_table:
        for row in detail_table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 13:
                continue
            run_date = _date(cells[0].get_text())
            if not run_date:
                continue

            track      = cells[1].get_text(strip=True)
            trap       = _trap(str(cells[2]))
            grade      = cells[4].get_text(strip=True)
            distance_m = _dist(cells[5].get_text())
            sp         = cells[6].get_text(strip=True)
            finish_pos = _int(cells[7].get_text())
            sectional  = _float(cells[8].get_text())
            actual_t   = _float(cells[9].get_text())
            going      = _going(cells[10].get_text())
            calc_t     = _float(cells[11].get_text())
            chester    = _int(cells[12].get_text()) if cells[12].get_text(strip=True) else None
            trainer    = cells[13].get_text(strip=True) if len(cells) > 13 else None

            if not track or finish_pos is None:
                continue

            runs.append({
                "run_date":       run_date,
                "track":          track,
                "trap":           trap,
                "grade":          grade,
                "distance_m":     distance_m,
                "sp":             sp,
                "finish_pos":     finish_pos,
                "won":            1 if finish_pos == 1 else 0,
                "sectional":      sectional,
                "actual_time":    actual_t,
                "going":          going,
                "calc_time":      calc_t,
                "chester_rating": chester,
                "trainer":        trainer,
            })

    return {
        "gs_name":    gs_name,
        "total_runs": total_runs,
        "total_wins": total_wins,
        "win_pct":    win_pct,
        "runs":       runs,
    }


# ---- Browser fetch -----------------------------------------------------------

async def fetch_dog(ctx, name, semaphore):
    url = "{}?dog={}".format(BASE_URL, quote_plus(name))

    async with semaphore:
        for attempt in range(1, RETRY_MAX + 1):
            page = None
            try:
                await asyncio.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
                page = await ctx.new_page()

                resp = await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=PAGE_TIMEOUT,
                )

                if resp and resp.status == 403:
                    print("  [{}] 403 Forbidden".format(name))
                    await page.close()
                    break

                # Wait for the summary table to appear (up to 10s)
                try:
                    await page.wait_for_selector("h4", timeout=10000)
                except Exception:
                    pass

                # Extra small delay to let any JS finish
                await asyncio.sleep(0.5)

                html = await page.content()
                await page.close()

                data = parse_page(html, name)
                if data:
                    return name, data
                else:
                    # Dump raw HTML snippet to file for debugging
                    debug_path = DB_PATH.parent / "gs_debug_last_fail.html"
                    try:
                        with open(str(debug_path), "w", encoding="utf-8") as dbf:
                            dbf.write("<!-- URL: {} -->\n".format(url))
                            dbf.write(html[:8000])
                        debug_msg = "HTML saved to {}".format(debug_path.name)
                    except Exception:
                        debug_msg = "could not save HTML"

                    if attempt < RETRY_MAX:
                        print("  [{}] Parse failed (attempt {}), retrying... {}".format(
                            name, attempt, debug_msg))
                        await asyncio.sleep(2)
                    else:
                        print("  [{}] Parse failed after {} attempts. {}".format(
                            name, RETRY_MAX, debug_msg))

            except Exception as e:
                if page:
                    try:
                        await page.close()
                    except Exception:
                        pass
                print("  [{}] Error: {} (attempt {})".format(name, e, attempt))
                if attempt < RETRY_MAX:
                    await asyncio.sleep(2 ** attempt)

    return name, None


# ---- Database writes ---------------------------------------------------------

def upsert_dog(conn, name_norm, data):
    now = datetime.now().isoformat()
    conn.execute(
        """
        INSERT INTO dogs (name, gs_name, total_runs, total_wins, win_pct, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            gs_name    = excluded.gs_name,
            total_runs = excluded.total_runs,
            total_wins = excluded.total_wins,
            win_pct    = excluded.win_pct,
            fetched_at = excluded.fetched_at
        """,
        (name_norm, data["gs_name"], data["total_runs"],
         data["total_wins"], data["win_pct"], now),
    )
    conn.commit()
    return conn.execute(
        "SELECT id FROM dogs WHERE name = ?", (name_norm,)
    ).fetchone()["id"]


def upsert_runs(conn, dog_id, runs):
    inserted = 0
    for r in runs:
        try:
            conn.execute(
                """
                INSERT OR IGNORE INTO runs
                  (dog_id, run_date, track, trap, grade, distance_m, sp,
                   finish_pos, won, sectional, actual_time, going,
                   calc_time, chester_rating, trainer)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    dog_id,
                    r["run_date"], r["track"], r["trap"], r["grade"],
                    r["distance_m"], r["sp"], r["finish_pos"], r["won"],
                    r["sectional"], r["actual_time"], r["going"],
                    r["calc_time"], r["chester_rating"], r["trainer"],
                ),
            )
            inserted += conn.execute("SELECT changes()").fetchone()[0]
        except sqlite3.Error as e:
            print("    DB error {}: {}".format(r["run_date"], e))
    conn.commit()
    return inserted


# ---- Name sources ------------------------------------------------------------

def names_from_today_json(path):
    with open(str(path)) as f:
        data = json.load(f)
    names = set()
    for race in data.get("_races", []):
        for dog in race.get("dogs", []):
            n = dog.get("name", "").strip()
            if n and n != "?":
                names.add(n.upper())
    return sorted(names)


def names_from_csv(path):
    import csv
    names = set()
    with open(str(path)) as f:
        reader = csv.DictReader(f)
        col = next(
            (c for c in reader.fieldnames
             if "dog" in c.lower() and "name" in c.lower()),
            None,
        )
        if not col:
            raise ValueError(
                "No 'Dog Name' column in {}. Columns: {}".format(
                    path, reader.fieldnames)
            )
        for row in reader:
            n = row[col].strip()
            if n:
                names.add(n.upper())
    return sorted(names)


# ---- Main --------------------------------------------------------------------

async def run(names, db_path):
    conn = open_db(db_path)
    semaphore = asyncio.Semaphore(CONCURRENCY)

    # Skip dogs already fetched today
    today = datetime.now().date().isoformat()
    already = {
        r["name"] for r in
        conn.execute(
            "SELECT name FROM dogs WHERE fetched_at >= ?", (today,)
        ).fetchall()
    }
    pending = [n for n in names if n.upper() not in already]
    skipped_cache = len(names) - len(pending)

    print("")
    print("=" * 60)
    print("  GS Scraper - {} dogs ({} already fetched today)".format(
        len(names), skipped_cache))
    print("  Fetching: {}".format(len(pending)))
    print("  DB: {}".format(db_path.resolve()))
    print("=" * 60)
    print("")

    if not pending:
        print("  Nothing to fetch - all dogs up to date.")
        conn.close()
        return

    t0 = time.time()
    found = skipped = failed = new_runs = 0

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        ctx = await browser.new_context(
            user_agent=USER_AGENT,
            locale="en-GB",
            viewport={"width": 1280, "height": 800},
        )

        tasks = [fetch_dog(ctx, name, semaphore) for name in pending]

        for i, coro in enumerate(asyncio.as_completed(tasks), 1):
            name, data = await coro
            norm = name.upper().strip()

            if data is None:
                print("  [{}/{}] X  {} - not found".format(
                    i, len(pending), name))
                failed += 1
                continue

            if not data.get("runs"):
                print("  [{}/{}] -  {} -> {} - 0 runs".format(
                    i, len(pending), name, data.get("gs_name", "?")))
                upsert_dog(conn, norm, data)
                skipped += 1
                continue

            dog_id = upsert_dog(conn, norm, data)
            nr = upsert_runs(conn, dog_id, data["runs"])
            new_runs += nr
            found += 1

            print("  [{}/{}] OK  {} -> {}  {}R {}W {:.1f}%  +{} rows".format(
                i, len(pending), name, data["gs_name"],
                data["total_runs"], data["total_wins"],
                data["win_pct"], nr))

        await browser.close()

    elapsed = time.time() - t0
    total_in_db = conn.execute("SELECT COUNT(*) FROM runs").fetchone()[0]
    dogs_in_db  = conn.execute("SELECT COUNT(*) FROM dogs").fetchone()[0]

    print("")
    print("=" * 60)
    print("  Done in {:.1f} min".format(elapsed / 60))
    print("  Found: {}  |  No data: {}  |  Failed: {}".format(
        found, skipped, failed))
    print("  New run rows added: {}".format(new_runs))
    print("  DB totals: {} dogs, {:,} runs".format(dogs_in_db, total_in_db))
    print("=" * 60)
    print("")

    conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="GreyhoundStats history scraper")
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--today", action="store_true",
                     help="Read dogs from tfe-data/today.json")
    src.add_argument("--csv", metavar="FILE",
                     help="Read dog names from CSV")
    src.add_argument("--dog", metavar="NAME", nargs="+",
                     help="One or more dog names")
    parser.add_argument("--db", default=str(DB_PATH),
                        help="SQLite path (default: {})".format(DB_PATH))
    args = parser.parse_args()

    db_path = Path(args.db)

    if args.today:
        if not TODAY_JSON.exists():
            sys.exit("today.json not found at {}. Run tfe_morning_scraper.py first.".format(
                TODAY_JSON))
        names = names_from_today_json(TODAY_JSON)
        print("Loaded {} dogs from today.json".format(len(names)))
    elif args.csv:
        names = names_from_csv(Path(args.csv))
        print("Loaded {} dogs from {}".format(len(names), args.csv))
    else:
        names = [n.upper() for n in args.dog]

    if not names:
        sys.exit("No dog names found.")

    asyncio.run(run(names, db_path))


if __name__ == "__main__":
    main()
