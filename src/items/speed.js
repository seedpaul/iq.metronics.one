import { mulberry32, choice, shuffle, id } from './common.js';

const SYMBOLS = ['<>','[]','{}','()','+-','=/','~!','%%','##','@@','!!','??','**'];

function sanitizeSeed(seed){
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const parsed = Number.parseInt(seed, 10);
  if (Number.isFinite(parsed)) return parsed >>> 0;
  return 0xA11CE;
}

export function buildSpeedSymbolSearchPages({ pages=4, seed }={}){
  const rng = mulberry32(sanitizeSeed(seed ?? 0xA11CE));
  const out = [];

  for (let p=0;p<pages;p++){
    const keySymbols = shuffle(rng, SYMBOLS).slice(0,2);
    const rows = [];
    const rowCount = 18;

    for (let i=0;i<rowCount;i++){
      const pair = shuffle(rng, SYMBOLS).slice(0,2);
      const answer = (pair[0] === keySymbols[0] && pair[1] === keySymbols[1]) || (pair[0] === keySymbols[1] && pair[1] === keySymbols[0]);
      // increase match rate modestly
      if (rng() < 0.25){
        pair[0] = keySymbols[0];
        pair[1] = rng() < 0.5 ? keySymbols[1] : choice(rng, SYMBOLS.filter(s => s !== keySymbols[1]));
      }
      rows.push({ pair, answer });
    }

    out.push({
      id: id('speed_symbol', p+1),
      type: 'speed-symbol-search',
      title: 'Symbol Search',
      prompt: 'For each pair: does it match the key symbols (in any order)?',
      keySymbols,
      rows,
      // proxy params
      a: 0.6, b: -0.2
    });
  }

  return out;
}

export function buildSpeedCodingPages({ pages=4, seed }={}){
  const rng = mulberry32(sanitizeSeed(seed ?? 0xC0D1NG));
  const out = [];

  for (let p=0;p<pages;p++){
    const symbols = shuffle(rng, SYMBOLS).slice(0,6);
    const digits = shuffle(rng, ['1','2','3','4','5','6','7','8','9']).slice(0,6);

    const key = symbols.map((s,i)=>({ sym:s, digit:digits[i] }));
    const map = Object.fromEntries(key.map(k=>[k.sym, k.digit]));

    const prompts = [];
    const answers = [];
    const n = 24;

    for (let i=0;i<n;i++){
      const sym = choice(rng, symbols);
      prompts.push(sym);
      answers.push(map[sym]);
    }

    out.push({
      id: id('speed_coding', p+1),
      type: 'speed-coding',
      title: 'Coding',
      prompt: 'Use the key to enter the correct digit for each symbol.',
      key,
      prompts,
      answers,
      a: 0.6, b: -0.2
    });
  }

  return out;
}
