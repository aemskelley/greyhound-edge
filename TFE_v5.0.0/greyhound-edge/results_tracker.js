// ============================================================
//  Greyhound Edge v5 — Results Tracker
//
//  Improvements:
//  - ISP fallback: uses ISP immediately, upgrades to BSP when available
//  - Auto-refresh: every visit re-parses prices and updates if BSP
//    has arrived since last visit (no manual action needed)
//  - Manual refresh button on result panel for on-demand update
//  - Price source indicator: shows whether P&L is based on BSP or ISP
// ============================================================

(function () {
  'use strict';

  if (!location.href.includes('/greyhound-racing/results')) return;

  // ── Price parsing ──────────────────────────────────────────
  const parseFraction = s => {
    if (!s || s === '-' || s === '0') return null;
    const c = s.replace(/jf|JF|f|F/g, '').trim();  // strip favourite suffixes (f, jf)
    if (/^evs?$/i.test(c)) return 2.0;  // evens = 1/1 = 2.0
    if (c.includes('/')) {
      const [n, d] = c.split('/').map(Number);
      return (d && !isNaN(n) && !isNaN(d)) ? +(n / d + 1).toFixed(3) : null;
    }
    const f = parseFloat(c);
    return isNaN(f) ? null : f;
  };

  const fmt2   = v => (v != null && !isNaN(v)) ? (+v).toFixed(2) : '–';

  // ── Extract race time from stored URL ─────────────────────
  // URL pattern: /racecards/venue/1218/2026-05-12/raceId → "12:18"
  function raceTimeFromUrl(url) {
    if (!url) return '–';
    const m = url.match(/\/(\d{4})\/\d{4}-\d{2}-\d{2}\//);
    if (!m) return '–';
    const t = m[1];
    return t.slice(0,2) + ':' + t.slice(2);
  }

  // ── Extract race date from racedAt timestamp ───────────────
  // racedAt is when the racecard was first visited — i.e. before the race
  function raceDateFromTimestamp(ts) {
    if (!ts) return '–';
    return new Date(ts).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' });
  }
  const fmtPnl = (pnl, src) => {
    if (pnl == null) return '–';
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}£${Math.abs(pnl).toFixed(2)} <span class="tfe-price-src">${src}</span>`;
  };

  // ── Parse full result from page ────────────────────────────
  // Returns dogs with BOTH isp and bsp where available

  // ── Clean venue name ──────────────────────────────────────
  // Strips Timeform scheduling text appended to venue name
  // e.g. "Harlow will be run on Wednesday 13 May" -> "Harlow"
  function cleanVenue(raw) {
    if (!raw) return '';
    const m = raw.match(/^([\w\s-]+?)(?:\s+will|\s+has|,|\s+on\s\d|\s+\d{1,2}\s+\w)/i);
    return m ? m[1].trim() : raw.trim();
  }

  function parseCurrentResult() {
    const dogRows = document.querySelectorAll('tr.rrb-runner-details-1');
    if (!dogRows.length) return null;

    const results = [];
    dogRows.forEach(tr => {
      const nextTR   = tr.nextElementSibling;
      const trapImg  = tr.querySelector('img.rrb-trap');
      const nameLink = tr.querySelector('a.rrb-greyhound');
      const posText  = tr.cells[0]?.textContent?.trim() || '';
      const posMatch = posText.match(/(\d+)/);
      const pos      = posMatch ? parseInt(posMatch[1]) : 9;

      const ispRaw = tr.cells[8]?.textContent?.trim() || '';
      const bspRaw = nextTR?.cells[2]?.textContent?.trim() || '';

      const isp = parseFraction(ispRaw);
      const bsp = parseFloat(bspRaw);

      results.push({
        pos,
        trap:    trapImg ? parseInt(trapImg.getAttribute('alt')) : null,
        name:    nameLink?.textContent?.trim() || '?',
        isp:     isp,
        bsp:     (!isNaN(bsp) && bsp > 1) ? bsp : null,   // BSP < 1 = not yet populated
        ispRaw,
        bspRaw
      });
    });

    results.sort((a, b) => a.pos - b.pos);
    return results;
  }

  // ── Choose best available price ────────────────────────────
  // BSP preferred; fall back to ISP; note which was used
  function bestPrice(dog) {
    if (dog.bsp && dog.bsp > 1) return { price: dog.bsp, source: 'BSP', decimal: dog.bsp };
    if (dog.isp && dog.isp > 1) return { price: dog.isp, source: 'ISP', decimal: dog.isp };
    return { price: null, source: null, decimal: null };
  }

  // ── Build outcome object ───────────────────────────────────
  function buildOutcome(raceRecord, actualResults) {
    const raceId    = raceRecord.raceId;
    const actualMap = {};
    actualResults.forEach(r => { actualMap[r.name.toUpperCase().trim()] = r; });

    const sorted     = [...raceRecord.dogs].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const topPick    = sorted[0];
    const secondPick = sorted[1];
    const topActual  = actualMap[topPick?.name?.toUpperCase().trim()];
    const secActual  = actualMap[secondPick?.name?.toUpperCase().trim()];
    const winner     = actualResults.find(r => r.pos === 1);

    const topPickWon    = topActual?.pos === 1;
    const topPickPlaced = topActual?.pos <= 2;
    const fcCorrect     = topPickWon && secActual?.pos === 2;

    // Best available price for top pick
    const priceInfo = topActual ? bestPrice(topActual) : { price: null, source: null };
    const pnl       = priceInfo.price
      ? (topPickWon ? +(priceInfo.price - 1).toFixed(2) : -1)
      : (topPickWon ? 0 : -1);

    // Has BSP fully settled for all dogs?
    const bspSettled = actualResults.every(r => r.bsp && r.bsp > 1);

    return {
      raceId,
      url:          location.href,
      racecardUrl:  raceRecord.url,
      race:         `${raceRecord.raceInfo?.distance || ''} ${raceRecord.raceInfo?.grade || ''} ${cleanVenue(raceRecord.raceInfo?.track || '')}`.trim(),
      raceInfo:     raceRecord.raceInfo,
      timestamp:    Date.now(),
      racedAt:      raceRecord.timestamp,
      bspSettled,
      priceSource:  priceInfo.source,
      // Picks
      topPick:      topPick?.name || '?',
      topScore:     topPick?.score ?? 0,
      topPickPos:   topActual?.pos ?? '?',
      topPickPrice: priceInfo.price,
      topPickBSP:   topActual?.bsp ?? null,
      topPickISP:   topActual?.isp ?? null,
      topPickWon, topPickPlaced, fcCorrect,
      secondPick:   secondPick?.name || '?',
      winner:       winner?.name || '?',
      winnerBSP:    winner?.bsp  ?? null,
      winnerISP:    winner?.isp  ?? null,
      pnl,
      // Per-dog results
      dogs: sorted.map(d => {
        const actual = actualMap[d.name.toUpperCase().trim()];
        const bp     = actual ? bestPrice(actual) : { price: null, source: null };
        return {
          name:       d.name,
          trap:       d.trap,
          score:      d.score,
          actualPos:  actual?.pos  ?? null,
          bsp:        actual?.bsp  ?? null,
          isp:        actual?.isp  ?? null,
          price:      bp.price,
          priceSource: bp.source,
          forecast:   d.forecast
        };
      }),
      weights: raceRecord.weights
    };
  }

  // ── Save / update outcome ──────────────────────────────────
  function saveOutcome(outcome, isUpdate = false) {
    const key = `outcome:${outcome.raceId}`;
    chrome.storage.local.set({ [key]: outcome }, () => {
      const status = isUpdate ? 'Updated' : 'Saved';
      const src    = outcome.priceSource || '?';
      console.log(`[TFE Tracker] ✓ ${status} race ${outcome.raceId} — ${outcome.topPickWon ? 'WIN' : 'LOSS'} P&L: ${outcome.pnl >= 0 ? '+' : ''}£${Math.abs(outcome.pnl).toFixed(2)} (${src})`);
    });
  }

  // ── Check if outcome needs a price refresh ─────────────────
  // Returns true if BSP wasn't settled when last saved
  function needsRefresh(existing) {
    // Refresh if BSP not fully settled, OR any dog still missing ISP/BSP
    if (!existing.bspSettled) return true;
    if (existing.priceSource === 'ISP') return true;
    if (existing.dogs?.some(d => d.bsp == null || d.isp == null)) return true;
    return false;
  }

  // ── Refresh an existing outcome with fresh page data ──────
  // Always re-parses the page and overwrites if ANY price data has changed:
  // - New ISP for dogs that previously had none (non-placed dogs get ISP later)
  // - BSP arriving for any dog
  // - Any price value changing
  function refreshOutcome(raceRecord, existingOutcome, onDone) {
    const actualResults = parseCurrentResult();
    if (!actualResults?.length) { onDone(existingOutcome, false); return; }

    const fresh = buildOutcome(raceRecord, actualResults);

    // Count how many dogs now have prices vs before
    const prevPriced  = (existingOutcome.dogs || []).filter(d => d.bsp || d.isp).length;
    const freshPriced = (fresh.dogs || []).filter(d => d.bsp || d.isp).length;

    // Count BSP arrivals
    const prevBsp  = (existingOutcome.dogs || []).filter(d => d.bsp).length;
    const freshBsp = (fresh.dogs || []).filter(d => d.bsp).length;

    const anyChange = freshPriced > prevPriced  // new ISP/BSP for previously unprice dogs
                   || freshBsp   > prevBsp      // new BSP arrivals
                   || (fresh.bspSettled && !existingOutcome.bspSettled)
                   || (fresh.topPickBSP != null && existingOutcome.topPickBSP == null)
                   || (fresh.priceSource === 'BSP' && existingOutcome.priceSource === 'ISP');

    if (anyChange) {
      saveOutcome(fresh, true);
      onDone(fresh, true);
      console.log(`[TFE Tracker] ✓ Prices updated — priced dogs: ${prevPriced}→${freshPriced}, BSP: ${prevBsp}→${freshBsp}`);
    } else {
      onDone(existingOutcome, false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  const getRaceId         = (url) => { const m = (url||location.href).match(/\/([0-9]+)(?:\?|$)/); return m ? m[1] : null; };
  const isIndividualPage  = ()    => /\/results\/[^/]+\/\d+\/\d{4}-\d{2}-\d{2}\/\d+/.test(location.href);

  // ── Build result panel ─────────────────────────────────────
  function buildResultPanel(raceRecord, outcome, wasRefreshed) {
    document.getElementById('tfe-result-panel')?.remove();

    const pnlCol  = outcome.pnl >= 0 ? '#00e676' : '#ef5350';
    const wonText = outcome.topPickWon ? '✅ WIN' : outcome.topPickPlaced ? '🟡 2nd' : '❌ LOSS';
    const wonBg   = outcome.topPickWon ? '#0a2a0a' : outcome.topPickPlaced ? '#2a2a0a' : '#2a0a0a';
    const src     = outcome.priceSource || '?';
    const srcCol  = src === 'BSP' ? '#69f0ae' : '#ffeb3b';
    const bspNote = outcome.bspSettled ? '' : `<span class="tfe-price-pending">⏳ BSP pending — using ISP</span>`;

    const dogRows = outcome.dogs.map(d => {
      const posCol   = d.actualPos === 1 ? '#00e676' : d.actualPos === 2 ? '#69f0ae' : d.actualPos <= 3 ? '#ffeb3b' : '#4a6a8a';
      const scoreCol = d.score >= 70 ? '#00e676' : d.score >= 50 ? '#ffeb3b' : '#4a6a8a';
      const isTop    = d.name === outcome.topPick;
      const priceStr = d.bsp ? `${d.bsp.toFixed(2)} <span style="color:#3a5a3a;font-size:8px">BSP</span>`
                     : d.isp ? `${d.isp.toFixed(2)} <span style="color:#5a5a3a;font-size:8px">ISP</span>` : '–';
      return `<tr style="${isTop ? 'background:#0a1a0a' : ''}">
        <td style="color:#4a6a8a;padding:3px 6px;font-size:10px">${d.trap || '–'}</td>
        <td style="color:${isTop ? '#c0d8ff' : '#8a9aaa'};padding:3px 6px;font-size:10px;font-weight:${isTop ? '700' : '400'}">${d.name}${isTop ? ' ⭐' : ''}</td>
        <td style="color:${scoreCol};padding:3px 6px;font-size:10px;text-align:center;font-weight:700">${d.score}</td>
        <td style="color:${posCol};padding:3px 6px;font-size:10px;text-align:center;font-weight:700">${d.actualPos || '–'}</td>
        <td style="padding:3px 6px;font-size:10px;text-align:right;color:#8a9aaa">${priceStr}</td>
        ${d.forecast ? `<td style="color:#4a7aaa;padding:3px 6px;font-size:9px;text-align:right">${d.forecast.oddsStr}</td>` : '<td></td>'}
      </tr>`;
    }).join('');

    const refreshLabel = wasRefreshed ? ' <span style="color:#69f0ae;font-size:9px">✓ Updated</span>' : '';

    const panel = document.createElement('div');
    panel.id = 'tfe-result-panel';
    panel.innerHTML = `
      <div class="tfe-rp-header">
        <span class="tfe-rp-title">🐕 TF Tracker${refreshLabel}</span>
        <span class="tfe-rp-race">${outcome.race}</span>
        <button id="tfe-rp-refresh" title="Re-parse prices from page" style="background:#0a1a2a;border:1px solid #1a3a5a;color:#4a7aaa;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:11px;flex-shrink:0">↺</button>
        <button class="tfe-rp-close" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
      ${bspNote ? `<div style="padding:4px 12px;background:#1a1a0a;font-size:10px">${bspNote}</div>` : ''}
      <div class="tfe-rp-result" style="background:${wonBg}">
        <span class="tfe-rp-result-text">${wonText}</span>
        <span class="tfe-rp-pick">Top Pick: <b>${outcome.topPick}</b> (${outcome.topScore}/100) → <b>${outcome.topPickPos}</b></span>
        <span class="tfe-rp-pnl" style="color:${pnlCol}">${outcome.pnl >= 0 ? '+' : ''}£${Math.abs(outcome.pnl).toFixed(2)} <span style="color:${srcCol};font-size:9px">${src}</span></span>
      </div>
      <div class="tfe-rp-body">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th class="tfe-rp-th">Trap</th><th class="tfe-rp-th">Dog</th>
            <th class="tfe-rp-th" style="text-align:center">Score</th>
            <th class="tfe-rp-th" style="text-align:center">Pos</th>
            <th class="tfe-rp-th" style="text-align:right">Price</th>
            <th class="tfe-rp-th" style="text-align:right">FC Odds</th>
          </tr></thead>
          <tbody>${dogRows}</tbody>
        </table>
        ${outcome.fcCorrect ? '<div class="tfe-rp-fc-win">🎯 Forecast correct! (1-2 in order)</div>' : ''}
      </div>`;

    document.body.appendChild(panel);

    // Manual refresh button
    panel.querySelector('#tfe-rp-refresh')?.addEventListener('click', () => {
      const btn = panel.querySelector('#tfe-rp-refresh');
      btn.textContent = '…';
      btn.disabled = true;

      const raceId = getRaceId();
      chrome.storage.local.get([`race:${raceId}`, `outcome:${raceId}`], items => {
        const rec = items[`race:${raceId}`] || raceRecord;
        const existing = items[`outcome:${raceId}`] || outcome;
        refreshOutcome(rec, existing, (updated, changed) => {
          buildResultPanel(rec, updated, changed);
          const b = document.getElementById('tfe-result-panel')?.querySelector('#tfe-rp-refresh');
          if (b) {
            b.textContent = changed ? '✓ Updated' : '✓ No change';
            b.disabled = false;
            setTimeout(() => { if (b) b.textContent = '↺'; }, 2000);
          }
        });
      });
    });
  }

  // ── Full scoring pipeline for scraper-imported races ────────
  // Identical logic to content.js — uses same data tables and weights.
  // This runs when the morning scraper provides racecard data so the
  // tracker shows complete scores/margins/EV without visiting pages.

  // Data tables (copied from content.js at build time)
  const _PAR_TIMES         = {
  "CentralPark": {"A3": 29.78, "A4": 29.92, "A5": 30.01, "D3": 16.9, "D4": 16.98, "D5": 17.09},
  "Doncaster": {"A2": 29.98, "B1": 27.85, "B2": 28.04, "B3": 28.19, "B4": 28.28, "B5": 28.46, "B6": 28.62, "B7": 28.89, "D2": 17.21, "D3": 17.36, "D4": 17.58},
  "DunstallPark": {"A5": 29.06, "A6": 29.2, "A7": 29.36, "D3": 16.34, "D4": 16.6},
  "Harlow": {"A4": 26.91, "A5": 26.94, "A6": 27.13, "A7": 27.39, "D2": 15.3, "D3": 15.47, "D4": 15.62, "D5": 15.92, "IT": 27.28},
  "Hove": {"D4": 17.03},
  "Kinsley": {"A4": 28.39, "A5": 28.57, "A6": 28.77, "A7": 28.94, "A8": 29.22, "D3": 16.57, "D4": 16.69, "D5": 16.94},
  "Monmore": {"A10": 29.58, "A4": 28.93, "A5": 28.94, "A6": 29.07, "A7": 29.16, "A8": 29.28, "A9": 29.49, "D4": 15.98},
  "Nottingham": {"A1": 30.09, "A2": 30.34, "A3": 30.55, "A4": 30.86, "A5": 31.04, "A6": 31.19},
  "Oxford": {"A2": 27.08, "A3": 27.3, "A4": 27.34, "A5": 27.4, "D3": 15.52},
  "PerryBarr": {"A3": 28.82, "A4": 28.98, "A5": 29.19, "A6": 29.26, "A7": 29.44, "A8": 29.67, "D3": 16.6},
  "Romford": {"A10": 24.68, "A11": 25.0, "A12": 25.02, "A4": 24.39, "A5": 24.38, "A6": 24.46, "A7": 24.58, "A8": 24.56, "A9": 24.67},
  "Sunderland": {"A2": 27.65, "A3": 27.75, "A4": 27.91, "A5": 28.02, "A6": 28.09, "D4": 16.29},
  "Swindon": {"D4": 15.88},
  "Towcester": {"D3": 16.35, "D4": 16.49},
  "Yarmouth": {"A1": 27.8, "A2": 28.11, "A3": 28.24, "A4": 28.33, "A5": 28.42, "A6": 28.57, "A7": 28.7, "A8": 28.81},
};

  const _TRAP_BIAS = {
    "CentralPark": {1: 16.0, 2: 14.47, 3: 14.88, 4: 12.69, 5: 15.56, 6: 18.28},
    "Crayford": {1: 21.74, 2: 16.0, 3: 22.73, 4: 17.39, 5: 17.14, 6: 23.81},
    "Doncaster": {1: 23.61, 2: 16.48, 3: 19.08, 4: 19.75, 5: 18.6, 6: 20.68},
    "DunstallPark": {1: 17.28, 2: 18.93, 3: 17.47, 4: 16.92, 5: 18.04, 6: 19.25},
    "Harlow": {1: 17.6, 2: 17.49, 3: 18.14, 4: 18.47, 5: 16.92, 6: 21.68},
    "Hove": {2: 19.05, 3: 22.58, 4: 19.23, 5: 15.22, 6: 7.69},
    "Kinsley": {1: 17.15, 2: 15.79, 3: 19.22, 4: 16.27, 5: 13.81, 6: 18.39},
    "Monmore": {1: 21.51, 2: 17.63, 3: 14.63, 4: 13.79, 5: 15.11, 6: 18.28},
    "Newcastle": {1: 23.08, 2: 22.22, 5: 18.6},
    "Nottingham": {1: 19.63, 2: 19.14, 3: 23.12, 4: 18.58, 5: 20.68, 6: 20.29},
    "Oxford": {1: 19.26, 2: 21.62, 3: 17.15, 4: 20.0, 5: 23.02, 6: 21.67},
    "PelawGrange": {1: 18.18, 2: 18.52, 4: 9.52, 5: 12.5, 6: 18.75},
    "PerryBarr": {1: 26.37, 2: 18.44, 3: 23.42, 4: 15.08, 5: 17.22, 6: 14.89},
    "Romford": {1: 14.08, 2: 18.55, 3: 14.74, 4: 14.05, 5: 18.3, 6: 13.92},
    "Sheffield": {1: 20.69, 2: 9.88, 3: 18.18, 4: 18.92, 5: 13.56, 6: 12.86},
    "SuffolkDowns": {1: 19.72, 2: 18.68, 3: 19.23, 4: 21.5, 5: 24.0, 6: 14.29},
    "Sunderland": {1: 21.03, 2: 13.68, 3: 17.16, 4: 18.16, 5: 14.11, 6: 16.67},
    "Swindon": {1: 8.33, 2: 22.11, 3: 17.78, 4: 22.38, 5: 20.63, 6: 10.0},
    "TheValley": {3: 23.08, 4: 17.39, 5: 18.18, 6: 25.0},
    "Towcester": {1: 13.92, 2: 11.34, 3: 20.41, 4: 19.4, 5: 7.89, 6: 22.06},
    "Yarmouth": {1: 16.04, 2: 15.29, 3: 20.53, 4: 17.14, 5: 18.88, 6: 17.37},
  };

  const _CHESTER_RATINGS  = {
  "CentralPark": {"A1": 79.8, "A2": 65.5, "A3": 60.5, "A4": 54.5, "A5": 47.4, "A6": 28.9, "D1": 50.4, "D2": 37.1, "D3": 20.0, "D4": 17.4, "D5": 11.1, "OR": 74.1},
  "Crayford": {"OR": 84.5},
  "Doncaster": {"A1": 84.7, "A2": 70.9, "A3": 59.4, "A4": 51.9, "B1": 82.4, "B2": 69.4, "B3": 61.9, "B4": 54.6, "B5": 42.6, "B6": 39.5, "B7": 29.8, "D1": 66.4, "D2": 61.2, "D3": 50.4, "D4": 32.5, "D5": 24.3, "OR": 78.2},
  "DunstallPark": {"A2": 69.5, "A3": 71.4, "A4": 60.6, "A5": 53.8, "A6": 52.3, "A7": 40.5, "A8": 29.8, "D2": 51.5, "D3": 50.6, "D4": 28.4},
  "Harlow": {"A2": 62.4, "A3": 58.4, "A4": 51.3, "A5": 51.3, "A6": 40.3, "A7": 26.5, "D1": 49.1, "D2": 49.2, "D3": 42.0, "D4": 27.1, "D5": 8.3},
  "Hove": {"A10": 30.4, "A11": 28.1, "A3": 61.1, "A4": 64.0, "A6": 53.0, "A7": 43.9, "A8": 45.8, "A9": 40.1, "D3": 37.8, "D4": 31.2},
  "Kinsley": {"A2": 60.6, "A3": 61.1, "A4": 55.4, "A5": 47.6, "A6": 39.0, "A7": 32.0, "A8": 19.4, "D2": 56.0, "D3": 44.9, "D4": 36.8, "D5": 15.2},
  "Monmore": {"A10": 30.7, "A2": 79.3, "A3": 75.3, "A4": 70.3, "A5": 67.3, "A6": 62.0, "A7": 57.5, "A8": 51.0, "A9": 39.7, "D1": 72.9, "D2": 62.4, "D3": 44.2, "D4": 27.9, "OR": 84.3, "OR3": 81.2, "S2": 76.0, "S3": 70.9, "S4": 57.3},
  "Newcastle": {"A4": 63.6, "A7": 42.4, "A8": 26.6},
  "Nottingham": {"A1": 71.9, "A2": 65.9, "A3": 58.1, "A4": 50.9, "A5": 43.1, "A6": 40.7, "A7": 20.9, "IT": 34.3, "OR": 70.8, "OR3": 65.1},
  "Oxford": {"A1": 77.4, "A2": 69.3, "A3": 61.8, "A4": 57.6, "A5": 49.0, "A6": 44.0, "A7": 30.4, "A8": 28.8, "A9": 18.2, "D1": 72.3, "D2": 55.6, "D3": 43.5, "D4": 23.9, "IT": 44.0, "OR": 86.3, "OR2": 73.1},
  "PelawGrange": {"A8": 11.6, "D2": 65.8, "D4": 23.5, "OR": 69.4},
  "PerryBarr": {"A1": 80.3, "A2": 73.6, "A3": 70.8, "A4": 65.9, "A5": 54.8, "A6": 47.8, "A7": 38.9, "A8": 28.5, "D2": 64.5, "D3": 48.9, "D4": 25.4},
  "Romford": {"A1": 73.2, "A10": 38.6, "A11": 28.4, "A12": 26.2, "A2": 74.2, "A3": 66.9, "A4": 67.4, "A5": 64.0, "A6": 59.8, "A7": 51.7, "A8": 48.9, "A9": 49.7, "OR": 76.5, "OR3": 69.1, "S6": 47.0},
  "Sheffield": {"A2": 79.5, "A4": 56.4, "A5": 53.5, "A6": 41.7, "A7": 25.8, "D3": 54.4},
  "SuffolkDowns": {"A3": 56.2, "A4": 59.7, "A5": 46.3, "A6": 38.4, "A7": 34.4, "A8": 27.6, "D3": 27.5, "D4": 12.4, "OR": 72.6, "S3": 70.1, "S4": 55.8},
  "Sunderland": {"A1": 59.7, "A2": 60.8, "A3": 54.4, "A4": 45.9, "A5": 40.7, "A6": 34.6, "A7": 23.9, "A8": 16.5, "A9": 11.8, "D2": 63.4, "D3": 52.4, "D4": 40.1, "D5": 32.1, "OR3": 67.3},
  "Swindon": {"A2": 79.3, "A3": 72.8, "A4": 65.8, "A5": 55.4, "A6": 45.9, "A7": 39.6, "A8": 32.8, "A9": 25.0, "D3": 52.1, "D4": 36.7, "OR": 78.7},
  "TheValley": {"A2": 47.7, "A3": 59.9, "A4": 41.5, "OR": 42.2},
  "Towcester": {"A3": 73.4, "A4": 61.4, "A5": 54.2, "A6": 43.4, "A7": 35.6, "D1": 61.8, "D2": 59.9, "D3": 43.8, "D4": 28.0, "IV": 51.7, "OR": 76.5},
  "Yarmouth": {"A1": 85.1, "A2": 74.5, "A3": 66.0, "A4": 62.7, "A5": 59.8, "A6": 51.2, "A7": 45.4, "A8": 37.7, "A9": 16.6, "D2": 46.7, "OR": 87.7, "S1": 89.3, "S2": 79.0},
};
  const _TRAINER_DATA     = {
  "A Ali|Oxford": {
    "w": 13.3,
    "p": -6.5,
    "r": 15
  },
  "A B Gifkins|Crayford": {
    "w": 24.1,
    "p": -2.8,
    "r": 29
  },
  "A C Wilson|Yarmouth": {
    "w": 20.7,
    "p": -98.53,
    "r": 777
  },
  "A Cobb|Harlow": {
    "w": 19.7,
    "p": -8.75,
    "r": 81
  },
  "A Cobb|Oxford": {
    "w": 15.4,
    "p": -18.9,
    "r": 52
  },
  "A D Scott|Crayford": {
    "w": 4.1,
    "p": -42.0,
    "r": 49
  },
  "A D Scott|Harlow": {
    "w": 26.7,
    "p": -3.09,
    "r": 15
  },
  "A D Scott|Towcester": {
    "w": 16.9,
    "p": -57.71,
    "r": 254
  },
  "A E Gardiner|Hove": {
    "w": 16.9,
    "p": -277.92,
    "r": 1169
  },
  "A G Rawlings|Swindon": {
    "w": 16.6,
    "p": -862.54,
    "r": 2842
  },
  "A G Rawlings|TheValley": {
    "w": 21.1,
    "p": -61.54,
    "r": 280
  },
  "A Greenwell|PelawGrange": {
    "w": 13.2,
    "p": -4.0,
    "r": 38
  },
  "A Harrison|Newcastle": {
    "w": 17.8,
    "p": -2538.43,
    "r": 9051
  },
  "A Herbert|CentralPark": {
    "w": 25.3,
    "p": -20.14,
    "r": 213
  },
  "A Herbert|Hove": {
    "w": 21.5,
    "p": -143.47,
    "r": 465
  },
  "A Ioannou|Henlow": {
    "w": 16.8,
    "p": -148.21,
    "r": 744
  },
  "A Ioannou|Towcester": {
    "w": 16.9,
    "p": -427.01,
    "r": 1648
  },
  "A J Dunn|Monmore": {
    "w": 18.3,
    "p": -445.46,
    "r": 1776
  },
  "A J Steele|PerryBarr": {
    "w": 12.1,
    "p": -85.96,
    "r": 198
  },
  "A J Taylor|Hove": {
    "w": 15.7,
    "p": -1415.63,
    "r": 6560
  },
  "A J West|Monmore": {
    "w": 18.8,
    "p": -68.99,
    "r": 154
  },
  "A K Jenkins|Monmore": {
    "w": 16.7,
    "p": -915.9,
    "r": 3761
  },
  "A Kelly-pilgrim|Crayford": {
    "w": 17.0,
    "p": -958.23,
    "r": 3580
  },
  "A Kelly-pilgrim|Romford": {
    "w": 14.3,
    "p": -609.87,
    "r": 1690
  },
  "A L Jeffery|TheValley": {
    "w": 17.5,
    "p": -591.09,
    "r": 1746
  },
  "A L Steels|Doncaster": {
    "w": 21.1,
    "p": -34.29,
    "r": 133
  },
  "A L Steels|Henlow": {
    "w": 18.3,
    "p": -13.54,
    "r": 93
  },
  "A L Steels|SuffolkDowns": {
    "w": 17.3,
    "p": -36.07,
    "r": 75
  },
  "A L Steels|Towcester": {
    "w": 15.4,
    "p": -248.94,
    "r": 563
  },
  "A M Kemp|PerryBarr": {
    "w": 10.3,
    "p": -43.88,
    "r": 68
  },
  "A M Kibble|Oxford": {
    "w": 22.7,
    "p": -73.7,
    "r": 198
  },
  "A M Kibble|Swindon": {
    "w": 21.5,
    "p": -813.6,
    "r": 4049
  },
  "A M Kibble|Towcester": {
    "w": 23.3,
    "p": -8.79,
    "r": 30
  },
  "A M Kirby|Harlow": {
    "w": 8.0,
    "p": -34.13,
    "r": 50
  },
  "A M Kirby|SuffolkDowns": {
    "w": 18.0,
    "p": -385.6,
    "r": 2015
  },
  "A M Kirby|Towcester": {
    "w": 16.0,
    "p": -207.28,
    "r": 777
  },
  "A M P Collett|CentralPark": {
    "w": 20.2,
    "p": -935.99,
    "r": 4252
  },
  "A M Talbot|Kinsley": {
    "w": 16.1,
    "p": -28.5,
    "r": 87
  },
  "A N J Morgan|TheValley": {
    "w": 15.3,
    "p": -2319.64,
    "r": 5960
  },
  "A Newitt|Towcester": {
    "w": 16.7,
    "p": -29.95,
    "r": 96
  },
  "A O Hopkins|Nottingham": {
    "w": 20.1,
    "p": -97.04,
    "r": 735
  },
  "A R Keppie|Hove": {
    "w": 16.7,
    "p": -130.48,
    "r": 556
  },
  "A R Timbrell|Nottingham": {
    "w": 16.5,
    "p": -496.65,
    "r": 1764
  },
  "A R Upton|PerryBarr": {
    "w": 16.1,
    "p": -261.83,
    "r": 843
  },
  "A R Upton|Sheffield": {
    "w": 17.3,
    "p": -197.99,
    "r": 567
  },
  "A S Mcpherson|Nottingham": {
    "w": 13.4,
    "p": -1326.12,
    "r": 4866
  },
  "A Stone|Nottingham": {
    "w": 16.1,
    "p": -361.59,
    "r": 1239
  },
  "A W Cartwright|Harlow": {
    "w": 32.5,
    "p": 24.38,
    "r": 40
  },
  "A W Cartwright|Henlow": {
    "w": 15.0,
    "p": -20.34,
    "r": 40
  },
  "A W Sear|Towcester": {
    "w": 17.1,
    "p": -26.8,
    "r": 70
  },
  "A Welch|Oxford": {
    "w": 16.9,
    "p": -701.08,
    "r": 1977
  },
  "A Welch|Towcester": {
    "w": 13.8,
    "p": -145.6,
    "r": 385
  },
  "B A Wray|Kinsley": {
    "w": 14.5,
    "p": -83.61,
    "r": 318
  },
  "B Carruthers|PelawGrange": {
    "w": 22.4,
    "p": -4.71,
    "r": 85
  },
  "B D Osullivan|CentralPark": {
    "w": 17.8,
    "p": -2196.86,
    "r": 8796
  },
  "B D Osullivan|Crayford": {
    "w": 20.1,
    "p": -414.34,
    "r": 1946
  },
  "B Denby|Nottingham": {
    "w": 19.5,
    "p": -752.12,
    "r": 3961
  },
  "B Doyle|Romford": {
    "w": 16.4,
    "p": -1470.29,
    "r": 5490
  },
  "B Draper|Sheffield": {
    "w": 24.7,
    "p": -815.19,
    "r": 4394
  },
  "B Fairbairn|Newcastle": {
    "w": 18.3,
    "p": -134.91,
    "r": 617
  },
  "B Fairbairn|PelawGrange": {
    "w": 7.7,
    "p": -8.0,
    "r": 13
  },
  "B G Backhurst|CentralPark": {
    "w": 18.4,
    "p": -7.3,
    "r": 49
  },
  "B G Backhurst|Oxford": {
    "w": 19.6,
    "p": -362.92,
    "r": 1404
  },
  "B H L Jack|Crayford": {
    "w": 21.8,
    "p": -67.8,
    "r": 312
  },
  "B Heaton|Kinsley": {
    "w": 16.9,
    "p": -1901.6,
    "r": 7449
  },
  "B J Mcphillips|Kinsley": {
    "w": 22.2,
    "p": -11.87,
    "r": 72
  },
  "B J Mcphillips|Newcastle": {
    "w": 24.4,
    "p": 3.75,
    "r": 41
  },
  "B J Mcphillips|PelawGrange": {
    "w": 19.6,
    "p": -42.19,
    "r": 219
  },
  "B L King|Oxford": {
    "w": 15.4,
    "p": -41.18,
    "r": 91
  },
  "B Lomax|Kinsley": {
    "w": 17.4,
    "p": -5.12,
    "r": 23
  },
  "B M Nicholls|Harlow": {
    "w": 13.6,
    "p": -364.39,
    "r": 1255
  },
  "B P Cooper|Harlow": {
    "w": 19.6,
    "p": -22.92,
    "r": 56
  },
  "B P Johnson|Oxford": {
    "w": 17.9,
    "p": -5.75,
    "r": 39
  },
  "B P Johnson|Swindon": {
    "w": 19.8,
    "p": -66.66,
    "r": 333
  },
  "B Reynolds|PerryBarr": {
    "w": 19.3,
    "p": -84.02,
    "r": 486
  },
  "B S Green|Hove": {
    "w": 18.7,
    "p": -1333.09,
    "r": 6202
  },
  "B Stowe|Henlow": {
    "w": 28.3,
    "p": 1.58,
    "r": 53
  },
  "B Stowe|Towcester": {
    "w": 19.5,
    "p": -27.32,
    "r": 118
  },
  "B Turner|Towcester": {
    "w": 0.0,
    "p": -10.0,
    "r": 10
  },
  "B W Ashpole|Henlow": {
    "w": 18.2,
    "p": -20.78,
    "r": 44
  },
  "B W Stuart|Newcastle": {
    "w": 17.9,
    "p": -112.52,
    "r": 319
  },
  "C A Gilbert|DunstallPark": {
    "w": 20.0,
    "p": 0.75,
    "r": 100
  },
  "C A Gilbert|PerryBarr": {
    "w": 18.6,
    "p": -113.95,
    "r": 581
  },
  "C A Grasso|Henlow": {
    "w": 21.1,
    "p": -16.78,
    "r": 38
  },
  "C A Grasso|Towcester": {
    "w": 18.4,
    "p": -177.18,
    "r": 637
  },
  "C A Hendy|PerryBarr": {
    "w": 25.8,
    "p": -13.19,
    "r": 62
  },
  "C A Williams|Doncaster": {
    "w": 16.6,
    "p": -178.1,
    "r": 680
  },
  "C A Williams|Oxford": {
    "w": 19.9,
    "p": -46.45,
    "r": 166
  },
  "C A Williams|PerryBarr": {
    "w": 15.0,
    "p": -192.69,
    "r": 588
  },
  "C A Williams|Swindon": {
    "w": 17.5,
    "p": -115.84,
    "r": 456
  },
  "C Condon|Towcester": {
    "w": 31.4,
    "p": -27.01,
    "r": 248
  },
  "C D Hamblin|Oxford": {
    "w": 21.9,
    "p": -513.4,
    "r": 2419
  },
  "C D Hamblin|Towcester": {
    "w": 21.1,
    "p": -27.18,
    "r": 109
  },
  "C D Marston|Monmore": {
    "w": 15.8,
    "p": -2133.62,
    "r": 7900
  },
  "C Darch|TheValley": {
    "w": 17.4,
    "p": -880.6,
    "r": 2735
  },
  "C F Allen|Harlow": {
    "w": 15.2,
    "p": -267.75,
    "r": 817
  },
  "C G Finch|Yarmouth": {
    "w": 17.8,
    "p": -75.78,
    "r": 236
  },
  "C Gardiner|Hove": {
    "w": 19.1,
    "p": -892.42,
    "r": 4660
  },
  "C H Raymond|PelawGrange": {
    "w": 16.5,
    "p": -6.14,
    "r": 103
  },
  "C Handford|Sheffield": {
    "w": 17.5,
    "p": -179.88,
    "r": 445
  },
  "C Harker|PelawGrange": {
    "w": 18.0,
    "p": -34.01,
    "r": 100
  },
  "C J Joyce|Towcester": {
    "w": 20.6,
    "p": -61.91,
    "r": 272
  },
  "C J Lister|Doncaster": {
    "w": 16.9,
    "p": -135.62,
    "r": 443
  },
  "C J Lister|Newcastle": {
    "w": 15.8,
    "p": -130.05,
    "r": 349
  },
  "C J Murray|PelawGrange": {
    "w": 16.5,
    "p": -65.33,
    "r": 170
  },
  "C Jackson|Newcastle": {
    "w": 19.3,
    "p": -132.84,
    "r": 615
  },
  "C Jackson|Sunderland": {
    "w": 22.6,
    "p": -46.91,
    "r": 177
  },
  "C Jones|Monmore": {
    "w": 15.2,
    "p": -1566.1,
    "r": 4980
  },
  "C King|Towcester": {
    "w": 20.6,
    "p": 9.79,
    "r": 63
  },
  "C L Conley|Oxford": {
    "w": 21.6,
    "p": -33.31,
    "r": 88
  },
  "C L Conley|Swindon": {
    "w": 31.8,
    "p": -3.27,
    "r": 66
  },
  "C L Hardy|Newcastle": {
    "w": 19.7,
    "p": -163.81,
    "r": 973
  },
  "C L S Snare|Yarmouth": {
    "w": 15.9,
    "p": -80.95,
    "r": 464
  },
  "C M Campbell|PelawGrange": {
    "w": 14.5,
    "p": -52.68,
    "r": 152
  },
  "C M Dibb|Harlow": {
    "w": 16.5,
    "p": -1155.36,
    "r": 4348
  },
  "C M Dibb|PelawGrange": {
    "w": 12.2,
    "p": -142.04,
    "r": 327
  },
  "C Mcnicholas|Sunderland": {
    "w": 16.0,
    "p": -2258.43,
    "r": 8473
  },
  "C N Wilton|Nottingham": {
    "w": 16.6,
    "p": -1189.35,
    "r": 3771
  },
  "C R Morris|Yarmouth": {
    "w": 22.0,
    "p": -628.93,
    "r": 2501
  },
  "C S Fereday|Monmore": {
    "w": 17.8,
    "p": -1830.79,
    "r": 8012
  },
  "C Smith|PerryBarr": {
    "w": 18.5,
    "p": -320.62,
    "r": 1306
  },
  "C W Brown|Kinsley": {
    "w": 19.0,
    "p": -54.87,
    "r": 416
  },
  "C W Brown|Sheffield": {
    "w": 27.3,
    "p": -4.33,
    "r": 44
  },
  "C W Mortimer|TheValley": {
    "w": 21.7,
    "p": -4.75,
    "r": 23
  },
  "C Watson|PelawGrange": {
    "w": 27.1,
    "p": -31.81,
    "r": 225
  },
  "C Weatherall|Monmore": {
    "w": 22.8,
    "p": -28.43,
    "r": 267
  },
  "C Weatherall|Towcester": {
    "w": 27.8,
    "p": -27.03,
    "r": 187
  },
  "C Wilson|Harlow": {
    "w": 18.6,
    "p": -155.81,
    "r": 1191
  },
  "C Wilson|Henlow": {
    "w": 18.2,
    "p": -0.5,
    "r": 22
  },
  "D A Curry|PelawGrange": {
    "w": 18.0,
    "p": -113.81,
    "r": 490
  },
  "D A Dark|Hove": {
    "w": 19.3,
    "p": -131.91,
    "r": 813
  },
  "D A Hunt|Oxford": {
    "w": 16.3,
    "p": -22.09,
    "r": 43
  },
  "D A Hunt|Swindon": {
    "w": 17.7,
    "p": -82.73,
    "r": 541
  },
  "D A Hunt|TheValley": {
    "w": 0.0,
    "p": -19.0,
    "r": 19
  },
  "D Acott|PerryBarr": {
    "w": 22.2,
    "p": -28.79,
    "r": 176
  },
  "D Alcorn|Newcastle": {
    "w": 16.2,
    "p": -314.92,
    "r": 1842
  },
  "D Alcorn|PelawGrange": {
    "w": 20.5,
    "p": -25.26,
    "r": 73
  },
  "D B Butler|PerryBarr": {
    "w": 29.4,
    "p": 1.75,
    "r": 17
  },
  "D B Whitton|Crayford": {
    "w": 20.3,
    "p": -835.5,
    "r": 3953
  },
  "D B Whitton|Harlow": {
    "w": 25.2,
    "p": -218.48,
    "r": 1201
  },
  "D B Whitton|Romford": {
    "w": 20.0,
    "p": -78.04,
    "r": 285
  },
  "D B Whitton|Yarmouth": {
    "w": 23.5,
    "p": -3.61,
    "r": 149
  },
  "D Beattie|Doncaster": {
    "w": 10.5,
    "p": -10.0,
    "r": 19
  },
  "D Bell|PelawGrange": {
    "w": 18.3,
    "p": -45.63,
    "r": 153
  },
  "D Blackbird|Kinsley": {
    "w": 11.1,
    "p": -3.5,
    "r": 18
  },
  "D Blackbird|Newcastle": {
    "w": 15.7,
    "p": -545.88,
    "r": 1816
  },
  "D Blackbird|Nottingham": {
    "w": 14.8,
    "p": -362.12,
    "r": 1236
  },
  "D Blackbird|Sunderland": {
    "w": 17.0,
    "p": -1665.63,
    "r": 7235
  },
  "D Bowe|PelawGrange": {
    "w": 19.4,
    "p": -8.9,
    "r": 72
  },
  "D Brock|Harlow": {
    "w": 16.3,
    "p": -236.79,
    "r": 920
  },
  "D Brock|Henlow": {
    "w": 4.9,
    "p": -43.75,
    "r": 61
  },
  "D Calvert|Doncaster": {
    "w": 17.3,
    "p": -2489.54,
    "r": 10273
  },
  "D Childs|Crayford": {
    "w": 16.1,
    "p": -789.8,
    "r": 2861
  },
  "D Childs|Romford": {
    "w": 15.1,
    "p": -429.72,
    "r": 1235
  },
  "D Cooper|Kinsley": {
    "w": 19.9,
    "p": -191.61,
    "r": 1070
  },
  "D D Knight|Hove": {
    "w": 20.8,
    "p": -793.06,
    "r": 4698
  },
  "D D Porter|Swindon": {
    "w": 16.8,
    "p": -1869.84,
    "r": 7648
  },
  "D D Porter|Towcester": {
    "w": 15.6,
    "p": -198.22,
    "r": 583
  },
  "D E Fradgley|Kinsley": {
    "w": 19.4,
    "p": -388.76,
    "r": 1904
  },
  "D F Carter|Harlow": {
    "w": 15.4,
    "p": -1180.14,
    "r": 4886
  },
  "D F Carter|Yarmouth": {
    "w": 14.6,
    "p": -250.73,
    "r": 759
  },
  "D Golightly|Doncaster": {
    "w": 23.7,
    "p": -37.38,
    "r": 215
  },
  "D Henry|Sheffield": {
    "w": 25.4,
    "p": -22.73,
    "r": 126
  },
  "D Henry|Towcester": {
    "w": 16.7,
    "p": -7.67,
    "r": 24
  },
  "D J Atkins|Henlow": {
    "w": 28.6,
    "p": -1.5,
    "r": 21
  },
  "D J Atkins|Towcester": {
    "w": 24.8,
    "p": -16.76,
    "r": 137
  },
  "D J Grainge|PelawGrange": {
    "w": 21.6,
    "p": -17.83,
    "r": 74
  },
  "D J Hammond|Kinsley": {
    "w": 15.3,
    "p": -292.53,
    "r": 1066
  },
  "D J Page|Monmore": {
    "w": 20.8,
    "p": -4.6,
    "r": 144
  },
  "D J Prentice|Yarmouth": {
    "w": 16.3,
    "p": -127.11,
    "r": 491
  },
  "D Jeans|Henlow": {
    "w": 6.9,
    "p": -38.0,
    "r": 58
  },
  "D Jeans|Oxford": {
    "w": 16.9,
    "p": -722.14,
    "r": 2794
  },
  "D Jeans|Towcester": {
    "w": 15.1,
    "p": -456.43,
    "r": 1779
  },
  "D K Hurlock|CentralPark": {
    "w": 15.4,
    "p": -369.69,
    "r": 1398
  },
  "D K Hurlock|Harlow": {
    "w": 18.9,
    "p": -3118.67,
    "r": 13793
  },
  "D K Hurlock|Romford": {
    "w": 18.1,
    "p": -218.96,
    "r": 900
  },
  "D L Cross|Doncaster": {
    "w": 16.4,
    "p": -322.26,
    "r": 1253
  },
  "D L Cross|Sheffield": {
    "w": 16.8,
    "p": -333.74,
    "r": 1083
  },
  "D L Fretwell|Sheffield": {
    "w": 16.3,
    "p": -812.12,
    "r": 2623
  },
  "D L T Allen|Harlow": {
    "w": 12.8,
    "p": -146.8,
    "r": 290
  },
  "D Little|Newcastle": {
    "w": 19.1,
    "p": -293.21,
    "r": 1128
  },
  "D Little|PelawGrange": {
    "w": 23.5,
    "p": 24.06,
    "r": 255
  },
  "D M Verner|Doncaster": {
    "w": 26.1,
    "p": -15.24,
    "r": 69
  },
  "D M Verner|Harlow": {
    "w": 20.7,
    "p": -54.83,
    "r": 237
  },
  "D Mullins|Romford": {
    "w": 19.3,
    "p": -1592.67,
    "r": 6780
  },
  "D N Lewis|Oxford": {
    "w": 20.8,
    "p": -214.7,
    "r": 1204
  },
  "D N Lewis|Swindon": {
    "w": 13.8,
    "p": -69.68,
    "r": 174
  },
  "D O Pearce|Oxford": {
    "w": 18.7,
    "p": -165.32,
    "r": 588
  },
  "D O Pearce|Swindon": {
    "w": 17.2,
    "p": -950.65,
    "r": 4363
  },
  "D P Brabon|CentralPark": {
    "w": 20.3,
    "p": -1126.45,
    "r": 4535
  },
  "D Puddy|CentralPark": {
    "w": 19.4,
    "p": -285.15,
    "r": 1368
  },
  "D R E Ellerker|Harlow": {
    "w": 20.5,
    "p": -226.16,
    "r": 886
  },
  "D R Jinks|Harlow": {
    "w": 17.2,
    "p": -1743.11,
    "r": 6355
  },
  "D S Davy|TheValley": {
    "w": 25.1,
    "p": -616.08,
    "r": 2694
  },
  "D T Gomersall|Sheffield": {
    "w": 13.1,
    "p": -560.11,
    "r": 1505
  },
  "D T Smith|DunstallPark": {
    "w": 20.5,
    "p": -132.3,
    "r": 444
  },
  "D T Smith|Nottingham": {
    "w": 16.9,
    "p": -14.67,
    "r": 71
  },
  "D T Smith|Swindon": {
    "w": 17.9,
    "p": -796.73,
    "r": 3155
  },
  "D T Yeates|Oxford": {
    "w": 20.9,
    "p": -74.62,
    "r": 354
  },
  "D W Lee|Crayford": {
    "w": 20.0,
    "p": -684.36,
    "r": 3273
  },
  "D W Lee|Romford": {
    "w": 18.5,
    "p": -226.33,
    "r": 936
  },
  "D W Wright|Kinsley": {
    "w": 17.8,
    "p": -178.78,
    "r": 996
  },
  "D Welding|DunstallPark": {
    "w": 17.8,
    "p": -44.5,
    "r": 146
  },
  "D Welding|PerryBarr": {
    "w": 18.9,
    "p": -144.93,
    "r": 815
  },
  "D Wilkinson|PelawGrange": {
    "w": 15.1,
    "p": -143.51,
    "r": 456
  },
  "D Winder|Newcastle": {
    "w": 19.3,
    "p": -251.08,
    "r": 952
  },
  "D Worton|PelawGrange": {
    "w": 18.6,
    "p": -12.5,
    "r": 43
  },
  "E A Lagan|Sunderland": {
    "w": 17.0,
    "p": -606.87,
    "r": 2234
  },
  "E D Gaunt|Henlow": {
    "w": 0.0,
    "p": -12.0,
    "r": 12
  },
  "E G Samuels|Yarmouth": {
    "w": 17.1,
    "p": -1909.16,
    "r": 7942
  },
  "E Gowler|Doncaster": {
    "w": 21.4,
    "p": -17.0,
    "r": 28
  },
  "E Gowler|Harlow": {
    "w": 18.9,
    "p": -15.75,
    "r": 74
  },
  "E Gowler|SuffolkDowns": {
    "w": 16.2,
    "p": -256.4,
    "r": 957
  },
  "E Gowler|Towcester": {
    "w": 17.2,
    "p": -44.61,
    "r": 342
  },
  "E J Blunt|DunstallPark": {
    "w": 16.7,
    "p": -70.25,
    "r": 216
  },
  "E J Blunt|PerryBarr": {
    "w": 16.3,
    "p": -264.85,
    "r": 916
  },
  "E J Cantillon|SuffolkDowns": {
    "w": 19.8,
    "p": -222.8,
    "r": 930
  },
  "E J Cantillon|Towcester": {
    "w": 18.6,
    "p": -173.94,
    "r": 565
  },
  "E L Field|Monmore": {
    "w": 15.7,
    "p": -345.82,
    "r": 1070
  },
  "E O Driver|Monmore": {
    "w": 17.0,
    "p": -82.39,
    "r": 411
  },
  "E O Driver|Nottingham": {
    "w": 20.4,
    "p": -169.3,
    "r": 1471
  },
  "E Saville|Nottingham": {
    "w": 17.3,
    "p": -622.33,
    "r": 2385
  },
  "E T Parker|Sheffield": {
    "w": 19.8,
    "p": -465.6,
    "r": 2197
  },
  "E Y Bell|Newcastle": {
    "w": 16.4,
    "p": -391.12,
    "r": 1466
  },
  "E Y Bell|Sunderland": {
    "w": 19.3,
    "p": -1586.12,
    "r": 7814
  },
  "F Bryce|Oxford": {
    "w": 35.7,
    "p": 2.37,
    "r": 28
  },
  "F Bryce|PerryBarr": {
    "w": 5.3,
    "p": -15.75,
    "r": 19
  },
  "F Bryce|Swindon": {
    "w": 26.1,
    "p": -14.26,
    "r": 245
  },
  "F C Ohare|PerryBarr": {
    "w": 15.7,
    "p": -41.38,
    "r": 83
  },
  "F J Gray|Henlow": {
    "w": 16.2,
    "p": -72.95,
    "r": 240
  },
  "F J Gray|Oxford": {
    "w": 20.0,
    "p": -38.25,
    "r": 140
  },
  "F J Gray|Towcester": {
    "w": 21.0,
    "p": -1218.95,
    "r": 6195
  },
  "F Kearney|PelawGrange": {
    "w": 17.6,
    "p": -89.4,
    "r": 307
  },
  "F Macklin|Harlow": {
    "w": 9.1,
    "p": -22.38,
    "r": 33
  },
  "F Macklin|Nottingham": {
    "w": 22.6,
    "p": -11.83,
    "r": 128
  },
  "F Macklin|SuffolkDowns": {
    "w": 36.4,
    "p": 4.72,
    "r": 33
  },
  "F Macklin|Yarmouth": {
    "w": 16.1,
    "p": -227.55,
    "r": 516
  },
  "G A Foot|PelawGrange": {
    "w": 19.9,
    "p": -183.28,
    "r": 664
  },
  "G A Griffiths|Monmore": {
    "w": 19.4,
    "p": -502.66,
    "r": 2752
  },
  "G A Payne|Henlow": {
    "w": 16.4,
    "p": -261.12,
    "r": 733
  },
  "G A Payne|Towcester": {
    "w": 20.8,
    "p": -86.04,
    "r": 602
  },
  "G A Rees|Sheffield": {
    "w": 21.3,
    "p": -218.29,
    "r": 1066
  },
  "G A Stark|Newcastle": {
    "w": 15.7,
    "p": -1029.56,
    "r": 3621
  },
  "G A Stark|Sunderland": {
    "w": 17.0,
    "p": -415.56,
    "r": 1462
  },
  "G Andreas|CentralPark": {
    "w": 16.8,
    "p": -361.78,
    "r": 1336
  },
  "G Andreas|Hove": {
    "w": 14.5,
    "p": -1350.43,
    "r": 4320
  },
  "G B Ballentine|DunstallPark": {
    "w": 15.5,
    "p": -81.09,
    "r": 207
  },
  "G B Ballentine|PerryBarr": {
    "w": 18.9,
    "p": -405.57,
    "r": 1865
  },
  "G Brain|Swindon": {
    "w": 16.7,
    "p": -33.21,
    "r": 84
  },
  "G C Wright|Oxford": {
    "w": 15.7,
    "p": -455.24,
    "r": 1507
  },
  "G C Wright|Swindon": {
    "w": 16.8,
    "p": -484.41,
    "r": 1807
  },
  "G C Wright|TheValley": {
    "w": 10.3,
    "p": -32.52,
    "r": 58
  },
  "G Conway|Doncaster": {
    "w": 8.5,
    "p": -51.71,
    "r": 82
  },
  "G Douglas|Kinsley": {
    "w": 7.1,
    "p": -10.5,
    "r": 14
  },
  "G E Evans|Romford": {
    "w": 19.8,
    "p": -1024.87,
    "r": 4797
  },
  "G E Hepden|Swindon": {
    "w": 16.3,
    "p": -454.0,
    "r": 1659
  },
  "G F Murphy|Henlow": {
    "w": 20.0,
    "p": -3.84,
    "r": 30
  },
  "G F Parker|Yarmouth": {
    "w": 18.2,
    "p": -9.5,
    "r": 33
  },
  "G Fearnley|PelawGrange": {
    "w": 9.1,
    "p": -3.0,
    "r": 11
  },
  "G Gillett|Swindon": {
    "w": 14.0,
    "p": -71.27,
    "r": 335
  },
  "G J Baker|Oxford": {
    "w": 17.2,
    "p": -29.01,
    "r": 58
  },
  "G J Beadle|Towcester": {
    "w": 25.5,
    "p": 4.81,
    "r": 90
  },
  "G J Beadle|Yarmouth": {
    "w": 18.1,
    "p": -580.24,
    "r": 1977
  },
  "G J R Hamilton|PelawGrange": {
    "w": 28.6,
    "p": -0.92,
    "r": 21
  },
  "G J Smith|Kinsley": {
    "w": 16.7,
    "p": -0.67,
    "r": 12
  },
  "G K Hockings|Yarmouth": {
    "w": 11.1,
    "p": -19.01,
    "r": 27
  },
  "G Kovac|Towcester": {
    "w": 19.2,
    "p": -65.11,
    "r": 271
  },
  "G L Davidson|CentralPark": {
    "w": 16.1,
    "p": -975.8,
    "r": 3872
  },
  "G L Davidson|Crayford": {
    "w": 17.8,
    "p": -238.51,
    "r": 1154
  },
  "G L Davidson|Hove": {
    "w": 16.8,
    "p": -173.64,
    "r": 853
  },
  "G L Thomas|PerryBarr": {
    "w": 13.8,
    "p": -37.92,
    "r": 109
  },
  "G M Smith|Monmore": {
    "w": 16.4,
    "p": -284.36,
    "r": 1289
  },
  "G Page|Yarmouth": {
    "w": 19.2,
    "p": -38.63,
    "r": 177
  },
  "G Ralton|PelawGrange": {
    "w": 12.7,
    "p": -26.6,
    "r": 79
  },
  "G Rankin|Monmore": {
    "w": 21.9,
    "p": -94.85,
    "r": 626
  },
  "G S Byford|Hove": {
    "w": 18.4,
    "p": -381.07,
    "r": 1733
  },
  "G S Hamilton|Yarmouth": {
    "w": 13.8,
    "p": -24.69,
    "r": 305
  },
  "G Strike|Kinsley": {
    "w": 17.6,
    "p": -4.25,
    "r": 17
  },
  "G Strike|Sunderland": {
    "w": 17.4,
    "p": -1712.11,
    "r": 6625
  },
  "G Vincent|Doncaster": {
    "w": 19.1,
    "p": -130.27,
    "r": 528
  },
  "G Vincent|Swindon": {
    "w": 17.2,
    "p": -58.81,
    "r": 169
  },
  "G Walker|Doncaster": {
    "w": 16.5,
    "p": -64.13,
    "r": 200
  },
  "G Walker|PelawGrange": {
    "w": 18.6,
    "p": -152.04,
    "r": 517
  },
  "H Burton|Newcastle": {
    "w": 17.9,
    "p": -437.61,
    "r": 1736
  },
  "H Burton|PelawGrange": {
    "w": 11.6,
    "p": -208.99,
    "r": 388
  },
  "H Grimshaw|Sheffield": {
    "w": 15.7,
    "p": -201.21,
    "r": 967
  },
  "H H Williams|DunstallPark": {
    "w": 12.1,
    "p": -20.03,
    "r": 33
  },
  "H H Williams|PerryBarr": {
    "w": 16.3,
    "p": -86.0,
    "r": 233
  },
  "H J Dimmock|Towcester": {
    "w": 20.5,
    "p": -482.97,
    "r": 2556
  },
  "H Young|PelawGrange": {
    "w": 44.1,
    "p": 36.61,
    "r": 68
  },
  "I D Langford|Monmore": {
    "w": 15.7,
    "p": -444.9,
    "r": 1359
  },
  "I D Langford|Oxford": {
    "w": 13.9,
    "p": -176.23,
    "r": 454
  },
  "I D Langford|Towcester": {
    "w": 17.7,
    "p": -95.6,
    "r": 311
  },
  "I E Walker|DunstallPark": {
    "w": 13.9,
    "p": -237.62,
    "r": 667
  },
  "I E Walker|Nottingham": {
    "w": 11.1,
    "p": -6.25,
    "r": 18
  },
  "I E Walker|PerryBarr": {
    "w": 15.6,
    "p": -764.22,
    "r": 3780
  },
  "I Hopper|PelawGrange": {
    "w": 18.8,
    "p": -74.21,
    "r": 202
  },
  "I J Barnard|Yarmouth": {
    "w": 16.6,
    "p": -1259.46,
    "r": 5310
  },
  "I Mawson|PelawGrange": {
    "w": 8.7,
    "p": -34.84,
    "r": 46
  },
  "I Page|PelawGrange": {
    "w": 9.1,
    "p": -25.38,
    "r": 55
  },
  "I Zivkovic|Kinsley": {
    "w": 17.0,
    "p": -1521.07,
    "r": 6439
  },
  "J A Danahar|Swindon": {
    "w": 14.9,
    "p": -983.66,
    "r": 3654
  },
  "J A Danahar|TheValley": {
    "w": 15.9,
    "p": -413.85,
    "r": 1122
  },
  "J A Johnstone|Doncaster": {
    "w": 23.9,
    "p": -139.69,
    "r": 498
  },
  "J A Knape|DunstallPark": {
    "w": 10.8,
    "p": -19.0,
    "r": 37
  },
  "J A Knape|PerryBarr": {
    "w": 16.7,
    "p": -34.98,
    "r": 72
  },
  "J A Knape|Towcester": {
    "w": 25.4,
    "p": 18.48,
    "r": 63
  },
  "J A Marriott|Sheffield": {
    "w": 30.2,
    "p": -9.22,
    "r": 106
  },
  "J A Millard|Swindon": {
    "w": 26.0,
    "p": 17.44,
    "r": 154
  },
  "J A Spolander|Sheffield": {
    "w": 22.4,
    "p": 9.63,
    "r": 295
  },
  "J A Teal|Sunderland": {
    "w": 16.1,
    "p": -1044.37,
    "r": 3635
  },
  "J Andrews|Sheffield": {
    "w": 17.7,
    "p": -1068.6,
    "r": 4019
  },
  "J B Thompson|Monmore": {
    "w": 18.6,
    "p": -2037.14,
    "r": 8205
  },
  "J Bateson|DunstallPark": {
    "w": 18.1,
    "p": -40.66,
    "r": 94
  },
  "J Bateson|PerryBarr": {
    "w": 20.5,
    "p": -156.19,
    "r": 657
  },
  "J Bloomfield|Henlow": {
    "w": 21.0,
    "p": -239.84,
    "r": 1646
  },
  "J Bloomfield|Romford": {
    "w": 14.9,
    "p": -368.6,
    "r": 995
  },
  "J Bloomfield|Towcester": {
    "w": 17.8,
    "p": -144.89,
    "r": 410
  },
  "J Bloomfield|Yarmouth": {
    "w": 16.8,
    "p": -630.79,
    "r": 2133
  },
  "J Blunt|Henlow": {
    "w": 13.3,
    "p": -68.12,
    "r": 226
  },
  "J Blunt|PerryBarr": {
    "w": 16.1,
    "p": -844.63,
    "r": 3132
  },
  "J Burling|Yarmouth": {
    "w": 10.5,
    "p": -12.56,
    "r": 19
  },
  "J Campbell|Oxford": {
    "w": 12.9,
    "p": -16.75,
    "r": 31
  },
  "J Campbell|Swindon": {
    "w": 19.9,
    "p": -106.38,
    "r": 316
  },
  "J Crawford|PelawGrange": {
    "w": 11.9,
    "p": -17.5,
    "r": 42
  },
  "J D Ball|Henlow": {
    "w": 21.4,
    "p": -6.88,
    "r": 14
  },
  "J D Brain|Swindon": {
    "w": 25.4,
    "p": 3.06,
    "r": 67
  },
  "J D Davy|Sheffield": {
    "w": 23.6,
    "p": -471.87,
    "r": 2219
  },
  "J D T Allen|Harlow": {
    "w": 11.9,
    "p": -746.66,
    "r": 1750
  },
  "J Daly|Henlow": {
    "w": 17.2,
    "p": -110.05,
    "r": 633
  },
  "J Daly|Nottingham": {
    "w": 17.1,
    "p": -978.91,
    "r": 3490
  },
  "J Daly|SuffolkDowns": {
    "w": 17.6,
    "p": -1053.99,
    "r": 4542
  },
  "J E Craske|SuffolkDowns": {
    "w": 15.7,
    "p": -45.47,
    "r": 102
  },
  "J E Craske|Yarmouth": {
    "w": 19.4,
    "p": -85.25,
    "r": 981
  },
  "J E Harvey|Hove": {
    "w": 20.0,
    "p": -122.98,
    "r": 919
  },
  "J E Hayton|Kinsley": {
    "w": 18.2,
    "p": -22.38,
    "r": 165
  },
  "J E Hayton|Sheffield": {
    "w": 18.4,
    "p": -29.17,
    "r": 87
  },
  "J E Meek|Monmore": {
    "w": 15.5,
    "p": -330.95,
    "r": 1133
  },
  "J E T Slater|Henlow": {
    "w": 11.5,
    "p": -18.13,
    "r": 52
  },
  "J E T Slater|Monmore": {
    "w": 13.4,
    "p": -544.18,
    "r": 1331
  },
  "J E T Slater|Towcester": {
    "w": 17.4,
    "p": -113.55,
    "r": 478
  },
  "J F Spracklen|Swindon": {
    "w": 21.5,
    "p": -22.09,
    "r": 353
  },
  "J Flaherty|Newcastle": {
    "w": 25.5,
    "p": -36.44,
    "r": 212
  },
  "J G Hurst|Kinsley": {
    "w": 16.9,
    "p": -955.23,
    "r": 3536
  },
  "J G Mullins|Towcester": {
    "w": 21.3,
    "p": -79.54,
    "r": 497
  },
  "J G Mullins|Yarmouth": {
    "w": 20.8,
    "p": -251.23,
    "r": 1590
  },
  "J Gray|Nottingham": {
    "w": 19.4,
    "p": -604.44,
    "r": 3347
  },
  "J H Smith|PerryBarr": {
    "w": 12.5,
    "p": -22.54,
    "r": 48
  },
  "J J Fenwick|Newcastle": {
    "w": 17.2,
    "p": -2060.04,
    "r": 8608
  },
  "J J Gornall|Harlow": {
    "w": 27.6,
    "p": -30.41,
    "r": 340
  },
  "J J Gornall|Henlow": {
    "w": 17.7,
    "p": -190.33,
    "r": 583
  },
  "J J Gornall|Towcester": {
    "w": 17.5,
    "p": -95.59,
    "r": 251
  },
  "J J Heath|Hove": {
    "w": 17.9,
    "p": -1735.42,
    "r": 6442
  },
  "J J Luckhurst|CentralPark": {
    "w": 19.9,
    "p": -266.16,
    "r": 1481
  },
  "J J Luckhurst|Crayford": {
    "w": 20.5,
    "p": -698.38,
    "r": 3902
  },
  "J K Hume|Yarmouth": {
    "w": 33.3,
    "p": 1.06,
    "r": 54
  },
  "J K Little|Swindon": {
    "w": 17.4,
    "p": -279.72,
    "r": 1256
  },
  "J L Morris|TheValley": {
    "w": 31.8,
    "p": -18.92,
    "r": 88
  },
  "J L Smith|Kinsley": {
    "w": 17.8,
    "p": -30.75,
    "r": 129
  },
  "J L Smith|SuffolkDowns": {
    "w": 21.9,
    "p": -64.51,
    "r": 269
  },
  "J L Smith|Towcester": {
    "w": 23.2,
    "p": -271.27,
    "r": 1040
  },
  "J Llewellin|Nottingham": {
    "w": 16.1,
    "p": -1797.1,
    "r": 6565
  },
  "J M Foreman|PelawGrange": {
    "w": 18.6,
    "p": -21.31,
    "r": 86
  },
  "J M Liles|Crayford": {
    "w": 20.1,
    "p": -795.48,
    "r": 3634
  },
  "J M Liles|Romford": {
    "w": 17.2,
    "p": -896.1,
    "r": 3622
  },
  "J M Liles|Towcester": {
    "w": 18.2,
    "p": -533.41,
    "r": 2517
  },
  "J M Lowe|Sheffield": {
    "w": 17.3,
    "p": -135.85,
    "r": 439
  },
  "J M Ray|Henlow": {
    "w": 12.6,
    "p": -135.61,
    "r": 277
  },
  "J M Ray|Oxford": {
    "w": 17.8,
    "p": -749.3,
    "r": 2457
  },
  "J M Ray|SuffolkDowns": {
    "w": 17.1,
    "p": -1418.97,
    "r": 5220
  },
  "J M Ray|Towcester": {
    "w": 25.0,
    "p": -2.99,
    "r": 12
  },
  "J M Ray|Yarmouth": {
    "w": 14.6,
    "p": -44.59,
    "r": 89
  },
  "J M Walton|Monmore": {
    "w": 14.8,
    "p": -480.05,
    "r": 1323
  },
  "J M Walton|Sheffield": {
    "w": 16.6,
    "p": -779.02,
    "r": 2605
  },
  "J M Windrass|Doncaster": {
    "w": 14.7,
    "p": -302.61,
    "r": 924
  },
  "J Moore|Sheffield": {
    "w": 15.7,
    "p": -153.29,
    "r": 503
  },
  "J P Higgins|Oxford": {
    "w": 15.6,
    "p": -17.43,
    "r": 45
  },
  "J P Lambe|PerryBarr": {
    "w": 21.9,
    "p": -520.05,
    "r": 2260
  },
  "J Pearson|Harlow": {
    "w": 15.2,
    "p": -385.16,
    "r": 1537
  },
  "J Pearson|SuffolkDowns": {
    "w": 15.2,
    "p": -335.52,
    "r": 1298
  },
  "J R Hall|DunstallPark": {
    "w": 18.7,
    "p": -205.54,
    "r": 800
  },
  "J R Hall|Nottingham": {
    "w": 33.3,
    "p": 14.63,
    "r": 12
  },
  "J R Hall|PerryBarr": {
    "w": 15.5,
    "p": -1204.49,
    "r": 4678
  },
  "J R Smith|Sheffield": {
    "w": 14.4,
    "p": -686.09,
    "r": 2092
  },
  "J Rigby|DunstallPark": {
    "w": 20.0,
    "p": -8.05,
    "r": 20
  },
  "J Rigby|PerryBarr": {
    "w": 25.7,
    "p": -24.39,
    "r": 183
  },
  "J Robinson|Kinsley": {
    "w": 15.9,
    "p": -798.26,
    "r": 3718
  },
  "J S Atkins|Crayford": {
    "w": 13.8,
    "p": -292.69,
    "r": 821
  },
  "J S Atkins|Doncaster": {
    "w": 19.9,
    "p": -324.67,
    "r": 1683
  },
  "J S Atkins|Kinsley": {
    "w": 16.3,
    "p": -111.16,
    "r": 363
  },
  "J S Atkins|PelawGrange": {
    "w": 14.6,
    "p": -166.92,
    "r": 519
  },
  "J S J Simpson|Romford": {
    "w": 15.0,
    "p": -707.94,
    "r": 2889
  },
  "J Sayers|PelawGrange": {
    "w": 6.2,
    "p": -11.5,
    "r": 16
  },
  "J Scott|Kinsley": {
    "w": 16.7,
    "p": -64.94,
    "r": 246
  },
  "J Secular|Harlow": {
    "w": 12.9,
    "p": -223.95,
    "r": 627
  },
  "J Sharp|Doncaster": {
    "w": 16.3,
    "p": -163.23,
    "r": 471
  },
  "J Sharp|Sheffield": {
    "w": 18.0,
    "p": -326.23,
    "r": 1497
  },
  "J Simpson|Doncaster": {
    "w": 16.0,
    "p": -1013.28,
    "r": 3850
  },
  "J Sutherst|Newcastle": {
    "w": 28.6,
    "p": -3.24,
    "r": 42
  },
  "J Sutherst|Sunderland": {
    "w": 19.1,
    "p": -676.1,
    "r": 2565
  },
  "J T Edgar|Newcastle": {
    "w": 16.8,
    "p": -662.24,
    "r": 3120
  },
  "J T Foster|Oxford": {
    "w": 14.1,
    "p": -101.45,
    "r": 297
  },
  "J T Foster|Towcester": {
    "w": 13.9,
    "p": -58.46,
    "r": 144
  },
  "J T Kingsley|CentralPark": {
    "w": 15.6,
    "p": -99.45,
    "r": 302
  },
  "J T Kingsley|Hove": {
    "w": 17.8,
    "p": -976.0,
    "r": 3193
  },
  "J Turner|Crayford": {
    "w": 15.4,
    "p": -892.65,
    "r": 2579
  },
  "J W Gaskin|Doncaster": {
    "w": 28.9,
    "p": -912.53,
    "r": 3492
  },
  "J W Reynolds|CentralPark": {
    "w": 17.2,
    "p": -14.57,
    "r": 151
  },
  "J W Reynolds|Crayford": {
    "w": 20.5,
    "p": -840.71,
    "r": 3354
  },
  "J Walton|Newcastle": {
    "w": 14.8,
    "p": -563.08,
    "r": 1606
  },
  "J Watson|PelawGrange": {
    "w": 17.6,
    "p": -33.18,
    "r": 221
  },
  "J Waugh|Kinsley": {
    "w": 19.4,
    "p": -15.75,
    "r": 129
  },
  "J Zivkovic|Kinsley": {
    "w": 22.2,
    "p": 1.83,
    "r": 45
  },
  "K A A Quinton|Yarmouth": {
    "w": 30.1,
    "p": -6.16,
    "r": 73
  },
  "K A Daly|Crayford": {
    "w": 16.3,
    "p": -759.9,
    "r": 3071
  },
  "K A Kennedy|Doncaster": {
    "w": 18.3,
    "p": -37.44,
    "r": 218
  },
  "K A Kennedy|PelawGrange": {
    "w": 15.9,
    "p": -257.51,
    "r": 1217
  },
  "K A Lempard|Nottingham": {
    "w": 21.4,
    "p": -4.83,
    "r": 14
  },
  "K Billingham|Monmore": {
    "w": 17.8,
    "p": -1375.79,
    "r": 5509
  },
  "K Billingham-hine|Monmore": {
    "w": 18.9,
    "p": -709.37,
    "r": 3240
  },
  "K Blackbird|Nottingham": {
    "w": 13.4,
    "p": -165.81,
    "r": 486
  },
  "K Blackbird|Sunderland": {
    "w": 16.0,
    "p": -535.85,
    "r": 2019
  },
  "K Bowman|Doncaster": {
    "w": 13.7,
    "p": -1499.02,
    "r": 4290
  },
  "K C Robins|Henlow": {
    "w": 12.3,
    "p": -46.59,
    "r": 114
  },
  "K C Robins|SuffolkDowns": {
    "w": 16.8,
    "p": -289.47,
    "r": 915
  },
  "K C Robins|Towcester": {
    "w": 21.1,
    "p": -18.68,
    "r": 242
  },
  "K Dawson|Yarmouth": {
    "w": 23.3,
    "p": -16.55,
    "r": 163
  },
  "K Dobson|Sunderland": {
    "w": 15.3,
    "p": -311.25,
    "r": 1258
  },
  "K Dodington|CentralPark": {
    "w": 17.9,
    "p": -143.62,
    "r": 592
  },
  "K Dodington|Oxford": {
    "w": 18.5,
    "p": -919.48,
    "r": 3923
  },
  "K E Seville|Kinsley": {
    "w": 17.8,
    "p": -353.36,
    "r": 1315
  },
  "K Everitt|Doncaster": {
    "w": 18.3,
    "p": -385.71,
    "r": 1840
  },
  "K G Crew|Harlow": {
    "w": 22.1,
    "p": -40.32,
    "r": 326
  },
  "K G Hardiman|Henlow": {
    "w": 33.3,
    "p": 8.68,
    "r": 24
  },
  "K G Hardiman|Oxford": {
    "w": 15.4,
    "p": -40.46,
    "r": 143
  },
  "K G Hardiman|Towcester": {
    "w": 11.6,
    "p": -23.0,
    "r": 43
  },
  "K Gooding|Henlow": {
    "w": 21.0,
    "p": -12.78,
    "r": 38
  },
  "K Gooding|Nottingham": {
    "w": 15.7,
    "p": -74.74,
    "r": 249
  },
  "K Gooding|Towcester": {
    "w": 18.7,
    "p": -297.59,
    "r": 899
  },
  "K Hodson|Sheffield": {
    "w": 17.1,
    "p": -1171.77,
    "r": 4755
  },
  "K J Bentley|Kinsley": {
    "w": 25.5,
    "p": 0.71,
    "r": 51
  },
  "K J Cobbold|Harlow": {
    "w": 24.6,
    "p": -85.48,
    "r": 525
  },
  "K J Cobbold|Yarmouth": {
    "w": 20.7,
    "p": -674.51,
    "r": 2730
  },
  "K J Crocker|Oxford": {
    "w": 15.0,
    "p": -589.88,
    "r": 1774
  },
  "K J Crocker|Swindon": {
    "w": 16.1,
    "p": -223.11,
    "r": 849
  },
  "K J Crocker|Towcester": {
    "w": 17.0,
    "p": -139.37,
    "r": 640
  },
  "K J Ferguson|Kinsley": {
    "w": 34.1,
    "p": 10.34,
    "r": 44
  },
  "K J Ferguson|Sheffield": {
    "w": 20.3,
    "p": -54.36,
    "r": 286
  },
  "K J Ohara|Kinsley": {
    "w": 24.0,
    "p": 6.45,
    "r": 104
  },
  "K L Windebank|Yarmouth": {
    "w": 17.8,
    "p": -153.87,
    "r": 781
  },
  "K M Grayson|Doncaster": {
    "w": 20.1,
    "p": -446.22,
    "r": 1489
  },
  "K M Grayson|Sheffield": {
    "w": 19.4,
    "p": -277.38,
    "r": 988
  },
  "K M Oflaherty|Romford": {
    "w": 19.4,
    "p": -1293.11,
    "r": 5822
  },
  "K M Tobin|Doncaster": {
    "w": 16.5,
    "p": -271.15,
    "r": 806
  },
  "K P Boon|SuffolkDowns": {
    "w": 31.6,
    "p": -0.95,
    "r": 38
  },
  "K R Hutton|Oxford": {
    "w": 26.3,
    "p": -178.59,
    "r": 1259
  },
  "K R Hutton|Towcester": {
    "w": 22.2,
    "p": -22.53,
    "r": 162
  },
  "K R Proctor|Harlow": {
    "w": 21.8,
    "p": -117.08,
    "r": 386
  },
  "K S Harrison|DunstallPark": {
    "w": 17.8,
    "p": -271.45,
    "r": 939
  },
  "K S Harrison|PerryBarr": {
    "w": 18.1,
    "p": -548.51,
    "r": 2362
  },
  "K Wilton|Nottingham": {
    "w": 19.2,
    "p": -42.87,
    "r": 296
  },
  "L A Sawyer|Yarmouth": {
    "w": 23.2,
    "p": -23.05,
    "r": 138
  },
  "L A Taylorson|Sheffield": {
    "w": 16.1,
    "p": -1320.29,
    "r": 4776
  },
  "L B Pearce|CentralPark": {
    "w": 15.8,
    "p": -542.73,
    "r": 1909
  },
  "L B Pearce|Hove": {
    "w": 12.8,
    "p": -124.09,
    "r": 304
  },
  "L B Pruhs|Doncaster": {
    "w": 12.5,
    "p": -21.75,
    "r": 40
  },
  "L B Pruhs|Oxford": {
    "w": 15.4,
    "p": -10.07,
    "r": 13
  },
  "L B Pruhs|SuffolkDowns": {
    "w": 19.4,
    "p": -78.96,
    "r": 216
  },
  "L B Pruhs|Towcester": {
    "w": 19.2,
    "p": -161.99,
    "r": 878
  },
  "L Brown|Yarmouth": {
    "w": 14.0,
    "p": -597.71,
    "r": 2294
  },
  "L C Rowe|Hove": {
    "w": 16.7,
    "p": -5.63,
    "r": 18
  },
  "L Cook|Nottingham": {
    "w": 21.6,
    "p": -498.21,
    "r": 2231
  },
  "L E Morrison|CentralPark": {
    "w": 17.1,
    "p": -653.14,
    "r": 2001
  },
  "L E Morrison|Crayford": {
    "w": 20.0,
    "p": 5.0,
    "r": 10
  },
  "L E Morrison|Harlow": {
    "w": 14.6,
    "p": -208.36,
    "r": 556
  },
  "L Eagleton|PelawGrange": {
    "w": 17.3,
    "p": -198.51,
    "r": 823
  },
  "L Field|Henlow": {
    "w": 16.2,
    "p": -141.34,
    "r": 451
  },
  "L Field|Monmore": {
    "w": 11.1,
    "p": -108.57,
    "r": 270
  },
  "L Field|Oxford": {
    "w": 16.2,
    "p": -12.5,
    "r": 37
  },
  "L Field|Towcester": {
    "w": 18.3,
    "p": -100.68,
    "r": 404
  },
  "L G Tuffin|Henlow": {
    "w": 17.2,
    "p": -13.59,
    "r": 29
  },
  "L G Tuffin|Towcester": {
    "w": 18.9,
    "p": -1218.19,
    "r": 5498
  },
  "L J Macmanus|Doncaster": {
    "w": 15.3,
    "p": -767.18,
    "r": 2471
  },
  "L J Pruhs|Oxford": {
    "w": 27.3,
    "p": 8.5,
    "r": 11
  },
  "L J Pruhs|Towcester": {
    "w": 26.4,
    "p": -12.65,
    "r": 53
  },
  "L J Stephenson|Sheffield": {
    "w": 20.6,
    "p": -920.4,
    "r": 4604
  },
  "L Williams|TheValley": {
    "w": 17.7,
    "p": -1281.92,
    "r": 4094
  },
  "M A Burton|TheValley": {
    "w": 32.1,
    "p": -11.22,
    "r": 109
  },
  "M A Dagley|Kinsley": {
    "w": 16.8,
    "p": -117.82,
    "r": 458
  },
  "M A Fisher|Henlow": {
    "w": 14.3,
    "p": -7.25,
    "r": 14
  },
  "M A M Buckley|Harlow": {
    "w": 11.5,
    "p": -103.32,
    "r": 192
  },
  "M A Mackemsley|Monmore": {
    "w": 18.1,
    "p": -10.44,
    "r": 127
  },
  "M A Mackemsley|Swindon": {
    "w": 20.5,
    "p": -86.63,
    "r": 351
  },
  "M A P Odonnell|Sheffield": {
    "w": 16.8,
    "p": -785.34,
    "r": 3863
  },
  "M A Payne|SuffolkDowns": {
    "w": 32.3,
    "p": 3.13,
    "r": 31
  },
  "M A Payne|Towcester": {
    "w": 41.7,
    "p": 4.25,
    "r": 12
  },
  "M A Roberts|Nottingham": {
    "w": 18.4,
    "p": -42.47,
    "r": 294
  },
  "M A Thomas|TheValley": {
    "w": 26.7,
    "p": -7.5,
    "r": 101
  },
  "M A Wallis|Henlow": {
    "w": 24.3,
    "p": -4.68,
    "r": 74
  },
  "M A Wallis|SuffolkDowns": {
    "w": 20.6,
    "p": -207.08,
    "r": 897
  },
  "M A Wallis|Towcester": {
    "w": 18.8,
    "p": -72.74,
    "r": 288
  },
  "M Brighton|Yarmouth": {
    "w": 17.6,
    "p": -253.19,
    "r": 774
  },
  "M C B Collins|Hove": {
    "w": 13.7,
    "p": -228.86,
    "r": 666
  },
  "M Dobson|PelawGrange": {
    "w": 17.8,
    "p": -53.98,
    "r": 129
  },
  "M Dobson|Sheffield": {
    "w": 17.4,
    "p": -118.47,
    "r": 432
  },
  "M E Westwood|Henlow": {
    "w": 17.7,
    "p": -31.33,
    "r": 203
  },
  "M E Westwood|Romford": {
    "w": 17.2,
    "p": -1199.72,
    "r": 5532
  },
  "M E Wiley|Romford": {
    "w": 16.9,
    "p": -2106.16,
    "r": 8337
  },
  "M F Connolly|PelawGrange": {
    "w": 28.8,
    "p": 0.22,
    "r": 52
  },
  "M G Adamson|Doncaster": {
    "w": 20.6,
    "p": -111.19,
    "r": 559
  },
  "M Gray|Newcastle": {
    "w": 19.0,
    "p": -42.43,
    "r": 205
  },
  "M Gray|PelawGrange": {
    "w": 20.0,
    "p": -81.19,
    "r": 345
  },
  "M H Fawsitt|Harlow": {
    "w": 16.7,
    "p": -62.31,
    "r": 449
  },
  "M Haythorne|Doncaster": {
    "w": 16.5,
    "p": -921.69,
    "r": 4034
  },
  "M J Dartnall|CentralPark": {
    "w": 24.1,
    "p": -44.35,
    "r": 232
  },
  "M J Dartnall|Oxford": {
    "w": 26.3,
    "p": -39.22,
    "r": 616
  },
  "M J Fieldson|Sunderland": {
    "w": 15.0,
    "p": -770.64,
    "r": 2657
  },
  "M J Giles|PerryBarr": {
    "w": 13.2,
    "p": -75.13,
    "r": 189
  },
  "M J May|TheValley": {
    "w": 19.9,
    "p": -93.99,
    "r": 251
  },
  "M J Mayo|PerryBarr": {
    "w": 11.7,
    "p": -140.74,
    "r": 325
  },
  "M J Mayo|TheValley": {
    "w": 16.9,
    "p": -326.1,
    "r": 922
  },
  "M J Rice|Harlow": {
    "w": 20.7,
    "p": -562.92,
    "r": 2666
  },
  "M J Rice|Yarmouth": {
    "w": 13.8,
    "p": -179.05,
    "r": 477
  },
  "M J Richards|Hove": {
    "w": 14.8,
    "p": -59.1,
    "r": 128
  },
  "M J Richards|Oxford": {
    "w": 19.5,
    "p": -117.32,
    "r": 791
  },
  "M J Richards|Towcester": {
    "w": 19.1,
    "p": -531.53,
    "r": 2491
  },
  "M J Russell|Monmore": {
    "w": 14.3,
    "p": -248.52,
    "r": 657
  },
  "M J Siddall|Kinsley": {
    "w": 14.3,
    "p": -420.28,
    "r": 1287
  },
  "M J Watson|PelawGrange": {
    "w": 16.5,
    "p": -172.9,
    "r": 474
  },
  "M K Bulmer|PelawGrange": {
    "w": 20.3,
    "p": -97.78,
    "r": 522
  },
  "M K Bulmer|Sunderland": {
    "w": 20.8,
    "p": -124.54,
    "r": 794
  },
  "M K Hamilton|Henlow": {
    "w": 50.0,
    "p": 15.36,
    "r": 14
  },
  "M K Smith|Crayford": {
    "w": 19.4,
    "p": -123.07,
    "r": 727
  },
  "M L Locke|Romford": {
    "w": 18.1,
    "p": -951.29,
    "r": 4668
  },
  "M Mavrias|CentralPark": {
    "w": 15.5,
    "p": -1256.74,
    "r": 4386
  },
  "M May|PerryBarr": {
    "w": 9.6,
    "p": -60.35,
    "r": 104
  },
  "M N Fenwick|CentralPark": {
    "w": 17.1,
    "p": -890.2,
    "r": 2736
  },
  "M N Fenwick|Romford": {
    "w": 0.0,
    "p": -12.0,
    "r": 12
  },
  "M N May|Kinsley": {
    "w": 15.6,
    "p": -1654.4,
    "r": 6192
  },
  "M Newberry|Yarmouth": {
    "w": 19.3,
    "p": -131.97,
    "r": 379
  },
  "M P Brown|Romford": {
    "w": 18.4,
    "p": -195.18,
    "r": 969
  },
  "M P Brown|SuffolkDowns": {
    "w": 22.5,
    "p": -398.84,
    "r": 2219
  },
  "M P Brown|Towcester": {
    "w": 20.0,
    "p": -520.83,
    "r": 2600
  },
  "M P Brown|Yarmouth": {
    "w": 24.5,
    "p": -25.71,
    "r": 98
  },
  "M R French|Yarmouth": {
    "w": 10.1,
    "p": -123.04,
    "r": 276
  },
  "M R Pike|Towcester": {
    "w": 16.7,
    "p": -4.8,
    "r": 12
  },
  "M R Sillars|PelawGrange": {
    "w": 13.1,
    "p": -94.52,
    "r": 213
  },
  "M R Stout|PelawGrange": {
    "w": 15.1,
    "p": -14.15,
    "r": 33
  },
  "M Shaw|Monmore": {
    "w": 15.9,
    "p": -68.47,
    "r": 151
  },
  "M Shields|Yarmouth": {
    "w": 16.3,
    "p": -42.23,
    "r": 178
  },
  "M Simpson|TheValley": {
    "w": 22.2,
    "p": -21.39,
    "r": 63
  },
  "M T Field|DunstallPark": {
    "w": 17.9,
    "p": -90.62,
    "r": 541
  },
  "M T Field|PerryBarr": {
    "w": 16.7,
    "p": -318.83,
    "r": 1016
  },
  "M T Field|Sheffield": {
    "w": 13.2,
    "p": -172.44,
    "r": 317
  },
  "M T Field|Towcester": {
    "w": 14.3,
    "p": -2.5,
    "r": 14
  },
  "M T Munslow|Nottingham": {
    "w": 18.3,
    "p": -818.19,
    "r": 2990
  },
  "M W Jeans|Swindon": {
    "w": 13.2,
    "p": -222.82,
    "r": 515
  },
  "M Walsh|Newcastle": {
    "w": 14.3,
    "p": -174.43,
    "r": 518
  },
  "N A Linnell|TheValley": {
    "w": 31.4,
    "p": -17.3,
    "r": 51
  },
  "N A Linnell|Towcester": {
    "w": 19.8,
    "p": -3.8,
    "r": 81
  },
  "N Brown|PelawGrange": {
    "w": 18.9,
    "p": -19.28,
    "r": 37
  },
  "N Chapman|Nottingham": {
    "w": 16.4,
    "p": -225.34,
    "r": 664
  },
  "N E M Mcellistrim|Hove": {
    "w": 16.9,
    "p": -710.69,
    "r": 2534
  },
  "N F Carter|CentralPark": {
    "w": 17.4,
    "p": -349.41,
    "r": 1296
  },
  "N F Carter|Crayford": {
    "w": 16.5,
    "p": -1106.76,
    "r": 3684
  },
  "N G Britton|PerryBarr": {
    "w": 12.3,
    "p": -53.11,
    "r": 219
  },
  "N I Wills|Harlow": {
    "w": 24.6,
    "p": -13.97,
    "r": 236
  },
  "N J Deas|Crayford": {
    "w": 17.3,
    "p": -597.0,
    "r": 2580
  },
  "N J Deas|Oxford": {
    "w": 18.8,
    "p": -954.33,
    "r": 4044
  },
  "N J Deas|Towcester": {
    "w": 16.4,
    "p": -230.23,
    "r": 721
  },
  "N J Hunt|Monmore": {
    "w": 19.0,
    "p": -558.7,
    "r": 2690
  },
  "N J Hunt|Romford": {
    "w": 18.1,
    "p": -558.07,
    "r": 2476
  },
  "N J Saunders|Sheffield": {
    "w": 13.8,
    "p": -770.78,
    "r": 2065
  },
  "N Langley|Kinsley": {
    "w": 18.1,
    "p": -272.86,
    "r": 1467
  },
  "N M Slowley|DunstallPark": {
    "w": 17.4,
    "p": -17.71,
    "r": 264
  },
  "N M Slowley|PerryBarr": {
    "w": 17.3,
    "p": -447.48,
    "r": 1951
  },
  "N P Ralph Jnr|DunstallPark": {
    "w": 23.0,
    "p": -18.27,
    "r": 126
  },
  "N P Ralph Jnr|PerryBarr": {
    "w": 18.8,
    "p": -142.18,
    "r": 716
  },
  "N S Black|Newcastle": {
    "w": 20.4,
    "p": -30.71,
    "r": 240
  },
  "N Shine|Harlow": {
    "w": 14.6,
    "p": -117.48,
    "r": 439
  },
  "N Shine|SuffolkDowns": {
    "w": 9.7,
    "p": -43.67,
    "r": 72
  },
  "N Shine|Yarmouth": {
    "w": 16.7,
    "p": -6.25,
    "r": 12
  },
  "P A Bedding|PelawGrange": {
    "w": 17.1,
    "p": -14.63,
    "r": 111
  },
  "P A Braithwaite|Towcester": {
    "w": 16.3,
    "p": -512.18,
    "r": 2179
  },
  "P A Curtin|Monmore": {
    "w": 17.3,
    "p": -1510.48,
    "r": 5705
  },
  "P A Harmes|DunstallPark": {
    "w": 21.1,
    "p": -1.63,
    "r": 19
  },
  "P A Harmes|PerryBarr": {
    "w": 20.8,
    "p": -37.37,
    "r": 187
  },
  "P A Holder|DunstallPark": {
    "w": 20.6,
    "p": -36.91,
    "r": 339
  },
  "P A Holder|PerryBarr": {
    "w": 19.4,
    "p": -198.65,
    "r": 1592
  },
  "P A Holmes|Kinsley": {
    "w": 14.9,
    "p": -152.05,
    "r": 638
  },
  "P A Sallis|Monmore": {
    "w": 17.2,
    "p": -1146.13,
    "r": 4105
  },
  "P Ancell|Kinsley": {
    "w": 13.7,
    "p": -60.69,
    "r": 234
  },
  "P B Philpott|CentralPark": {
    "w": 16.1,
    "p": -150.04,
    "r": 757
  },
  "P B Philpott|Henlow": {
    "w": 17.0,
    "p": -25.75,
    "r": 88
  },
  "P B Philpott|SuffolkDowns": {
    "w": 15.2,
    "p": -8.75,
    "r": 105
  },
  "P B Philpott|Towcester": {
    "w": 15.2,
    "p": -435.55,
    "r": 1334
  },
  "P B Witchell|Harlow": {
    "w": 16.3,
    "p": -693.34,
    "r": 2944
  },
  "P Barlow|Doncaster": {
    "w": 21.1,
    "p": -49.38,
    "r": 180
  },
  "P Barlow|PerryBarr": {
    "w": 26.7,
    "p": -4.05,
    "r": 157
  },
  "P Barlow|Sheffield": {
    "w": 20.5,
    "p": -204.17,
    "r": 943
  },
  "P Bevan|Swindon": {
    "w": 17.4,
    "p": -27.2,
    "r": 115
  },
  "P C White|Monmore": {
    "w": 15.8,
    "p": -329.4,
    "r": 1245
  },
  "P C White|Nottingham": {
    "w": 18.3,
    "p": -278.95,
    "r": 1334
  },
  "P Clarke|Harlow": {
    "w": 16.9,
    "p": -3879.81,
    "r": 14866
  },
  "P Crowson|Harlow": {
    "w": 23.6,
    "p": -22.26,
    "r": 199
  },
  "P Crowson|Henlow": {
    "w": 10.0,
    "p": -7.63,
    "r": 10
  },
  "P D A Dugmore|Nottingham": {
    "w": 15.7,
    "p": -119.25,
    "r": 362
  },
  "P D Burr|Romford": {
    "w": 17.7,
    "p": -654.4,
    "r": 2117
  },
  "P D Burr|Yarmouth": {
    "w": 21.3,
    "p": -172.52,
    "r": 1495
  },
  "P D Sanderson|Sheffield": {
    "w": 13.7,
    "p": -915.04,
    "r": 2880
  },
  "P G Broome|Henlow": {
    "w": 16.7,
    "p": -4.58,
    "r": 36
  },
  "P H Harnden|Henlow": {
    "w": 17.5,
    "p": -136.4,
    "r": 663
  },
  "P H Harnden|Towcester": {
    "w": 17.2,
    "p": -1589.61,
    "r": 5592
  },
  "P Held|Harlow": {
    "w": 15.1,
    "p": -86.55,
    "r": 317
  },
  "P I Cowdrill|Monmore": {
    "w": 17.1,
    "p": -1547.03,
    "r": 5678
  },
  "P I Cross|Yarmouth": {
    "w": 16.5,
    "p": -511.03,
    "r": 2634
  },
  "P J Browne|Hove": {
    "w": 19.3,
    "p": -609.61,
    "r": 2328
  },
  "P J Dolby|Harlow": {
    "w": 15.2,
    "p": -31.33,
    "r": 79
  },
  "P J Dolby|Henlow": {
    "w": 17.8,
    "p": -88.8,
    "r": 297
  },
  "P J Dolby|SuffolkDowns": {
    "w": 18.2,
    "p": -5.34,
    "r": 11
  },
  "P J Dolby|Towcester": {
    "w": 19.3,
    "p": -53.04,
    "r": 218
  },
  "P J Doocey|Monmore": {
    "w": 21.7,
    "p": -240.56,
    "r": 1554
  },
  "P J Manley|Doncaster": {
    "w": 21.7,
    "p": -9.3,
    "r": 23
  },
  "P J Manley|Henlow": {
    "w": 19.4,
    "p": -1.18,
    "r": 31
  },
  "P J Manley|SuffolkDowns": {
    "w": 16.5,
    "p": -164.2,
    "r": 650
  },
  "P J Manley|Towcester": {
    "w": 16.3,
    "p": -99.81,
    "r": 367
  },
  "P J R Steward|Harlow": {
    "w": 19.5,
    "p": -117.24,
    "r": 857
  },
  "P J R Steward|Henlow": {
    "w": 15.3,
    "p": -161.27,
    "r": 439
  },
  "P J R Steward|SuffolkDowns": {
    "w": 17.1,
    "p": -123.02,
    "r": 644
  },
  "P J R Steward|Towcester": {
    "w": 15.8,
    "p": -81.6,
    "r": 209
  },
  "P J Rosney|PerryBarr": {
    "w": 19.6,
    "p": -112.95,
    "r": 351
  },
  "P J Wilson|Nottingham": {
    "w": 17.1,
    "p": -387.22,
    "r": 1679
  },
  "P Janssens|SuffolkDowns": {
    "w": 30.0,
    "p": -1.95,
    "r": 10
  },
  "P Janssens|Towcester": {
    "w": 20.5,
    "p": -15.29,
    "r": 73
  },
  "P Kennedy|Newcastle": {
    "w": 15.4,
    "p": -305.08,
    "r": 752
  },
  "P Lithgow|Newcastle": {
    "w": 20.1,
    "p": -40.54,
    "r": 349
  },
  "P M Donovan|CentralPark": {
    "w": 24.2,
    "p": -277.6,
    "r": 2237
  },
  "P M Donovan|Hove": {
    "w": 16.8,
    "p": -42.77,
    "r": 89
  },
  "P M Holland|Nottingham": {
    "w": 17.6,
    "p": -452.56,
    "r": 1858
  },
  "P Marchant|Hove": {
    "w": 17.2,
    "p": -13.27,
    "r": 29
  },
  "P Meek|DunstallPark": {
    "w": 17.2,
    "p": -62.8,
    "r": 151
  },
  "P Meek|PerryBarr": {
    "w": 18.7,
    "p": -229.99,
    "r": 927
  },
  "P Miller|Kinsley": {
    "w": 15.6,
    "p": -137.79,
    "r": 469
  },
  "P Miller|Newcastle": {
    "w": 19.6,
    "p": -65.22,
    "r": 281
  },
  "P Miller|Sunderland": {
    "w": 17.5,
    "p": -2285.42,
    "r": 8167
  },
  "P Milner|Doncaster": {
    "w": 30.2,
    "p": -32.22,
    "r": 341
  },
  "P Milner|Sheffield": {
    "w": 24.7,
    "p": -40.96,
    "r": 235
  },
  "P Milner|Towcester": {
    "w": 20.0,
    "p": -3.49,
    "r": 25
  },
  "P N Godfrey|Swindon": {
    "w": 17.3,
    "p": -76.17,
    "r": 260
  },
  "P N Richardson|PelawGrange": {
    "w": 17.0,
    "p": -159.35,
    "r": 570
  },
  "P N Richardson|PerryBarr": {
    "w": 23.0,
    "p": -3.21,
    "r": 61
  },
  "P Naylor|PerryBarr": {
    "w": 16.4,
    "p": -140.73,
    "r": 666
  },
  "P P Deal|Harlow": {
    "w": 19.3,
    "p": -24.8,
    "r": 150
  },
  "P Prior|Doncaster": {
    "w": 21.5,
    "p": -131.0,
    "r": 859
  },
  "P Prior|Sheffield": {
    "w": 24.6,
    "p": -36.71,
    "r": 207
  },
  "P R Foster|Swindon": {
    "w": 20.3,
    "p": -451.74,
    "r": 1813
  },
  "P R Spragg|PerryBarr": {
    "w": 21.2,
    "p": 3.33,
    "r": 33
  },
  "P R Vincent|Harlow": {
    "w": 30.8,
    "p": 6.89,
    "r": 419
  },
  "P Rutherford|Newcastle": {
    "w": 17.3,
    "p": -1233.64,
    "r": 4804
  },
  "P S Rea|Harlow": {
    "w": 16.7,
    "p": -67.74,
    "r": 233
  },
  "P S Rea|Henlow": {
    "w": 13.7,
    "p": -67.58,
    "r": 182
  },
  "P S Rea|SuffolkDowns": {
    "w": 17.3,
    "p": -681.63,
    "r": 2740
  },
  "P S Rea|Yarmouth": {
    "w": 14.2,
    "p": -489.45,
    "r": 1454
  },
  "P Shore|Monmore": {
    "w": 13.5,
    "p": -26.75,
    "r": 52
  },
  "P Shore|Towcester": {
    "w": 22.2,
    "p": -3.79,
    "r": 18
  },
  "P Simpson|PelawGrange": {
    "w": 15.7,
    "p": -18.63,
    "r": 83
  },
  "P Singlewood|Newcastle": {
    "w": 16.5,
    "p": -550.72,
    "r": 1755
  },
  "P Smith|Doncaster": {
    "w": 13.3,
    "p": -110.22,
    "r": 263
  },
  "P Smith|Kinsley": {
    "w": 17.9,
    "p": -20.76,
    "r": 140
  },
  "P T Henman|Henlow": {
    "w": 27.4,
    "p": -21.14,
    "r": 146
  },
  "P T Henman|Towcester": {
    "w": 15.3,
    "p": -122.67,
    "r": 254
  },
  "P T Maynard|Swindon": {
    "w": 17.9,
    "p": -680.88,
    "r": 3020
  },
  "P T Maynard|TheValley": {
    "w": 22.6,
    "p": -62.19,
    "r": 256
  },
  "P Taylor|Kinsley": {
    "w": 15.7,
    "p": -57.99,
    "r": 319
  },
  "P Timmins|Nottingham": {
    "w": 17.5,
    "p": -299.65,
    "r": 1012
  },
  "P Tsirigotis|Henlow": {
    "w": 15.6,
    "p": -120.89,
    "r": 346
  },
  "P Tsirigotis|Towcester": {
    "w": 19.5,
    "p": -114.2,
    "r": 476
  },
  "P V Swadden|Swindon": {
    "w": 17.7,
    "p": -947.69,
    "r": 3616
  },
  "P V Swadden|Towcester": {
    "w": 17.6,
    "p": -36.63,
    "r": 131
  },
  "P V Whitwood|Yarmouth": {
    "w": 34.8,
    "p": 7.84,
    "r": 138
  },
  "P W Gregson|Sheffield": {
    "w": 14.6,
    "p": -78.26,
    "r": 336
  },
  "P W Young|Romford": {
    "w": 17.9,
    "p": -4421.3,
    "r": 20153
  },
  "P Ward|Harlow": {
    "w": 16.9,
    "p": -1485.91,
    "r": 5859
  },
  "P Webster|Sheffield": {
    "w": 16.3,
    "p": -458.36,
    "r": 1625
  },
  "P Worton|PelawGrange": {
    "w": 16.7,
    "p": -4.75,
    "r": 18
  },
  "R A Baker|Oxford": {
    "w": 23.9,
    "p": -196.01,
    "r": 1141
  },
  "R A Baker|Towcester": {
    "w": 20.3,
    "p": -34.48,
    "r": 153
  },
  "R A Dimmock|Towcester": {
    "w": 15.6,
    "p": -35.58,
    "r": 109
  },
  "R A Draper|Sheffield": {
    "w": 24.5,
    "p": -442.62,
    "r": 1965
  },
  "R A Jones|Swindon": {
    "w": 18.5,
    "p": -29.48,
    "r": 108
  },
  "R B Galloway|Kinsley": {
    "w": 20.0,
    "p": -0.75,
    "r": 10
  },
  "R B Galloway|PelawGrange": {
    "w": 14.3,
    "p": -8.38,
    "r": 14
  },
  "R B York|Harlow": {
    "w": 15.2,
    "p": -20.75,
    "r": 46
  },
  "R B York|SuffolkDowns": {
    "w": 17.6,
    "p": -333.23,
    "r": 1100
  },
  "R B York|Towcester": {
    "w": 13.5,
    "p": -22.38,
    "r": 52
  },
  "R C Hardy|Doncaster": {
    "w": 17.9,
    "p": -210.13,
    "r": 753
  },
  "R D Copping|Harlow": {
    "w": 17.8,
    "p": -45.78,
    "r": 180
  },
  "R D Copping|Oxford": {
    "w": 15.8,
    "p": -40.12,
    "r": 101
  },
  "R D Copping|SuffolkDowns": {
    "w": 24.4,
    "p": -4.47,
    "r": 172
  },
  "R D Copping|Yarmouth": {
    "w": 19.1,
    "p": -45.21,
    "r": 371
  },
  "R Devenish|Henlow": {
    "w": 28.4,
    "p": -19.21,
    "r": 366
  },
  "R Devenish|Yarmouth": {
    "w": 20.4,
    "p": -68.81,
    "r": 221
  },
  "R E Allder|Towcester": {
    "w": 23.3,
    "p": -52.83,
    "r": 309
  },
  "R E Perkins|Sheffield": {
    "w": 10.0,
    "p": -45.44,
    "r": 80
  },
  "R F Bennett|PelawGrange": {
    "w": 10.3,
    "p": -89.72,
    "r": 165
  },
  "R F Yeates|Hove": {
    "w": 18.0,
    "p": -187.18,
    "r": 633
  },
  "R F Yeates|Oxford": {
    "w": 20.4,
    "p": -422.78,
    "r": 1945
  },
  "R Fitch|Henlow": {
    "w": 18.6,
    "p": -94.45,
    "r": 770
  },
  "R Fitch|Yarmouth": {
    "w": 19.6,
    "p": -158.89,
    "r": 509
  },
  "R Fletcher|Kinsley": {
    "w": 18.2,
    "p": -86.71,
    "r": 253
  },
  "R H Peckover|Henlow": {
    "w": 16.1,
    "p": -11.38,
    "r": 31
  },
  "R H Peckover|Oxford": {
    "w": 17.7,
    "p": -150.38,
    "r": 497
  },
  "R H Smith|PelawGrange": {
    "w": 36.1,
    "p": -6.26,
    "r": 36
  },
  "R H Tungatt|Henlow": {
    "w": 19.6,
    "p": -5.59,
    "r": 97
  },
  "R H Tungatt|Hove": {
    "w": 11.1,
    "p": -45.27,
    "r": 81
  },
  "R H Tungatt|Oxford": {
    "w": 17.4,
    "p": -165.26,
    "r": 701
  },
  "R Hale|Newcastle": {
    "w": 19.6,
    "p": -252.57,
    "r": 911
  },
  "R Holt|Sheffield": {
    "w": 16.4,
    "p": -282.65,
    "r": 967
  },
  "R J Buckton|Newcastle": {
    "w": 18.7,
    "p": -140.59,
    "r": 866
  },
  "R J Holloway|Crayford": {
    "w": 17.9,
    "p": -259.41,
    "r": 756
  },
  "R J Holloway|Hove": {
    "w": 20.5,
    "p": -166.09,
    "r": 776
  },
  "R J Leeks|Harlow": {
    "w": 11.8,
    "p": -46.88,
    "r": 93
  },
  "R J Leeks|SuffolkDowns": {
    "w": 16.7,
    "p": -9.38,
    "r": 30
  },
  "R J Overton|Doncaster": {
    "w": 17.9,
    "p": -1466.14,
    "r": 5660
  },
  "R J Turney|Henlow": {
    "w": 24.0,
    "p": -11.38,
    "r": 50
  },
  "R J Turney|Towcester": {
    "w": 13.3,
    "p": -113.68,
    "r": 241
  },
  "R Jones|Towcester": {
    "w": 20.5,
    "p": -29.46,
    "r": 112
  },
  "R Jury|Oxford": {
    "w": 22.3,
    "p": -37.41,
    "r": 166
  },
  "R Jury|Swindon": {
    "w": 18.9,
    "p": -45.83,
    "r": 106
  },
  "R K Corner|Yarmouth": {
    "w": 21.1,
    "p": -4.0,
    "r": 19
  },
  "R Knights|PelawGrange": {
    "w": 17.8,
    "p": -49.73,
    "r": 135
  },
  "R L Hill|Oxford": {
    "w": 21.9,
    "p": -180.77,
    "r": 1056
  },
  "R Lambe|DunstallPark": {
    "w": 21.8,
    "p": -72.35,
    "r": 262
  },
  "R M Emery|CentralPark": {
    "w": 20.8,
    "p": -7.25,
    "r": 24
  },
  "R M Emery|Crayford": {
    "w": 17.3,
    "p": -324.66,
    "r": 1635
  },
  "R M Emery|Harlow": {
    "w": 14.3,
    "p": -77.46,
    "r": 293
  },
  "R M Emery|SuffolkDowns": {
    "w": 17.9,
    "p": -25.46,
    "r": 95
  },
  "R M Emery|Yarmouth": {
    "w": 12.1,
    "p": -166.61,
    "r": 372
  },
  "R Mccarthy|PelawGrange": {
    "w": 16.4,
    "p": -548.09,
    "r": 1867
  },
  "R P Rees|Hove": {
    "w": 20.4,
    "p": -452.63,
    "r": 2573
  },
  "R Pattinson|CentralPark": {
    "w": 15.9,
    "p": -655.49,
    "r": 2200
  },
  "R Peckham|Towcester": {
    "w": 32.0,
    "p": 4.82,
    "r": 25
  },
  "R Peckham|Yarmouth": {
    "w": 13.3,
    "p": -29.01,
    "r": 60
  },
  "R Rotherham|PelawGrange": {
    "w": 16.0,
    "p": -119.57,
    "r": 380
  },
  "R Saunders|Newcastle": {
    "w": 29.6,
    "p": -1.55,
    "r": 27
  },
  "R Saunders|PelawGrange": {
    "w": 19.7,
    "p": -28.89,
    "r": 223
  },
  "R Short|DunstallPark": {
    "w": 19.3,
    "p": -40.78,
    "r": 140
  },
  "R Short|Swindon": {
    "w": 21.6,
    "p": -126.69,
    "r": 1028
  },
  "R Short|TheValley": {
    "w": 18.1,
    "p": -74.15,
    "r": 188
  },
  "R Short|Towcester": {
    "w": 14.0,
    "p": -62.42,
    "r": 185
  },
  "R Taberner|Monmore": {
    "w": 19.4,
    "p": -1844.42,
    "r": 8073
  },
  "R Thompson|PelawGrange": {
    "w": 13.3,
    "p": -7.13,
    "r": 15
  },
  "R Thompson|Sunderland": {
    "w": 13.6,
    "p": -829.5,
    "r": 2712
  },
  "R W Butler|CentralPark": {
    "w": 15.1,
    "p": -1037.01,
    "r": 4070
  },
  "R W Liddington|Towcester": {
    "w": 10.6,
    "p": -46.38,
    "r": 179
  },
  "R Williams|DunstallPark": {
    "w": 17.1,
    "p": -197.14,
    "r": 667
  },
  "R Williams|PerryBarr": {
    "w": 16.6,
    "p": -888.66,
    "r": 3336
  },
  "S A Aveline|DunstallPark": {
    "w": 17.3,
    "p": -58.37,
    "r": 196
  },
  "S A Aveline|PerryBarr": {
    "w": 18.3,
    "p": -320.4,
    "r": 1526
  },
  "S A Birks|Doncaster": {
    "w": 18.2,
    "p": -752.28,
    "r": 2983
  },
  "S A Cahill|Hove": {
    "w": 19.6,
    "p": -1745.18,
    "r": 7566
  },
  "S A Clark|Harlow": {
    "w": 17.4,
    "p": -678.83,
    "r": 3018
  },
  "S A Clark|SuffolkDowns": {
    "w": 20.8,
    "p": -78.59,
    "r": 606
  },
  "S A Howard|Swindon": {
    "w": 30.8,
    "p": 16.0,
    "r": 26
  },
  "S A Howard|TheValley": {
    "w": 30.6,
    "p": -54.0,
    "r": 314
  },
  "S A Maxwell|PelawGrange": {
    "w": 20.2,
    "p": -14.31,
    "r": 99
  },
  "S A Saberton|Harlow": {
    "w": 22.4,
    "p": -1466.23,
    "r": 7212
  },
  "S Anderson|Newcastle": {
    "w": 17.4,
    "p": -425.23,
    "r": 1733
  },
  "S Atkinson|Doncaster": {
    "w": 15.5,
    "p": -33.82,
    "r": 193
  },
  "S Atkinson|DunstallPark": {
    "w": 14.9,
    "p": -35.94,
    "r": 175
  },
  "S Atkinson|Henlow": {
    "w": 13.7,
    "p": -218.97,
    "r": 497
  },
  "S Atkinson|Nottingham": {
    "w": 14.8,
    "p": -89.38,
    "r": 338
  },
  "S Atkinson|PelawGrange": {
    "w": 21.3,
    "p": -71.94,
    "r": 249
  },
  "S Atkinson|PerryBarr": {
    "w": 18.3,
    "p": -118.86,
    "r": 524
  },
  "S Atkinson|TheValley": {
    "w": 21.8,
    "p": -30.04,
    "r": 202
  },
  "S Atkinson|Towcester": {
    "w": 18.1,
    "p": -172.53,
    "r": 562
  },
  "S C Oxley|Sheffield": {
    "w": 17.8,
    "p": -211.9,
    "r": 741
  },
  "S Caile|Newcastle": {
    "w": 18.9,
    "p": -793.69,
    "r": 3162
  },
  "S Clayton|Yarmouth": {
    "w": 32.9,
    "p": -8.0,
    "r": 140
  },
  "S Davies|Sheffield": {
    "w": 14.0,
    "p": -49.52,
    "r": 136
  },
  "S G Tighe|Newcastle": {
    "w": 20.1,
    "p": -201.17,
    "r": 1240
  },
  "S G Tighe|PelawGrange": {
    "w": 34.0,
    "p": 13.49,
    "r": 156
  },
  "S Gaughan|Towcester": {
    "w": 24.0,
    "p": -101.2,
    "r": 629
  },
  "S H Fletcher|Henlow": {
    "w": 20.0,
    "p": -50.51,
    "r": 115
  },
  "S H Fletcher|Towcester": {
    "w": 16.7,
    "p": -17.17,
    "r": 42
  },
  "S Harms|Towcester": {
    "w": 29.6,
    "p": 36.11,
    "r": 108
  },
  "S J Ballard|Yarmouth": {
    "w": 18.3,
    "p": -55.71,
    "r": 191
  },
  "S J Cull|DunstallPark": {
    "w": 7.8,
    "p": -117.42,
    "r": 192
  },
  "S J Cull|PerryBarr": {
    "w": 14.2,
    "p": -271.32,
    "r": 1110
  },
  "S J L Lapidge|Doncaster": {
    "w": 18.8,
    "p": -151.59,
    "r": 670
  },
  "S J L Lapidge|Oxford": {
    "w": 21.8,
    "p": 0.99,
    "r": 252
  },
  "S J L Lapidge|Towcester": {
    "w": 18.2,
    "p": -16.08,
    "r": 55
  },
  "S J Pedder|Nottingham": {
    "w": 16.4,
    "p": -167.11,
    "r": 493
  },
  "S J Rayner|Towcester": {
    "w": 19.3,
    "p": -550.55,
    "r": 3096
  },
  "S J Roberts|Towcester": {
    "w": 12.3,
    "p": -116.44,
    "r": 260
  },
  "S J Spillane|Nottingham": {
    "w": 16.3,
    "p": -752.45,
    "r": 2374
  },
  "S J Storrie|PelawGrange": {
    "w": 18.3,
    "p": -47.06,
    "r": 246
  },
  "S Knights|Yarmouth": {
    "w": 15.7,
    "p": -284.45,
    "r": 1010
  },
  "S L Newberry|PerryBarr": {
    "w": 22.0,
    "p": 16.33,
    "r": 132
  },
  "S L Thompson|Towcester": {
    "w": 18.4,
    "p": -23.79,
    "r": 168
  },
  "S Linley|Sunderland": {
    "w": 16.7,
    "p": -1659.51,
    "r": 5791
  },
  "S M Buckland|Monmore": {
    "w": 18.0,
    "p": -82.66,
    "r": 445
  },
  "S M Horner|Kinsley": {
    "w": 19.6,
    "p": -12.08,
    "r": 56
  },
  "S M Hughes|Swindon": {
    "w": 13.2,
    "p": -467.28,
    "r": 1291
  },
  "S M Johnson|Swindon": {
    "w": 39.1,
    "p": 4.04,
    "r": 23
  },
  "S M Johnson|Towcester": {
    "w": 27.0,
    "p": -6.0,
    "r": 37
  },
  "S Manthorpe|Yarmouth": {
    "w": 21.6,
    "p": -27.75,
    "r": 278
  },
  "S Maplesden|Hove": {
    "w": 17.6,
    "p": -1508.94,
    "r": 5914
  },
  "S Mavrias|CentralPark": {
    "w": 16.3,
    "p": -1439.97,
    "r": 4715
  },
  "S Mcdonald|Swindon": {
    "w": 17.8,
    "p": -542.83,
    "r": 2109
  },
  "S Moore|Nottingham": {
    "w": 21.6,
    "p": -1.38,
    "r": 51
  },
  "S Naylor|Sheffield": {
    "w": 18.8,
    "p": -327.85,
    "r": 1239
  },
  "S Oakes|Kinsley": {
    "w": 18.1,
    "p": -186.5,
    "r": 933
  },
  "S P White|TheValley": {
    "w": 42.0,
    "p": 2.49,
    "r": 50
  },
  "S R Bennett|Doncaster": {
    "w": 18.9,
    "p": -135.13,
    "r": 439
  },
  "S R Gresham|Oxford": {
    "w": 15.9,
    "p": -28.45,
    "r": 63
  },
  "S R Gresham|Swindon": {
    "w": 21.9,
    "p": -82.76,
    "r": 484
  },
  "S R Miller|PelawGrange": {
    "w": 17.9,
    "p": -41.22,
    "r": 112
  },
  "S R Parker|Doncaster": {
    "w": 20.6,
    "p": -523.36,
    "r": 2606
  },
  "S R Parker|Sheffield": {
    "w": 21.3,
    "p": -29.91,
    "r": 178
  },
  "S R Pilgrim|Oxford": {
    "w": 19.5,
    "p": -12.17,
    "r": 77
  },
  "S R Pilgrim|Swindon": {
    "w": 13.6,
    "p": -307.7,
    "r": 1042
  },
  "S R Pilgrim|TheValley": {
    "w": 3.7,
    "p": -22.0,
    "r": 27
  },
  "S R Thorogood|Kinsley": {
    "w": 32.0,
    "p": 10.63,
    "r": 25
  },
  "S Ray|Newcastle": {
    "w": 17.2,
    "p": -1460.82,
    "r": 6816
  },
  "S Roberts|Newcastle": {
    "w": 15.5,
    "p": -1160.51,
    "r": 3773
  },
  "S Roberts|PelawGrange": {
    "w": 14.8,
    "p": -12.0,
    "r": 27
  },
  "S Smith|Kinsley": {
    "w": 16.0,
    "p": -505.48,
    "r": 1963
  },
  "S W Deakin|DunstallPark": {
    "w": 19.2,
    "p": -198.42,
    "r": 1092
  },
  "S W Deakin|Nottingham": {
    "w": 15.6,
    "p": -588.1,
    "r": 2378
  },
  "S W Deakin|PerryBarr": {
    "w": 17.3,
    "p": -1594.11,
    "r": 5848
  },
  "S W L Chappell|Swindon": {
    "w": 16.0,
    "p": -100.86,
    "r": 324
  },
  "S W L Chappell|TheValley": {
    "w": 22.4,
    "p": -26.93,
    "r": 286
  },
  "S Watson|Doncaster": {
    "w": 26.4,
    "p": -572.28,
    "r": 3157
  },
  "T Batchelor|Crayford": {
    "w": 17.3,
    "p": -462.34,
    "r": 1823
  },
  "T Batchelor|Romford": {
    "w": 14.2,
    "p": -261.08,
    "r": 730
  },
  "T Bedford|Sheffield": {
    "w": 14.3,
    "p": -898.62,
    "r": 2622
  },
  "T C Heilbron|Newcastle": {
    "w": 21.0,
    "p": -104.18,
    "r": 1144
  },
  "T D Coote|Kinsley": {
    "w": 18.4,
    "p": -545.86,
    "r": 2561
  },
  "T D Coote|Sheffield": {
    "w": 17.3,
    "p": -797.3,
    "r": 2841
  },
  "T G Edgar|Newcastle": {
    "w": 15.6,
    "p": -961.49,
    "r": 4331
  },
  "T Hudson|PerryBarr": {
    "w": 12.2,
    "p": -15.6,
    "r": 49
  },
  "T J Dornan|Crayford": {
    "w": 18.9,
    "p": -324.2,
    "r": 1346
  },
  "T J Dornan|Hove": {
    "w": 21.8,
    "p": -38.2,
    "r": 133
  },
  "T J Nevin|Harlow": {
    "w": 15.8,
    "p": -57.59,
    "r": 171
  },
  "T J Nevin|Henlow": {
    "w": 16.6,
    "p": -267.03,
    "r": 1190
  },
  "T J Nevin|Oxford": {
    "w": 17.7,
    "p": -1781.77,
    "r": 6316
  },
  "T J Nevin|Towcester": {
    "w": 10.5,
    "p": -7.75,
    "r": 19
  },
  "T Jameson|PelawGrange": {
    "w": 18.7,
    "p": -45.67,
    "r": 144
  },
  "T Kibble|Oxford": {
    "w": 15.1,
    "p": -505.77,
    "r": 1637
  },
  "T Kibble|Swindon": {
    "w": 14.6,
    "p": -493.25,
    "r": 1484
  },
  "T M Goodyear|Yarmouth": {
    "w": 17.3,
    "p": -49.94,
    "r": 168
  },
  "T M Levers|CentralPark": {
    "w": 17.7,
    "p": -149.78,
    "r": 577
  },
  "T M Levers|Crayford": {
    "w": 19.1,
    "p": -640.24,
    "r": 2712
  },
  "T M Levers|Oxford": {
    "w": 18.2,
    "p": -241.57,
    "r": 923
  },
  "T Parkinson|Harlow": {
    "w": 13.6,
    "p": -25.2,
    "r": 44
  },
  "T Robinson|PelawGrange": {
    "w": 21.9,
    "p": -4.67,
    "r": 32
  },
  "T S Welch|Harlow": {
    "w": 17.5,
    "p": -118.47,
    "r": 400
  },
  "T S Welch|Romford": {
    "w": 17.7,
    "p": -134.78,
    "r": 685
  },
  "T Simmons|Henlow": {
    "w": 10.0,
    "p": -7.13,
    "r": 10
  },
  "V A Lea|Henlow": {
    "w": 11.1,
    "p": -4.0,
    "r": 18
  },
  "V A Lea|Monmore": {
    "w": 16.9,
    "p": -443.51,
    "r": 1867
  },
  "V A Lea|Towcester": {
    "w": 16.3,
    "p": -708.94,
    "r": 2643
  },
  "V J Lund|PelawGrange": {
    "w": 25.2,
    "p": -8.25,
    "r": 115
  },
  "V K Thom|Yarmouth": {
    "w": 14.2,
    "p": -961.4,
    "r": 3086
  },
  "V L Clark|Doncaster": {
    "w": 20.3,
    "p": -649.97,
    "r": 2437
  },
  "W Brown|Sheffield": {
    "w": 2.8,
    "p": -32.75,
    "r": 36
  },
  "W C Munden|Towcester": {
    "w": 12.7,
    "p": -120.95,
    "r": 316
  },
  "W E Link|Doncaster": {
    "w": 15.5,
    "p": -195.73,
    "r": 534
  },
  "W E Smith|Kinsley": {
    "w": 14.8,
    "p": -161.8,
    "r": 535
  },
  "W Finley|Newcastle": {
    "w": 17.4,
    "p": -480.92,
    "r": 1860
  },
  "W M Lyons|Kinsley": {
    "w": 16.5,
    "p": -2948.71,
    "r": 13043
  },
  "W M Scoles|Henlow": {
    "w": 16.7,
    "p": -18.72,
    "r": 54
  },
  "W M Scoles|SuffolkDowns": {
    "w": 15.8,
    "p": -119.3,
    "r": 469
  },
  "W Russell|Monmore": {
    "w": 15.2,
    "p": -72.16,
    "r": 217
  },
  "W Russell|PerryBarr": {
    "w": 17.3,
    "p": -258.74,
    "r": 945
  },
  "W Sheldon|PelawGrange": {
    "w": 23.1,
    "p": -1.22,
    "r": 78
  }
};
  const _DEFAULTS         = {
    nRuns: 5,
    // Weights from 119-race correlation analysis (2026-05-14)
    // Sectional +0.116 (strongest), Speed +0.107, Rating +0.083, Clean Run +0.046
    // Trap -0.126, Grade -0.145, Trend -0.023, Momentum -0.013 → zeroed
    wSpeed: 28, wRating: 22, wSectional: 30, wConsistency: 2,
    wGrade: 0, wTrapAffinity: 0, wTrend: 0, wCleanRun: 10, wMomentum: 0, wTrainer: 8,
    distanceFilter: true, decayWeighting: true,
    sidebarPos: 'right'
  };

  const _TRACK_MAP = {
    'new':'Newcastle',   'newcastle':'Newcastle',
    'she':'Sheffield',   'sheffield':'Sheffield',
    'rom':'Romford',     'romford':'Romford',
    'hov':'Hove',        'hove':'Hove',
    'mon':'Monmore',     'monmore':'Monmore',
    'tow':'Towcester',   'towcester':'Towcester',
    'har':'Harlow',      'harlow':'Harlow',
    'not':'Nottingham',  'nottingham':'Nottingham',
    'kin':'Kinsley',     'kinsley':'Kinsley',
    'yar':'Yarmouth',    'yarmouth':'Yarmouth',
    'sun':'Sunderland',  'sunderland':'Sunderland',
    'pla':'PelawGrange', 'pelawgrange':'PelawGrange',
    // 'Star Pelaw' → first-6 = 'starpe', also catch 'star' and full name
    'sta':'StarPelaw',   'starpe':'StarPelaw', 'starpelaw':'StarPelaw', 'starpelaw':'StarPelaw',
    'val':'TheValley',   'thevalley':'TheValley',  'valley':'TheValley',
    // 'Dunstall Park' → first-6 = 'dunsta', also full key
    'dun':'DunstallPark','dunsta':'DunstallPark','dunstallpark':'DunstallPark','dunstall':'DunstallPark',
    'don':'Doncaster',   'doncaster':'Doncaster',
    'oxf':'Oxford',      'oxford':'Oxford',
    // 'Central Park' → first-6 = 'centra', also full key
    'cen':'CentralPark', 'centra':'CentralPark', 'centralpark':'CentralPark', 'central':'CentralPark',
    'suf':'SuffolkDowns','suffolkdowns':'SuffolkDowns','suffolk':'SuffolkDowns',
    'swi':'Swindon',     'swindon':'Swindon',
    'cra':'Crayford',    'crayford':'Crayford',
    'hen':'Henlow',      'henlow':'Henlow',
    'per':'PerryBarr',   'perrybarr':'PerryBarr',
  };

  function _normaliseTrack(raw) {
    if (!raw) return null;
    const stripped = raw.toLowerCase().replace(/[\s\-_]/g,'');
    const key6     = stripped.slice(0,6);
    // Resolve via TRACK_MAP (short slug, 6-char prefix, or full stripped name)
    const resolved = _TRACK_MAP[key6] || _TRACK_MAP[stripped] || _TRACK_MAP[raw.toLowerCase().replace(/\s/g,'')] || null;
    // Alias: StarPelaw is the same venue as PelawGrange (different display name from scraper)
    if (resolved === 'StarPelaw') return 'PelawGrange';
    return resolved;
  }

  function _avg(arr) {
    const v = arr.filter(x => x != null && !isNaN(x));
    return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
  }
  function _wavg(arr) {
    const v = arr.filter(x => x != null && !isNaN(x));
    if (!v.length) return null;
    let ws=0,wt=0; v.forEach((x,i)=>{const w=Math.pow(0.85,i);ws+=x*w;wt+=w;});
    return wt>0?ws/wt:null;
  }
  function _stdDev(arr) {
    const v=arr.filter(x=>x!=null&&!isNaN(x));
    if(v.length<2)return null;
    const m=_avg(v),sd=Math.sqrt(v.map(x=>(x-m)**2).reduce((a,b)=>a+b,0)/v.length);
    return sd;
  }
  function _rankScore(vals, dir='desc') {
    const valid=vals.map((v,i)=>({v,i})).filter(x=>x.v!=null&&!isNaN(x.v));
    if(!valid.length)return vals.map(()=>null);
    const sorted=[...valid].sort((a,b)=>dir==='desc'?b.v-a.v:a.v-b.v);
    const result=Array(vals.length).fill(null);
    sorted.forEach((x,rank)=>{result[x.i]= valid.length>1 ? 1-rank/(valid.length-1) : 1;});
    return result;
  }
  function _gradeVal(g) {
    const m=g&&g.match(/([AD])(\d+)/);return m?parseInt(m[2]):null;
  }
  function _parseDist(s) {
    const m=s&&s.match(/(\d+)m/);return m?parseInt(m[1]):null;
  }
  function _trainerEdge(name, trackKey) {
    if (!name||!trackKey) return null;
    const norm = name.trim().replace(/\s+/g,' ');
    const exactKey = norm+'|'+trackKey;
    if (_TRAINER_DATA[exactKey]) return _TRAINER_DATA[exactKey];
    const noApos = norm.replace(/'/g,'');
    if (_TRAINER_DATA[noApos+'|'+trackKey]) return _TRAINER_DATA[noApos+'|'+trackKey];
    return null;
  }
  function _parTimeDelta(runs, trackKey, grade, n, raceDist) {
    const par = trackKey&&grade ? _PAR_TIMES[trackKey]?.[grade] : null;
    if (!par) return null;
    const same = runs.filter(r=>r.distM&&raceDist&&Math.abs(r.distM-raceDist)<=15).slice(0,n);
    const times = same.map(r=>r.tfTime).filter(v=>v&&v>0);
    if (!times.length) return null;
    const avgT = _wavg(times);
    return avgT!=null ? +(par-avgT).toFixed(3) : null;
  }
  function _chesterRating(trackKey, grade) {
    return trackKey&&grade ? (_CHESTER_RATINGS[trackKey]?.[grade]??null) : null;
  }

  // Conditions where the model has demonstrated no reliable edge (from backtest analysis).
  // BET signals are suppressed for these — they contribute negative ROI regardless of EV/margin.
  const _NO_EDGE_VENUES   = new Set(['Monmore', 'Harlow', 'Yarmouth']);
  const _NO_EDGE_DISTANCES = new Set(['480m', '400m', '264m', '270m']);
  const _NO_EDGE_GRADES   = /^D|^S|^HP/i;   // D/S/HP grades: model r≈0.03 vs won, near-random

  function _hasEdge(raceInfo) {
    const venue = (raceInfo?.track || '').trim();
    const dist  = (raceInfo?.distance || '').trim();
    const grade = (raceInfo?.grade || '').trim();
    if (_NO_EDGE_VENUES.has(venue))    return false;
    if (_NO_EDGE_DISTANCES.has(dist))  return false;
    if (_NO_EDGE_GRADES.test(grade))   return false;
    return true;
  }

  function scoreScraperDogs(dogs, raceInfo) {
    const n        = _DEFAULTS.nRuns || 10;
    const trackKey = raceInfo.trackKey || _normaliseTrack(raceInfo.track) || null;
    const grade    = raceInfo.grade || null;
    const raceDist = _parseDist(raceInfo.distance);

    const W = {
      speed:      _DEFAULTS.wSpeed      ?? 28,
      rating:     _DEFAULTS.wRating     ?? 22,
      sectional:  _DEFAULTS.wSectional  ?? 30,
      consistency:_DEFAULTS.wConsistency?? 2,
      cleanRun:   _DEFAULTS.wCleanRun   ?? 10,
      trainer:    _DEFAULTS.wTrainer    ?? 8,
      grade:      _DEFAULTS.wGrade      ?? 0,
      trap:       _DEFAULTS.wTrapAffinity??0,
      trend:      _DEFAULTS.wTrend      ?? 0,
      momentum:   _DEFAULTS.wMomentum   ?? 0,
    };
    const totalW = Object.values(W).reduce((a,b)=>a+b,0);

    // Compute per-dog stats
    const stats = dogs.map(dog => {
      const runs   = (dog._runs||dog.runs||[]);
      const recent = runs.slice(0, n);
      const sameDist = raceDist ? runs.filter(r=>r.distM&&Math.abs(r.distM-raceDist)<=15) : runs;
      const recentD  = sameDist.slice(0, n);

      const rtgs  = recent.map(r=>r.rtg).filter(v=>v&&v>0);
      const secs  = recent.map(r=>r.secRtg).filter(v=>v&&v>0);
      const times = recentD.map(r=>r.tfTime).filter(v=>v&&v>0);
      const fins  = recent.map(r=>r.finPos).filter(v=>v&&v>0);
      const gains = recent.filter(r=>r.bendData).map(r=>r.bendData.gain);
      const cleans= recent.filter(r=>r.runType==='clean'||r.runType==='fast_start').length;

      const avgRtg    = _wavg(rtgs);
      const avgSecRtg = _wavg(secs);  // decay-weighted, consistent with avgRtg
      const ptd       = _parTimeDelta(runs, trackKey, grade, n, raceDist);
      const avgTime   = _avg(times);  // fallback if no par
      const consist   = _stdDev(fins);
      const cleanRate = recent.length ? (cleans/recent.length)*100 : null;
      const momentum  = _avg(gains);

      // Grade suitability
      const curRating = _chesterRating(trackKey, grade);
      const recentRtgs = recent.map(r=>{
        const rk=_normaliseTrack(r.track);
        return rk&&r.grade?(_CHESTER_RATINGS[rk]?.[r.grade]??null):null;
      }).filter(v=>v!=null);
      const gradeSuit = curRating!=null&&recentRtgs.length>0 ? _avg(recentRtgs)-curRating : null;

      // Trap affinity
      const structural = trackKey&&dog.trap ? _TRAP_BIAS[trackKey]?.[dog.trap]??null : null;
      const personal   = (()=>{
        const ta=runs.filter(r=>r.trapPos===dog.trap);
        return ta.length?(ta.filter(r=>r.finPos===1).length/ta.length)*100:null;
      })();
      const trapWin = structural ?? personal;

      // Form trend
      const allRtgs = runs.map(r=>r.rtg).filter(v=>v&&v>0);
      const trend   = (_avg(allRtgs.slice(0,3))!=null&&_avg(allRtgs.slice(3,6))!=null)
                    ? _avg(allRtgs.slice(0,3))-_avg(allRtgs.slice(3,6)) : null;

      // Trainer edge
      const te = _trainerEdge(dog.trainerName, trackKey);
      const trainerScore = te ? (te.p>0 ? Math.min(100,Math.max(0,te.w)) : 0) : null;

      return {avgRtg, avgSecRtg, ptd, avgTime, consist, cleanRate, momentum,
               gradeSuit, trapWin, trend, trainerScore};
    });

    // Rank each component across field
    const rRtg    = _rankScore(stats.map(s=>s.avgRtg),     'desc');
    const rSec    = _rankScore(stats.map(s=>s.avgSecRtg),  'desc');
    // Speed: use par-time-delta if available (positive = faster), else avg time (lower = faster)
    const hasPtd  = stats.some(s=>s.ptd!=null);
    const rSpd    = hasPtd
      ? _rankScore(stats.map(s=>s.ptd),     'desc')
      : _rankScore(stats.map(s=>s.avgTime), 'asc');
    const rCons   = _rankScore(stats.map(s=>s.consist),     'asc');   // lower stddev = better
    const rClean  = _rankScore(stats.map(s=>s.cleanRate),   'desc');
    const rTrain  = _rankScore(stats.map(s=>s.trainerScore),'desc');
    const rGrade  = _rankScore(stats.map(s=>s.gradeSuit),   'desc');
    const rTrap   = _rankScore(stats.map(s=>s.trapWin),     'desc');
    const rTrend  = _rankScore(stats.map(s=>s.trend),       'desc');
    const rMom    = _rankScore(stats.map(s=>s.momentum),    'desc');

    return dogs.map((dog, i) => {
      const s = stats[i];
      const score = (
        (rRtg[i]  ??0.5)*W.rating    +
        (rSpd[i]  ??0.5)*W.speed     +
        (rSec[i]  ??0.5)*W.sectional +
        (rCons[i] ??0.5)*W.consistency+
        (rClean[i]??0.5)*W.cleanRun  +
        (rTrain[i]??0.5)*W.trainer   +
        (rGrade[i]??0.5)*W.grade     +
        (rTrap[i] ??0.5)*W.trap      +
        (rTrend[i]??0.5)*W.trend     +
        (rMom[i]  ??0.5)*W.momentum
      ) / totalW * 100;

      // Full component breakdown — matches exportBacktestCSV's dog.breakdown reads
      const breakdown = {
        speed:       { rankScore: rSpd[i]   ?? null, pts: rSpd[i]   != null ? +(rSpd[i]   * W.speed).toFixed(2)        : null },
        rating:      { rankScore: rRtg[i]   ?? null, pts: rRtg[i]   != null ? +(rRtg[i]   * W.rating).toFixed(2)       : null },
        sectional:   { rankScore: rSec[i]   ?? null, pts: rSec[i]   != null ? +(rSec[i]   * W.sectional).toFixed(2)    : null },
        consistency: { rankScore: rCons[i]  ?? null, pts: rCons[i]  != null ? +(rCons[i]  * W.consistency).toFixed(2)  : null },
        trapAffinity:{ rankScore: rTrap[i]  ?? null, pts: rTrap[i]  != null ? +(rTrap[i]  * W.trap).toFixed(2)         : null },
        trend:       { rankScore: rTrend[i] ?? null, pts: rTrend[i] != null ? +(rTrend[i] * W.trend).toFixed(2)        : null },
        grade:       { rankScore: rGrade[i] ?? null, pts: rGrade[i] != null ? +(rGrade[i] * W.grade).toFixed(2)        : null },
        cleanRun:    { rankScore: rClean[i] ?? null, pts: rClean[i] != null ? +(rClean[i] * W.cleanRun).toFixed(2)     : null },
        momentum:    { rankScore: rMom[i]   ?? null, pts: rMom[i]   != null ? +(rMom[i]   * W.momentum).toFixed(2)     : null },
        trainer:     { rankScore: rTrain[i] ?? null, pts: rTrain[i] != null ? +(rTrain[i] * W.trainer).toFixed(2)      : null },
      };

      // Determine trap source for export
      const trapSource = (() => {
        const structural = trackKey && dog.trap ? _TRAP_BIAS[trackKey]?.[dog.trap] ?? null : null;
        return structural != null ? 'structural' : 'personal';
      })();

      // Trainer edge object for export
      const te = _trainerEdge(dog.trainerName, trackKey);
      const trainerEdge = te ? { pnl: te.p, winPct: te.w } : null;

      // nRuns used / same-dist count
      const runs     = (dog._runs || dog.runs || []);
      const recent   = runs.slice(0, n);
      const sameDist = raceDist ? runs.filter(r => r.distM && Math.abs(r.distM - raceDist) <= 15) : runs;
      const nUsed    = recent.length;
      const sameDistCount = sameDist.length;

      // Confidence: fraction of components that had real data (not null → defaulted to 0.5)
      const activeComponents = [rRtg[i], rSpd[i], rSec[i], rCons[i], rClean[i], rTrain[i]];
      const confidence = Math.round((activeComponents.filter(v => v != null).length / activeComponents.length) * 100);

      return {
        ...dog,
        score:        Math.round(score),
        forecast:     dog.forecast || null,
        // Raw stats — populated so exportBacktestCSV columns are non-empty
        avgTFTime:    s.avgTime    ?? null,
        parTimeDelta: s.ptd        ?? null,
        avgRtg:       s.avgRtg     ?? null,
        avgSecRtg:    s.avgSecRtg  ?? null,
        consistency:  s.consist    ?? null,
        trapWinPct:   s.trapWin    ?? null,
        trapSource,
        trend:        s.trend      ?? null,
        gradeSuit:    s.gradeSuit  ?? null,
        cleanRunRate: s.cleanRate  ?? null,
        avgMomentum:  s.momentum   ?? null,
        trainerEdge,
        nUsed,
        sameDistCount,
        confidence,
        // Full component breakdown for weight analysis
        breakdown,
      };
    });
  }

  // ── Load all outcomes + pending race records ─────────────
  // Also imports today's pre-scraped races from localhost:7329
  // so the tracker is populated without visiting each racecard.
  function loadAllOutcomes(cb) {

    function buildDashboardData(items) {
      const outcomes = Object.entries(items)
        .filter(([k]) => k.startsWith('outcome:'))
        .map(([, v]) => v)
        .sort((a, b) => (b.racedAt || b.timestamp) - (a.racedAt || a.timestamp));

      const raceRecords = {};
      Object.entries(items)
        .filter(([k]) => k.startsWith('race:'))
        .forEach(([k, v]) => { raceRecords[v.raceId] = v; });

      // Re-score any _fromScraper records where dogs have null scores OR null forecasts
      // (imported before scoreScraperDogs or forecast extraction was available)
      const rescoreUpdates = {};
      Object.values(raceRecords).forEach(rec => {
        if (!rec._fromScraper) return;
        const needsScore = (rec.dogs || []).some(d =>
          (d.score == null || d.forecast == null) && d._runs?.length > 0
        );
        if (!needsScore) return;
        const scored = scoreScraperDogs(rec.dogs, rec.raceInfo || {});
        rescoreUpdates[`race:${rec.raceId}`] = { ...rec, dogs: scored };
        raceRecords[rec.raceId] = { ...rec, dogs: scored };
      });
      if (Object.keys(rescoreUpdates).length > 0) {
        chrome.storage.local.set(rescoreUpdates);  // async, fire-and-forget
      }

      const outcomeIds = new Set(outcomes.map(o => o.raceId));
      const pending = Object.values(raceRecords)
        .filter(r => !outcomeIds.has(r.raceId))
        .sort((a, b) => (a.racedAt || a.timestamp) - (b.racedAt || b.timestamp));

      cb(outcomes, pending, raceRecords);
    }

    // Fetch scraper data via background service worker — content scripts
    // cannot connect to localhost directly (blocked by Timeform's page CSP).
    // The background worker is exempt from page CSPs.
    chrome.runtime.sendMessage({ type: 'FETCH_SCRAPER_DATA' }, response => {
      const data = response?.ok ? response.data : null;

      if (!data || !data._races || !data._races.length) {
        // No scraper data available — use storage only, but still try to auto-settle
        return chrome.storage.local.get(null, items => {
          buildDashboardData(items);
          autoSettleFromScraper(items);
        });
      }

      // Import any races not already in storage
      chrome.storage.local.get(null, items => {
        const toWrite = {};
        let imported = 0;

        data._races.forEach(race => {
          const raceId = race.raceId;
          if (!raceId) return;

          // Skip if already imported AND has forecast data on top dog
          const existing = items[`race:${raceId}`];
          if (existing) {
            const topDog = (existing.dogs || []).find(d => d.score != null);
            // Re-import if forecast is missing — picks up newly scraped forecast data
            if (topDog?.forecast?.impliedPct != null) return;
          }

          // Build dog list with run history
          const rawDogs = (race.dogs || []).map(dog => {
            const hist = dog.dogId && data[dog.dogId];
            const runs = hist ? hist.runs : (dog.runs || []);
            return {
              name:        dog.name,
              trap:        dog.trap,
              trainerName: dog.trainerName || null,
              score:       null,
              forecast:    dog.forecast || null,  // from scraper racecard extract
              _runs:       runs,
              dogId:       dog.dogId,
            };
          });
          // Score inline using run history — gives margin/ranking without racecard visit
          const dogs = rawDogs.some(d => d._runs?.length > 0)
            ? scoreScraperDogs(rawDogs, race.raceInfo || {})
            : rawDogs;

          const timeMatch = (race.url || '').match(/\/(\d{4})\//);
          const timeStr   = timeMatch
            ? timeMatch[1].slice(0,2) + ':' + timeMatch[1].slice(2)
            : race.time || '';

          toWrite[`race:${raceId}`] = {
            raceId,
            url:      race.url,
            raceInfo: {
              track:    race.raceInfo?.track || race.track || '',
              grade:    race.raceInfo?.grade || '',
              distance: race.raceInfo?.distance || '',
              time:     timeStr,
              trackKey: race.raceInfo?.trackKey || _normaliseTrack(race.raceInfo?.track || race.track || '') || '',
            },
            timestamp:    data._meta?.fetchedAt || Date.now(),
            dogs,
            weights: {
              wSpeed:       _DEFAULTS.wSpeed       ?? 28,
              wRating:      _DEFAULTS.wRating      ?? 22,
              wSectional:   _DEFAULTS.wSectional   ?? 30,
              wConsistency: _DEFAULTS.wConsistency ?? 2,
              wTrapAffinity:_DEFAULTS.wTrapAffinity?? 0,
              wTrend:       _DEFAULTS.wTrend       ?? 0,
              wGrade:       _DEFAULTS.wGrade       ?? 0,
              wCleanRun:    _DEFAULTS.wCleanRun    ?? 10,
              wMomentum:    _DEFAULTS.wMomentum    ?? 0,
              wTrainer:     _DEFAULTS.wTrainer     ?? 8,
            },
            _fromScraper: true,
          };
          imported++;
        });

        if (imported > 0) {
          chrome.storage.local.set(toWrite, () => {
            console.log(`[TFE Tracker] Imported ${imported} races from morning scraper`);
            chrome.storage.local.get(null, items => {
              buildDashboardData(items);
              autoSettleFromScraper(items);
            });
          });
        } else {
          chrome.storage.local.get(null, items => {
            buildDashboardData(items);
            autoSettleFromScraper(items);
          });
        }
      });
    });
  }

  // ── Auto-settle from results scraper ──────────────────────────────────────
  // Fetches results_{date}.json from localhost:7329, matches each finished race
  // to its race: record in storage, builds an outcome via buildOutcome(), and
  // saves it — exactly as if the user had visited each result page manually.
  function autoSettleFromScraper(storageItems) {
    const today = new Date().toISOString().slice(0, 10);
    chrome.runtime.sendMessage({ type: 'FETCH_RESULTS_DATA', date: today }, response => {
      if (!response?.ok || !response.data?.results?.length) {
        console.log('[TFE Settle] No results file found for', today, '— is server running?');
        return;
      }

      const results = response.data.results;
      console.log('[TFE Settle] Results file loaded:', results.length, 'races');

      // Log what raceIds are in storage vs results file
      const storageRaceIds = Object.keys(storageItems).filter(k => k.startsWith('race:')).map(k => k.replace('race:',''));
      const resultRaceIds  = results.map(r => r.raceId);
      console.log('[TFE Settle] Storage race IDs:', storageRaceIds.slice(0,5), '...');
      console.log('[TFE Settle] Results race IDs:', resultRaceIds.slice(0,5), '...');
      const matched = resultRaceIds.filter(id => storageRaceIds.includes(id));
      console.log('[TFE Settle] Matched IDs:', matched.length, 'of', resultRaceIds.length);

      const toSave = {};
      let settled  = 0;
      let skipped  = 0;

      results.forEach(result => {
        const raceId  = result.raceId;
        const runners = result.runners;
        if (!raceId || !runners?.length) { skipped++; return; }

        const raceRecord = storageItems[`race:${raceId}`];
        if (!raceRecord) { console.log('[TFE Settle] No race record for', raceId); skipped++; return; }
        if (!raceRecord.dogs?.length) { console.log('[TFE Settle] Race record has no dogs:', raceId); skipped++; return; }

        const existing = storageItems[`outcome:${raceId}`];
        if (existing?.bspSettled) { skipped++; return; }

        const outcome = buildOutcome(raceRecord, runners);
        outcome.url                 = result.url || raceRecord.url || '';
        outcome.racecardUrl         = raceRecord.url || '';
        outcome._fromResultsScraper = true;

        if (outcome.winner && outcome.winner !== '?') {
          toSave[`outcome:${raceId}`] = outcome;
          console.log('[TFE Settle] Settling:', raceId, outcome.winner, outcome.topPickWon ? 'WIN' : 'LOSS');
          settled++;
        } else {
          console.log('[TFE Settle] No winner found for:', raceId, 'runners:', runners.map(r=>r.name));
        }
      });

      console.log('[TFE Settle] Total settled:', settled, 'skipped:', skipped);

      if (settled > 0) {
        chrome.storage.local.set(toSave, () => {
          console.log('[TFE Settle] Saved', settled, 'outcomes to storage');
          chrome.storage.local.get(null, buildDashboardData);
        });
      }
    });
  }

  // ── BACKTEST CSV — one row per dog per race ──────────────
  // Includes full component breakdown for regression analysis
  function exportBacktestCSV(outcomes, raceRecords) {
    // Header: race context + dog identity + every component score + actual result
    const headers = [
      // Race context
      'Race ID','Date','Time','Venue','Grade','Distance','TrackKey',
      // Dog identity
      'Dog Name','Trap','Trainer',
      // Final model score & rank in field
      'Model Score','Rank in Field','N Dogs in Race',
      // Raw stats used in scoring
      'Avg TFTime','Par Time Delta','Avg Rtg','Avg SecRtg','Consistency (σ)',
      'Trap Win %','Trap Source','Form Trend','Grade Suit',
      'Clean Run %','Momentum','Trainer Edge PnL','Trainer Edge Win%','Confidence',
      'N Form Rows Used','Same-Dist Rows',
      // Component RANK SCORES (0-1) — these are what get multiplied by weights
      'RS Speed','RS Rating','RS Sectional','RS Consistency','RS Trap',
      'RS Trend','RS Grade','RS Clean','RS Momentum','RS Trainer',
      // Component POINTS (rankScore × weight) — what feeds the total
      'PTS Speed','PTS Rating','PTS Sectional','PTS Consistency','PTS Trap',
      'PTS Trend','PTS Grade','PTS Clean','PTS Momentum','PTS Trainer',
      // Weights used at scoring time
      'W Speed','W Rating','W Sectional','W Consistency','W Trap',
      'W Trend','W Grade','W Clean','W Momentum','W Trainer',
      // Pricing
      'TF Forecast Odds','TF Forecast Implied %','Model Implied %','EV %',
      // Actual result
      'Actual Position','Won','Placed (1-2)','BSP','ISP','Best Price','Price Source','PnL',
      // Top pick flag
      'Was Top Pick','URL'
    ];

    const rows = [];
    outcomes.forEach(outcome => {
      const raceRec = raceRecords[outcome.raceId];
      if (!raceRec) return; // Need original racecard data for component scores

      // Sort dogs by score to determine rank in field
      const sortedDogs = [...raceRec.dogs].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

      // Calculate model implied% (sum of scores normalised to 100%)
      const totalScore = sortedDogs.reduce((s, d) => s + Math.max(d.score ?? 1, 1), 0);

      // Build actual results map — outcome.dogs use actualPos (not pos)
      const actualMap = {};
      (outcome.dogs || []).forEach(d => {
        actualMap[d.name.toUpperCase().trim()] = d;
      });

      // Also try fuzzy matching (strip spaces)
      const actualMapFuzzy = {};
      (outcome.dogs || []).forEach(d => {
        actualMapFuzzy[d.name.toUpperCase().replace(/\s+/g,'')] = d;
      });

      const date = raceDateFromTimestamp(raceRec.racedAt || raceRec.timestamp);
      const time = raceTimeFromUrl(raceRec.url);

      sortedDogs.forEach((dog, rank) => {
        const key = dog.name.toUpperCase().trim();
        const keyFuzzy = key.replace(/\s+/g,'');
        // Match by exact name, then fuzzy
        const actual = actualMap[key] || actualMapFuzzy[keyFuzzy] || null;

        const modelImplied = (Math.max(dog.score ?? 1, 1) / totalScore) * 100;
        const fcImplied = dog.forecast?.impliedPct ?? null;
        const ev = (fcImplied != null) ? +((modelImplied / fcImplied - 1) * 100).toFixed(2) : null;
        const bd = dog.breakdown || {};
        const w = raceRec.weights || {};

        // outcome.dogs use actualPos (not pos) — fix field name
        const actualPosition = actual?.actualPos ?? actual?.pos ?? null;
        const won = actualPosition === 1;
        const placed = actualPosition != null && actualPosition <= 2;

        // BSP/ISP from outcome dog record
        const bestPrice = actual?.bsp ?? actual?.price ?? actual?.isp ?? null;
        const priceSrc  = actual?.bsp ? 'BSP' : (actual?.price || actual?.isp) ? 'ISP' : null;
        const dogPnl    = bestPrice ? (won ? +(bestPrice - 1).toFixed(2) : -1) : (won ? 0 : -1);

        rows.push([
          raceRec.raceId,
          date,
          time,
          cleanVenue(raceRec.raceInfo?.track),
          raceRec.raceInfo?.grade    || '',
          raceRec.raceInfo?.distance || '',
          raceRec.raceInfo?.trackKey || '',
          dog.name,
          dog.trap ?? '',
          dog.trainerName || dog.trainer || '',
          dog.score ?? '',
          rank + 1,
          sortedDogs.length,
          // Raw stats
          dog.avgTFTime    != null ? dog.avgTFTime.toFixed(3)   : '',
          dog.parTimeDelta != null ? dog.parTimeDelta.toFixed(3): '',
          dog.avgRtg       != null ? dog.avgRtg.toFixed(2)      : '',
          dog.avgSecRtg    != null ? dog.avgSecRtg.toFixed(2)   : '',
          dog.consistency  != null ? dog.consistency.toFixed(2) : '',
          dog.trapWinPct   != null ? dog.trapWinPct.toFixed(1)  : '',
          dog.trapSource   || '',
          dog.trend        != null ? dog.trend.toFixed(2)       : '',
          dog.gradeSuit    != null ? dog.gradeSuit.toFixed(2)   : '',
          dog.cleanRunRate != null ? dog.cleanRunRate.toFixed(1): '',
          dog.avgMomentum  != null ? dog.avgMomentum.toFixed(2) : '',
          dog.trainerEdge?.pnl    ?? '',
          dog.trainerEdge?.winPct ?? '',
          dog.confidence   ?? '',
          dog.nUsed        ?? '',
          dog.sameDistCount ?? '',
          // Component rank scores (0-1)
          bd.speed?.rankScore        ?? '',
          bd.rating?.rankScore       ?? '',
          bd.sectional?.rankScore    ?? '',
          bd.consistency?.rankScore  ?? '',
          bd.trapAffinity?.rankScore ?? '',
          bd.trend?.rankScore        ?? '',
          bd.grade?.rankScore        ?? '',
          bd.cleanRun?.rankScore     ?? '',
          bd.momentum?.rankScore     ?? '',
          bd.trainer?.rankScore      ?? '',
          // Component points (rankScore × weight)
          bd.speed?.pts        ?? '',
          bd.rating?.pts       ?? '',
          bd.sectional?.pts    ?? '',
          bd.consistency?.pts  ?? '',
          bd.trapAffinity?.pts ?? '',
          bd.trend?.pts        ?? '',
          bd.grade?.pts        ?? '',
          bd.cleanRun?.pts     ?? '',
          bd.momentum?.pts     ?? '',
          bd.trainer?.pts      ?? '',
          // Weights used
          w.wSpeed ?? '', w.wRating ?? '', w.wSectional ?? '',
          w.wConsistency ?? '', w.wTrapAffinity ?? '',
          w.wTrend ?? '', w.wGrade ?? '',
          w.wCleanRun ?? '', w.wMomentum ?? '', w.wTrainer ?? '',
          // Pricing
          dog.forecast?.oddsStr     ?? '',
          fcImplied != null ? fcImplied.toFixed(2) : '',
          modelImplied.toFixed(2),
          ev != null ? ev : '',
          // Actual result — use actualPosition (outcome.dogs use actualPos not pos)
          actualPosition ?? '',
          won ? 1 : 0,
          placed ? 1 : 0,
          actual?.bsp  ?? '',
          actual?.isp ?? actual?.price ?? '',
          bestPrice    ?? '',
          priceSrc     ?? '',
          dogPnl.toFixed(2),
          // Was this the model's top pick?
          rank === 0 ? 1 : 0,
          outcome.url || raceRec.url || ''
        ]);
      });
    });

    if (!rows.length) {
      alert('No backtest data available yet.\n\nVisit racecards BEFORE races run, then visit the result pages after.\nBoth racecard data AND result data are needed for backtest export.');
      return;
    }

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `tfe_backtest_full_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();

    console.log(`[TFE Tracker] Exported ${rows.length} dog-rows from ${outcomes.length} races`);
  }

  // ── CSV Export ────────────────────────────────────────────
  function exportCSV(outcomes) {
    const headers = [
      'Date','Time','Venue','Grade','Distance',
      'Top Pick','Top Pick Trap','Score','Position','Won','Placed',
      'FC Correct','Price Source','Top Pick Price','Top Pick BSP','Top Pick ISP',
      'Winner','Winner BSP','P&L','Second Pick','N Dogs',
      // Weights used
      'W Speed','W Rating','W Sectional','W Consistency','W Grade',
      'W Trap','W Trend','W Clean Run','W Momentum',
      // Links
      'Result URL','Racecard URL'
    ];
    const rows = outcomes.map(o => {
      const date       = raceDateFromTimestamp(o.racedAt || o.timestamp);
      const time       = raceTimeFromUrl(o.racecardUrl || o.url || '');
      const topDogData = o.dogs?.find(d => d.name === o.topPick);
      const trap       = topDogData?.trap ?? '';
      const w          = o.weights || {};
      return [
        date,
        time,
        cleanVenue(o.raceInfo?.track),
        o.raceInfo?.grade    || '',
        o.raceInfo?.distance || '',
        o.topPick      || '',
        trap,
        o.topScore     ?? '',
        o.topPickPos   ?? '',
        o.topPickWon   ? 1 : 0,
        o.topPickPlaced ? 1 : 0,
        o.fcCorrect    ? 1 : 0,
        o.priceSource  || '',
        o.topPickPrice ?? '',
        o.topPickBSP   ?? '',
        o.topPickISP   ?? '',
        o.winner       || '',
        o.winnerBSP    ?? '',
        o.pnl != null ? o.pnl.toFixed(2) : '',
        o.secondPick   || '',
        o.dogs?.length ?? '',
        w.wSpeed       ?? '',
        w.wRating      ?? '',
        w.wSectional   ?? '',
        w.wConsistency ?? '',
        w.wGrade       ?? '',
        w.wTrapAffinity ?? '',
        w.wTrend       ?? '',
        w.wCleanRun    ?? '',
        w.wMomentum    ?? '',
        o.url          || '',
        o.racecardUrl  || ''
      ];
    });
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `tfe_tracker_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  // ── Dashboard ──────────────────────────────────────────────
  function buildDashboard(outcomes, pendingRaces = [], raceRecords = {}) {
    document.getElementById('tfe-dashboard')?.remove();
    if (!outcomes.length && !pendingRaces.length) {
      const p = document.createElement('div');
      p.id = 'tfe-dashboard';
      p.innerHTML = `
        <div class="tfe-rp-header">
          <span class="tfe-rp-title">🐕 TF Tracker — Dashboard</span>
          <button class="tfe-rp-close" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
        <div style="padding:20px;text-align:center;color:#3a5a7a;font-size:12px">
          No races tracked yet.<br><br>
          Visit live racecards before races run — scores save automatically.<br>
          Visit result pages after races complete to log outcomes.
        </div>`;
      document.body.appendChild(p);
      return;
    }

    const n        = outcomes.length;
    const wins     = outcomes.filter(o => o.topPickWon).length;
    const placed   = outcomes.filter(o => o.topPickPlaced).length;
    const fcs      = outcomes.filter(o => o.fcCorrect).length;
    const pending  = outcomes.filter(o => !o.bspSettled).length;
    const pnl      = outcomes.reduce((s, o) => s + (o.pnl ?? -1), 0);
    const roi      = n ? pnl / n * 100 : 0;
    const bsps     = outcomes.filter(o => o.topPickBSP).map(o => o.topPickBSP);
    const avgBSP   = bsps.length ? bsps.reduce((a,b)=>a+b,0)/bsps.length : null;
    const pCol     = pnl >= 0 ? '#00e676' : '#ef5350';
    const rCol     = roi >= 0 ? '#00e676' : '#ef5350';

    // Running P&L sparkline
    let running = 0;
    // Chart always chronological: oldest → newest left → right
    // outcomes is sorted newest-first so reverse it for the chart
    const chartPts = [...outcomes].reverse().map((o, i, arr) => {
      running += (o.pnl ?? -1);
      const x = (i / Math.max(arr.length-1, 1)) * 280;
      return { x, y: running, won: o.topPickWon };
    });
    const allY    = chartPts.map(p => p.y);
    const minY    = Math.min(...allY, -1);
    const maxY    = Math.max(...allY, 1);
    const scaleY  = v => 55 - ((v - minY) / (maxY - minY + 0.001)) * 55;
    const zeroY   = scaleY(0);
    const polyPts = chartPts.map(p => `${p.x},${scaleY(p.y)}`).join(' ');
    const dots    = chartPts.map(p =>
      `<circle cx="${p.x}" cy="${scaleY(p.y)}" r="3" fill="${p.won ? '#00e676' : '#ef5350'}"/>`
    ).join('');

    const rows = outcomes.slice(0, 100).map(o => {
      const pCol2      = o.pnl >= 0 ? '#00e676' : '#ef5350';
      const icon       = o.topPickWon ? '✅' : o.topPickPlaced ? '🟡' : '❌';
      const src        = o.priceSource || '?';
      const srcCol     = src === 'BSP' ? '#2a5a3a' : '#3a3a1a';
      const srcTxt     = src === 'BSP' ? '#69f0ae' : '#aaaa60';
      // Use racedAt (racecard visit time = before race) for the date, not result-check time
      const date       = raceDateFromTimestamp(o.racedAt || o.timestamp);
      // Race time from the stored URL
      const raceUrl    = o.racecardUrl || o.url || '';
      const time       = raceTimeFromUrl(raceUrl);
      // Split venue and grade from raceInfo
      const venue      = cleanVenue(o.raceInfo?.track || o.race?.split(' ').slice(-1)[0] || '–');
      const grade      = o.raceInfo?.grade    || '–';
      const dist       = o.raceInfo?.distance || '–';
      // Top pick trap from dogs array
      const topDogData = o.dogs?.find(d => d.name === o.topPick);
      const trap       = topDogData?.trap ?? '–';
      // BSP display
      const bspStr     = o.topPickBSP ? o.topPickBSP.toFixed(2) : (o.topPickISP ? o.topPickISP.toFixed(2) + '*' : '–');
      const resultUrl  = o.url || (o.racecardUrl ? o.racecardUrl.replace('/racecards/','/results/') : '#');

      return `<tr class="tfe-dash-row">
        <td class="tfe-dc" style="white-space:nowrap">${date}</td>
        <td class="tfe-dc" style="white-space:nowrap;color:#6a8aaa">${time}</td>
        <td class="tfe-dc" style="white-space:nowrap;color:#5a7a9a;max-width:70px;overflow:hidden;text-overflow:ellipsis" title="${venue}">${venue}</td>
        <td class="tfe-dc" style="white-space:nowrap"><span style="background:#1a1a00;color:#aaaa40;padding:1px 4px;border-radius:2px;font-size:8px">${grade}</span></td>
        <td class="tfe-dc" style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c0d0e0;font-weight:600" title="${o.topPick}">${o.topPick}</td>
        <td class="tfe-dc" style="text-align:center;color:#4a6a8a">${trap}</td>
        <td class="tfe-dc" style="text-align:center;color:#4a9eff;font-weight:700">${o.topScore}</td>
        <td class="tfe-dc" style="text-align:center;padding:3px 4px">${icon}</td>
        <td class="tfe-dc" style="text-align:right;color:#6a8aaa">${bspStr}</td>
        <td class="tfe-dc" style="text-align:right;color:${pCol2};font-weight:700">${o.pnl >= 0 ? '+' : ''}£${fmt2(o.pnl)}</td>
        <td class="tfe-dc" style="text-align:right"><span style="font-size:8px;background:${srcCol};padding:1px 4px;border-radius:2px;color:${srcTxt}">${src}</span></td>
        <td class="tfe-dc" style="text-align:center">
          <a href="${resultUrl}" target="_blank" title="View result" style="color:#2a5a9a;font-size:11px;text-decoration:none">🔗</a>
        </td>
      </tr>`;
    }).join('');

    // Pending races: scored but no result logged yet
    // Build structured data array for sortable pending table
    const pendingData = pendingRaces.slice(0, 200).map(r => {
      const date      = raceDateFromTimestamp(r.timestamp);
      const time      = raceTimeFromUrl(r.url || '');
      const venue     = cleanVenue(r.raceInfo?.track || '–');
      const grade     = r.raceInfo?.grade    || '–';
      const srtDogs   = [...(r.dogs || [])].sort((a,b) => (b.score??-1)-(a.score??-1));
      const topDog    = srtDogs[0];
      const secDog    = srtDogs[1];
      const trap      = topDog?.trap ?? '–';
      const s1        = topDog?.score ?? null;
      const s2        = secDog?.score ?? null;
      const margin    = (s1!=null&&s2!=null) ? Math.round(s1-s2) : null;
      const fc        = topDog?.forecast;
      const _rs2      = srtDogs.map(d => Math.max(d.score??1,1));
      const _tot2     = _rs2.reduce((a,b)=>a+b, 0);
      const _mPct2    = _tot2>0 ? (_rs2[0]/_tot2)*100 : null;
      const ev        = (_mPct2!=null && fc?.impliedPct!=null)
        ? +((_mPct2/fc.impliedPct-1)*100).toFixed(1) : null;
      const betSignal = ev!=null && ev>=20 && margin!=null && margin>=10 && _hasEdge(r.raceInfo);
      const resultUrl = r.url ? r.url.replace('/racecards/','/results/') : '#';
      return { date, time, venue, grade, trap, name: topDog?.name||'?',
               score: topDog?.score??null, margin, ev, betSignal, resultUrl };
    });

    function renderPendingRows(data) {
      return data.map(p => {
        const mgC = p.margin!=null&&p.margin>=15?'#69f0ae':p.margin!=null&&p.margin>=10?'#ffeb3b':'#6a8aaa';
        const evC = p.ev!=null&&p.ev>=10?'#69f0ae':p.ev!=null&&p.ev>=0?'#ffeb3b':'#ef5350';
        return `<tr class="tfe-dash-row">
          <td class="tfe-dc" style="white-space:nowrap">${p.date}</td>
          <td class="tfe-dc" style="white-space:nowrap;color:#6a8aaa">${p.time}</td>
          <td class="tfe-dc" style="white-space:nowrap;color:#5a7a9a;max-width:70px;overflow:hidden;text-overflow:ellipsis" title="${p.venue}">${p.venue}</td>
          <td class="tfe-dc"><span style="background:#1a1a00;color:#8a8a30;padding:1px 4px;border-radius:2px;font-size:8px">${p.grade}</span></td>
          <td class="tfe-dc" style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#b0c8e0;font-weight:600">${p.name}</td>
          <td class="tfe-dc" style="text-align:center;color:#4a9eff">${p.trap}</td>
          <td class="tfe-dc" style="text-align:center;color:#4a9eff;font-weight:700">${p.score??'–'}</td>
          <td class="tfe-dc" style="text-align:right;color:${mgC};font-weight:700">${p.margin!=null?'▲'+p.margin:'–'}</td>
          <td class="tfe-dc" style="text-align:right;color:${evC};font-weight:700">${p.ev!=null?(p.ev>=0?'+':'')+p.ev+'%':'–'}</td>
          <td class="tfe-dc" style="text-align:center">${p.betSignal?'<span style="background:#0d2e0d;color:#00e676;border:1px solid #00c853;border-radius:3px;padding:1px 5px;font-size:8px;font-weight:700">✔ BET</span>':'<span style="color:#2a3a4a;font-size:9px">–</span>'}</td>
          <td class="tfe-dc" style="text-align:center">
            <a href="${p.resultUrl}" target="_blank" style="color:#2a5a9a;font-size:11px;text-decoration:none">🔗</a>
          </td>
        </tr>`;
      }).join('');
    }
    const pendingRows = renderPendingRows(pendingData);

    const panel = document.createElement('div');
    panel.id = 'tfe-dashboard';
    panel.innerHTML = `
      <div class="tfe-rp-header">
        <span class="tfe-rp-title">🐕 TF Tracker</span>
        <span class="tfe-rp-race">${n} races · ${pending ? `<span style="color:#ffeb3b">${pending} BSP pending</span>` : '✓ all BSP settled'}</span>
        <button class="tfe-rp-close" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
      <div class="tfe-dash-stats">
        <div class="tfe-dash-stat"><div class="tfe-dash-val">${n}</div><div class="tfe-dash-lbl">Races</div></div>
        <div class="tfe-dash-stat"><div class="tfe-dash-val">${wins}</div><div class="tfe-dash-lbl">Wins</div></div>
        <div class="tfe-dash-stat"><div class="tfe-dash-val" style="color:#4a9eff">${Math.round(wins/n*100)}%</div><div class="tfe-dash-lbl">Win %</div></div>
        <div class="tfe-dash-stat"><div class="tfe-dash-val">${placed}</div><div class="tfe-dash-lbl">Placed</div></div>
        <div class="tfe-dash-stat"><div class="tfe-dash-val">${fcs}</div><div class="tfe-dash-lbl">FC ✓</div></div>
        <div class="tfe-dash-stat"><div class="tfe-dash-val" style="color:${pCol}">${pnl>=0?'+':''}£${fmt2(pnl)}</div><div class="tfe-dash-lbl">P&L</div></div>
        <div class="tfe-dash-stat"><div class="tfe-dash-val" style="color:${rCol}">${roi>=0?'+':''}${roi.toFixed(1)}%</div><div class="tfe-dash-lbl">ROI</div></div>
        <div class="tfe-dash-stat"><div class="tfe-dash-val">${avgBSP ? avgBSP.toFixed(2) : '–'}</div><div class="tfe-dash-lbl">Avg BSP</div></div>
      </div>
      <div style="padding:6px 12px 2px;background:#050508;border-bottom:1px solid #0a1220">
        <div style="font-size:9px;color:#2a4060;margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em">Running P&L</div>
        <svg width="280" height="60" style="overflow:visible;display:block">
          <line x1="0" y1="${zeroY}" x2="280" y2="${zeroY}" stroke="#1a2a3a" stroke-width="1" stroke-dasharray="3,3"/>
          <polyline points="${polyPts}" fill="none" stroke="${pnl >= 0 ? '#00e676' : '#ef5350'}" stroke-width="1.5"/>
          ${dots}
        </svg>
      </div>
      <div style="overflow-y:auto;max-height:260px">
        ${outcomes.length ? `
        <div style="padding:4px 8px;background:#080814;font-size:9px;color:#2a5a3a;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #0a1220">
          ✅ Results Loaded (${outcomes.length})
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th class="tfe-rp-th">Date</th>
            <th class="tfe-rp-th">Time</th>
            <th class="tfe-rp-th">Venue</th>
            <th class="tfe-rp-th">Grd</th>
            <th class="tfe-rp-th">Top Pick</th>
            <th class="tfe-rp-th" style="text-align:center">Trp</th>
            <th class="tfe-rp-th" style="text-align:center">Sc</th>
            <th class="tfe-rp-th" style="text-align:center">W?</th>
            <th class="tfe-rp-th" style="text-align:right">BSP</th>
            <th class="tfe-rp-th" style="text-align:right">P&L</th>
            <th class="tfe-rp-th" style="text-align:right">Src</th>
            <th class="tfe-rp-th" style="text-align:center">🔗</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>` : ''}
        ${pendingRows ? `
        <div style="padding:4px 8px;background:#080814;font-size:9px;color:#3a5a2a;text-transform:uppercase;letter-spacing:.05em;border-top:1px solid #0a1220;border-bottom:1px solid #0a1220;margin-top:2px;display:flex;align-items:center;justify-content:space-between">
          <span>⏳ Awaiting Results (${pendingRaces.length})</span>
          <div style="display:flex;gap:4px">
            <button id="tfe-settle-btn" style="font-size:8.5px;padding:1px 7px;background:#0a2a1a;border:1px solid #00c853;border-radius:3px;color:#00e676;cursor:pointer" title="Import results from results scraper">⬇ Settle</button>
            <button id="tfe-prerace-csv-awaiting" onclick="exportPreraceCSVFromTracker()" style="font-size:8.5px;padding:1px 7px;background:#0a1a2a;border:1px solid #1a3a5a;border-radius:3px;color:#4a9eff;cursor:pointer">⬇ Pre-race CSV</button>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr id="tfe-pending-thead">
            <th class="tfe-rp-th tfe-sortable" data-col="date">Date ↕</th>
            <th class="tfe-rp-th tfe-sortable" data-col="time">Time ↕</th>
            <th class="tfe-rp-th tfe-sortable" data-col="venue">Venue ↕</th>
            <th class="tfe-rp-th tfe-sortable" data-col="grade">Grd ↕</th>
            <th class="tfe-rp-th tfe-sortable" data-col="name">Top Pick ↕</th>
            <th class="tfe-rp-th" style="text-align:center">Trp</th>
            <th class="tfe-rp-th tfe-sortable" data-col="score" style="text-align:center">Sc ↕</th>
            <th class="tfe-rp-th tfe-sortable" data-col="margin" style="text-align:right">Margin ↕</th>
            <th class="tfe-rp-th tfe-sortable" data-col="ev" style="text-align:right">EV% ↕</th>
            <th class="tfe-rp-th tfe-sortable" data-col="betSignal" style="text-align:center">Signal ↕</th>
            <th class="tfe-rp-th" style="text-align:center">🔗</th>
          </tr></thead>
          <tbody id="tfe-pending-tbody">${pendingRows}</tbody>
        </table>` : ''}
      </div>
      <div style="padding:5px 12px;border-top:1px solid #0a1220;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-shrink:0">
        <span style="font-size:9px;color:#2a3a4a;flex:1">£1 level stake · 🔗 opens result page</span>
        <button id="tfe-export-csv" style="font-size:9px;padding:2px 8px;background:#0a1a2a;border:1px solid #1a3a5a;border-radius:3px;color:#4a9eff;cursor:pointer" title="Top picks only — one row per race">⬇ Summary CSV</button>
        <button id="tfe-export-backtest" style="font-size:9px;padding:2px 8px;background:#0a2a1a;border:1px solid #1a5a3a;border-radius:3px;color:#4ae69e;cursor:pointer" title="All dogs with full breakdown — one row per dog per race">⬇ Backtest CSV</button>
        <button id="tfe-clear-all" style="font-size:9px;padding:2px 8px;background:#1a0a0a;border:1px solid #3a1a1a;border-radius:3px;color:#6a3a3a;cursor:pointer">Clear All</button>
      </div>`;

    // Store pending races globally for the inline CSV button onclick
    window._tfe_pendingRaces = pendingRaces;
    document.body.appendChild(panel);

    // ── Sortable pending table ──────────────────────────────────────────────
    (function() {
      const thead = panel.querySelector('#tfe-pending-thead');
      const tbody = panel.querySelector('#tfe-pending-tbody');
      if (!thead || !tbody) return;

      let sortCol = 'time';   // default sort
      let sortDir = 1;        // 1 = asc, -1 = desc
      const sortArrow = (col) => col === sortCol ? (sortDir===1?' ↑':' ↓') : ' ↕';

      function sortAndRender() {
        const sorted = [...pendingData].sort((a, b) => {
          let av = a[sortCol]; let bv = b[sortCol];
          // Nulls always last
          if (av==null && bv==null) return 0;
          if (av==null) return 1;
          if (bv==null) return -1;
          if (typeof av === 'string') return sortDir * av.localeCompare(bv);
          return sortDir * (av - bv);
        });
        tbody.innerHTML = renderPendingRows(sorted);
        // Update arrow indicators
        thead.querySelectorAll('.tfe-sortable').forEach(th => {
          const col = th.dataset.col;
          const base = th.textContent.replace(/ [↕↑↓]$/, '');
          th.textContent = base + sortArrow(col);
        });
      }

      thead.querySelectorAll('.tfe-sortable').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          const col = th.dataset.col;
          if (sortCol === col) {
            sortDir *= -1;  // toggle direction
          } else {
            sortCol = col;
            // Numeric cols default desc (biggest first); text cols default asc
            sortDir = ['score','margin','ev','betSignal'].includes(col) ? -1 : 1;
          }
          sortAndRender();
        });
      });

      // Apply default sort (time asc) on load
      sortAndRender();
    })();

    // Wire pre-race CSV button via addEventListener (belt-and-braces alongside onclick)
    panel.querySelector('#tfe-prerace-csv-awaiting')?.addEventListener('click', () => exportPreraceCSVFromTracker());
    panel.querySelector('#tfe-export-csv')?.addEventListener('click', () => exportCSV(outcomes));
    panel.querySelector('#tfe-export-backtest')?.addEventListener('click', () => exportBacktestCSV(outcomes, raceRecords));

    // Settle button — manually trigger auto-settle from results scraper
    const settleBtn = panel.querySelector('#tfe-settle-btn');
    if (settleBtn) {
      settleBtn.addEventListener('click', () => {
        settleBtn.textContent = '⏳ Settling...';
        settleBtn.disabled = true;
        chrome.storage.local.get(null, freshItems => {
          autoSettleFromScraper(freshItems);
          setTimeout(() => {
            settleBtn.textContent = '⬇ Settle';
            settleBtn.disabled = false;
          }, 3000);
        });
      });
    }

    panel.querySelector('#tfe-clear-all')?.addEventListener('click', () => {
      if (!confirm(`Clear all ${n} tracked races? This cannot be undone.`)) return;
      chrome.storage.local.get(null, items => {
        const keys = Object.keys(items).filter(k => k.startsWith('outcome:') || k.startsWith('race:'));
        chrome.storage.local.remove(keys, () => panel.remove());
      });
    });
  }


  // ── Pre-race CSV from tracker (pending races only) ────────────────────
  function exportPreraceCSVFromTracker(races) {
    const pendingList = races || window._tfe_pendingRaces || [];
    if (!pendingList.length) { alert('No pending races to export.'); return; }
    const _n    = new Date();
    const today = _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');
    const hdrs  = ['Race ID','Date','Time','Venue','Grade','Distance',
                   'Dog','Trap','Rank','Score','Margin','Model%','FC%','EV%','FC Odds','BET Signal','URL'];
    const rows  = [hdrs.join(',')];
    pendingList.forEach(r => {
      const ri   = r.raceInfo || {};
      const ts   = r.timestamp;
      const _d   = ts ? new Date(ts) : new Date();
      const ds   = _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');
      // Time comes from URL, not raceInfo (raceInfo has no time field)
      const time = raceTimeFromUrl(r.url || '');
      const srt  = (r.dogs||[]).slice().sort((a,b)=>(b.score??-1)-(a.score??-1));
      if (!srt.length) return;
      // Recalculate model implied% from stored scores (same as calcImpliedProbs)
      const rawSc = srt.map(d => Math.max(d.score??1, 1));
      const tot   = rawSc.reduce((a,b)=>a+b, 0);
      const mPcts = rawSc.map(s => (s/tot)*100);
      const s1  = srt[0]?.score ?? null;
      const s2  = srt[1]?.score ?? null;
      const mg  = (s1!=null&&s2!=null) ? Math.round(s1-s2) : '';
      srt.forEach((dog, rank) => {
        const mPct = mPcts[rank];
        const fc   = dog.forecast;
        const fcPct= fc?.impliedPct ?? null;
        const ev   = (mPct!=null && fcPct!=null)
          ? +((mPct/fcPct-1)*100).toFixed(1) : '';
        const bet  = (rank===0 && ev!=='' && ev>=20 && mg!=='' && mg>=10 && _hasEdge(ri)) ? 'YES' : '';
        const e    = v => '"'+String(v??'').replace(/"/g,'""')+'"';
        rows.push([r.raceId, ds, time,
                   e(ri.track||''), ri.grade||'', ri.distance||'',
                   e(dog.name||''), dog.trap||'',
                   rank+1, dog.score??'',
                   rank===0 ? mg : '',
                   mPct!=null  ? mPct.toFixed(1)  : '',
                   fcPct!=null ? fcPct.toFixed(1) : '',
                   ev, e(fc?.oddsStr||''), bet, e(r.url||'')].join(','));
      });
    });
    if (rows.length <= 1) { alert('No dog data found in pending races.\n\nMake sure you\'ve visited racecards before the races run.'); return; }
    const blob = new Blob([rows.join('\n')], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'TFE_prerace_' + today + '.csv';
    a.click();
  }

  // ── Dashboard toggle button ────────────────────────────────
  function injectDashboardBtn() {
    if (document.getElementById('tfe-dash-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'tfe-dash-toggle';
    btn.textContent = '📊 TF Tracker';
    btn.addEventListener('click', () => loadAllOutcomes((outcomes, pending, raceRecords) => buildDashboard(outcomes, pending, raceRecords)));
    document.body.appendChild(btn);
  }

  // ── Main ───────────────────────────────────────────────────
  function init() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    setTimeout(injectDashboardBtn, 800);

    // Auto-settle from results scraper on every page load — no manual steps needed
    setTimeout(() => {
      chrome.storage.local.get(null, items => autoSettleFromScraper(items));
    }, 1500);

    // Auto-load the tracker dashboard if there is any tracked data
    // Mirrors how the racecard sidebar auto-loads without needing a button click
    setTimeout(() => {
      loadAllOutcomes((outcomes, pending, raceRecords) => {
        if (outcomes.length || pending.length) {
          buildDashboard(outcomes, pending, raceRecords);
        }
      });
    }, 1200);

    if (!isIndividualPage()) return;

    const raceId = getRaceId();
    if (!raceId) return;

    setTimeout(() => {
      chrome.storage.local.get([`race:${raceId}`, `outcome:${raceId}`], items => {
        const raceRecord = items[`race:${raceId}`];
        const existing   = items[`outcome:${raceId}`];

        if (existing) {
          // Always re-parse on every visit — catches new ISP for non-placed dogs,
          // BSP arriving later in the day, and any price changes since last visit
          refreshOutcome(raceRecord || {}, existing, (updated, changed) => {
            buildResultPanel(raceRecord || {}, updated, changed);
          });
          return;
        }

        if (!raceRecord) {
          console.log(`[TFE Tracker] No saved scores for race ${raceId} — visit the racecard before the race to enable tracking`);
          return;
        }

        // First time seeing this result — parse and save
        const actualResults = parseCurrentResult();
        if (!actualResults?.length) { console.log('[TFE Tracker] Could not parse result'); return; }

        const outcome = buildOutcome(raceRecord, actualResults);
        saveOutcome(outcome, false);
        buildResultPanel(raceRecord, outcome, false);
      });
    }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; setTimeout(init, 1000); }
  }).observe(document, { subtree: true, childList: true });


  window.exportPreraceCSVFromTracker = exportPreraceCSVFromTracker;
})()