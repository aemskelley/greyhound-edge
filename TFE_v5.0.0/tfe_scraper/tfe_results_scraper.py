"""
TFE Evening Results Scraper
============================
Fetches results for all races previously scraped by tfe_morning_scraper.py
and saves them as results_YYYY-MM-DD.json for the TFE extension to use
when settling the P&L tracker.

Run this at end of day (after last race) or next morning:
    python tfe_results_scraper.py              # today's results
    python tfe_results_scraper.py yesterday    # yesterday's results

Requirements:
    pip install playwright tqdm
    playwright install chromium  (if not already done)

Output:
    tfe-data/results_YYYY-MM-DD.json

The extension reads this file automatically when you open the results tracker.
"""

import asyncio
import json
import sys
import time
from datetime import date, timedelta
from pathlib import Path

from playwright.async_api import async_playwright

try:
    from tqdm.asyncio import tqdm as atqdm
    import tqdm as _tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# ── Config ─────────────────────────────────────────────────────────────────
DATA_DIR     = Path(__file__).parent.parent / "tfe-data"
PROFILE_DIR  = Path(__file__).parent.parent / "tfe-browser-profile"
CONCURRENCY  = 3      # result pages simultaneously — slower = less bot detection
PAGE_TIMEOUT = 25000  # ms per page
STAGGER_MS   = 500    # ms between tab opens

# ── Progress bar ────────────────────────────────────────────────────────────
class Progress:
    """Simple progress bar that works with or without tqdm."""
    def __init__(self, total, desc=""):
        self.total   = total
        self.current = 0
        self.desc    = desc
        self.start   = time.time()
        self._bar    = None
        if HAS_TQDM:
            self._bar = _tqdm.tqdm(
                total=total, desc=desc, unit="race",
                bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
                ncols=70, colour="cyan"
            )
        else:
            print(f"\n{desc} (0/{total})", flush=True)

    def update(self, label=""):
        self.current += 1
        if self._bar:
            self._bar.set_postfix_str(label[:30], refresh=True)
            self._bar.update(1)
        else:
            pct  = int(self.current / self.total * 100)
            bar  = "█" * (pct // 5) + "░" * (20 - pct // 5)
            elapsed = int(time.time() - self.start)
            print(f"\r  [{bar}] {pct:3d}% {self.current}/{self.total} {label:<25}", end="", flush=True)

    def close(self, summary=""):
        if self._bar:
            self._bar.close()
        else:
            print(f"\r  {'█'*20} 100% {self.total}/{self.total} Done!{' '*20}", flush=True)
        elapsed = time.time() - self.start
        print(f"  ✓ {summary} ({elapsed:.0f}s)", flush=True)


# ── Result page JS extractor ────────────────────────────────────────────────
_RESULT_JS = r"""() => {
    const parseISP = s => {
        if (!s || s === '-') return null;
        const c = s.replace('f','').trim();
        if (c.includes('/')) { const [n,d]=c.split('/').map(Number); return d?+(n/d+1).toFixed(3):null; }
        const f=parseFloat(c); return isNaN(f)?null:f;
    };
    const ct = (tr,i) => (tr.cells[i]&&tr.cells[i].textContent.trim())||'';

    // Race info
    const bodyText = document.body.innerText||'';
    const rm  = bodyText.match(/The\s+(\d+m)\s+[\d:]+\s+([A-Z0-9]+)\s+at\s+([\w\s]+?)(?:\s+[a-z]|[.,\n]|$)/m);
    const winTime = bodyText.match(/Winning Time:\s*([\d.]+)/)?.[1] ?? null;
    const raceInfo = {
        distance: rm?rm[1]:null,
        grade:    rm?rm[2]:null,
        track:    rm?rm[3].trim():null,
        winTime:  winTime ? parseFloat(winTime) : null,
    };

    // Try multiple selectors — Timeform occasionally updates class names
    const SELECTORS = [
        'tr.rrb-runner-details-1',
        'tr.rrc-runner-details-1',
        'tr[class*="runner-details"]',
        'tr[class*="runner_details"]',
        'tr[class*="rrb-runner"]',
        'tr[class*="rrc-runner"]',
    ];

    let rows = [];
    let usedSelector = null;
    for (const sel of SELECTORS) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) { rows = Array.from(found); usedSelector = sel; break; }
    }

    // Debug: if still nothing, return class names of all TRs so we can identify the right selector
    if (!rows.length) {
        const allTrClasses = Array.from(document.querySelectorAll('tr')).map(tr => tr.className).filter(Boolean).slice(0,20);
        return { _debug: true, raceInfo, trClasses: allTrClasses, url: location.href };
    }

    const runners = [];
    rows.forEach(tr => {
        const nextTR  = tr.nextElementSibling;
        const trapImg = tr.querySelector('img[class*="trap"], img[alt]');
        const nameEl  = tr.querySelector('a[class*="greyhound"], a[href*="greyhound"]');
        const posText = ct(tr, 0);
        const posMatch= posText.match(/(\d+)/);
        const pos     = posMatch ? parseInt(posMatch[1]) : 9;
        const bspText = nextTR ? nextTR.cells[2]?.textContent?.trim() : null;
        const bsp     = bspText ? parseFloat(bspText) : null;
        runners.push({
            pos,
            trap: trapImg ? parseInt(trapImg.getAttribute('alt')) : null,
            name: nameEl?.textContent?.trim() || '?',
            isp:  parseISP(ct(tr, 8)),
            bsp:  isNaN(bsp) ? null : bsp,
            tfr:  parseInt(ct(tr, 9)) || null,
        });
    });

    if (!runners.length) return null;
    runners.sort((a,b) => a.pos - b.pos);
    return { raceInfo, runners, _selector: usedSelector };
}"""


# ── Helpers ─────────────────────────────────────────────────────────────────
def racecard_to_result_url(url):
    """Convert a racecard URL to its results equivalent."""
    return url.replace('/racecards/', '/results/')


async def open_page(ctx, url, wait_sel=None, timeout=PAGE_TIMEOUT):
    page = await ctx.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        if wait_sel:
            try:
                await page.wait_for_selector(wait_sel, timeout=timeout)
            except Exception:
                pass
    except Exception as e:
        await page.close()
        raise
    return page


async def run_concurrent(coros, limit, stagger_ms=STAGGER_MS):
    """Run coroutines with bounded concurrency and staggered starts."""
    sem     = asyncio.Semaphore(limit)
    results = [None] * len(coros)

    async def bounded(i, coro):
        await asyncio.sleep(i * stagger_ms / 1000)
        async with sem:
            try:
                results[i] = await coro
            except Exception as e:
                pass  # failed result — logged elsewhere

    await asyncio.gather(*[bounded(i, c) for i, c in enumerate(coros)])
    return results


async def fetch_result(ctx, race, progress):
    """Fetch result page for one race. Returns result dict or None."""
    result_url = racecard_to_result_url(race['url'])
    label      = f"{race['track']} {race['time']}"
    try:
        page = await open_page(ctx, result_url, None)

        # Wait for any table row to appear — works regardless of class name changes
        try:
            await page.wait_for_selector('table tr', timeout=PAGE_TIMEOUT)
        except Exception:
            pass

        # Extra wait for JS-rendered content
        await page.wait_for_timeout(2000)

        data = await page.evaluate(_RESULT_JS)
        await page.close()
        progress.update(label)

        # Debug mode — print TR classes so we can identify correct selector
        if data and data.get('_debug'):
            print(f"\n  [DEBUG] {label} — no runner rows found")
            print(f"  [DEBUG] TR classes on page: {data.get('trClasses', [])}")
            return None

        if data and data.get('runners'):
            return {
                'raceId':   race['raceId'],
                'url':      result_url,
                'track':    race['track'],
                'time':     race['time'],
                'date':     race['date'],
                'raceInfo': data['raceInfo'],
                'runners':  data['runners'],
            }
    except Exception as e:
        progress.update(f"✗ {label}")
    return None


# ── Main ────────────────────────────────────────────────────────────────────
async def main(target_date: date):
    DATA_DIR.mkdir(exist_ok=True)
    PROFILE_DIR.mkdir(exist_ok=True)

    # Load today.json to get race list
    data_file = DATA_DIR / "today.json"
    if not data_file.exists():
        print(f"✗ tfe-data/today.json not found.")
        print(f"  Run tfe_morning_scraper.py first.")
        return

    with open(data_file) as f:
        today_data = json.load(f)

    scraped_date_str = today_data.get('_meta', {}).get('date', '')
    target_date_str  = str(target_date)

    races = today_data.get('_races', [])
    if not races:
        print("✗ No races found in today.json")
        return

    # Filter to target date
    if scraped_date_str != target_date_str:
        print(f"  Note: today.json is from {scraped_date_str}, fetching results for that date")
        target_date_str = scraped_date_str

    output_file = DATA_DIR / f"results_{target_date_str}.json"

    # Check if already done
    existing = {}
    if output_file.exists():
        try:
            existing = json.loads(output_file.read_text())
            done = sum(1 for r in existing.get('results', []) if r.get('runners'))
            print(f"  Found existing results file with {done}/{len(races)} races settled")
            print(f"  Fetching any missing results...")
        except Exception:
            existing = {}

    existing_ids = {r['raceId'] for r in existing.get('results', []) if r.get('runners')}
    to_fetch     = [r for r in races if r['raceId'] not in existing_ids]

    if not to_fetch:
        print(f"✓ All {len(races)} results already fetched.")
        print(f"  Output: {output_file.resolve()}")
        return

    print(f"\n{'='*60}")
    print(f" TFE Evening Results Scraper")
    print(f" Date:    {target_date_str}")
    print(f" Races:   {len(races)} total, {len(to_fetch)} to fetch")
    print(f" Output:  {output_file.name}")
    print(f"{'='*60}\n")

    t0 = time.time()

    async with async_playwright() as pw:
        ctx = await pw.chromium.launch_persistent_context(
            str(PROFILE_DIR),
            headless=False,  # must match morning scraper — headless triggers WAF bot detection
            args=["--window-size=1280,900"],
            viewport={"width": 1280, "height": 900},
        )

        progress = Progress(len(to_fetch), desc="Fetching results")

        fetch_coros = [fetch_result(ctx, race, progress) for race in to_fetch]
        new_results = await run_concurrent(fetch_coros, CONCURRENCY)

        progress.close(f"{sum(1 for r in new_results if r)} results fetched")
        await ctx.close()

    # Merge with any existing
    all_results = list(existing.get('results', []))
    settled     = 0
    for result in new_results:
        if result and result.get('runners'):
            all_results.append(result)
            settled += 1

    # Sort by time
    all_results.sort(key=lambda r: r.get('time', ''))

    output = {
        '_meta': {
            'date':      target_date_str,
            'fetchedAt': time.time() * 1000,
            'raceCount': len(races),
            'settled':   settled + len(existing_ids),
        },
        'results': all_results,
    }

    output_file.write_text(json.dumps(output))

    elapsed = time.time() - t0
    print(f"\n{'='*60}")
    print(f" Done in {elapsed:.0f}s")
    print(f" Settled: {settled + len(existing_ids)}/{len(races)} races")
    print(f" Output:  {output_file.resolve()}")
    print(f"{'='*60}")
    print(f"\n The extension will auto-load results from this file.")


if __name__ == "__main__":
    # Allow "yesterday" as an argument
    if len(sys.argv) > 1 and sys.argv[1].lower() == "yesterday":
        target = date.today() - timedelta(days=1)
    else:
        target = date.today()

    asyncio.run(main(target))
