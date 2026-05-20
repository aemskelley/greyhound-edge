// ============================================================
//  Greyhound Edge v5
//
//  New in v5:
//  1. Dark Pro UI — higher contrast, readable dog names & text
//  2. Ghost-outline footer buttons (Option 1) — properly legible
//  3. Race info bar — grade in bold blue, venue warmer tone
//  4. Model % bold, forecast % muted in EV strip
//  5. Top-pick green left-accent border when expanded
// ============================================================

(function () {
  'use strict';

  // ── V4 Lookup Tables (from statistical datasets) ──────────

  // Structural trap win% by track (from UK_Greyhound_Track-Stats_A.xlsx)
  const TRAP_BIAS = {
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


  // ── Chester/Webster Ratings by Track + Grade (2025 Q4) ───
  // Source: greyhoundstats.co.uk/graded_averages.php
  // Rating of 100 = A1/Open class equivalent time
  // Used for: grade suitability (real quality gaps) and speed rating
  const CHESTER_RATINGS = {
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

  // Average winning times (2025 Q4) — kept for raw speed calculation
  const PAR_TIMES = {
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



  // Trainer stats lookup — 657 trainer/track combos, 2024-2026 weighted
  // w = weighted win%, p = cumulative P&L, r = total runners
  // Source: UK_Greyhound_Trainer_Graded_Ratings_2024-26.xlsx
  // Weighting: 2026×3, 2025×2, 2024×1
  // All combos with 10+ runners included (informational, not just profitable)
  // Trainer stats lookup — trainer/track combos, 2024-2026
  // w = win%, p = P&L to £1 stake, r = total runners
  // Source: UK_Greyhound_Trainer_Graded_Ratings_2024-26.xlsx (≥10 runners)
  // Keys: "TrainerName|TrackKey" where TrackKey matches TRACK_MAP output.
  // Includes O'Surname apostrophe variants for exact-match coverage.
  const TRAINER_DATA = {
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


  // Favourite win rates by track (UK_Greyhound_Favourite_Statistics.xlsx)
  const FAV_WIN_RATE = {
    CentralPark:37.9, Doncaster:40.0, DunstallPark:34.9, Harlow:36.3,
    Hove:35.8, Kinsley:31.3, Monmore:37.0, Newcastle:37.8,
    Nottingham:34.0, Oxford:38.9, PelawGrange:40.3, Romford:32.9,
    Sheffield:37.6, SuffolkDowns:46.1, Sunderland:36.7,
    TheValley:41.7, Towcester:33.2, StarPelaw:40.3,
  };

  // ── Track name normalisation ──────────────────────────────
  // Maps Timeform track names → lookup table keys
  const TRACK_MAP = {
    'new': 'Newcastle', 'newcastle': 'Newcastle',
    'she': 'Sheffield', 'sheffield': 'Sheffield',
    'rom': 'Romford', 'romford': 'Romford',
    'hov': 'Hove', 'hove': 'Hove',
    'mon': 'Monmore', 'monmore': 'Monmore',
    'tow': 'Towcester', 'towcester': 'Towcester',
    'har': 'Harlow', 'harlow': 'Harlow',
    'not': 'Nottingham', 'nottingham': 'Nottingham',
    'kin': 'Kinsley', 'kinsley': 'Kinsley',
    'yar': 'Yarmouth', 'yarmouth': 'Yarmouth',
    'sun': 'Sunderland', 'sunderland': 'Sunderland',
    'pla': 'PelawGrange', 'pelawgrange': 'PelawGrange',
    // Star Pelaw = Pelaw Grange Stadium (same venue, different display name from scraper)
    'sta': 'PelawGrange', 'starpe': 'PelawGrange', 'starpelaw': 'PelawGrange', 'star': 'PelawGrange',
    'val': 'TheValley', 'thevalley': 'TheValley', 'valley': 'TheValley',
    'dun': 'DunstallPark', 'dunsta': 'DunstallPark', 'dunstallpark': 'DunstallPark', 'dunstall': 'DunstallPark',
    'don': 'Doncaster', 'doncaster': 'Doncaster',
    'oxf': 'Oxford', 'oxford': 'Oxford',
    'cen': 'CentralPark', 'centra': 'CentralPark', 'centralpark': 'CentralPark', 'central': 'CentralPark',
    'suf': 'SuffolkDowns', 'suffolkdowns': 'SuffolkDowns', 'suffolk': 'SuffolkDowns',
    'swi': 'Swindon', 'swindon': 'Swindon',
    'cra': 'Crayford', 'crayford': 'Crayford',
    'hen': 'Henlow', 'henlow': 'Henlow',
    'per': 'PerryBarr', 'perrybarr': 'PerryBarr',
  };

  function normaliseTrack(raw) {
    if (!raw) return null;
    const key = raw.toLowerCase().replace(/[\s\-_]/g,'').slice(0,6);
    return TRACK_MAP[key] || TRACK_MAP[raw.toLowerCase().replace(/\s/g,'')] || null;
  }

  // ── GBGB Official Trap Colours ────────────────────────────
  // T1: Red bg, White text
  // T2: Blue bg, White text
  // T3: White bg, Black text
  // T4: Black bg, Yellow (Yellow stripe on black)
  // T5: Orange bg, White text
  // T6: Black/White striped bg, Red text → shown as white bg, red text + stripe border
  const TRAP_STYLE = {
    1: { bg:'#cc0000',       text:'#ffffff', border:'#cc0000'    },
    2: { bg:'#003399',       text:'#ffffff', border:'#003399'    },
    3: { bg:'#ffffff',       text:'#111111', border:'#999999'    },
    4: { bg:'#111111',       text:'#ffffff', border:'#111111'    },
    5: { bg:'#ff8800',       text:'#ffffff', border:'#ff8800'    },
    6: { bg:'#ffffff',       text:'#cc0000', border:'#333333',
         extra:'repeating-linear-gradient(45deg,#333 0,#333 2px,#fff 2px,#fff 8px)' },
  };

  function trapBadgeHTML(trap) {
    const s = TRAP_STYLE[trap] || { bg:'#555', text:'#fff', border:'#555' };
    const bg = s.extra || s.bg;
    return `<span class="tfe-trap-badge" style="background:${bg};color:${s.text};border:1.5px solid ${s.border}">${trap}</span>`;
  }

  // ── Defaults ──────────────────────────────────────────────
  const DEFAULTS = {
    nRuns: 5,
    // Weights from 119-race correlation analysis (2026-05-14)
    // Sectional +0.116 (strongest), Speed +0.107, Rating +0.083, Clean Run +0.046
    // Trap -0.126, Grade -0.145, Trend -0.023, Momentum -0.013 → zeroed
    wSpeed: 28, wRating: 22, wSectional: 30, wConsistency: 2,
    wGrade: 0, wTrapAffinity: 0, wTrend: 0, wCleanRun: 10, wMomentum: 0, wTrainer: 8,
    distanceFilter: true, decayWeighting: true,
    sidebarPos: 'right'
  };

  let CFG = { ...DEFAULTS };

  // ── Grade hierarchy ───────────────────────────────────────
  const GRADE_ORDER = {
    A1:1,A2:2,A3:3,A4:4,A5:5,A6:6,A7:7,A8:8,A9:9,A10:10,A11:11,A12:12,
    B1:1,B2:2,B3:3,B4:4,B5:5,
    S1:1,S2:2,S3:3,S4:4,S5:5,
    D1:1,D2:2,D3:3,D4:4,D5:5,D6:6,
  };
  const gradeVal = g => g ? (GRADE_ORDER[g] ?? null) : null;

  // ── Run comment classification ────────────────────────────
  const INTERFERENCE = /\b(Crd|Bmp|Bumped|Checked|Fell|Knocked|Impeded|Hampered|Crowded|Carried)\b/i;
  const SLOW_START   = /\b(SAw|SlowAway|MissedBreak|Dwelt|VSAw)\b/i;
  const FAST_START   = /\b(QAw|QuickAway|EP|EarlyPace|SnLed|ALed|LedFr)\b/i;
  const classifyRun  = c => !c ? 'unknown'
    : INTERFERENCE.test(c) ? 'interference'
    : SLOW_START.test(c)   ? 'slow_start'
    : FAST_START.test(c)   ? 'fast_start' : 'clean';

  function parseBendString(str) {
    if (!str || str === '-') return null;
    const digits = str.replace(/[^0-9]/g,'').split('').map(Number);
    if (digits.length < 2) return null;
    return { gain: digits[0] - digits[digits.length-1] };
  }

  // ── Math helpers ──────────────────────────────────────────
  const avg    = arr => { const v=arr.filter(x=>x!=null&&!isNaN(x)); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; };
  const stdDev = arr => { const v=arr.filter(x=>x!=null&&!isNaN(x)); if(v.length<2)return null; const m=avg(v); return Math.sqrt(v.map(x=>(x-m)**2).reduce((a,b)=>a+b,0)/v.length); };
  const fmt    = (v,d=2) => (v!=null&&!isNaN(v)) ? (+v).toFixed(d) : '–';
  const pct    = v => (v!=null&&!isNaN(v)) ? Math.round(v)+'%' : '–';
  const cellTxt = (tr,i) => tr.cells[i]?.textContent?.trim()||'';
  const cellNum = (tr,i) => { const n=parseFloat(cellTxt(tr,i)); return isNaN(n)?null:n; };
  const cellInt = (tr,i) => { const n=parseInt(cellTxt(tr,i));   return isNaN(n)?null:n; };

  function decayWeights(n,f=0.75){return Array.from({length:n},(_,i)=>Math.pow(f,i));}
  function weightedAvg(vals,weights){
    const pairs=vals.map((v,i)=>[v,weights[i]]).filter(([v])=>v!=null&&!isNaN(v));
    if(!pairs.length)return null;
    const sw=pairs.reduce((s,[,w])=>s+w,0);
    return pairs.reduce((s,[v,w])=>s+v*w,0)/sw;
  }

  // ── No-edge condition filter ──────────────────────────────
  // Venues/distances/grades where backtest shows model has no reliable signal.
  // BET signals are suppressed — these conditions contribute negative ROI.
  const _NO_EDGE_VENUES    = new Set(['Monmore', 'Harlow', 'Yarmouth']);
  const _NO_EDGE_DISTANCES = new Set(['480m', '400m', '264m', '270m']);
  const _NO_EDGE_GRADES    = /^D|^S|^HP/i;

  function _hasEdge(raceInfo) {
    const venue = (raceInfo?.track || '').trim();
    const dist  = (raceInfo?.distance || '').trim();
    const grade = (raceInfo?.grade || '').trim();
    if (_NO_EDGE_VENUES.has(venue))    return false;
    if (_NO_EDGE_DISTANCES.has(dist))  return false;
    if (_NO_EDGE_GRADES.test(grade))   return false;
    return true;
  }

  // ── Z-score helper ────────────────────────────────────────
  function fieldZScore(values) {
    // Returns z-scores of each value within the array (null values → null output)
    const valid = values.filter(v => v != null && !isNaN(v));
    if (valid.length < 2) return values.map(v => (v != null && !isNaN(v)) ? 0 : null);
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const sd   = Math.sqrt(valid.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / valid.length);
    if (sd === 0) return values.map(v => (v != null && !isNaN(v)) ? 0 : null);
    return values.map(v => v != null && !isNaN(v) ? +((v - mean) / sd).toFixed(2) : null);
  }

  // ── Betfair price increment rounding ─────────────────────
  // Rounds odds UP to the nearest valid Betfair exchange increment
  function roundToBetfairOdds(odds) {
    if (odds == null || isNaN(odds)) return null;
    if (odds < 1.01)  return 1.01;
    if (odds < 2)     return Math.ceil(odds * 100) / 100;
    if (odds < 3)     return Math.ceil(odds * 50)  / 50;
    if (odds < 4)     return Math.ceil(odds * 20)  / 20;
    if (odds < 6)     return Math.ceil(odds * 10)  / 10;
    if (odds < 10)    return Math.ceil(odds * 5)   / 5;
    if (odds < 20)    return Math.ceil(odds * 2)   / 2;
    if (odds < 30)    return Math.ceil(odds * 1)   / 1;
    if (odds < 50)    return Math.ceil(odds / 2)   * 2;
    if (odds < 100)   return Math.ceil(odds / 5)   * 5;
    if (odds < 1000)  return Math.ceil(odds / 10)  * 10;
    return odds;
  }

  function rankScore(values,dir='desc'){
    const valid=values.filter(v=>v!=null&&!isNaN(v));
    if(valid.length<2)return values.map(v=>(v!=null&&!isNaN(v))?1:null);
    const sorted=[...valid].sort((a,b)=>dir==='desc'?b-a:a-b);
    return values.map(v=>{
      if(v==null||isNaN(v))return null;
      return 1-(sorted.indexOf(v)/(sorted.length-1));
    });
  }

  const parseISP = s => {
    if(!s||s==='-')return null;
    const c=s.replace(/jf|JF|f|F/g,'').trim();
    if(/^evs?$/i.test(c))return 2.0;
    if(c.includes('/')){const[n,d]=c.split('/').map(Number);return d?n/d+1:null;}
    const f=parseFloat(c);return isNaN(f)?null:f;
  };
  const parseDist = s => { const m=s?.match(/(\d+)m/); return m?parseInt(m[1]):null; };

  // ── DOM helpers ───────────────────────────────────────────
  function parseTrap(headerTR) {
    const img = headerTR.cells[0]?.querySelector('img.rpb-trap');
    if(img){const n=parseInt(img.getAttribute('alt'));if(!isNaN(n))return n;}
    const link=headerTR.querySelector('a.rpb-greyhound');
    if(link){const m=link.className.match(/rpb-greyhound-(\d)/);if(m)return parseInt(m[1]);}
    return null;
  }
  function parseFormIndex(headerTR){
    const link=headerTR.querySelector('a.rpb-greyhound');
    if(!link)return null;
    const m=(link.getAttribute('onmouseover')||'').match(/showSingleGreyhoundForm\((\d+)/);
    return m?parseInt(m[1]):null;
  }
  function parseDogName(headerTR){
    return headerTR.querySelector('a.rpb-greyhound')?.textContent?.trim()||'?';
  }

  // Returns { href, dogId } for the dog's Timeform profile page.
  // href  — absolute URL: /greyhound-racing/greyhound-form/{name}/{id}
  // dogId — numeric ID from the URL (used as cache key)
  function parseDogProfileLink(headerTR) {
    const link = headerTR.querySelector('a.rpb-greyhound');
    if (!link) return { href: null, dogId: null };
    const href  = link.href || null;                          // absolute URL from browser
    // ID is last path segment: /greyhound-form/swift-hostile/107826
    const dogId = href?.match(/\/(\d+)\/?$/)?.[1] ?? null;
    return { href, dogId };
  }

  // ── Parse trainer name from racecard ─────────────────────
  // The trainer is in rpb-entry-details-2 TR (second row per dog)
  function parseTrainerName(dogIndex) {
    // Try rpb-entry-details-2 (standard) then rpb-entry-details-3 fallback
    const trainerTRs = document.querySelectorAll('tr.rpb-entry-details-2');
    if (!trainerTRs[dogIndex]) return null;
    const text = trainerTRs[dogIndex].textContent.trim();
    // Format varies: "J Sharp  (36.84%)" or "Miss J Sharp" or "J R Smith"
    // Extract name before parenthesis and percentage, clean whitespace
    const m = text.match(/^([A-Za-z][A-Za-z .'-]+?)(?:\s*\(|\s{2,}|$)/);
    if (!m) return null;
    // Normalise: collapse internal spaces
    return m[1].trim().replace(/\s+/g, ' ');
  }

  // ── Parse form rows ───────────────────────────────────────
  function parseFormRows(recentFormTR){
    const rows=[];
    const innerTRs=[...recentFormTR.querySelectorAll('tr')];
    for(let i=0;i<innerTRs.length;i++){
      const tr=innerTRs[i];
      if(tr.classList.contains('run-comment-mob'))continue;
      if(!tr.cells||tr.cells.length<17)continue;
      if(!/^\d{2}\/\d{2}\/\d{4}/.test(cellTxt(tr,0)))continue;
      const nextTR=innerTRs[i+1];
      const comment=nextTR?.classList.contains('run-comment-mob')?nextTR.textContent.trim():'';
      const distStr=cellTxt(tr,3);
      rows.push({
        dist:distStr, distM:parseDist(distStr),
        grade:cellTxt(tr,4), gradeVal:gradeVal(cellTxt(tr,4)),
        track:cellTxt(tr,2),
        trapPos:cellInt(tr,7),
        finPos: cellInt(tr,10),
        tfTime: cellNum(tr,14),
        secRtg: cellInt(tr,15),
        rtg:    cellInt(tr,16),
        bendData:parseBendString(cellTxt(tr,9)),
        comment, runType:classifyRun(comment)
      });
    }
    return rows;
  }

  // ── Parse race info ───────────────────────────────────────
  function parseRaceInfo(){
    // Use URL slug as primary track source — cleanest and always available
    // Pattern: /racecards/newcastle/1218/2026-05-14/...
    const urlSlugMatch = location.href.match(/\/racecards\/([^/]+)\//);
    const urlSlug = urlSlugMatch ? urlSlugMatch[1] : null;

    const bodyText = document.body.innerText || '';
    // Match "The 480m 12:18 A5 at Newcastle" — stop before "will" or punctuation
    const rm = bodyText.match(/The\s+(\d+m)\s+[\d:]+\s+([A-Z0-9]+)\s+at\s+(\w[\w ]*?)(?:\s+will|[.,\n]|$)/m);

    // Clean display name from URL slug: "central-park" → "Central Park"
    const trackDisplay = urlSlug
      ? urlSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : (rm ? rm[3].trim() : null);

    const trackKey = normaliseTrack(urlSlug || (rm ? rm[3].trim() : null));

    return {
      distance: rm ? rm[1] : null,
      grade:    rm ? rm[2] : null,
      track:    trackDisplay,
      trackKey
    };
  }

  // ── V4 Grade-par time delta ───────────────────────────────
  // Returns avg seconds FASTER than grade par (positive = faster = better)
  // Uses all same-track same-grade runs, decay weighted
  function calcParTimeDelta(allRows, trackKey, currentGrade, n, distFilter, raceDist) {
    const par = trackKey && currentGrade ? PAR_TIMES[trackKey]?.[currentGrade] : null;
    if (!par) return null;

    // Filter by DISTANCE only (not grade) — par time is distance-based.
    // A dog running 29.18s at Sheffield 500m in A3 is directly comparable
    // to the par time for Sheffield 500m A2 (29.35s). Grade of the past
    // run is irrelevant — what matters is the raw time over the same distance.
    const eligible = allRows.filter(r => {
      const sameDist = !raceDist || (r.distM && Math.abs(r.distM - raceDist) <= 15);
      return sameDist && r.tfTime && r.tfTime > 0;
    }).slice(0, n);

    if (!eligible.length) return null;
    const times   = eligible.map(r => r.tfTime);
    const weights = decayWeights(times.length);
    const avgTime = weightedAvg(times, weights);
    return avgTime != null ? +(par - avgTime).toFixed(3) : null; // positive = faster than par
  }

  // ── V4 Structural trap bias score ────────────────────────
  // Returns win% for this trap at this track from stats dataset
  function structuralTrapWin(trackKey, trap) {
    if (!trackKey || !trap) return null;
    return TRAP_BIAS[trackKey]?.[trap] ?? null;
  }

  // ── V4 Trainer edge lookup ────────────────────────────────
  function trainerEdge(trainerName, trackKey) {
    if (!trainerName || !trackKey) return null;
    const normName = trainerName.trim().replace(/\s+/g,' ');
    // Try exact key first
    const exactKey = `${normName}|${trackKey}`;
    if (TRAINER_DATA[exactKey]) return TRAINER_DATA[exactKey];
    // Fuzzy: apostrophe/case/space normalisation
    const normKey = exactKey.toUpperCase().replace(/[' ]/g,'');
    for (const [k, v] of Object.entries(TRAINER_DATA)) {
      if (k.toUpperCase().replace(/[' ]/g,'') === normKey) return v;
    }
    // Partial: first initial + last name match
    const parts = normName.split(' ');
    if (parts.length >= 2) {
      const initial = parts[0];
      const lastName = parts[parts.length - 1].toUpperCase();
      for (const [k, v] of Object.entries(TRAINER_DATA)) {
        const [kName, kTrack] = k.split('|');
        if (kTrack !== trackKey) continue;
        const kParts = kName.split(' ');
        if (kParts[0] === initial && kParts[kParts.length-1].toUpperCase() === lastName) return v;
      }
    }
    return null;
  }

  // ── Calculate all stats for one dog ──────────────────────
  function calcStats(allRows, currentTrap, raceInfo, trainerName, n){
    const trackKey = raceInfo.trackKey;
    const raceDist = parseDist(raceInfo.distance);
    const currentGrade = raceInfo.grade;

    const sameDist = CFG.distanceFilter && raceDist
      ? allRows.filter(r => r.distM && Math.abs(r.distM - raceDist) <= 15)
      : allRows;
    const recent  = allRows.slice(0, n);
    const recentD = sameDist.slice(0, n);

    const times   = recentD.map(r=>r.tfTime).filter(v=>v&&v>0);
    const rtgs    = recent.map(r=>r.rtg).filter(v=>v&&v>0);
    const secRtgs = recent.map(r=>r.secRtg).filter(v=>v&&v>0);
    const fins    = recent.map(r=>r.finPos).filter(v=>v&&v>0);

    const avgTFTime   = CFG.decayWeighting ? weightedAvg(times, decayWeights(times.length)) : avg(times);
    const avgRtg      = CFG.decayWeighting ? weightedAvg(rtgs,  decayWeights(rtgs.length))  : avg(rtgs);
    const avgSecRtg   = CFG.decayWeighting ? weightedAvg(secRtgs, decayWeights(secRtgs.length)) : avg(secRtgs);  // decay-weighted, consistent with avgRtg
    const consistency = stdDev(fins);

    // V4: grade-par time delta (replaces raw time for speed scoring)
    const parTimeDelta = calcParTimeDelta(allRows, trackKey, currentGrade, n, CFG.distanceFilter, raceDist);

    // V4: structural trap bias from dataset
    const trapWinPct = structuralTrapWin(trackKey, currentTrap) ??
      // fallback to personal history if no dataset match
      (() => {
        const trapAll = allRows.filter(r=>r.trapPos===currentTrap);
        return trapAll.length ? (trapAll.filter(r=>r.finPos===1).length/trapAll.length)*100 : null;
      })();

    const trapSource = TRAP_BIAS[trackKey]?.[currentTrap] != null ? 'structural' : 'personal';

    // Form trend
    const allRtgs = allRows.map(r=>r.rtg).filter(v=>v&&v>0);
    const trend   = avg(allRtgs.slice(0,3))!=null && avg(allRtgs.slice(3,6))!=null
                  ? avg(allRtgs.slice(0,3))-avg(allRtgs.slice(3,6)) : null;

    // Grade suitability — using Chester Ratings (real quality gaps, not equal steps)
    // Positive = dog has been running in higher-rated grades than today = class dropper
    // Negative = dog running up in class
    const curRating    = trackKey && currentGrade ? (CHESTER_RATINGS[trackKey]?.[currentGrade] ?? null) : null;
    const recentRatings = recent.map(r => {
      // Try to get Chester rating for the grade the dog ran in
      const rTrackKey = normaliseTrack(r.track);
      const rRating   = rTrackKey && r.grade ? (CHESTER_RATINGS[rTrackKey]?.[r.grade] ?? null) : null;
      // Fallback: use gradeVal linear if no Chester rating
      return rRating;
    }).filter(v => v != null);
    // gradeSuit: avg rating of recent races MINUS today's race rating
    // Positive = dog has been racing against better opposition = class relief today
    const gradeSuit = curRating != null && recentRatings.length > 0
      ? avg(recentRatings) - curRating
      : null;

    // Legacy gradeVal still needed for some fallback logic
    const curGV    = gradeVal(currentGrade);
    const recentGV = recent.map(r=>r.gradeVal).filter(v=>v!=null);

    // Clean run rate
    const cleanRuns    = recent.filter(r=>r.runType==='clean'||r.runType==='fast_start').length;
    const cleanRunRate = recent.length ? (cleanRuns/recent.length)*100 : null;

    // Momentum
    const gains       = recent.filter(r=>r.bendData).map(r=>r.bendData.gain);
    const avgMomentum = avg(gains);

    // V4: Trainer edge
    const te = trainerEdge(trainerName, trackKey);
    // Score trainer: 0 = no data, positive = profitable at this track
    // Normalise by P&L per runner (winPct vs track average ~18%)
    const trainerScore = te ? (te.p > 0 ? Math.min(100, Math.max(0, te.w)) : 0) : null;

    // Confidence
    const confidence = Math.min(100, Math.round(
      (sameDist.length/Math.max(n,3))*60 + (rtgs.length/Math.max(n,3))*40
    ));

    // Flags
    const flags = [];
    if(CFG.distanceFilter && raceDist && sameDist.length===0)
      flags.push({type:'warn',icon:'📏',text:'No same-distance runs'});
    else if(CFG.distanceFilter && raceDist && sameDist.length<3)
      flags.push({type:'info',icon:'📏',text:`Only ${sameDist.length} same-dist runs`});
    if(parTimeDelta!=null && parTimeDelta>0.3)
      flags.push({type:'good',icon:'⚡',text:`${fmt(parTimeDelta,2)}s faster than grade par`});
    if(parTimeDelta!=null && parTimeDelta<-0.3)
      flags.push({type:'warn',icon:'🐢',text:`${fmt(Math.abs(parTimeDelta),2)}s slower than grade par`});
    if(curGV!=null && avg(recentGV)!=null){
      const diff=avg(recentGV)-curGV;
      if(diff>=2)  flags.push({type:'good',icon:'⬇',text:`Drops ${diff.toFixed(1)} grades`});
      if(diff<=-2) flags.push({type:'warn',icon:'⬆',text:`Rises ${Math.abs(diff).toFixed(1)} grades`});
    }
    if(trend!=null && trend>5)  flags.push({type:'good',icon:'📈',text:`Rating improving +${fmt(trend,0)}`});
    if(trend!=null && trend<-5) flags.push({type:'warn',icon:'📉',text:`Rating declining ${fmt(trend,0)}`});
    if(te) {
      const pnlStr = `${te.p >= 0 ? '+' : ''}£${te.p}`;
      const flagType = te.p >= 0 ? 'good' : 'info';
      flags.push({type:flagType, icon:'🎓', text:`${trainerName?.split(' ').slice(-1)[0]} ${te.w}%W ${pnlStr} (${te.r} runs)`});
    }
    if(trapSource==='structural')
      flags.push({type:'info',icon:'🏟',text:`T${currentTrap} structural: ${trapWinPct?.toFixed(1)}% at ${trackKey}`});

    return {
      avgTFTime, parTimeDelta, trapSource,
      bestTFTime:  times.length?Math.min(...times):null,
      worstTFTime: times.length?Math.max(...times):null,
      avgRtg, avgSecRtg, consistency,
      trapWinPct, trend, gradeSuit,
      cleanRunRate, avgMomentum, trainerScore,
      trainerEdge: te, trainerName,
      confidence, flags,
      fins, nUsed:recent.length,
      sameDistCount:sameDist.length
    };
  }

  // ── Scoring engine ────────────────────────────────────────
  function scoreDogs(dogs){
    const W = {
      speed:'wSpeed', rating:'wRating', sectional:'wSectional',
      consistency:'wConsistency', trapAffinity:'wTrapAffinity', trend:'wTrend',
      grade:'wGrade', cleanRun:'wCleanRun', momentum:'wMomentum', trainer:'wTrainer'
    };

    // V4: Speed uses parTimeDelta (faster than par) instead of raw time
    // parTimeDelta: higher = faster than par = better → 'desc'
    // Field-level Z-scores (for dominance display — same values rankScore uses)
    const _speedVals  = dogs.map(d=>d.stats?.parTimeDelta??d.stats?.avgTFTime??null);
    const _speedDir   = dogs.some(d=>d.stats?.parTimeDelta!=null);  // true = higher is faster
    const _ratingVals = dogs.map(d=>d.stats?.avgRtg    ??null);
    const _sectVals   = dogs.map(d=>d.stats?.avgSecRtg ??null);
    const _cleanVals  = dogs.map(d=>d.stats?.cleanRunRate??null);
    // For speed, faster (higher parTimeDelta) is better, so z-score is already correct direction
    const zSpeed   = fieldZScore(_speedVals);
    const zRating  = fieldZScore(_ratingVals);
    const zSect    = fieldZScore(_sectVals);
    const zClean   = fieldZScore(_cleanVals);

    const sSpeed    = rankScore(_speedVals,
                                _speedDir?'desc':'asc');
    const sRating   = rankScore(_ratingVals,'desc');
    const sSect     = rankScore(_sectVals,  'desc');
    const sConsist  = rankScore(dogs.map(d=>d.stats?.consistency  ??null),'asc');
    const sTrap     = rankScore(dogs.map(d=>d.stats?.trapWinPct   ??null),'desc');
    const sTrend    = rankScore(dogs.map(d=>d.stats?.trend        ??null),'desc');
    const sGrade    = rankScore(dogs.map(d=>d.stats?.gradeSuit    ??null),'desc');
    const sClean    = rankScore(dogs.map(d=>d.stats?.cleanRunRate ??null),'desc');
    const sMoment   = rankScore(dogs.map(d=>d.stats?.avgMomentum ??null),'desc');
    const sTrainer  = rankScore(dogs.map(d=>d.stats?.trainerScore ??null),'desc');

    return dogs.map((dog,i)=>{
      const s=dog.stats;
      const parLabel = s?.parTimeDelta!=null
        ? `${s.parTimeDelta>=0?'+':''}${fmt(s.parTimeDelta,2)}s vs par`
        : `${fmt(s?.avgTFTime)}s (no par)`;

      const breakdown={
        speed:       {score:sSpeed[i],   pts:sSpeed[i]  !=null?sSpeed[i]  *CFG.wSpeed       :null, label:'Speed vs Grade Par',   fmt:parLabel},
        rating:      {score:sRating[i],  pts:sRating[i] !=null?sRating[i] *CFG.wRating      :null, label:'Form Rating',          fmt:fmt(s?.avgRtg,0)},
        sectional:   {score:sSect[i],    pts:sSect[i]   !=null?sSect[i]   *CFG.wSectional   :null, label:'Sectional Rating',     fmt:fmt(s?.avgSecRtg,0)},
        consistency: {score:sConsist[i], pts:sConsist[i]!=null?sConsist[i]*CFG.wConsistency :null, label:'Consistency (σ)',      fmt:`σ ${fmt(s?.consistency,1)}`},
        trapAffinity:{score:sTrap[i],    pts:sTrap[i]   !=null?sTrap[i]   *CFG.wTrapAffinity:null, label:`Trap ${dog.trap} ${s?.trapSource==='structural'?'(structural)':'(personal)'}`, fmt:`${pct(s?.trapWinPct)}`},
        trend:       {score:sTrend[i],   pts:sTrend[i]  !=null?sTrend[i]  *CFG.wTrend      :null, label:'Form Trend',           fmt:s?.trend!=null?(s.trend>=0?'▲ +':'▼ ')+fmt(Math.abs(s.trend),1):'–'},
        grade:       {score:sGrade[i],   pts:sGrade[i]  !=null?sGrade[i]  *CFG.wGrade      :null, label:'Grade Suitability',    fmt:s?.gradeSuit!=null?(s.gradeSuit>=0?'▼ +':'▲ ')+fmt(Math.abs(s.gradeSuit),1):'–'},
        cleanRun:    {score:sClean[i],   pts:sClean[i]  !=null?sClean[i]  *CFG.wCleanRun   :null, label:'Clean Run Rate',       fmt:pct(s?.cleanRunRate)},
        momentum:    {score:sMoment[i],  pts:sMoment[i] !=null?sMoment[i] *CFG.wMomentum   :null, label:'Finishing Momentum',   fmt:s?.avgMomentum!=null?(s.avgMomentum>=0?'+':'')+fmt(s.avgMomentum,1)+' places':'–'},
        trainer:     {score:sTrainer[i], pts:sTrainer[i]!=null?sTrainer[i]*CFG.wTrainer     :null, label:'Trainer Edge',         fmt:s?.trainerEdge?`${s.trainerEdge.p>=0?'+':''}£${s.trainerEdge.p} ${s.trainerEdge.w}%W`:'No data'},
      };

      const available  = Object.entries(breakdown).filter(([,p]) => p.pts != null);
      const totalPts   = available.reduce((sum,[,p]) => sum + p.pts, 0);

      // Score against FULL possible maximum (all weighted components),
      // not just the ones with data. Missing data = 0 pts for that component.
      // This prevents a dog with only 1-2 data points scoring inflated 100s.
      const fullMaxPts = Object.keys(W).reduce((sum, k) => sum + (CFG[W[k]] || 0), 0);

      // Minimum data check: require data for components worth at least 30pts combined
      // (Speed=28 + Rating=22 + Sectional=18 = 68pts possible; 30pt threshold means
      //  at least one of the major components must be present)
      const availableWeight = available.reduce((sum,[k]) => sum + (CFG[W[k]] || 0), 0);
      const MIN_DATA_WEIGHT = 30; // minimum pts-worth of data required for a valid score

      const score = (fullMaxPts > 0 && availableWeight >= MIN_DATA_WEIGHT)
        ? Math.round((totalPts / fullMaxPts) * 100)
        : null; // null = show ? in sidebar — insufficient data to score

      return {...dog, score, breakdown,
        zScores: {
          speed:  zSpeed[i],
          rating: zRating[i],
          sect:   zSect[i],
          clean:  zClean[i],
        }
      };
    });
  }

  // ── Score colours ─────────────────────────────────────────
  function scoreColor(s){
    if(s==null)return'#555';
    if(s>=80)return'#00e676';
    if(s>=65)return'#69f0ae';
    if(s>=50)return'#ffeb3b';
    if(s>=35)return'#ff9800';
    return'#ef5350';
  }
  function confidenceColor(c){return c>=80?'#00e676':c>=50?'#ffeb3b':'#ef5350';}

  // ── Parse Timeform Betting Forecast ──────────────────────
  function parseBettingForecast(){
    const forecastEl=document.querySelector('p.rpf-betting-forecast');
    if(!forecastEl)return new Map();
    const map=new Map();
    const bTags=[...forecastEl.querySelectorAll('b')].filter(b=>/\d/.test(b.textContent));
    bTags.forEach(bTag=>{
      const oddsStr=bTag.textContent.trim();
      let nameText='';
      let node=bTag.nextSibling;
      while(node&&!(node.nodeName==='B'&&/\d/.test(node.textContent))){
        if(node.nodeType===3)nameText+=node.textContent;
        node=node.nextSibling;
      }
      const name=nameText.replace(/^[\s,]+|[\s,]+$/g,'').toUpperCase().trim();
      if(!name||!oddsStr)return;
      const decimal=fractionalToDecimal(oddsStr);
      const impliedPct=decimal?(1/decimal)*100:null;
      map.set(name,{oddsStr,decimal,impliedPct});
    });
    return map;
  }

  function fractionalToDecimal(str){
    if(!str)return null;
    const clean=str.replace(/jf|JF|f|F/g,'').trim();
    if(clean.includes('/')){const[n,d]=clean.split('/').map(Number);return(d&&!isNaN(n)&&!isNaN(d))?+(n/d+1).toFixed(3):null;}
    const f=parseFloat(clean);return isNaN(f)?null:f;
  }

  function matchForecast(dogName,forecastMap){
    const key=dogName.toUpperCase().trim();
    if(forecastMap.has(key))return forecastMap.get(key);
    for(const[k,v]of forecastMap){if(k.replace(/\s+/g,'')=== key.replace(/\s+/g,''))return v;}
    for(const[k,v]of forecastMap){if(key.includes(k)||k.includes(key))return v;}
    return null;
  }

  function calcImpliedProbs(scoredDogs){
    const scores=scoredDogs.map(d=>Math.max(d.score??1,1));
    const total=scores.reduce((a,b)=>a+b,0);
    return scores.map(s=>(s/total)*100);
  }

  function evColor(ev){
    if(ev==null)return'#555';
    if(ev>=15)return'#00e676';if(ev>=5)return'#69f0ae';
    if(ev>=-5)return'#ffeb3b';if(ev>=-15)return'#ff9800';
    return'#ef5350';
  }
  function evLabel(ev){
    if(ev==null)return'–';
    if(ev>=15)return'🔥 Strong Value';if(ev>=5)return'✅ Value';
    if(ev>=-5)return'➖ Fair';if(ev>=-15)return'⚠ Slight Overbet';
    return'❌ Overbet';
  }

  // ── Build sidebar HTML ────────────────────────────────────
  function buildSidebarHTML(raceInfo, scoredDogs){
    const sorted    =[...scoredDogs].sort((a,b)=>(b.score??-1)-(a.score??-1));
    const _s1 = sorted[0]?.score ?? null;
    const _s2 = sorted[1]?.score ?? null;
    const scoreMargin = (_s1!=null&&_s2!=null) ? Math.round(_s1-_s2) : null;
    const medals    =['🥇','🥈','🥉'];
    const barColors =['#4fc3f7','#81c784','#ffb74d','#ce93d8','#4db6ac','#f48fb1','#a5d6a7','#ef9a9a','#fff59d','#80cbc4'];
    const barKeys   =['speed','rating','sectional','consistency','trapAffinity','trend','grade','cleanRun','momentum','trainer'];
    const wKeys     ={speed:'wSpeed',rating:'wRating',sectional:'wSectional',consistency:'wConsistency',
                      trapAffinity:'wTrapAffinity',trend:'wTrend',grade:'wGrade',cleanRun:'wCleanRun',
                      momentum:'wMomentum',trainer:'wTrainer'};

    const forecast     = parseBettingForecast();
    const impliedProbs = calcImpliedProbs(sorted);

    // Find the favourite (shortest decimal odds)
    let favName = null;
    let favMinOdds = Infinity;
    for(const[name,data]of forecast){
      if(data.decimal && data.decimal < favMinOdds){favMinOdds=data.decimal;favName=name;}
    }

    const raceHeader=`
      <div class="tfe-race-info">
        <span class="tfe-race-dist">${raceInfo.distance||'?'}</span>
        <span class="tfe-race-grade">${raceInfo.grade||'?'}</span>
        <span class="tfe-race-track">${raceInfo.track||''}</span>
        ${raceInfo.trackKey?`<span class="tfe-forecast-badge">📊 ${raceInfo.trackKey}</span>`:''}
        ${forecast.size?'<span class="tfe-forecast-badge">TF Forecast ✓</span>':''}
        ${scoreMargin!=null?`<span class="tfe-margin-badge ${scoreMargin>=15?'tfe-margin-hot':scoreMargin>=10?'tfe-margin-warm':'tfe-margin-cool'}">▲${scoreMargin}pts clear</span>`:''}
      </div>`;

    const cards=sorted.map((dog,rank)=>{
      const sc   =dog.score;
      const col  =scoreColor(sc);
      const trap =dog.trap||0;
      const conf =dog.stats?.confidence??0;
      const confCol=confidenceColor(conf);

      const fcData     =matchForecast(dog.name,forecast);
      const modelPct   =impliedProbs[rank];
      const forecastPct=fcData?.impliedPct??null;
      const ev=(modelPct!=null&&forecastPct!=null)?+((modelPct/forecastPct-1)*100).toFixed(1):null;
      const evCol=evColor(ev);
      const isFav=favName&&dog.name.toUpperCase().trim()===favName;

      const bars=barKeys.map((k,ki)=>{
        const bd=dog.breakdown[k];
        if(!bd||bd.pts==null)return'';
        const w=Math.max(2,Math.round((bd.pts/(CFG[wKeys[k]]||1))*32));
        return`<span class="tfe-bar-seg" style="width:${w}px;background:${barColors[ki]}" title="${bd.label}: ${bd.fmt} → ${fmt(bd.pts,1)}pts"></span>`;
      }).join('');

      const flagHTML=(dog.stats?.flags||[]).map(f=>{
        const fc=f.type==='good'?'#1a3a1a':f.type==='warn'?'#3a1a0a':'#1a2a3a';
        const ft=f.type==='good'?'#69f0ae':f.type==='warn'?'#ff9800':'#4a9eff';
        return`<span class="tfe-flag" style="background:${fc};color:${ft}">${f.icon} ${f.text}</span>`;
      }).join('');

      const detailRows=Object.entries(dog.breakdown).map(([,bd])=>`
        <tr>
          <td class="tfe-dt-label">${bd.label}</td>
          <td class="tfe-dt-value">${bd.fmt}</td>
          <td class="tfe-dt-pts">${bd.pts!=null?`<b style="color:#c0d8ff">${fmt(bd.pts,1)}</b>`:'<span style="color:#2a3a4a">–</span>'}</td>
        </tr>`).join('');

      const finStr=(dog.stats?.fins||[]).slice(0,6).map(f=>{
        const c=f===1?'#00e676':f===2?'#69f0ae':f<=3?'#ffeb3b':'#ef5350';
        return`<span style="color:${c};font-weight:800">${f}</span>`;
      }).join('<span style="color:#1a2a3a"> · </span>')||'–';

      const timeRange=dog.stats?.bestTFTime
        ?`${fmt(dog.stats.bestTFTime)}–${fmt(dog.stats.worstTFTime)}s`:'–';

      const _isTop = rank === 0;
      const betSignal = _isTop && ev!=null && ev>=20 && scoreMargin!=null && scoreMargin>=10 && _hasEdge(raceInfo);

      // ── Z-score dominance strip (top pick only) ───────────
      const _zs = dog.zScores || {};
      function _zFmt(z, label) {
        if (z == null) return '';
        const abs = Math.abs(z);
        const col = abs >= 1.5 ? (z > 0 ? '#69f0ae' : '#ef5350')
                  : abs >= 0.8 ? (z > 0 ? '#ffeb3b' : '#ff9800')
                  : '#6a8aaa';
        const sign = z >= 0 ? '+' : '';
        return `<span style="color:${col};font-size:10px;white-space:nowrap" title="${label} z-score vs field">${label} <b>${sign}${z.toFixed(1)}σ</b></span>`;
      }
      const domParts = [
        _zFmt(_zs.rating, 'Rtg'),
        _zFmt(_zs.speed,  'Spd'),
        _zFmt(_zs.sect,   'Sec'),
        _zFmt(_zs.clean,  'Cln'),
      ].filter(Boolean);
      const domStrip = (_isTop && domParts.length)
        ? `<div class="tfe-dom-strip">${domParts.join('<span style="color:#2a4a6a;padding:0 3px">·</span>')}</div>`
        : '';
      const _fairDec   = modelPct > 0 ? 100 / modelPct : null;
      const _fairBf    = _fairDec ? roundToBetfairOdds(_fairDec) : null;
      const _fairStr   = _fairBf ? `<span title="Model fair odds (Betfair increment)" style="color:#8aaac8;font-size:9px;margin-left:2px">fair: ${_fairBf}</span>` : '';
      const evStrip=fcData?`
        <div class="tfe-ev-strip">
          <span class="tfe-odds-badge">${fcData.oddsStr}${isFav?' 📋TF Fav':''}</span>
          <span class="tfe-prob-pair">
            <span class="tfe-prob-model" title="Model implied">${modelPct.toFixed(0)}%</span>
            <span class="tfe-prob-sep">vs</span>
            <span class="tfe-prob-fc" title="Forecast implied">${forecastPct.toFixed(0)}%</span>
          </span>
          <span class="tfe-ev-badge" style="color:${evCol};border-color:${evCol}" title="${evLabel(ev)}">${ev>=0?'+':''}${ev}% EV</span>${_fairStr}
        </div>`:'';

      // Trainer badge in header
      const trainerBadge = dog.stats?.trainerEdge
        ? `<span class="tfe-trainer-badge" title="Profitable trainer at this track">🎓</span>`
        : '';

      return`
        <div class="tfe-dog-card">
          <div class="tfe-dog-header" onclick="this.parentElement.classList.toggle('tfe-open')">
            <span class="tfe-medal">${medals[rank]||(rank+1)+'.'}</span>
            ${trapBadgeHTML(trap)}
            <span class="tfe-dog-name">${dog.name}${trainerBadge}</span>
            <span class="tfe-confidence" style="color:${confCol}" title="Data confidence: ${conf}%">⬤</span>
            <span class="tfe-score-badge" style="color:${col};border-color:${col}">${sc??'?'}</span>
            <span class="tfe-chevron">▾</span>
            ${betSignal?'<span class="tfe-bet-badge">✔ BET</span>':''}
          </div>
          <div class="tfe-bars">${bars}</div>
          ${domStrip}
          ${evStrip}
          ${flagHTML?`<div class="tfe-flags">${flagHTML}</div>`:''}
          <div class="tfe-dog-detail">
            <div class="tfe-quick-stats">
              <span>Fins: ${finStr}</span>
              <span>Range: <b>${timeRange}</b></span>
              <span>Conf: <b style="color:${confCol}">${conf}%</b></span>
            </div>
            <table class="tfe-detail-table">
              <thead><tr><th>Stat</th><th>Value</th><th style="text-align:right">Pts</th></tr></thead>
              <tbody>${detailRows}</tbody>
              <tfoot>
                ${(()=>{
                  const _zRows = [
                    {label:'Rtg σ vs field', val:_zs.rating},
                    {label:'Spd σ vs field', val:_zs.speed},
                    {label:'Sec σ vs field', val:_zs.sect},
                    {label:'Cln σ vs field', val:_zs.clean},
                  ].filter(r=>r.val!=null);
                  if(!_zRows.length) return '';
                  return _zRows.map(r=>{
                    const abs=Math.abs(r.val);
                    const col=abs>=1.5?(r.val>0?'#69f0ae':'#ef5350'):abs>=0.8?(r.val>0?'#ffeb3b':'#ff9800'):'#6a8aaa';
                    const sign=r.val>=0?'+':'';
                    return `<tr><td class="tfe-dt-label" style="font-size:9px">${r.label}</td><td></td><td class="tfe-dt-pts" style="color:${col};font-weight:700">${sign}${r.val.toFixed(1)}σ</td></tr>`;
                  }).join('');
                })()}
                ${fcData?`<tr>
                  <td colspan="2" style="color:#6a9abb;padding:3px 4px;font-size:10px">TF Forecast</td>
                  <td style="text-align:right;padding:3px 4px;color:#b0c8e0;font-size:10px">${fcData.oddsStr} <span style="color:#8899aa">(${forecastPct.toFixed(0)}%)</span></td>
                </tr>
                <tr>
                  <td colspan="2" style="color:#6a9abb;padding:3px 4px;font-size:10px">Model Implied</td>
                  <td style="text-align:right;padding:3px 4px;color:#b0c8e0;font-size:10px">${modelPct.toFixed(0)}%</td>
                </tr>
                <tr>
                  <td colspan="2" style="color:#4a9eff;padding:4px 4px 2px;font-weight:700;font-size:10px;border-top:1px solid #1a3050">EV vs Forecast</td>
                  <td style="text-align:right;padding:4px 4px 2px;border-top:1px solid #1a3050;font-size:13px;font-weight:900;color:${evCol}">${ev>=0?'+':''}${ev}%</td>
                </tr>`:''}
                <tr>
                  <td colspan="2" class="tfe-total-label">TOTAL SCORE</td>
                  <td class="tfe-total-score" style="color:${col}">${sc??'?'}<span class="tfe-total-denom">/100</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>`;
    }).join('');

    const distFilter=CFG.distanceFilter?`<span class="tfe-filter-badge">📏 ${raceInfo.distance} only</span>`:'';
    const decayBadge=CFG.decayWeighting?`<span class="tfe-filter-badge">⏱ Decay weighted</span>`:'';
    const v4Badge=`<span class="tfe-filter-badge" style="color:#4db6ac;border-color:#4db6ac">V4 ✦ Track Data</span>`;

    return`
      <div class="tfe-sidebar-inner">
        <div class="tfe-sb-header">
          <span class="tfe-sb-title">GREYHOUND EDGE</span><span style="font-size:9px;background:#1a3060;color:#7aaaff;padding:2px 7px;border-radius:4px;font-weight:600;margin-left:4px">v5</span>
          <span class="tfe-sb-race">${raceInfo.distance||''} ${raceInfo.grade||''} ${raceInfo.track||''}</span>
          <button class="tfe-sb-close" id="tfe-close-btn">✕</button>
        </div>
        <div class="tfe-sb-legend">
          ${['Spd','Rtg','Sect','Con','Trap','Trend','Grade','Clean','Mom','Trainer'].map((l,i)=>
            `<span class="tfe-legend-dot" style="background:${barColors[i]}"></span>${l}`
          ).join(' ')}
        </div>
        ${(distFilter||decayBadge||v4Badge)?`<div class="tfe-filter-row">${v4Badge}${distFilter}${decayBadge}</div>`:''}
        <div class="tfe-dogs-list">${cards}</div>
        <div class="tfe-sb-footer">
          <span>${sorted[0]?.allRows?.length > CFG.nRuns ? `${sorted[0].allRows.length} runs loaded ✓` : `Last ${CFG.nRuns} runs`} · click to expand</span>
          <button id="tfe-rescore-btn" class="tfe-rescore-btn" title="Re-score with current weights and overwrite saved data">↺ Re-score</button>
          <button id="tfe-odds-btn" class="tfe-odds-btn">🟢 Betfair Odds</button>
          <button id="tfe-bestpicks-btn" class="tfe-action-btn" title="Show today's best picks">⭐ Best Picks</button>
          <button id="tfe-prerace-csv-btn" class="tfe-action-btn" title="Download today's pre-race selections as CSV">⬇ Pre-race CSV</button>
          <span class="tfe-settings-link" id="tfe-settings-link">⚙ Settings</span>
        </div>
      </div>`;
  }

  // ── Betfair URL builder ───────────────────────────────────
  // Extracts venue and time from Timeform racecard URL.
  // Timeform: /racecards/harlow/1303/2026-05-13/...
  function parseBetfairVenueTime(racecardUrl) {
    const m = racecardUrl.match(/\/racecards\/([^/]+)\/(\d{4})\//);
    if (!m) return null;
    return {
      venue: m[1],                                    // e.g. "harlow"
      time:  m[2].slice(0,2) + ':' + m[2].slice(2)  // "1303" → "13:03"
    };
  }

  // ── Fetch live Betfair exchange odds via background tab ───
  // Two-step: (1) find the market URL, (2) scrape the prices
  function fetchLiveOdds(marketUrl, callback) {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      callback(null, 'Chrome runtime not available');
      return;
    }
    chrome.runtime.sendMessage({ type: 'EXTRACT_BETFAIR_ODDS', url: marketUrl }, response => {
      if (chrome.runtime.lastError) {
        callback(null, chrome.runtime.lastError.message);
      } else if (response?.ok) {
        callback(response.data, null);
      } else {
        callback(null, response?.error || 'Unknown error');
      }
    });
  }

  // ── Match Betfair runner name to Timeform dog name ────────
  // Betfair uses Title Case, Timeform uses UPPER CASE
  function matchOCName(tfName, bfRunners) {
    const key = tfName.toUpperCase().trim().replace(/\s+/g,' ');
    let match = bfRunners.find(r => r.name.toUpperCase().trim() === key);
    if (match) return match;
    match = bfRunners.find(r => r.name.toUpperCase().replace(/\s+/g,'') === key.replace(/\s+/g,''));
    if (match) return match;
    match = bfRunners.find(r => {
      const rk = r.name.toUpperCase().trim();
      return key.includes(rk) || rk.includes(key);
    });
    return match || null;
  }

  // ── Update sidebar with live odds ─────────────────────────
  function applyLiveOdds(liveData, trackMovement = false) {
    if (!liveData?.runners?.length) return;

    const sidebar = document.getElementById('tfe-sidebar');
    if (!sidebar) return;

    sidebar.querySelectorAll('.tfe-dog-card').forEach(card => {
      const nameEl  = card.querySelector('.tfe-dog-name');
      const dogName = nameEl?.textContent?.trim().replace('🎓','').trim();
      if (!dogName) return;

      const ocMatch = matchOCName(dogName, liveData.runners);
      if (!ocMatch || !ocMatch.bestBack) return;

      // ── Price movement tracking ───────────────────────────
      let moveHTML = '';
      if (trackMovement && ocMatch.bestBack) {
        const prev = window._tfePriceHistory[dogName];
        if (prev && Math.abs(ocMatch.bestBack - prev.price) > 0.05) {
          const moved = ocMatch.bestBack - prev.price;
          const pct   = Math.abs(((ocMatch.bestBack / prev.price) - 1) * 100).toFixed(0);
          if (moved < 0) {
            moveHTML = `<span style="color:#33ee88;font-weight:800;font-size:9px" title="Steaming — was ${prev.price}">▼${pct}% STM</span>`;
            card.style.borderColor = '#2a5a3a';
          } else {
            moveHTML = `<span style="color:#ef5350;font-weight:800;font-size:9px" title="Drifting — was ${prev.price}">▲${pct}% DFT</span>`;
            card.style.borderColor = '#5a2a2a';
          }
        } else if (prev) {
          card.style.borderColor = ''; // reset if stable
        }
        window._tfePriceHistory[dogName] = { price: ocMatch.bestBack, prev: prev?.price || null };
      }

      // ── Build or update live strip ────────────────────────
      let liveStrip = card.querySelector('.tfe-live-strip');
      if (!liveStrip) {
        liveStrip = document.createElement('div');
        liveStrip.className = 'tfe-live-strip';
        const evStrip = card.querySelector('.tfe-ev-strip');
        const bars    = card.querySelector('.tfe-bars');
        const ins = evStrip || bars;
        if (ins) ins.insertAdjacentElement('afterend', liveStrip);
        else card.querySelector('.tfe-dog-header').insertAdjacentElement('afterend', liveStrip);
      }

      const isFav    = liveData.favourite?.toUpperCase().trim() === dogName.toUpperCase().trim();
      const implPct  = ocMatch.impliedPct;
      const fracStr  = ocMatch.fractional || ocMatch.bestBack?.toFixed(2) || '–';

      const allCards = [...sidebar.querySelectorAll('.tfe-dog-card')];
      const scores   = allCards.map(c => Math.max(parseInt(c.querySelector('.tfe-score-badge')?.textContent)||1,1));
      const total    = scores.reduce((a,b)=>a+b,0);
      const modelPct = (scores[allCards.indexOf(card)] / total) * 100;

      const ev    = implPct ? +((modelPct / implPct - 1) * 100).toFixed(1) : null;
      const evCol = ev == null ? '#555' : ev >= 15 ? '#00e676' : ev >= 5 ? '#69f0ae' : ev >= -5 ? '#ffeb3b' : ev >= -15 ? '#ff9800' : '#ef5350';
      const evLbl = ev == null ? '–' : ev >= 15 ? '🔥 Strong Value' : ev >= 5 ? '✅ Value' : ev >= -5 ? '➖ Fair' : ev >= -15 ? '⚠ Overbet' : '❌ Overbet';

      liveStrip.innerHTML = `
        <span class="tfe-live-badge">🟢 BF</span>
        <span class="tfe-odds-badge" style="background:#0a2a0a;border-color:#2a5a2a;color:#69f0ae">${fracStr}${isFav?' ⭐FAV':''}</span>
        ${moveHTML}
        <span style="flex:1;font-size:9px;color:#3a5a7a">${modelPct.toFixed(0)}% mdl · ${implPct?.toFixed(0)}% mkt</span>
        <span class="tfe-ev-badge" style="color:${evCol};border-color:${evCol}" title="${evLbl}">${ev!=null?(ev>=0?'+':'')+ev+'%':''} EV</span>`;
    });

    // Footer timestamp
    const footer = sidebar.querySelector('.tfe-sb-footer span:first-child');
    if (footer) {
      const t = new Date(liveData.fetchedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      footer.querySelectorAll('.tfe-bf-stamp').forEach(el => el.remove());
      const stamp = document.createElement('span');
      stamp.className = 'tfe-bf-stamp';
      stamp.style.cssText = 'color:#2a7a4a;font-size:9px';
      stamp.textContent = ` · 🟢 BF ${t}`;
      footer.appendChild(stamp);
    }

    // Button — only update if not in auto-refresh mode
    const btn = sidebar.querySelector('#tfe-odds-btn');
    if (btn && !window._tfeAutoRefresh) {
      btn.textContent = '↺ Refresh BF';
      btn.disabled = false;
    }
  }

  // ── Auto-refresh state ────────────────────────────────────
  // Stores previous prices for movement detection
  // { dogName → { price, trend: 'up'|'down'|'stable', prevPrice } }
  window._tfePriceHistory = window._tfePriceHistory || {};
  window._tfeAutoRefresh  = null; // interval ID
  window._tfeRefreshCount = 0;
  const POLL_INTERVAL_MS  = 10000; // 10 seconds standard
  const POLL_FAST_MS      = 5000;  // 5 seconds final 2 minutes

  function stopAutoRefresh() {
    if (window._tfeAutoRefresh) {
      clearInterval(window._tfeAutoRefresh);
      window._tfeAutoRefresh = null;
      window._tfeRefreshCount = 0;
    }
    // Close the persistent BF tab
    chrome.runtime.sendMessage({ type: 'CLOSE_BETFAIR_TAB' });
    console.log('[GHEdge] Auto-refresh stopped');
  }

  function startAutoRefresh(btn) {
    window._tfeRefreshCount = 0;

    const doPoll = () => {
      chrome.runtime.sendMessage({ type: 'POLL_BETFAIR_TAB' }, response => {
        if (!response?.ok) {
          console.log('[GHEdge] Poll failed:', response?.error);
          // If tab gone — stop
          if (response?.error === 'Tab gone' || response?.error === 'No BF tab open') {
            stopAutoRefresh();
            if (btn) {
              btn.textContent = '🟢 Betfair Odds';
              btn.style.borderColor = '';
              btn.style.color = '';
            }
          }
          return;
        }

        const data = response.data;
        window._tfeRefreshCount++;

        // If market suspended or in-play — stop polling
        if (data.isSuspended || data.isInplay) {
          console.log('[GHEdge] Market in-play/suspended — stopping auto-refresh');
          stopAutoRefresh();
          if (btn) {
            btn.textContent = '🏁 In-play';
            btn.style.borderColor = '#ff9800';
            btn.style.color = '#ff9800';
          }
          applyLiveOdds(data); // Final update
          return;
        }

        // Apply prices with movement tracking
        applyLiveOdds(data, true);

        // Update button to show live status
        if (btn) {
          const t = new Date(data.fetchedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
          btn.textContent = `⏸ Live · ${t}`;
          btn.style.borderColor = '#2a8a50';
          btn.style.color = '#4acc88';
          btn.disabled = false;
        }
      });
    };

    // First poll immediately
    doPoll();

    // Then set interval
    window._tfeAutoRefresh = setInterval(doPoll, POLL_INTERVAL_MS);
    console.log(`[GHEdge] Auto-refresh started — polling every ${POLL_INTERVAL_MS/1000}s`);
  }

  // ── Main ──────────────────────────────────────────────────
  async function buildAndInjectSidebar(){
    document.getElementById('tfe-sidebar')?.remove();

    const dogHeaderTRs=document.querySelectorAll('tr.rpb-entry-details-1');
    if(!dogHeaderTRs.length){console.log('[GHEdge] No dog rows found');return;}

    const raceInfo=parseRaceInfo();
    console.log('[GHEdge] Race:',raceInfo);

    const formTRMap={};
    document.querySelectorAll('tr[class*="rpb-recent-form-"]').forEach(tr=>{
      const m=tr.className.match(/rpb-recent-form-(\d+)/);
      if(m)formTRMap[parseInt(m[1])]=tr;
    });

    // ── Parse dogs from racecard DOM ─────────────────────────
    const dogs=[];
    dogHeaderTRs.forEach((headerTR,idx)=>{
      const trap           = parseTrap(headerTR);
      const formIndex      = parseFormIndex(headerTR);
      const name           = parseDogName(headerTR);
      const trainer        = parseTrainerName(idx);
      const { href: profileHref, dogId } = parseDogProfileLink(headerTR);
      const formTR         = formTRMap[formIndex];
      const racecardRows   = formTR ? parseFormRows(formTR) : [];
      dogs.push({ trap, formIndex, name, trainer, profileHref, dogId, racecardRows });
    });

    if(!dogs.length){console.log('[GHEdge] No dogs');return;}

    // ── Render immediately with racecard-only data ───────────
    // (gives instant sidebar while history loads in background)
    const doScore = (dogList) => {
      dogList.forEach(dog => {
        dog.stats = calcStats(dog.allRows, dog.trap, raceInfo, dog.trainer, CFG.nRuns);
      });
      return scoreDogs(dogList);
    };

    dogs.forEach(dog => { dog.allRows = dog.racecardRows; dog.historyRuns = 0; });
    let scored = doScore(dogs);
    const sidebar=document.createElement('div');
    sidebar.id       ='tfe-sidebar';
    sidebar.className=`tfe-sidebar tfe-sidebar-${CFG.sidebarPos}`;
    sidebar.innerHTML=buildSidebarHTML(raceInfo,scored);
    document.body.appendChild(sidebar);
    wireUpSidebarEvents(sidebar, raceInfo, scored);
    // NOTE: saveRacecardScores is intentionally deferred until after history merge.
    // The tracker always gets the best available data, not racecard-only data.
    console.log(`[GHEdge] ✓ Initial render: ${dogs.length} dogs (racecard only — saving deferred)`);

    // ── Load full history in background ──────────────────────
    const histories = await loadDogHistories(dogs);
    let historyLoaded = false;
    let cacheHits     = false;
    dogs.forEach(dog => {
      const hist = dog.dogId ? histories[dog.dogId] : null;
      if (!hist?.runs?.length) return;
      dog.allRows      = mergeHistory(dog.racecardRows, hist.runs);
      dog.historyRuns  = dog.allRows.length;
      if (dog.allRows.length > dog.racecardRows.length) {
        historyLoaded = true;
        cacheHits     = true;
      }
      console.log(`[GHEdge] ${dog.name}: racecard=${dog.racecardRows.length} + history=${hist.runs.length} → merged=${dog.allRows.length}`);
    });

    if (!historyLoaded) {
      // History tabs are still loading in background — set up a listener
      // so we re-render when any dog's history arrives in storage
      console.log('[GHEdge] History loading in background — watching storage for updates...');
      saveRacecardScores(raceInfo, scored);

      const dogIds = dogs.map(d => d.dogId).filter(Boolean);
      const historyKeys = new Set(dogIds.map(id => `history:${id}`));
      let pendingRender = false;

      const historyWatcher = (changes) => {
        const relevantKey = Object.keys(changes).find(k => historyKeys.has(k));
        if (!relevantKey || pendingRender) return;
        pendingRender = true;

        // Debounce — wait 800ms then re-render once all dogs are likely done
        setTimeout(async () => {
          chrome.storage.onChanged.removeListener(historyWatcher);
          const allHistoryKeys = dogIds.map(id => `history:${id}`);
          chrome.storage.local.get(allHistoryKeys, stored => {
            let anyNew = false;
            dogs.forEach(dog => {
              if (!dog.dogId) return;
              const hist = stored[`history:${dog.dogId}`];
              if (!hist?.runs?.length) return;
              dog.allRows     = mergeHistory(dog.racecardRows, hist.runs);
              dog.historyRuns = dog.allRows.length;
              if (dog.allRows.length > dog.racecardRows.length) anyNew = true;
            });
            if (!anyNew) return;
            const rescored = doScore(dogs);
            const sb = document.getElementById('tfe-sidebar');
            if (sb) {
              sb.innerHTML = buildSidebarHTML(raceInfo, rescored);
              wireUpSidebarEvents(sb, raceInfo, rescored);
            }
            saveRacecardScores(raceInfo, rescored);
            console.log('[GHEdge] ✓ Sidebar updated with background history data');
          });
        }, 800);
      };

      chrome.storage.onChanged.addListener(historyWatcher);

      // Safety timeout — remove listener after 2 minutes regardless
      setTimeout(() => chrome.storage.onChanged.removeListener(historyWatcher), 120000);
      return;
    }

    // ── Re-render sidebar with enriched data ─────────────────
    scored = doScore(dogs);
    const existingSidebar = document.getElementById('tfe-sidebar');
    if (existingSidebar) {
      existingSidebar.innerHTML = buildSidebarHTML(raceInfo, scored);
      wireUpSidebarEvents(existingSidebar, raceInfo, scored);
    }
    saveRacecardScores(raceInfo, scored);
    console.log(`[GHEdge] ✓ History-enriched render complete`);
  }

  // ── Sidebar event wiring (called after initial + re-render) ──
  function wireUpSidebarEvents(sidebar, raceInfo, scored) {
    sidebar.querySelector('#tfe-close-btn')?.addEventListener('click',()=>sidebar.remove());
    sidebar.querySelector('#tfe-settings-link')?.addEventListener('click',()=>alert('Click the 🐕 extension icon in the Chrome toolbar to adjust settings.'));

    // Re-score button
    sidebar.querySelector('#tfe-rescore-btn')?.addEventListener('click', function() {
      const btn = this;
      const urlMatch = location.href.match(/\/([0-9]+)(?:\?|$)/);
      const raceId   = urlMatch ? urlMatch[1] : null;
      if (!raceId) return;
      btn.textContent = '…';
      btn.disabled = true;
      const doRescore = (cfg) => {
        CFG = cfg;
        // Clear race record AND history attempt flags so rescore re-fetches history
      const attemptKeys = scored?.map(d => d.dogId ? `historyAttempt:${d.dogId}` : null).filter(Boolean) ?? [];
      chrome.storage.local.remove([`race:${raceId}`, ...attemptKeys], () => {
          buildAndInjectSidebar();
          setTimeout(() => {
            const b = document.querySelector('#tfe-rescore-btn');
            if (b) { b.textContent = '✓ Saved'; b.disabled = false; }
          }, 1500);
        });
      };
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(DEFAULTS, s => doRescore({...DEFAULTS,...s}));
      } else {
        doRescore(CFG);
      }
    });

    sidebar.querySelector('#tfe-bestpicks-btn')?.addEventListener('click', () => showBestPicksPanel());
    sidebar.querySelector('#tfe-prerace-csv-btn')?.addEventListener('click', () => exportPreraceCSV());

    sidebar.querySelector('#tfe-odds-btn')?.addEventListener('click', function() {
      const btn = this;

      // If already auto-refreshing — stop it
      if (window._tfeAutoRefresh) {
        stopAutoRefresh();
        btn.textContent = '🟢 Betfair Odds';
        btn.style.borderColor = '';
        btn.style.color = '';
        return;
      }

      const parsed = parseBetfairVenueTime(location.href);
      if (!parsed) { btn.textContent = '⚠ URL error'; return; }

      btn.textContent = '⏳ Finding market...';
      btn.disabled = true;

      // Step 1 — find the Betfair market URL
      chrome.runtime.sendMessage({
        type:  'FIND_BETFAIR_MARKET',
        venue: parsed.venue,
        time:  parsed.time
      }, response => {
        if (!response?.ok || !response.data) {
          if (response?.debug) {
            console.log('[GHEdge] Betfair search debug:', JSON.stringify(response.debug));
            btn.textContent = '⚠ Debug — check console';
          } else {
            btn.textContent = '⚠ Market not found';
          }
          btn.disabled = false;
          setTimeout(() => { btn.textContent = '🟢 Betfair Odds'; }, 4000);
          return;
        }

        let marketUrl = typeof response.data === 'string' ? response.data : response.data[0]?.href;
        if (!marketUrl) {
          btn.textContent = '⚠ No match';
          btn.disabled = false;
          setTimeout(() => { btn.textContent = '🟢 Betfair Odds'; }, 3000);
          return;
        }

        // Step 2 — open persistent BF tab and start auto-refresh
        btn.textContent = '⏳ Opening market...';
        chrome.runtime.sendMessage({ type: 'OPEN_BETFAIR_TAB', url: marketUrl }, openRes => {
          if (!openRes?.ok) {
            btn.textContent = '⚠ Tab error';
            btn.disabled = false;
            setTimeout(() => { btn.textContent = '🟢 Betfair Odds'; }, 3000);
            return;
          }

          btn.disabled = false;
          btn.textContent = '⏳ Loading prices...';

          // Wait 4s for the tab to load, then start polling
          setTimeout(() => startAutoRefresh(btn), 4000);
        });
      });
    });

    // Drag
    const hdr=sidebar.querySelector('.tfe-sb-header');
    if(hdr){
      hdr.style.cursor='grab';
      let ox,oy,sx,sy;
      hdr.addEventListener('mousedown',e=>{
        if(e.target.id==='tfe-close-btn')return;
        sidebar.style.right='auto';
        ox=sidebar.offsetLeft;oy=sidebar.offsetTop;
        sx=e.clientX;sy=e.clientY;
        sidebar.style.left=ox+'px';sidebar.style.top=oy+'px';
        const mv=ev=>{sidebar.style.left=ox+ev.clientX-sx+'px';sidebar.style.top=oy+ev.clientY-sy+'px';};
        const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
      });
    }
  }

  // ── Auto-save (first visit only) ─────────────────────────
  function saveRacecardScores(raceInfo,scoredDogs){
    if(typeof chrome==='undefined'||!chrome.storage)return;
    const urlMatch=location.href.match(/\/([0-9]+)(?:\?|$)/);
    const raceId=urlMatch?urlMatch[1]:null;
    if(!raceId||location.href.includes('/results/'))return;

    const key=`race:${raceId}`;
    chrome.storage.local.get(key,existing=>{
      if(existing[key]){console.log(`[GHEdge] Race ${raceId} already saved`);return;}

      const record={
        raceId,url:location.href,raceInfo,timestamp:Date.now(),
        weights:{wSpeed:CFG.wSpeed,wRating:CFG.wRating,wSectional:CFG.wSectional,
                 wConsistency:CFG.wConsistency,wGrade:CFG.wGrade,wTrapAffinity:CFG.wTrapAffinity,
                 wTrend:CFG.wTrend,wCleanRun:CFG.wCleanRun,wMomentum:CFG.wMomentum,wTrainer:CFG.wTrainer},
        dogs:scoredDogs.map(d=>{
          // Compact breakdown: just rankScore (0-1) and pts per component
          const bd = {};
          if (d.breakdown) {
            for (const [k, v] of Object.entries(d.breakdown)) {
              bd[k] = {
                rankScore: v.score != null ? +v.score.toFixed(3) : null,
                pts:       v.pts   != null ? +v.pts.toFixed(2)   : null,
                rawValue:  v.fmt   || null
              };
            }
          }
          return {
            name: d.name, trap: d.trap, score: d.score, trainer: d.trainer,
            // Raw stats (the underlying numbers)
            avgTFTime:    d.stats?.avgTFTime    ?? null,
            parTimeDelta: d.stats?.parTimeDelta ?? null,
            avgRtg:       d.stats?.avgRtg       ?? null,
            avgSecRtg:    d.stats?.avgSecRtg    ?? null,
            consistency:  d.stats?.consistency  ?? null,
            trapWinPct:   d.stats?.trapWinPct   ?? null,
            trapSource:   d.stats?.trapSource   ?? null,
            trend:        d.stats?.trend        ?? null,
            gradeSuit:    d.stats?.gradeSuit    ?? null,
            cleanRunRate: d.stats?.cleanRunRate ?? null,
            avgMomentum:  d.stats?.avgMomentum  ?? null,
            trainerScore: d.stats?.trainerScore ?? null,
            confidence:   d.stats?.confidence   ?? null,
            nUsed:        d.stats?.nUsed        ?? null,
            sameDistCount:d.stats?.sameDistCount ?? null,
            trainerEdge:  d.stats?.trainerEdge  ?? null,
            // Component breakdown (rankScores + points per component)
            breakdown:    bd,
            forecast:     null
          };
        }),
        forecast:{}
      };

      const forecastEl=document.querySelector('p.rpf-betting-forecast');
      if(forecastEl)record.forecast.raw=forecastEl.textContent.trim();

      try{
        const fc=parseBettingForecast();
        record.dogs=record.dogs.map(d=>{
          const fcData=matchForecast(d.name,fc);
          return{...d,forecast:fcData?{oddsStr:fcData.oddsStr,decimal:fcData.decimal,impliedPct:fcData.impliedPct}:null};
        });
      }catch(e){}

      chrome.storage.local.set({[key]:record},()=>{
        console.log(`[GHEdge] ✓ Saved race ${raceId} (${record.dogs.length} dogs) V4 scoring`);
      });
    });
  }


  // ── Pre-race CSV export ───────────────────────────────────
  function exportPreraceCSV() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    chrome.storage.local.get(null, allData => {
      // Use local date (not UTC) to avoid day-boundary issues in UK evenings
      const now   = new Date();
      const today = now.getFullYear() + '-' +
                    String(now.getMonth()+1).padStart(2,'0') + '-' +
                    String(now.getDate()).padStart(2,'0');

      const hdrs = ['Race ID','Date','Time','Venue','Grade','Distance',
                    'Dog','Trap','Rank','Score','Margin','Model%','FC%','EV%','FC Odds','BET Signal','URL'];
      const rows = [hdrs.join(',')];

      Object.entries(allData).forEach(([key, rec]) => {
        if (!key.startsWith('race:')) return;
        // Local date comparison
        const ts  = rec.timestamp;
        if (!ts) return;
        const d   = new Date(ts);
        const ds  = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        if (ds !== today) return;

        const ri   = rec.raceInfo || {};
        // Sort by score desc — same order as sidebar
        const srt  = (rec.dogs || []).slice().sort((a,b) => (b.score??-1)-(a.score??-1));
        if (!srt.length) return;

        // Recalculate model implied% from stored scores (same as calcImpliedProbs)
        const rawScores = srt.map(d => Math.max(d.score ?? 1, 1));
        const total     = rawScores.reduce((a,b) => a+b, 0);
        const modelPcts = rawScores.map(s => (s / total) * 100);

        const s1  = srt[0]?.score ?? null;
        const s2  = srt[1]?.score ?? null;
        const mg  = (s1!=null && s2!=null) ? Math.round(s1-s2) : '';

        srt.forEach((dog, rank) => {
          const modelPct = modelPcts[rank];
          const fcPct    = dog.forecast?.impliedPct ?? null;
          const ev       = (modelPct != null && fcPct != null)
            ? +((modelPct / fcPct - 1) * 100).toFixed(1) : '';
          const bet      = (rank===0 && ev!=='' && ev>=10 && mg!=='' && mg>=10 && _hasEdge(ri)) ? 'YES' : '';
          const e        = v => '"' + String(v??'').replace(/"/g,'""') + '"';
          rows.push([
            rec.raceId, ds,
            (()=>{ const _m=(rec.url||'').match(/\/(\d{4})\/\d{4}-/); return _m?_m[1].slice(0,2)+':'+_m[1].slice(2):''; })(), e(ri.track||''), ri.grade||'', ri.distance||'',
            e(dog.name||''), dog.trap||'',
            rank+1, dog.score??'',
            rank===0 ? mg : '',
            modelPct!=null ? modelPct.toFixed(1) : '',
            fcPct!=null    ? fcPct.toFixed(1)    : '',
            ev,
            e(dog.forecast?.oddsStr||''),
            bet,
            e(rec.url||'')
          ].join(','));
        });
      });

      if (rows.length <= 1) { alert('No pre-race data found for today.\n\nMake sure you\'ve visited racecards today before clicking this.'); return; }
      const blob = new Blob([rows.join('\n')], {type:'text/csv'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'TFE_prerace_' + today + '.csv';
      a.click();
    });
  }

    // ── Best Picks panel ─────────────────────────────────────
  function showBestPicksPanel() {
    document.getElementById('tfe-bestpicks-panel')?.remove();
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    chrome.storage.local.get(null, allData => {
      const _now = new Date();
      const today = _now.getFullYear()+'-'+String(_now.getMonth()+1).padStart(2,'0')+'-'+String(_now.getDate()).padStart(2,'0');
      const picks = [];

      Object.entries(allData).forEach(([key, rec]) => {
        if (!key.startsWith('race:')) return;
        if (!rec.timestamp) return;
        const _d = new Date(rec.timestamp);
        const ds = _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');
        if (ds !== today) return;
        const ri  = rec.raceInfo || {};
        const srt = (rec.dogs||[]).slice().sort((a,b)=>(b.score??-1)-(a.score??-1));
        if (!srt.length) return;
        const top = srt[0];
        const s1  = top.score ?? null;
        const s2  = srt[1]?.score ?? null;
        const mg  = (s1!=null&&s2!=null) ? Math.round(s1-s2) : null;
        const fc  = top.forecast;
        // Recalculate model implied% from stored scores
        const _rawSc = srt.map(d => Math.max(d.score??1,1));
        const _tot   = _rawSc.reduce((a,b)=>a+b,0);
        const _mPct  = _tot > 0 ? (_rawSc[0]/_tot)*100 : null;
        const ev  = (_mPct!=null && fc?.impliedPct!=null)
          ? +((_mPct/fc.impliedPct-1)*100).toFixed(1) : null;
        const bet = ev!=null && ev>=10 && mg!=null && mg>=10 && _hasEdge(ri);
        const timeStr = ri.time || (rec.url||'').match(/\/(\d{4})\//)?.[1]?.replace(/(\d\d)(\d\d)/,'$1:$2') || '';
        picks.push({time:timeStr, venue:ri.track||'', grade:ri.grade||'',
                    dog:top.name, trap:top.trap, score:top.score,
                    margin:mg, ev, fcOdds:fc?.oddsStr||'', betSignal:bet, url:rec.url||''});
      });

      if (!picks.length) { alert('No pre-race data for today yet.'); return; }
      picks.sort((a,b) => (b.betSignal-a.betSignal) || ((b.margin??-1)-(a.margin??-1)));

      const betCount = picks.filter(p=>p.betSignal).length;
      const trapStyle = t => {
        const m={1:{bg:'#cc0000',c:'#fff'},2:{bg:'#003399',c:'#fff'},3:{bg:'#fff',c:'#111'},
                 4:{bg:'#111',c:'#fff'},5:{bg:'#f80',c:'#fff'},6:{bg:'#fff',c:'#c00'}};
        const s=m[t]||{bg:'#444',c:'#fff'};
        return `background:${s.bg};color:${s.c}`;
      };

      const tbody = picks.map(p => {
        const bet  = p.betSignal
          ? '<span style="background:#0d2e0d;color:#00e676;border:1px solid #00c853;border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700">\u2714 BET</span>' : '';
        const evS  = p.ev!=null ? (p.ev>=0?'+':'')+p.ev+'%' : '\u2013';
        const evC  = p.ev!=null&&p.ev>=10?'#69f0ae':p.ev!=null&&p.ev>=0?'#ffeb3b':'#ef5350';
        const mgC  = p.margin!=null&&p.margin>=15?'#69f0ae':p.margin!=null&&p.margin>=10?'#ffeb3b':'#7aaad0';
        const scC  = p.score>=70?'#69f0ae':p.score>=55?'#ffeb3b':p.score>=40?'#ff9800':'#ef5350';
        const link = p.url ? `<a href="${p.url}" style="color:#4db6ac;text-decoration:none">${p.time}</a>` : p.time;
        return `<tr style="border-bottom:1px solid #0d1e30">
          <td style="padding:5px 8px;color:#c0d8f0;white-space:nowrap">${link}</td>
          <td style="padding:5px 6px;color:#8ab0cc;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis">${p.venue}</td>
          <td style="padding:5px 6px;color:#7aaad0">${p.grade}</td>
          <td style="padding:5px 6px"><span style="${trapStyle(p.trap)};border-radius:3px;padding:1px 6px;font-weight:700;font-size:10px">${p.trap||'?'}</span></td>
          <td style="padding:5px 6px;color:#d8eaf8;font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.dog}</td>
          <td style="padding:5px 6px;color:${scC};font-weight:700;text-align:right">${p.score??'?'}</td>
          <td style="padding:5px 6px;color:${mgC};font-weight:700;text-align:right">${p.margin!=null?'\u25b2'+p.margin:'\u2013'}</td>
          <td style="padding:5px 6px;color:${evC};font-weight:700;text-align:right">${evS}</td>
          <td style="padding:5px 6px;color:#a0b8cc;text-align:right">${p.fcOdds}</td>
          <td style="padding:5px 8px;text-align:center">${bet}</td>
        </tr>`;
      }).join('');

      const panel = document.createElement('div');
      panel.id = 'tfe-bestpicks-panel';
      panel.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);width:700px;max-width:96vw;max-height:80vh;z-index:1000000;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,0.75);font-family:Segoe UI,system-ui,sans-serif;font-size:12px;overflow:auto';
      panel.innerHTML = `
        <div style="background:#070710;border:1px solid #1e3a5f;border-radius:10px;overflow:hidden">
          <div id="tfe-bp-hdr" style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:linear-gradient(135deg,#0a1e3a,#070710);border-bottom:1px solid #1a3050;cursor:grab">
            <span style="font-size:11px;font-weight:800;color:#4a9eff;letter-spacing:.06em;text-transform:uppercase">\u2b50 Best Picks \u2014 Today</span>
            <span style="font-size:10px;color:#5a7a9a;flex:1">${picks.length} races \u00b7 <span style="color:${betCount?'#00e676':'#3a5a7a'}">${betCount} BET signal${betCount!==1?'s':''}</span></span>
            <button onclick="document.getElementById('tfe-bestpicks-panel').remove()" style="background:none;border:1px solid #1e2e40;color:#3a5a7a;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:11px">\u2715</button>
          </div>
          <div style="padding:4px 12px;background:#050508;border-bottom:1px solid #0a1220;font-size:9px;color:#3a5a7a">
            \u2714 BET = top pick with EV \u2265 10% AND score margin \u2265 10pts AND supported condition (excl. D-grades, 480m/400m, Monmore) &nbsp;\u00b7&nbsp; sorted: BET signals first, then margin descending
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:560px">
              <thead>
                <tr style="background:#050508;border-bottom:1px solid #1a3050">
                  <th style="padding:5px 8px;text-align:left;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Time</th>
                  <th style="padding:5px 6px;text-align:left;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em">Venue</th>
                  <th style="padding:5px 6px;text-align:left;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em">Grd</th>
                  <th style="padding:5px 6px;text-align:left;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em">Trp</th>
                  <th style="padding:5px 6px;text-align:left;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em">Dog</th>
                  <th style="padding:5px 6px;text-align:right;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em">Score</th>
                  <th style="padding:5px 6px;text-align:right;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em">Margin</th>
                  <th style="padding:5px 6px;text-align:right;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em">EV%</th>
                  <th style="padding:5px 6px;text-align:right;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em">FC Odds</th>
                  <th style="padding:5px 8px;text-align:center;color:#1e3a5a;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em">Signal</th>
                </tr>
              </thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>
          <div style="padding:6px 12px;background:#050508;border-top:1px solid #0a1220;display:flex;gap:6px;align-items:center">
            <button onclick="exportPreraceCSV()" style="font-size:9px;padding:2px 8px;background:#0a1a2a;border:1px solid #1a3a5a;border-radius:3px;color:#4a9eff;cursor:pointer">\u2b07 Pre-race CSV</button>
            <button onclick="document.getElementById('tfe-bestpicks-panel').remove()" style="font-size:9px;padding:2px 8px;background:#1a0a0a;border:1px solid #2a1a1a;border-radius:3px;color:#6a3a3a;cursor:pointer">Close</button>
          </div>
        </div>`;
      document.body.appendChild(panel);

      // draggable
      let ox,oy,sx,sy;
      const hd = panel.querySelector('#tfe-bp-hdr');
      hd.addEventListener('mousedown', e => {
        if(e.target.tagName==='BUTTON') return;
        panel.style.left  = panel.getBoundingClientRect().left+'px';
        panel.style.transform = 'none';
        ox=panel.offsetLeft; oy=panel.offsetTop; sx=e.clientX; sy=e.clientY;
        const mv=ev=>{panel.style.left=ox+ev.clientX-sx+'px';panel.style.top=oy+ev.clientY-sy+'px';};
        const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
        document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
      });
    });
  }


  // ══════════════════════════════════════════════════════════
  // Full career history loader
  // ══════════════════════════════════════════════════════════

  // Fetches full career history for all dogs in parallel.
  // Returns a map of dogId → { runs[], fetchedAt } (from cache or fresh fetch).
  // Dogs without a profileUrl or whose fetch fails are absent from the map.
  async function loadDogHistories(dogs, forceRefetch = false) {
    if (typeof chrome === 'undefined' || !chrome.storage) return {};

    const CACHE_TTL   = 7 * 24 * 60 * 60 * 1000;
    const ATTEMPT_TTL = 7 * 24 * 60 * 60 * 1000;
    const now         = Date.now();
    const results     = {};

    // ── Try pre-fetched data from local morning scraper first ──
    // Routes through background worker — content scripts can't fetch
    // localhost directly (blocked by Timeform's page CSP).
    if (!forceRefetch) {
      const prebuilt = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'FETCH_SCRAPER_DATA' }, response => {
          resolve(response?.ok ? response.data : null);
        });
      });
      if (prebuilt) {
        let hits = 0;
        dogs.forEach(dog => {
          if (dog.dogId && prebuilt[dog.dogId]) {
            results[dog.dogId] = prebuilt[dog.dogId];
            hits++;
          }
        });
        if (hits > 0) {
          console.log(`[GHEdge] Pre-fetched data: ${hits}/${dogs.length} dogs from localhost`);
          return results;  // all done — no tabs needed
        }
      }
    }

    // Gather all storage keys for one batch read
    const validDogs  = dogs.filter(d => d.profileHref && d.dogId);
    if (!validDogs.length) return results;

    const allKeys = validDogs.flatMap(d => [
      `history:${d.dogId}`,
      `historyAttempt:${d.dogId}`,
    ]);

    // Single read for all dogs — avoids 6 parallel reads racing each other
    const stored = await new Promise(res =>
      chrome.storage.local.get(allKeys, res)
    );

    // Decide which dogs need fetching
    const toFetch = validDogs.filter(dog => {
      const cached  = stored[`history:${dog.dogId}`];
      const attempt = stored[`historyAttempt:${dog.dogId}`];

      if (cached?.runs?.length && (now - cached.fetchedAt) < CACHE_TTL) {
        results[dog.dogId] = cached;  // cache hit — use immediately
        return false;
      }
      if (!forceRefetch && attempt && (now - attempt.at) < ATTEMPT_TTL) {
        return false;  // already tried recently — skip silently
      }
      return true;  // needs a fresh fetch
    });

    if (!toFetch.length) return results;

    // Write ALL attempt flags in one atomic batch BEFORE opening any tabs.
    // This prevents re-opening tabs if the page is visited again mid-fetch.
    const attemptBatch = {};
    toFetch.forEach(dog => { attemptBatch[`historyAttempt:${dog.dogId}`] = { at: now }; });
    await new Promise(res => chrome.storage.local.set(attemptBatch, res));

    // Now fetch all in parallel
    await Promise.all(toFetch.map(dog => new Promise(resolve => {
      chrome.runtime.sendMessage(
        { type: 'FETCH_DOG_HISTORY', url: dog.profileHref },
        response => {
          if (response?.ok && response.data?.runs?.length) {
            chrome.storage.local.set({ [`history:${dog.dogId}`]: response.data });
            results[dog.dogId] = response.data;
          }
          resolve();
        }
      );
    })));

    return results;
  }

  // Merges cached/fetched history into a dog's allRows array.
  // Deduplicates by date + track + dist so racecard rows are never doubled.
  function mergeHistory(racecardRows, historyRuns) {
    if (!historyRuns?.length) return racecardRows;

    const existingKeys = new Set(
      racecardRows.map(r => `${r.date||''}|${r.track}|${r.dist}`)
    );

    // History runs come newest-first from Timeform; racecard rows are also newest-first.
    // We want the merged array newest-first, deduped.
    const newRuns = historyRuns.filter(r => {
      const key = `${r.date||''}|${r.track}|${r.dist}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    // Merge: racecard rows are authoritative (have bendData, comment etc.);
    // history fills in older runs. Sort newest-first by date string (DD/MM/YYYY).
    const combined = [...racecardRows, ...newRuns].sort((a, b) => {
      // Parse DD/MM/YYYY → comparable string YYYY/MM/DD
      const toSortable = d => d ? d.replace(/(\d+)\/(\d+)\/(\d+)/, '$3/$2/$1') : '';
      return toSortable(b.date) > toSortable(a.date) ? 1 : -1;
    });

    return combined;
  }

  // ── Boot ──────────────────────────────────────────────────
  function init(){
    if(typeof chrome!=='undefined'&&chrome.storage){
      chrome.storage.sync.get(DEFAULTS,s=>{CFG={...DEFAULTS,...s};buildAndInjectSidebar();});
    }else{buildAndInjectSidebar();}
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1200));
  }else{setTimeout(init,1200);}

  let lastUrl=location.href;
  new MutationObserver(()=>{
    if(location.href!==lastUrl){
      lastUrl=location.href;
      // Stop any running auto-refresh when navigating to a new race
      if(window._tfeAutoRefresh) stopAutoRefresh();
      window._tfePriceHistory = {}; // reset price history for new race
      setTimeout(init,1500);
    }
  }).observe(document,{subtree:true,childList:true});

  if(typeof chrome!=='undefined'&&chrome.storage){
    chrome.storage.onChanged.addListener(()=>init());
  }


  window.exportPreraceCSV   = exportPreraceCSV;
  window.showBestPicksPanel = showBestPicksPanel;
})();