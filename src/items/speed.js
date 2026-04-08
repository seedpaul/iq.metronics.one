import { mulberry32, choice, shuffle, id } from './common.js';

const SYMBOLS = [
  'sigil_orbit',
  'sigil_beacon',
  'sigil_frame',
  'sigil_kite',
  'sigil_pulse',
  'sigil_halo',
  'sigil_prism',
  'sigil_axis',
  'sigil_nova',
  'sigil_arc',
  'sigil_gate',
  'sigil_quartz'
];

const SYMBOL_FEATURES = {
  sigil_orbit: { shape: 'circle', fill: 'none', mark: 'dot', rot: 0 },
  sigil_beacon: { shape: 'triangle', fill: 'solid', mark: 'slash', rot: 0 },
  sigil_frame: { shape: 'square', fill: 'none', mark: 'bar', rot: 0 },
  sigil_kite: { shape: 'diamond', fill: 'stripe', mark: 'dot', rot: 0 },
  sigil_pulse: { shape: 'pill', fill: 'solid', mark: 'ring', rot: 90 },
  sigil_halo: { shape: 'circle', fill: 'stripe', mark: 'ring', rot: 0 },
  sigil_prism: { shape: 'hex', fill: 'none', mark: 'slash', rot: 0 },
  sigil_axis: { shape: 'diamond', fill: 'solid', mark: 'bar', rot: 0 },
  sigil_nova: { shape: 'star', fill: 'none', mark: 'dot', rot: 0 },
  sigil_arc: { shape: 'triangle', fill: 'mesh', mark: 'chevron', rot: 180 },
  sigil_gate: { shape: 'square', fill: 'solid', mark: 'ring', rot: 0 },
  sigil_quartz: { shape: 'hex', fill: 'mesh', mark: 'dot', rot: 0 }
};

export const MIN_SYMBOL_VISUAL_DISTANCE = 4;

function sanitizeSeed(seed){
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const parsed = Number.parseInt(seed, 10);
  if (Number.isFinite(parsed)) return parsed >>> 0;
  return 0xA11CE;
}

function symbolFeatures(symbol){
  return SYMBOL_FEATURES[symbol] || null;
}

export function measureSymbolVisualDistance(left, right){
  const a = symbolFeatures(left);
  const b = symbolFeatures(right);
  if (!a || !b) return left === right ? 0 : MIN_SYMBOL_VISUAL_DISTANCE;

  let score = 0;
  if (a.shape !== b.shape) score += 4;
  if (a.mark !== b.mark) score += 2;
  if (a.fill !== b.fill) score += 1.25;
  if ((a.rot || 0) !== (b.rot || 0)) score += 0.75;
  return score;
}

export function measureSymbolSetSeparation(symbols){
  if (!Array.isArray(symbols) || symbols.length < 2) return Infinity;
  let minimum = Infinity;
  for (let i = 0; i < symbols.length; i++){
    for (let j = i + 1; j < symbols.length; j++){
      minimum = Math.min(minimum, measureSymbolVisualDistance(symbols[i], symbols[j]));
    }
  }
  return minimum;
}

function pickDistinctSymbols(rng, count, pool = SYMBOLS, minDistance = MIN_SYMBOL_VISUAL_DISTANCE){
  let best = [];
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 64; attempt++){
    const ordered = shuffle(rng, [...pool]);
    const chosen = [];

    for (const symbol of ordered){
      if (chosen.every((existing) => measureSymbolVisualDistance(existing, symbol) >= minDistance)){
        chosen.push(symbol);
      }
      if (chosen.length === count) return chosen;
    }

    const separation = measureSymbolSetSeparation(chosen);
    if (chosen.length > best.length || (chosen.length === best.length && separation > bestScore)){
      best = chosen;
      bestScore = separation;
    }
  }

  if (best.length === count) return best;
  const fallback = shuffle(rng, [...pool]).slice(0, count);
  return measureSymbolSetSeparation(best) > measureSymbolSetSeparation(fallback) ? best : fallback;
}

function makeDistinctPair(rng, pool){
  return pickDistinctSymbols(rng, 2, pool);
}

function matchesKeyPair(pair, keySymbols){
  if (!Array.isArray(pair) || !Array.isArray(keySymbols) || pair.length !== 2 || keySymbols.length !== 2) return false;
  if (new Set(pair).size !== 2 || new Set(keySymbols).size !== 2) return false;
  return pair.every((symbol) => keySymbols.includes(symbol));
}

function buildPresentPair(rng, keySymbols){
  return rng() < 0.5 ? keySymbols.slice() : keySymbols.slice().reverse();
}

function buildOneOverlapPair(rng, keySymbols){
  const shared = choice(rng, keySymbols);
  const other = choice(rng, SYMBOLS.filter((symbol) => !keySymbols.includes(symbol)));
  return rng() < 0.5 ? [shared, other] : [other, shared];
}

function buildNoOverlapPair(rng, keySymbols){
  return makeDistinctPair(rng, SYMBOLS.filter((symbol) => !keySymbols.includes(symbol)));
}

function balancedPromptSequence(rng, symbols, repeatsPerSymbol){
  const pool = [];
  symbols.forEach((symbol) => {
    for (let count = 0; count < repeatsPerSymbol; count++) pool.push(symbol);
  });

  let sequence = shuffle(rng, pool);
  for (let pass = 0; pass < 8; pass++){
    let changed = false;
    for (let i = 1; i < sequence.length; i++){
      if (sequence[i] !== sequence[i - 1]) continue;
      const swapIndex = sequence.findIndex((candidate, idx) => idx > i && candidate !== sequence[i - 1] && candidate !== sequence[i + 1]);
      if (swapIndex > i){
        [sequence[i], sequence[swapIndex]] = [sequence[swapIndex], sequence[i]];
        changed = true;
      }
    }
    if (!changed) break;
  }
  return sequence;
}

export function buildSpeedSymbolSearchPages({ pages=4, seed }={}){
  const rng = mulberry32(sanitizeSeed(seed ?? 0xA11CE));
  const out = [];

  for (let p=0;p<pages;p++){
    const keySymbols = makeDistinctPair(rng, SYMBOLS);
    const rows = [];
    const rowCount = 18;
    const targetCounts = {
      exact: Math.floor(rowCount / 3),
      one_overlap: Math.floor(rowCount / 3),
      no_overlap: rowCount - (Math.floor(rowCount / 3) * 2)
    };

    for (let i = 0; i < targetCounts.exact; i++) rows.push({ pair: buildPresentPair(rng, keySymbols), answer: true, kind: 'exact' });
    for (let i = 0; i < targetCounts.one_overlap; i++) rows.push({ pair: buildOneOverlapPair(rng, keySymbols), answer: false, kind: 'one_overlap' });
    for (let i = 0; i < targetCounts.no_overlap; i++) rows.push({ pair: buildNoOverlapPair(rng, keySymbols), answer: false, kind: 'no_overlap' });

    const shuffledRows = shuffle(rng, rows).map((row) => ({
      ...row,
      answer: matchesKeyPair(row.pair, keySymbols)
    }));

    out.push({
      id: id('speed_symbol', p+1),
      type: 'speed-symbol-search',
      title: 'Symbol Search',
      prompt: 'For each trial, select Present only when the candidate pair contains exactly the same two symbols as the key pair, in either order.',
      keySymbols,
      rows: shuffledRows,
      // proxy params
      a: 0.6, b: -0.2
    });
  }

  return out;
}

export function buildSpeedCodingPages({ pages=4, seed }={}){
  const rng = mulberry32(sanitizeSeed(seed ?? 0xC0D1E));
  const out = [];

  for (let p=0;p<pages;p++){
    const symbols = pickDistinctSymbols(rng, 6, SYMBOLS);
    const digits = shuffle(rng, ['1','2','3','4','5','6','7','8','9']).slice(0,6);

    const key = symbols.map((s,i)=>({ sym:s, digit:digits[i] }));
    const map = Object.fromEntries(key.map(k=>[k.sym, k.digit]));

    const repeatsPerSymbol = 4;
    const prompts = balancedPromptSequence(rng, symbols, repeatsPerSymbol);
    const answers = prompts.map((sym) => map[sym]);

    out.push({
      id: id('speed_coding', p+1),
      type: 'speed-coding',
      title: 'Coding',
      prompt: 'Use the key to find the digit that matches each symbol. Respond with the matching digit, not the symbol name.',
      key,
      prompts,
      answers,
      a: 0.6, b: -0.2
    });
  }

  return out;
}
