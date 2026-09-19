#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const CATEGORIES = ['Denim', 'Outerwear', 'Knitwear', 'Tops', 'Accessories'];
const BENCHMARKS = { Denim: 650, Outerwear: 900, Knitwear: 350, Tops: 180, Accessories: 120 };
const OUT_STATES = ['TX', 'NV', 'OR', 'WA', 'NY', 'FL', 'CO', 'AZ', 'GA', 'IL'];
const TOTAL = 2500;

// Original 16 seed rows — must match index.html `seed` exactly
const SEED_ROWS = [
  ['Denim',       'CA', 630,  'LISTED_RESALE'],
  ['Outerwear',   'CA', null, 'REPAIRED'],
  ['Knitwear',    'TX', 345,  'LISTED_RESALE'],
  ['Tops',        'CA', 185,  'DOWN_CYCLED_SHRED'],
  ['Accessories', 'CA', 105,  'LISTED_RESALE'],
  ['Denim',       'NV', 680,  'REPAIRED'],
  ['Outerwear',   'CA', 930,  'LISTED_RESALE'],
  ['Tops',        'CA', null, 'REPAIRED'],
  ['Knitwear',    'CA', 360,  'UNVERIFIED_EXPORT'],
  ['Denim',       'CA', 645,  'LANDFILL'],
  ['Accessories', 'OR', 115,  'LISTED_RESALE'],
  ['Outerwear',   'CA', 875,  'REPAIRED'],
  ['Tops',        'CA', 175,  'LISTED_RESALE'],
  ['Denim',       '',   610,  'LISTED_RESALE'],
  ['Knitwear',    'CA', null, 'LISTED_RESALE'],
  ['Outerwear',   'CA', 790,  'DOWN_CYCLED_SHRED'],
];

// Seeded PRNG for reproducible output
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xDEADBEEF);

function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

function evidenceId(disp, i) {
  if (disp === 'LISTED_RESALE') return `RS-${20301 + i}`;
  if (disp === 'REPAIRED')      return `RP-${20301 + i}`;
  return '';
}

// Profile weights for synthetic rows
const PROFILES = [
  { w: 55, gen: () => ({ state: 'CA',               disp: pick(['LISTED_RESALE', 'REPAIRED']),                          hasWeight: rand() > 0.25 }) },
  { w: 20, gen: () => ({ state: pick(OUT_STATES),    disp: pick(['LISTED_RESALE', 'REPAIRED']),                          hasWeight: rand() > 0.20 }) },
  { w: 12, gen: () => ({ state: 'CA',               disp: pick(['DOWN_CYCLED_SHRED', 'UNVERIFIED_EXPORT', 'LANDFILL']), hasWeight: rand() > 0.15 }) },
  { w: 10, gen: () => ({ state: '',                 disp: pick(['LISTED_RESALE', 'REPAIRED']),                          hasWeight: rand() > 0.30 }) },
  { w:  3, gen: () => ({ state: pick([...OUT_STATES, '']), disp: pick(['DOWN_CYCLED_SHRED', 'UNVERIFIED_EXPORT']),       hasWeight: rand() > 0.40 }) },
];
const totalW = PROFILES.reduce((s, p) => s + p.w, 0);
function pickProfile() {
  let r = rand() * totalW;
  for (const p of PROFILES) { r -= p.w; if (r <= 0) return p.gen(); }
  return PROFILES[0].gen();
}

// --- Build records ---
const items = [];

// First 16: original seed, exact IDs and timestamps from index.html
for (let i = 0; i < SEED_ROWS.length; i++) {
  const [cat, state, wt, disp] = SEED_ROWS[i];
  items.push({
    item_id:         `TB-${1001 + i}`,
    cleanout_bag_id: `TU-BAG-${9821 + Math.floor(i / 2)}`,
    category:        cat,
    donor_state:     state,
    weight_grams:    wt,
    disposition:     disp,
    timestamp:       new Date(Date.UTC(2026, 8, 19, 13, i * 2)).toISOString(),
    evidence_id:     evidenceId(disp, i),
  });
}

// Remaining 2,484 synthetic rows, 2-min intervals from 2026-09-01T08:00Z
const BATCH_START = new Date('2026-09-01T08:00:00Z').getTime();
for (let i = SEED_ROWS.length; i < TOTAL; i++) {
  const cat       = pick(CATEGORIES);
  const benchmark = BENCHMARKS[cat];
  const { state, disp, hasWeight } = pickProfile();
  const weight    = hasWeight ? Math.round(benchmark * (0.80 + rand() * 0.40)) : null;
  items.push({
    item_id:         `TB-${1001 + i}`,
    cleanout_bag_id: `TU-BAG-${9821 + Math.floor(i / 2)}`,
    category:        cat,
    donor_state:     state,
    weight_grams:    weight,
    disposition:     disp,
    timestamp:       new Date(BATCH_START + i * 2 * 60000).toISOString(),
    evidence_id:     evidenceId(disp, i),
  });
}

// --- Sanity check ---
const counts = {};
for (const item of items) {
  const state = String(item.donor_state || '').trim().toUpperCase();
  let code;
  if (!state)                                                   code = 'GEO_AMBIGUOUS';
  else if (state !== 'CA')                                      code = 'REJECTED_OUT_OF_STATE';
  else if (!['LISTED_RESALE', 'REPAIRED'].includes(item.disposition)) code = 'REJECTED_NON_QUALIFYING_DISPOSITION';
  else                                                          code = 'ELIGIBLE';
  counts[code] = (counts[code] || 0) + 1;
}
const grandTotal = Object.values(counts).reduce((s, n) => s + n, 0);
if (grandTotal !== TOTAL) throw new Error(`Sanity check failed: got ${grandTotal}, expected ${TOTAL}`);

console.log(`Generated ${items.length} items → sample-data/`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(45)} ${String(v).padStart(4)}  (${((v / TOTAL) * 100).toFixed(1)}%)`);
}

// --- Write fixtures ---
const outDir = path.join(__dirname, 'sample-data');
fs.mkdirSync(outDir, { recursive: true });

// JSON + CSV (for "Choose JSON / CSV" import button)
fs.writeFileSync(path.join(outDir, 'traceback-sample-batch.json'), JSON.stringify(items, null, 2));

const HEADERS = ['item_id', 'cleanout_bag_id', 'category', 'donor_state', 'weight_grams', 'disposition', 'timestamp', 'evidence_id'];
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvLines = [HEADERS.join(','), ...items.map(r => HEADERS.map(k => csvCell(r[k])).join(','))];
fs.writeFileSync(path.join(outDir, 'traceback-sample-batch.csv'), csvLines.join('\r\n'));

// Inline JS for <script src> — sets window.SAMPLE_BATCH before main script runs
fs.writeFileSync(
  path.join(outDir, 'large-batch.js'),
  `window.SAMPLE_BATCH = ${JSON.stringify(items)};\n`,
);

console.log('  traceback-sample-batch.json');
console.log('  traceback-sample-batch.csv');
console.log('  large-batch.js');
