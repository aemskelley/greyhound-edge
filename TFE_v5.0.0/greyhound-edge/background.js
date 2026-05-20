// ============================================================
//  Greyhound Edge v5 — Background Service Worker
//
//  Handles:
//  - Racecard extraction (Timeform tab)
//  - Result extraction (Timeform tab)
//  - Betfair exchange odds scraping (replaces Oddschecker)
//  - Dog history fetching (Timeform profile tab)
//  - Local server data fetching (today.json, results JSON)
// ============================================================

// ── Extraction code injected into racecard tabs ───────────
function extractRacecardFromTab() {
  const GRADE_ORDER = {
    'A1':1,'A2':2,'A3':3,'A4':4,'A5':5,'A6':6,'A7':7,'A8':8,'A9':9,'A10':10,
    'B1':1,'B2':2,'B3':3,'B4':4,'B5':5,
    'S1':1,'S2':2,'S3':3,'S4':4,'S5':5,
    'D1':1,'D2':2,'D3':3,'D4':4,'D5':5,'D6':6,
  };
  const gradeVal  = g => g ? (GRADE_ORDER[g] ?? null) : null;
  const parseDist = s => { const m = s?.match(/(\d+)m/); return m ? parseInt(m[1]) : null; };
  const INTERFERENCE = /\b(Crd|Bmp|Bumped|Checked|Fell|Knocked|Impeded|Hampered|Crowded|Carried)\b/i;
  const SLOW_START   = /\b(SAw|SlowAway|MissedBreak|Dwelt|VSAw)\b/i;
  const FAST_START   = /\b(QAw|QuickAway|EP|EarlyPace|SnLed|ALed|LedFr)\b/i;
  const classifyRun  = c => !c ? 'unknown'
    : INTERFERENCE.test(c) ? 'interference'
    : SLOW_START.test(c)   ? 'slow_start'
    : FAST_START.test(c)   ? 'fast_start' : 'clean';

  const cellTxt = (tr, i) => tr.cells[i]?.textContent?.trim() || '';
  const cellNum = (tr, i) => { const n = parseFloat(cellTxt(tr, i)); return isNaN(n) ? null : n; };
  const cellInt = (tr, i) => { const n = parseInt(cellTxt(tr, i));   return isNaN(n) ? null : n; };

  function parseBendString(str) {
    if (!str || str === '-') return null;
    const digits = str.replace(/[^0-9]/g, '').split('').map(Number);
    if (digits.length < 2) return null;
    return { gain: digits[0] - digits[digits.length - 1] };
  }

  const dogHeaderTRs = document.querySelectorAll('tr.rpb-entry-details-1');
  const formTRs      = document.querySelectorAll('tr[class*="rpb-recent-form-"]');
  if (!dogHeaderTRs.length || !formTRs.length) return null;

  const bodyText = document.body.innerText || '';
  const rm = bodyText.match(/The\s+(\d+m)\s+[\d:]+\s+([A-Z0-9]+)\s+at\s+([\w\s]+?)[.\n]/);
  const raceInfo = rm
    ? { distance: rm[1], grade: rm[2], track: rm[3].trim() }
    : { distance: null, grade: null, track: null };

  const formTRMap = {};
  formTRs.forEach(tr => {
    const m = tr.className.match(/rpb-recent-form-(\d+)/);
    if (m) formTRMap[parseInt(m[1])] = tr;
  });

  const dogs = [];
  dogHeaderTRs.forEach(headerTR => {
    const trapImg = headerTR.cells[0]?.querySelector('img.rpb-trap');
    const trap    = trapImg ? parseInt(trapImg.getAttribute('alt')) : null;
    const link    = headerTR.querySelector('a.rpb-greyhound');
    const name    = link?.textContent?.trim() || '?';
    const ovm     = (link?.getAttribute('onmouseover') || '').match(/showSingleGreyhoundForm\((\d+)/);
    const formIdx = ovm ? parseInt(ovm[1]) : null;
    const formTR  = formTRMap[formIdx];

    const rows = [];
    if (formTR) {
      const innerTRs = [...formTR.querySelectorAll('tr')];
      for (let i = 0; i < innerTRs.length; i++) {
        const tr = innerTRs[i];
        if (tr.classList.contains('run-comment-mob')) continue;
        if (!tr.cells || tr.cells.length < 17) continue;
        if (!/^\d{2}\/\d{2}\/\d{4}/.test(cellTxt(tr, 0))) continue;
        const nextTR  = innerTRs[i + 1];
        const comment = nextTR?.classList.contains('run-comment-mob') ? nextTR.textContent.trim() : '';
        const distStr = cellTxt(tr, 3);
        rows.push({
          distM:    parseDist(distStr),
          dist:     distStr,
          grade:    cellTxt(tr, 4),
          gradeVal: gradeVal(cellTxt(tr, 4)),
          track:    cellTxt(tr, 2),
          trapPos:  cellInt(tr, 7),
          finPos:   cellInt(tr, 10),
          tfTime:   cellNum(tr, 14),
          secRtg:   cellInt(tr, 15),
          rtg:      cellInt(tr, 16),
          bendData: parseBendString(cellTxt(tr, 9)),
          comment,
          runType:  classifyRun(comment)
        });
      }
    }
    dogs.push({ trap, name, allRows: rows });
  });

  return { raceInfo, dogs, url: location.href };
}

// ── Extraction code injected into result tabs ─────────────
function extractResultFromTab() {
  const parseISPstr = s => {
    if (!s || s === '-') return null;
    const c = s.replace('f', '');
    if (c.includes('/')) { const [n,d] = c.split('/').map(Number); return d ? n/d+1 : null; }
    const f = parseFloat(c); return isNaN(f) ? null : f;
  };

  const results = [];
  document.querySelectorAll('tr.rrb-runner-details-1').forEach(tr => {
    const nextTR   = tr.nextElementSibling;
    const trapImg  = tr.querySelector('img.rrb-trap');
    const nameLink = tr.querySelector('a.rrb-greyhound');
    const posText  = tr.cells[0]?.textContent?.trim() || '';
    const posMatch = posText.match(/(\d+)/);
    const pos      = posMatch ? parseInt(posMatch[1]) : 9;
    const bsp      = nextTR ? parseFloat(nextTR.cells[2]?.textContent?.trim()) : null;

    results.push({
      pos,
      trap: trapImg ? parseInt(trapImg.getAttribute('alt')) : null,
      name: nameLink?.textContent?.trim() || '?',
      isp:  parseISPstr(tr.cells[8]?.textContent?.trim() || ''),
      bsp:  isNaN(bsp) ? null : bsp,
      tfr:  parseInt(tr.cells[9]?.textContent?.trim()) || null,
    });
  });

  if (!results.length) return null;
  results.sort((a,b) => a.pos - b.pos);
  return results;
}

// ── Open a tab, poll for readiness, extract, close ────────
function openTabAndExtract(url, extractFn, readySelector, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, tab => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }

      let elapsed = 0;
      const interval = 600;

      const poll = setInterval(async () => {
        elapsed += interval;

        try {
          const tabInfo = await chrome.tabs.get(tab.id).catch(() => null);
          if (!tabInfo || tabInfo.status === 'unloaded') {
            clearInterval(poll);
            reject(new Error('Tab was closed or unloaded'));
            return;
          }

          if (tabInfo.status !== 'complete') return;

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractFn,
          });

          const data = results?.[0]?.result;
          if (data) {
            clearInterval(poll);
            chrome.tabs.remove(tab.id).catch(() => {});
            resolve(data);
          }

        } catch (e) {
          if (elapsed >= timeoutMs) {
            clearInterval(poll);
            chrome.tabs.remove(tab.id).catch(() => {});
            reject(new Error(`Timeout on ${url}: ${e.message}`));
          }
        }

        if (elapsed >= timeoutMs) {
          clearInterval(poll);
          chrome.tabs.remove(tab.id).catch(() => {});
          reject(new Error(`Timeout waiting for data on ${url}`));
        }
      }, interval);
    });
  });
}

// ── Betfair exchange odds extractor ──────────────────────
// Injected into a Betfair exchange market page.
// Extracts runner names, trap numbers, and best back prices.
function extractBetfairOddsFromTab() {
  // Wait for runner rows to be rendered by Angular
  const runnerRows = document.querySelectorAll('tr.runner-line');
  if (!runnerRows.length) return null;

  // Also check prices have loaded — need at least one label.Zs3u5
  const priceLabels = document.querySelectorAll('label.Zs3u5');
  if (!priceLabels.length) return null;

  const runners = [];
  let minPrice  = Infinity;
  let favourite = null;

  runnerRows.forEach(tr => {
    // Runner name
    const nameEl = tr.querySelector('h3.runner-name');
    if (!nameEl) return;
    const name = nameEl.textContent.trim();

    // Trap number — from greyhound-silk class e.g. "greyhound-silk-3"
    const silkEl = tr.querySelector('[class*="greyhound-silk-"]');
    let trap = null;
    if (silkEl) {
      const m = silkEl.className.match(/greyhound-silk-(\d)/);
      if (m) trap = parseInt(m[1]);
    }

    // Best back price — in the last-back-cell, button with is-best-selection="true"
    let bestBack = null;
    const lastBackCell = tr.querySelector('td.last-back-cell');
    if (lastBackCell) {
      const bestBtn = lastBackCell.querySelector('button[is-best-selection="true"]');
      if (bestBtn) {
        const priceLabel = bestBtn.querySelector('label.Zs3u5');
        if (priceLabel) {
          bestBack = parseFloat(priceLabel.textContent.trim());
          if (isNaN(bestBack)) bestBack = null;
        }
      }
      // Fallback — if no is-best-selection button, just grab first price label
      if (!bestBack) {
        const anyLabel = lastBackCell.querySelector('label.Zs3u5');
        if (anyLabel) {
          bestBack = parseFloat(anyLabel.textContent.trim());
          if (isNaN(bestBack)) bestBack = null;
        }
      }
    }

    const impliedPct = (bestBack && bestBack > 1)
      ? +((1 / bestBack) * 100).toFixed(2)
      : null;

    // Track favourite (shortest price)
    if (bestBack && bestBack < minPrice) {
      minPrice  = bestBack;
      favourite = name;
    }

    // Check if runner is non-runner
    const isNonRunner = tr.classList.contains('removed-runner');

    runners.push({
      name,
      trap,
      bestBack,
      impliedPct,
      isNonRunner,
      // Fractional equivalent from button title attribute
      fractional: lastBackCell?.querySelector('button[is-best-selection="true"]')?.getAttribute('title') || null
    });
  });

  if (!runners.length) return null;

  // Sort by trap
  runners.sort((a, b) => (a.trap || 99) - (b.trap || 99));

  return {
    runners,
    favourite,
    fetchedAt: Date.now(),
    url:       location.href,
    marketId:  location.href.match(/market\/([\d.]+)/)?.[1] || null
  };
}

// ── Betfair market search extractor ──────────────────────
// Injected into https://www.betfair.com/exchange/plus/en/greyhound-racing-betting-4339
// Finds the market URL for a specific venue + time.
// Structure: <a class="race-link" href="greyhound-racing/market/1.xxx">
//              <span class="label">14:26</span>
//            </a>
// Venue name is in a parent container heading above the ul.race-list
function extractBetfairMarketUrl(venueKey, timeStr) {
  const BASE = 'https://www.betfair.com/exchange/plus/';

  // Wait for race links to be rendered
  const raceLinks = document.querySelectorAll('a.race-link');
  if (!raceLinks.length) return null; // not ready yet

  const normVenue = venueKey.toLowerCase().replace(/[-\s]/g, '');

  // Walk all meeting containers — each has a venue heading + ul.race-list
  // Try to find the meeting whose venue matches, then find the right time
  const meetings = document.querySelectorAll('.meeting, [data-ng-repeat*="meeting"], .event-information');

  let result = null;

  // Strategy 1: find by venue container + time
  for (const meeting of meetings) {
    const meetingText = meeting.textContent.toLowerCase().replace(/[-\s]/g, '');
    if (!meetingText.includes(normVenue)) continue;

    // Found the right meeting — find the time link
    const links = meeting.querySelectorAll('a.race-link');
    for (const link of links) {
      const span = link.querySelector('span.label');
      if (span && span.textContent.trim() === timeStr) {
        const href = link.getAttribute('href') || '';
        result = href.startsWith('http') ? href : BASE + href;
        break;
      }
    }
    if (result) break;
  }

  // Strategy 2: fallback — search ALL race links for time match
  // Return all matches so content.js can pick the best one
  if (!result) {
    const candidates = [];
    raceLinks.forEach(link => {
      const span = link.querySelector('span.label');
      if (!span) return;
      const time = span.textContent.trim();
      const href = link.getAttribute('href') || '';
      const fullHref = href.startsWith('http') ? href : BASE + href;
      // Get surrounding text for venue clue
      const container = link.closest('li')?.parentElement?.parentElement;
      const containerText = container?.textContent?.trim().slice(0, 60) || '';
      candidates.push({ time, href: fullHref, context: containerText });
    });

    // Return time-matched candidates
    const timeMatches = candidates.filter(c => c.time === timeStr);
    if (timeMatches.length === 1) {
      result = timeMatches[0].href;
    } else if (timeMatches.length > 1) {
      // Multiple races at same time — try venue match
      const venueMatch = timeMatches.find(c =>
        c.context.toLowerCase().replace(/[-\s]/g,'').includes(normVenue)
      );
      result = venueMatch ? venueMatch.href : timeMatches[0].href;
    }
  }

  return result || null;
}

// ── Dog profile history extractor ─────────────────────────
function extractHistoryFromTab() {
  const formRows = document.querySelectorAll(
    'tr[class*="rpb-recent-form-"], tr.rpb-greyhound-profile-form, .rp-dog-form tr'
  );

  if (document.readyState !== 'complete') return null;
  if (!formRows.length) return { runs: [], noData: true };

  const INTERFERENCE = /\b(Crd|Bmp|Bumped|Checked|Fell|Knocked|Impeded|Hampered|Crowded|Carried)\b/i;
  const SLOW_START   = /\b(SAw|SlowAway|MissedBreak|Dwelt|VSAw)\b/i;
  const FAST_START   = /\b(QAw|QuickAway|EP|EarlyPace|SnLed|ALed|LedFr)\b/i;
  const classifyRun  = c => !c ? 'unknown'
    : INTERFERENCE.test(c) ? 'interference'
    : SLOW_START.test(c)   ? 'slow_start'
    : FAST_START.test(c)   ? 'fast_start' : 'clean';

  const parseDist = s => { const m = s?.match(/(\d+)m/); return m ? parseInt(m[1]) : null; };
  const cellTxt = (tr, i) => tr.cells[i]?.textContent?.trim() || '';
  const cellNum = (tr, i) => { const n = parseFloat(cellTxt(tr, i)); return isNaN(n) ? null : n; };
  const cellInt = (tr, i) => { const n = parseInt(cellTxt(tr, i));   return isNaN(n) ? null : n; };

  const GRADE_ORDER = {
    'A1':1,'A2':2,'A3':3,'A4':4,'A5':5,'A6':6,'A7':7,'A8':8,'A9':9,'A10':10,
    'D1':1,'D2':2,'D3':3,'D4':4,'D5':5,'D6':6,
    'OR':0,'OR1':0,'OR2':0,'OR3':0,
  };

  const runs = [];
  const seen = new Set();

  formRows.forEach(containerTR => {
    const innerTRs = [...containerTR.querySelectorAll('tr')];
    innerTRs.forEach((tr, i) => {
      if (tr.classList.contains('run-comment-mob')) return;
      if (!tr.cells || tr.cells.length < 17) return;
      if (!/^\d{2}\/\d{2}\/\d{4}/.test(cellTxt(tr, 0))) return;

      const dateStr = cellTxt(tr, 0);
      const track   = cellTxt(tr, 2);
      const dist    = cellTxt(tr, 3);
      const key     = `${dateStr}|${track}|${dist}`;
      if (seen.has(key)) return;
      seen.add(key);

      const nextTR  = innerTRs[i + 1];
      const comment = nextTR?.classList.contains('run-comment-mob')
                    ? nextTR.textContent.trim() : '';
      const gradeStr = cellTxt(tr, 4);

      function parseBend(str) {
        if (!str || str === '-') return null;
        const digits = str.replace(/[^0-9]/g, '').split('').map(Number);
        if (digits.length < 2) return null;
        return { gain: digits[0] - digits[digits.length - 1] };
      }

      runs.push({
        date:      dateStr,
        track,
        dist,
        distM:     parseDist(dist),
        grade:     gradeStr,
        gradeVal:  GRADE_ORDER[gradeStr] ?? null,
        trapPos:   cellInt(tr, 7),
        finPos:    cellInt(tr, 10),
        tfTime:    cellNum(tr, 14),
        secRtg:    cellInt(tr, 15),
        rtg:       cellInt(tr, 16),
        bendData:  parseBend(cellTxt(tr, 9)),
        comment,
        runType:   classifyRun(comment),
      });
    });
  });

  if (!runs.length) return { runs: [], noData: true };
  return { runs, fetchedAt: Date.now(), url: location.href };
}

// ── Message handler ───────────────────────────────────────
// ── Persistent Betfair tab — stored in chrome.storage.local ─
// In-memory vars reset if service worker is killed/restarted.
// chrome.storage.local persists across SW restarts.
let _bfTabId     = null; // fast local cache
let _bfMarketUrl = null;

// On SW startup, restore tabId from storage
chrome.storage.local.get(['bfTabId','bfMarketUrl'], res => {
  if (res.bfTabId) {
    // Verify tab still exists
    chrome.tabs.get(res.bfTabId).then(tab => {
      if (tab) {
        _bfTabId     = res.bfTabId;
        _bfMarketUrl = res.bfMarketUrl;
        console.log('[GHEdge] Restored BF tab from storage:', _bfTabId);
      } else {
        chrome.storage.local.remove(['bfTabId','bfMarketUrl']);
      }
    }).catch(() => {
      chrome.storage.local.remove(['bfTabId','bfMarketUrl']);
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'EXTRACT_RACECARD') {
    openTabAndExtract(message.url, extractRacecardFromTab, 'tr.rpb-entry-details-1')
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'EXTRACT_RESULT') {
    openTabAndExtract(message.url, extractResultFromTab, 'tr.rrb-runner-details-1', 15000)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // ── Betfair exchange odds — direct market URL ─────────
  if (message.type === 'EXTRACT_BETFAIR_ODDS') {
    const { url } = message;

    chrome.tabs.create({ url, active: false }, tab => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      let elapsed  = 0;
      const MAX_MS = 30000;
      const POLL   = 800;

      const poll = setInterval(async () => {
        elapsed += POLL;

        try {
          const tabInfo = await chrome.tabs.get(tab.id).catch(() => null);
          if (!tabInfo) { clearInterval(poll); sendResponse({ ok: false, error: 'Tab closed' }); return; }
          if (tabInfo.status !== 'complete') return;

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Wait for Angular to render runner rows AND prices
              const runnerRows  = document.querySelectorAll('tr.runner-line');
              const priceLabels = document.querySelectorAll('label.Zs3u5');

              // Debug info always — helps diagnose if not ready
              if (!runnerRows.length || !priceLabels.length) {
                // Return debug object (not null) after 5s so we know what's on the page
                const allTRs    = document.querySelectorAll('tr').length;
                const bodySnip  = document.body.innerText.slice(0, 200);
                return {
                  notReady: true,
                  runnerRowsFound: runnerRows.length,
                  priceLabelsFound: priceLabels.length,
                  allTRs, bodySnip
                };
              }

              const runners = [];
              let minPrice  = Infinity;
              let favourite = null;

              runnerRows.forEach(tr => {
                const nameEl = tr.querySelector('h3.runner-name');
                if (!nameEl) return;
                const name = nameEl.textContent.trim();

                // Trap from silk class e.g. greyhound-silk-3
                const silkEl = tr.querySelector('[class*="greyhound-silk-"]');
                let trap = null;
                if (silkEl) {
                  const m = [...silkEl.classList].join(' ').match(/greyhound-silk-(\d)/);
                  if (m) trap = parseInt(m[1]);
                }

                // Best back price — button with is-best-selection="true" in last-back-cell
                let bestBack = null;
                let fractional = null;
                const lastBackCell = tr.querySelector('td.last-back-cell');
                if (lastBackCell) {
                  const bestBtn = lastBackCell.querySelector('button[is-best-selection="true"]');
                  const targetBtn = bestBtn || lastBackCell.querySelector('button');
                  if (targetBtn) {
                    fractional = targetBtn.getAttribute('title') || null;
                    const priceLabel = targetBtn.querySelector('label.Zs3u5');
                    if (priceLabel) {
                      bestBack = parseFloat(priceLabel.textContent.trim());
                      if (isNaN(bestBack)) bestBack = null;
                    }
                  }
                }

                const impliedPct = (bestBack && bestBack > 1)
                  ? +((1 / bestBack) * 100).toFixed(2) : null;

                if (bestBack && bestBack < minPrice) {
                  minPrice  = bestBack;
                  favourite = name;
                }

                runners.push({
                  name, trap, bestBack, impliedPct, fractional,
                  isNonRunner: tr.classList.contains('removed-runner')
                });
              });

              if (!runners.length) return { notReady: true, noRunnersExtracted: true };

              runners.sort((a, b) => (a.trap || 99) - (b.trap || 99));

              return {
                runners, favourite,
                fetchedAt: Date.now(),
                url: location.href,
                marketId: location.href.match(/market\/([\d.]+)/)?.[1] || null
              };
            }
          });

          const data = results?.[0]?.result;

          // Still loading — keep polling
          if (!data || data.notReady) {
            console.log('[GHEdge] BF market not ready yet:', JSON.stringify(data));
            if (elapsed >= MAX_MS) {
              clearInterval(poll);
              chrome.tabs.remove(tab.id).catch(() => {});
              sendResponse({ ok: false, error: `Timeout — last state: ${JSON.stringify(data)}` });
            }
            return;
          }

          // Got data
          clearInterval(poll);
          chrome.tabs.remove(tab.id).catch(() => {});
          sendResponse({ ok: true, data });

        } catch (e) {
          console.log('[GHEdge] BF scrape error:', e.message);
          if (elapsed >= MAX_MS) {
            clearInterval(poll);
            chrome.tabs.remove(tab.id).catch(() => {});
            sendResponse({ ok: false, error: e.message });
          }
        }
      }, POLL);
    });
    return true;
  }

  // ── Betfair market search — find market URL from venue+time ──
  if (message.type === 'FIND_BETFAIR_MARKET') {
    const { venue, time } = message;
    const searchUrl = 'https://www.betfair.com/exchange/plus/en/greyhound-racing-betting-4339';

    // Pass venue and time via chrome.scripting args parameter — no eval needed
    chrome.tabs.create({ url: searchUrl, active: false }, tab => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      let elapsed  = 0;
      const MAX_MS = 25000;
      const POLL   = 800;

      const poll = setInterval(async () => {
        elapsed += POLL;

        try {
          const tabInfo = await chrome.tabs.get(tab.id).catch(() => null);
          if (!tabInfo) { clearInterval(poll); sendResponse({ ok: false, error: 'Tab closed' }); return; }
          if (tabInfo.status !== 'complete') return;

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (venueKey, timeStr) => {
              const BASE = 'https://www.betfair.com/exchange/plus/';
              const raceLinks  = document.querySelectorAll('a.race-link');
              const allMarket  = document.querySelectorAll('a[href*="market"]');

              // Not loaded yet — keep polling
              if (!raceLinks.length && !allMarket.length) return null;

              if (raceLinks.length) {
                const candidates = [];
                raceLinks.forEach(link => {
                  const span = link.querySelector('span.label, span.time, span');
                  const t    = span ? span.textContent.trim() : link.textContent.trim();
                  const href = link.getAttribute('href') || '';
                  const full = href.startsWith('http') ? href : BASE + href;
                  const ctx  = link.closest('li')?.parentElement?.parentElement?.textContent?.trim().slice(0,120) || '';
                  candidates.push({ time: t, href: full, context: ctx });
                });

                const timeMatches = candidates.filter(c => c.time === timeStr);
                if (timeMatches.length === 1) return timeMatches[0].href;
                if (timeMatches.length > 1) {
                  const vm = timeMatches.find(c =>
                    c.context.toLowerCase().replace(/[-\s]/g,'').includes(venueKey)
                  );
                  return vm ? vm.href : timeMatches[0].href;
                }

                // No time match — return debug info
                return {
                  debug: true,
                  raceLinksFound: raceLinks.length,
                  sampleTimes: candidates.slice(0,10).map(c => c.time),
                  sampleHrefs: candidates.slice(0,3).map(c => c.href),
                  venueKey, timeStr,
                  bodySnippet: document.body.innerText.slice(0,300)
                };
              }

              // Fallback — any anchor with market in href
              return {
                debug: true,
                fallback: true,
                raceLinksFound: 0,
                allMarketLinks: [...allMarket].slice(0,5).map(a => ({
                  href: a.getAttribute('href'), text: a.textContent.trim().slice(0,40)
                })),
                venueKey, timeStr,
                bodySnippet: document.body.innerText.slice(0,300)
              };
            },
            args: [venue.toLowerCase().replace(/[-\s]/g, ''), time]
          });

          const data = results?.[0]?.result;
          if (data === null) return; // not ready — keep polling

          clearInterval(poll);
          chrome.tabs.remove(tab.id).catch(() => {});

          if (typeof data === 'string') {
            sendResponse({ ok: true, data });
          } else if (data?.debug) {
            console.log('[GHEdge] Betfair debug:', JSON.stringify(data));
            sendResponse({ ok: false, error: 'debug', debug: data });
          } else {
            sendResponse({ ok: false, error: 'No market found' });
          }

        } catch (e) {
          if (elapsed >= MAX_MS) {
            clearInterval(poll);
            chrome.tabs.remove(tab.id).catch(() => {});
            sendResponse({ ok: false, error: `Timeout: ${e.message}` });
          }
        }

        if (elapsed >= MAX_MS) {
          clearInterval(poll);
          chrome.tabs.remove(tab.id).catch(() => {});
          sendResponse({ ok: false, error: 'Timeout' });
        }
      }, POLL);
    });
    return true;
  }

  // Keep EXTRACT_ODDS for Oddschecker as fallback
  if (message.type === 'EXTRACT_ODDS') {
    const extractOddsFromTab = function() {
      const rows = document.querySelectorAll('tr.diff-row.evTabRow');
      if (!rows.length) return null;
      const runners = [];
      let minDecimal = Infinity;
      let favourite  = null;
      rows.forEach(tr => {
        const name      = tr.getAttribute('data-bname');
        if (!name) return;
        const oddsState = tr.getAttribute('data-initial-odds-state') || '';
        let bestDecimal = 0;
        let bestFrac    = '';
        oddsState.split(',').forEach(entry => {
          const parts = entry.split('_');
          if (parts.length < 5) return;
          const dec = parseFloat(parts[3]);
          if (!isNaN(dec) && dec > 1 && dec > bestDecimal) {
            bestDecimal = dec;
            bestFrac    = parts[2];
          }
        });
        const runner = {
          name:           name.trim(),
          bestDecimal:    bestDecimal > 1 ? +bestDecimal.toFixed(3) : null,
          bestFractional: bestFrac || null,
          impliedPct:     bestDecimal > 1 ? +((1 / bestDecimal) * 100).toFixed(2) : null,
          bestBookmakers: tr.getAttribute('data-best-bks') || ''
        };
        if (runner.bestDecimal && runner.bestDecimal < minDecimal) {
          minDecimal = runner.bestDecimal;
          favourite  = runner.name;
        }
        runners.push(runner);
      });
      if (!runners.length) return null;
      return { runners, favourite, fetchedAt: Date.now(), url: location.href };
    };
    openTabAndExtract(message.url, extractOddsFromTab, 'tr.diff-row.evTabRow', 15000)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'FETCH_DOG_HISTORY') {
    openTabAndExtract(message.url, extractHistoryFromTab, null, 20000)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'FETCH_SCRAPER_DATA') {
    fetch('http://localhost:7329/today.json', { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'FETCH_RESULTS_DATA') {
    const dateStr = message.date || new Date().toISOString().slice(0,10);
    fetch(`http://localhost:7329/results_${dateStr}.json`, { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // ── Persistent Betfair market tab management ──────────────
  // Keeps one BF market tab open for the current race.
  // OPEN_BETFAIR_TAB  — opens tab, returns tabId
  // POLL_BETFAIR_TAB  — scrapes existing tab silently (no open/close)
  // CLOSE_BETFAIR_TAB — closes tab when race goes in-play or page changes

  if (message.type === 'OPEN_BETFAIR_TAB') {
    const { url } = message;
    // Close any existing BF tab first
    if (_bfTabId) {
      chrome.tabs.remove(_bfTabId).catch(() => {});
      _bfTabId = null;
    }
    chrome.tabs.create({ url, active: false }, tab => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      _bfTabId     = tab.id;
      _bfMarketUrl = url;
      // Persist to storage so SW restart doesn't lose the tab ID
      chrome.storage.local.set({ bfTabId: tab.id, bfMarketUrl: url });
      console.log('[GHEdge] BF tab opened and saved:', tab.id, url);
      sendResponse({ ok: true, tabId: tab.id });
    });
    return true;
  }

  if (message.type === 'POLL_BETFAIR_TAB') {
    // Recover from SW restart — check storage if in-memory is empty
    const doWithTabId = async (tabId) => {
      if (!tabId) {
        sendResponse({ ok: false, error: 'No BF tab open' });
        return;
      }

      try {
        const tabInfo = await chrome.tabs.get(tabId).catch(() => null);
        if (!tabInfo) {
          _bfTabId = null;
          chrome.storage.local.remove(['bfTabId','bfMarketUrl']);
          sendResponse({ ok: false, error: 'Tab gone' });
          return;
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const runnerRows  = document.querySelectorAll('tr.runner-line');
            const priceLabels = document.querySelectorAll('label.Zs3u5');
            if (!runnerRows.length || !priceLabels.length) return { notReady: true };

            // Only detect truly suspended/inplay markets — avoid matching ng-class attribute strings
            // These classes are only added to the DOM element when the state is actually active
            const suspendedEl  = document.querySelector('.market-status-suspended');
            const inplayBadge  = document.querySelector('.inplay-badge, .in-play-badge, .market-inplay-icon');
            const suspendedMsg = document.querySelector('.suspended-msg, .suspension-info');
            const isSuspended  = !!suspendedEl || !!suspendedMsg;
            const isInplay     = !!inplayBadge;

            const runners = [];
            let minPrice  = Infinity;
            let favourite = null;

            runnerRows.forEach(tr => {
              const nameEl = tr.querySelector('h3.runner-name');
              if (!nameEl) return;
              const name = nameEl.textContent.trim();

              const silkEl = tr.querySelector('[class*="greyhound-silk-"]');
              let trap = null;
              if (silkEl) {
                const m = [...silkEl.classList].join(' ').match(/greyhound-silk-(\d)/);
                if (m) trap = parseInt(m[1]);
              }

              let bestBack   = null;
              let fractional = null;
              const lastBackCell = tr.querySelector('td.last-back-cell');
              if (lastBackCell) {
                const bestBtn = lastBackCell.querySelector('button[is-best-selection="true"]') || lastBackCell.querySelector('button');
                if (bestBtn) {
                  fractional = bestBtn.getAttribute('title') || null;
                  const lbl  = bestBtn.querySelector('label.Zs3u5');
                  if (lbl) {
                    bestBack = parseFloat(lbl.textContent.trim());
                    if (isNaN(bestBack)) bestBack = null;
                  }
                }
              }

              const impliedPct = (bestBack && bestBack > 1) ? +((1 / bestBack) * 100).toFixed(2) : null;
              if (bestBack && bestBack < minPrice) { minPrice = bestBack; favourite = name; }
              runners.push({ name, trap, bestBack, impliedPct, fractional, isNonRunner: tr.classList.contains('removed-runner') });
            });

            if (!runners.length) return { notReady: true };
            runners.sort((a, b) => (a.trap || 99) - (b.trap || 99));
            return { runners, favourite, fetchedAt: Date.now(), isSuspended, isInplay,
                     url: location.href, marketId: location.href.match(/market\/([\d.]+)/)?.[1] || null };
          }
        });

        const data = results?.[0]?.result;
        if (!data || data.notReady) {
          sendResponse({ ok: false, error: 'Not ready' });
        } else {
          sendResponse({ ok: true, data });
        }
      } catch (e) {
        console.log('[GHEdge] Poll error:', e.message);
        sendResponse({ ok: false, error: e.message });
      }
    };

    if (_bfTabId) {
      doWithTabId(_bfTabId);
    } else {
      // SW may have restarted — recover from storage
      chrome.storage.local.get('bfTabId', res => {
        if (res.bfTabId) {
          _bfTabId = res.bfTabId;
          doWithTabId(_bfTabId);
        } else {
          sendResponse({ ok: false, error: 'No BF tab open' });
        }
      });
    }
    return true;
  }

  if (message.type === 'CLOSE_BETFAIR_TAB') {
    if (_bfTabId) {
      chrome.tabs.remove(_bfTabId).catch(() => {});
      _bfTabId     = null;
      _bfMarketUrl = null;
    }
    chrome.storage.local.remove(['bfTabId','bfMarketUrl']);
    console.log('[GHEdge] BF tab closed and storage cleared');
    sendResponse({ ok: true });
    return true;
  }

});
