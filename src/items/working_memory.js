import { mulberry32, id } from './common.js';

function digits(rng, len){
  let s = '';
  for (let i=0;i<len;i++){
    s += String(Math.floor(rng()*10));
  }
  // avoid all same digit
  if (/^(\d)\1+$/.test(s)) s = s.slice(0,-1) + String((Number(s.slice(-1))+3)%10);
  return s;
}

export function buildDigitSpanItems({ count=18 }={}){
  const rng = mulberry32(0xFEEDC0DE);
  const items = [];
  let n = 1;

  // ramp length
  for (let i=0;i<count;i++){
    const len = 3 + Math.floor(i/3); // grows slowly
    const dir = (i % 3 === 2) ? 'backward' : 'forward';
    items.push({
      id: id('wm', n++),
      type: 'digitspan',
      title: dir === 'backward' ? 'Digit span (backward)' : 'Digit span',
      prompt: dir === 'backward' ? 'Remember the digits and type them backward.' : 'Remember the digits and type them.',
      digits: digits(rng, len),
      direction: dir,
      showMs: 900 + len*120,
      // approximate parameters
      a: 0.65 + rng()*0.4,
      b: -1.0 + (len-3)*0.45
    });
  }

  return items;
}
