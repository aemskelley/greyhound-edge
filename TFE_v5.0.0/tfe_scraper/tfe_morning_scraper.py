"""
TFE Morning Scraper  (v2 — parallel)
=====================================
Scrapes all of today's Timeform greyhound racecards and full dog career
histories, then saves the data as today.json for the TFE browser extension.

v2 improvements over v1:
  - Races scraped in parallel batches (RACE_CONCURRENCY at a time)
  - Dog profiles scraped in parallel batches (DOG_CONCURRENCY at a time)
  - Each unique dog only fetched once even if it runs in multiple races
  - Saves one final file at the end (faster than progressive saves)
  - Estimated time: ~8-12 minutes for a full BAGS day (vs 40+ min sequential)

Requirements:
    pip install playwright
    playwright install chromium

Usage:
    python tfe_morning_scraper.py

First run: a Chrome window opens so you can log in to Timeform.
Subsequent runs: reuses saved session from tfe-browser-profile/.

Output:
    tfe-data/today.json   (served by tfe_server.py at localhost:7329)
"""

import asyncio
import json
import re
import time
from datetime import date
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────
BASE_URL      = "https://www.timeform.com/greyhound-racing"
RACECARDS_URL = f"{BASE_URL}/racecards"
DATA_DIR      = Path(__file__).parent.parent / "tfe-data"
OUTPUT_FILE   = DATA_DIR / "today.json"
PROFILE_DIR   = Path("tfe-browser-profile")

RACE_CONCURRENCY = 4    # racecards fetched simultaneously
DOG_CONCURRENCY  = 6    # dog profile pages fetched simultaneously
PAGE_DELAY_MS    = 150  # stagger between tab opens in each batch
PAGE_TIMEOUT_MS  = 20000

# Track filter — None = all tracks
# e.g. ["sheffield", "kinsley", "nottingham", "central-park"]
TRACK_FILTER = None


# ── Inline JS for extracting racecard data ──────────────────────────────────
_RACECARD_JS = r"""
() => {
    const GO = {'A1':1,'A2':2,'A3':3,'A4':4,'A5':5,'A6':6,'A7':7,'A8':8,'A9':9,'A10':10,'D1':1,'D2':2,'D3':3,'D4':4,'D5':5,'D6':6,'OR':0,'OR1':0,'OR2':0,'OR3':0};
    const INT = /\b(Crd|Bmp|Bumped|Checked|Fell|Knocked|Impeded|Hampered|Crowded|Carried)\b/i;
    const SLW = /\b(SAw|SlowAway|MissedBreak|Dwelt|VSAw)\b/i;
    const FST = /\b(QAw|QuickAway|EP|EarlyPace|SnLed|ALed|LedFr)\b/i;
    const cls = c => !c?'unknown':INT.test(c)?'interference':SLW.test(c)?'slow_start':FST.test(c)?'fast_start':'clean';
    const pd  = s => { const m=s&&s.match(/(\d+)m/); return m?parseInt(m[1]):null; };
    const ct  = (tr,i) => (tr.cells[i]&&tr.cells[i].textContent.trim())||'';
    const cn  = (tr,i) => { const n=parseFloat(ct(tr,i)); return isNaN(n)?null:n; };
    const ci  = (tr,i) => { const n=parseInt(ct(tr,i));   return isNaN(n)?null:n; };
    const pb  = s => { if(!s||s==='-')return null; const d=s.replace(/[^0-9]/g,'').split('').map(Number); return d.length<2?null:{gain:d[0]-d[d.length-1]}; };
    const rm  = (document.body.innerText||'').match(/The\s+(\d+m)\s+[\d:]+\s+([A-Z0-9]+)\s+at\s+([\w\s]+?)(?:\s+will|[.,\n]|$)/m);
    const slug= (location.pathname.match(/\/racecards\/([^/]+)\//))||[];
    const trk = slug[1]?slug[1].replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):(rm?rm[3].trim():'');
    const TM  = {'new':'Newcastle','she':'Sheffield','rom':'Romford','hov':'Hove','mon':'Monmore','tow':'Towcester','har':'Harlow','not':'Nottingham','kin':'Kinsley','yar':'Yarmouth','sun':'Sunderland','pla':'PelawGrange','val':'TheValley','dun':'DunstallPark','don':'Doncaster','oxf':'Oxford','cen':'CentralPark','suf':'SuffolkDowns'};
    const tkRaw = (slug[1]||'').replace(/-/g,'').toLowerCase().slice(0,6);
    const trackKey = TM[tkRaw] || TM[(slug[1]||'').replace(/-/g,'').toLowerCase()] || trk.replace(/\s/g,'');
    const ri = {distance:rm?rm[1]:null, grade:rm?rm[2]:null, track:trk, trackKey};
    const forecastEl = document.querySelector('p.rpf-betting-forecast');
    const forecastMap = new Map();
    if (forecastEl) {
      const bTags = Array.from(forecastEl.querySelectorAll('b')).filter(b=>/\d/.test(b.textContent));
      bTags.forEach(bTag => {
        const oddsStr = bTag.textContent.trim();
        let nameText='', node=bTag.nextSibling;
        while(node&&!(node.nodeName==='B'&&/\d/.test(node.textContent))){if(node.nodeType===3)nameText+=node.textContent;node=node.nextSibling;}
        const name=nameText.replace(/^[\s,]+|[\s,]+$/g,'').toUpperCase().trim();
        if(!name||!oddsStr)return;
        const clean=oddsStr.replace(/jf|JF|f|F/g,'').trim();
        let decimal=null;
        if(clean.includes('/')){const[n,d]=clean.split('/').map(Number);decimal=(d&&!isNaN(n)&&!isNaN(d))?+(n/d+1).toFixed(3):null;}
        else{const f=parseFloat(clean);decimal=isNaN(f)?null:f;}
        forecastMap.set(name,{oddsStr,decimal,impliedPct:decimal?(1/decimal)*100:null});
      });
    }
    const trainerTRs = Array.from(document.querySelectorAll('tr.rpb-entry-details-2'));
    const ftm = {};
    document.querySelectorAll('tr[class*="rpb-recent-form-"]').forEach(tr=>{const m=tr.className.match(/rpb-recent-form-(\d+)/);if(m)ftm[parseInt(m[1])]=tr;});
    const dogs=[];
    document.querySelectorAll('tr.rpb-entry-details-1').forEach((htr,dogIndex)=>{
        const ti=htr.cells[0]&&htr.cells[0].querySelector('img.rpb-trap');
        const trap=ti?parseInt(ti.getAttribute('alt')):null;
        const lnk=htr.querySelector('a.rpb-greyhound');
        const name=lnk?lnk.textContent.trim():'?';
        const href=lnk?lnk.href:null;
        const did=href?(href.match(/\/(\d+)\/?$/)||[])[1]:null;
        const om=lnk?(lnk.getAttribute('onmouseover')||''):'';
        const omm=om.match(/showSingleGreyhoundForm\((\d+)/);
        const ftr=omm?ftm[parseInt(omm[1])]:null;
        let trainerName=null;
        if(trainerTRs[dogIndex]){const txt=trainerTRs[dogIndex].textContent.trim();const tm=txt.match(/^([A-Za-z][A-Za-z .'-]+?)(?:\s*\(|\s{2,}|$)/);if(tm)trainerName=tm[1].trim().replace(/\s+/g,' ');}
        const forecast=forecastMap.get(name.toUpperCase().trim())||null;
        const runs=[];
        if(ftr){const trs=Array.from(ftr.querySelectorAll('tr'));trs.forEach((tr,i)=>{
            if(tr.classList.contains('run-comment-mob'))return;
            if(!tr.cells||tr.cells.length<17)return;
            if(!/^\d{2}\/\d{2}\/\d{4}/.test(ct(tr,0)))return;
            const ntr=trs[i+1];
            const cmt=(ntr&&ntr.classList.contains('run-comment-mob'))?ntr.textContent.trim():'';
            const ds=ct(tr,3),gs=ct(tr,4);
            runs.push({date:ct(tr,0),track:ct(tr,2),dist:ds,distM:pd(ds),grade:gs,gradeVal:GO[gs]!==undefined?GO[gs]:null,trapPos:ci(tr,7),finPos:ci(tr,10),tfTime:cn(tr,14),secRtg:ci(tr,15),rtg:ci(tr,16),bendData:pb(ct(tr,9)),comment:cmt,runType:cls(cmt)});
        });}
        dogs.push({name,trap,dogId:did,profileUrl:href,trainerName,forecast,runs});
    });
    return {raceInfo:ri,dogs};
}
"""

# ── Inline JS for extracting full history from dog profile page ─────────────
_HISTORY_JS = r"""() => {
    const GO = {'A1':1,'A2':2,'A3':3,'A4':4,'A5':5,'A6':6,'A7':7,'A8':8,'A9':9,'A10':10,'D1':1,'D2':2,'D3':3,'D4':4,'D5':5,'D6':6,'OR':0,'OR1':0,'OR2':0,'OR3':0};
    const INT = /\b(Crd|Bmp|Bumped|Checked|Fell|Knocked|Impeded|Hampered|Crowded|Carried)\b/i;
    const SLW = /\b(SAw|SlowAway|MissedBreak|Dwelt|VSAw)\b/i;
    const FST = /\b(QAw|QuickAway|EP|EarlyPace|SnLed|ALed|LedFr)\b/i;
    const cls = c => !c?'unknown':INT.test(c)?'interference':SLW.test(c)?'slow_start':FST.test(c)?'fast_start':'clean';
    const pd  = s => { const m=s&&s.match(/(\d+)m/); return m?parseInt(m[1]):null; };
    const ct  = (tr,i) => (tr.cells[i]&&tr.cells[i].textContent.trim())||'';
    const cn  = (tr,i) => { const n=parseFloat(ct(tr,i)); return isNaN(n)?null:n; };
    const ci  = (tr,i) => { const n=parseInt(ct(tr,i));   return isNaN(n)?null:n; };
    const pb  = s => { if(!s||s==='-')return null; const d=s.replace(/[^0-9]/g,'').split('').map(Number); return d.length<2?null:{gain:d[0]-d[d.length-1]}; };
    const runs=[],seen=new Set();
    document.querySelectorAll('tr[class*="rpb-recent-form-"]').forEach(ctr=>{
        const trs=Array.from(ctr.querySelectorAll('tr'));
        trs.forEach((tr,i)=>{
            if(tr.classList.contains('run-comment-mob'))return;
            if(!tr.cells||tr.cells.length<17)return;
            if(!/^\d{2}\/\d{2}\/\d{4}/.test(ct(tr,0)))return;
            const ds=ct(tr,0),tk=ct(tr,2),di=ct(tr,3),key=ds+'|'+tk+'|'+di;
            if(seen.has(key))return; seen.add(key);
            const ntr=trs[i+1];
            const cmt=(ntr&&ntr.classList.contains('run-comment-mob'))?ntr.textContent.trim():'';
            const gs=ct(tr,4);
            runs.push({date:ds,track:tk,dist:di,distM:pd(di),grade:gs,gradeVal:GO[gs]!==undefined?GO[gs]:null,trapPos:ci(tr,7),finPos:ci(tr,10),tfTime:cn(tr,14),secRtg:ci(tr,15),rtg:ci(tr,16),bendData:pb(ct(tr,9)),comment:cmt,runType:cls(cmt)});
        });
    });
    return runs;
}"""


# ── Helpers ──────────────────────────────────────────────────────────────────
async def open_page(context, url, wait_sel=None, timeout=PAGE_TIMEOUT_MS):
    page = await context.new_page()
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


async def run_concurrent(coros, limit, stagger_ms=PAGE_DELAY_MS):
    """Run coroutines with bounded concurrency and staggered starts.
    Stagger happens BEFORE acquiring the semaphore so sleeping tasks
    don't consume concurrency slots.
    """
    sem     = asyncio.Semaphore(limit)
    results = [None] * len(coros)

    async def bounded(i, coro):
        # Stagger initial launch so we don't open N tabs simultaneously
        await asyncio.sleep(i * stagger_ms / 1000)
        async with sem:  # now acquire slot only when about to do real work
            try:
                results[i] = await coro
            except Exception as e:
                print(f"    ✗ [{i}] failed: {e}")

    await asyncio.gather(*[bounded(i, c) for i, c in enumerate(coros)])
    return results


def sort_key(run):
    d = run.get("date", "")
    parts = d.split("/")
    return "/".join(reversed(parts)) if len(parts) == 3 else d


def merge_runs(racecard, history):
    existing = {f"{r['date']}|{r['track']}|{r['dist']}" for r in racecard}
    extra    = [r for r in history if f"{r['date']}|{r['track']}|{r['dist']}" not in existing]
    combined = racecard + extra
    combined.sort(key=sort_key, reverse=True)
    return combined


# ── Scrapers ─────────────────────────────────────────────────────────────────
async def get_todays_races(context):
    print("Fetching today's race list...")
    page  = await open_page(context, RACECARDS_URL)
    links = await page.eval_on_selector_all(
        "a[href*='/greyhound-racing/racecards/']",
        "els => els.map(el => ({url: el.href, title: el.getAttribute('title')||''}))"
    )
    await page.close()

    today = str(date.today())
    seen  = set()
    races = []
    for lnk in links:
        url = lnk["url"]
        if url in seen:
            continue
        m = re.search(r"/racecards/([^/]+)/(\d{4})/(\d{4}-\d{2}-\d{2})/(\d+)", url)
        if not m:
            continue
        track, hhmm, rdate, rid = m.groups()
        if rdate != today:
            continue
        if TRACK_FILTER and track not in TRACK_FILTER:
            continue
        seen.add(url)
        races.append({"url": url, "track": track,
                      "time": f"{hhmm[:2]}:{hhmm[2:]}",
                      "raceId": rid, "date": rdate, "title": lnk["title"]})

    races.sort(key=lambda r: r["time"])
    print(f"  {len(races)} races found for {today}")
    return races


async def scrape_racecard(context, race):
    page   = await open_page(context, race["url"], "tr.rpb-entry-details-1")
    result = await page.evaluate(_RACECARD_JS)
    await page.close()
    return result


async def scrape_history(context, dog):
    if not dog.get("profileUrl") or not dog.get("dogId"):
        return []
    page = await open_page(context, dog["profileUrl"],
                           "tr[class*='rpb-recent-form-']")
    runs = await page.evaluate(_HISTORY_JS)
    await page.close()
    return runs or []


# ── Main ──────────────────────────────────────────────────────────────────────
async def main():
    DATA_DIR.mkdir(exist_ok=True)
    PROFILE_DIR.mkdir(exist_ok=True)
    t0 = time.time()

    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        print("Starting browser (headless=False so you can log in if needed)...")
        ctx = await pw.chromium.launch_persistent_context(
            str(PROFILE_DIR),
            headless=False,
            args=["--window-size=1280,900"],
            viewport={"width": 1280, "height": 900},
        )

        # 1. Race list
        races = await get_todays_races(ctx)
        if not races:
            print("No races found.")
            await ctx.close()
            return

        # 2. All racecards in parallel
        print(f"\nFetching {len(races)} racecards ({RACE_CONCURRENCY} parallel)...")
        racecard_results = await run_concurrent(
            [scrape_racecard(ctx, r) for r in races],
            RACE_CONCURRENCY
        )
        print(f"  Done in {time.time()-t0:.0f}s")

        # 3. Collect unique dogs
        dog_map      = {}   # dogId → dog (first occurrence wins)
        race_records = []
        for race, rc in zip(races, racecard_results):
            rec = {**race, "raceInfo": rc.get("raceInfo", {}) if rc else {}, "dogs": []}
            for dog in (rc.get("dogs", []) if rc else []):
                did = dog.get("dogId")
                if did and did not in dog_map:
                    dog_map[did] = dog
                rec["dogs"].append(dog)
            race_records.append(rec)

        unique_dogs = list(dog_map.values())
        print(f"\n  {len(unique_dogs)} unique dogs across all races")

        # 4. All dog histories in parallel
        print(f"Fetching dog histories ({DOG_CONCURRENCY} parallel)...")
        history_results = await run_concurrent(
            [scrape_history(ctx, d) for d in unique_dogs],
            DOG_CONCURRENCY
        )

        await ctx.close()

    # 5. Build output
    merged = {}
    gained = 0
    for dog, hist in zip(unique_dogs, history_results):
        did  = dog.get("dogId")
        if not did:
            continue
        hist      = hist or []
        rc_runs   = dog.get("runs", [])
        all_runs  = merge_runs(rc_runs, hist)
        extra     = len(all_runs) - len(rc_runs)
        if extra > 0:
            gained += extra
        merged[did] = {"runs": all_runs, "fetchedAt": time.time() * 1000}

    elapsed = time.time() - t0
    output  = {
        "_meta": {
            "date":      str(date.today()),
            "fetchedAt": time.time() * 1000,
            "raceCount": len(races),
            "dogCount":  len(unique_dogs),
            "extraRuns": gained,
            "elapsed_s": round(elapsed),
        },
        "_races": race_records,
        **merged,
    }

    OUTPUT_FILE.write_text(json.dumps(output))
    size_kb = OUTPUT_FILE.stat().st_size / 1024

    print(f"\n{'='*60}")
    print(f"Completed in {elapsed/60:.1f} minutes")
    print(f"  Races:     {len(races)}")
    print(f"  Dogs:      {len(unique_dogs)}")
    print(f"  Extra runs from history: {gained}")
    print(f"  Output:    {OUTPUT_FILE.resolve()}")
    print(f"  File size: {size_kb:.0f} KB")
    print(f"{'='*60}")
    print("\nNow run:  python tfe_server.py")


if __name__ == "__main__":
    asyncio.run(main())
