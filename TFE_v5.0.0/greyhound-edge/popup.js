// popup.js — Greyhound Edge v5

const DEFAULTS = {
  nRuns: 5,
  // v5 weights — total 100
  // Trap affinity now uses structural track data, not personal history
  // Speed now uses grade-par adjustment, not raw time
  // Trainer is new 10th component
  wSpeed: 28, wRating: 22, wSectional: 30, wConsistency: 2,
  wGrade: 0, wTrapAffinity: 0, wTrend: 0, wCleanRun: 10, wMomentum: 0, wTrainer: 8,
  distanceFilter: true, decayWeighting: true,
  sidebarPos: 'right'
};

const WEIGHT_KEYS = ['wSpeed','wRating','wSectional','wConsistency','wTrapAffinity','wTrend','wGrade','wCleanRun','wMomentum','wTrainer'];
const TOGGLE_KEYS = ['distanceFilter','decayWeighting'];

let currentPos = 'right';

function setPos(p) {
  currentPos = p;
  document.getElementById('posRight').classList.toggle('active', p === 'right');
  document.getElementById('posLeft').classList.toggle('active', p === 'left');
}

function updateWeightTotal() {
  const total = WEIGHT_KEYS.reduce((s, k) => s + parseInt(document.getElementById(k)?.value || 0), 0);
  const el = document.getElementById('weightTotal');
  const ok = total === 100;
  el.innerHTML = `Total: <b style="color:${ok ? '#2da870' : '#ef5350'}">${total}</b> ${ok ? '✓' : '⚠ should be 100'}`;
}

WEIGHT_KEYS.forEach(k => {
  const slider = document.getElementById(k);
  const valEl  = document.getElementById(k + '-val');
  if (!slider) return;
  slider.addEventListener('input', () => {
    valEl.textContent = slider.value;
    updateWeightTotal();
  });
});

// Load saved settings
chrome.storage.sync.get(DEFAULTS, settings => {
  WEIGHT_KEYS.forEach(k => {
    const el = document.getElementById(k);
    if (el) { el.value = settings[k] ?? DEFAULTS[k]; document.getElementById(k+'-val').textContent = el.value; }
  });
  TOGGLE_KEYS.forEach(k => {
    const el = document.getElementById(k);
    if (el) el.checked = settings[k] ?? DEFAULTS[k];
  });
  document.getElementById('nRuns').value = settings.nRuns || 5;
  setPos(settings.sidebarPos || 'right');
  updateWeightTotal();
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const s = { sidebarPos: currentPos, nRuns: parseInt(document.getElementById('nRuns').value) || 5 };
  WEIGHT_KEYS.forEach(k => { s[k] = parseInt(document.getElementById(k)?.value) || 0; });
  TOGGLE_KEYS.forEach(k => { s[k] = document.getElementById(k)?.checked ?? true; });

  chrome.storage.sync.set(s, () => {
    const msg = document.getElementById('savedMsg');
    msg.textContent = '✓ Saved — reloading...';
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.url?.includes('timeform.com')) setTimeout(() => chrome.tabs.reload(tabs[0].id), 350);
    });
    setTimeout(() => { msg.textContent = ''; }, 2500);
  });
});
