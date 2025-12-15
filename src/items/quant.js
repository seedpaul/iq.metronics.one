import { mulberry32, choice, shuffle, id } from './common.js';

function seriesItem(rng, n){
  // build a simple series: quadratic, alternating, or incremental differences
  const kind = choice(rng, ['diff','square','alt','multadd']);

  let seq = [];
  let answer = 0;

  if (kind === 'diff'){
    const start = 1 + Math.floor(rng()*6);
    let d = 2 + Math.floor(rng()*5);
    let dd = 1 + Math.floor(rng()*4);
    seq = [start];
    for (let i=1;i<5;i++){
      seq.push(seq[i-1] + d);
      d += dd;
    }
    answer = seq[4];
    seq = seq.slice(0,4);
  }

  if (kind === 'square'){
    const k = 2 + Math.floor(rng()*6);
    seq = [k*k, (k+1)*(k+1), (k+2)*(k+2), (k+3)*(k+3)];
    answer = (k+4)*(k+4);
  }

  if (kind === 'alt'){
    const a = 2 + Math.floor(rng()*6);
    const b = 1 + Math.floor(rng()*5);
    const start = 5 + Math.floor(rng()*8);
    seq = [start, start + a, start + a - b, start + 2*a - b];
    answer = start + 2*a - 2*b;
  }

  if (kind === 'multadd'){
    const start = 2 + Math.floor(rng()*6);
    const m = 2;
    const add = 1 + Math.floor(rng()*4);
    seq = [start];
    for (let i=1;i<5;i++){
      seq.push(seq[i-1]*m + add);
    }
    answer = seq[4];
    seq = seq.slice(0,4);
  }

  const correct = answer;
  const distract = shuffle(rng, [
    correct + 1 + Math.floor(rng()*3),
    correct - 1 - Math.floor(rng()*3),
    correct + 5,
    correct - 5
  ]).slice(0,3);

  const choices = shuffle(rng, [correct, ...distract]).slice(0,4);

  const labels = ['A','B','C','D'];
  const mapped = choices.map((v,i)=>`${labels[i]}) ${v}`);
  const correctIndex = choices.indexOf(correct);
  const ansLabel = mapped[correctIndex];

  const aParam = 0.9 + rng()*0.8;
  const bParam = -1.1 + rng()*2.4;

  return {
    id: id('quant', n),
    type: 'mcq',
    kind: 'series',
    title: 'Number series',
    prompt: `What comes next?  ${seq.join(', ')}, ?`,
    choices: mapped,
    answer: ansLabel,
    a: aParam, b: bParam
  };
}

function wordProblem(rng, n){
  const templates = [
    () => {
      const machines = 5;
      const minutes = 5;
      const widgets = 5;
      return {
        p: `If ${machines} machines take ${minutes} minutes to make ${widgets} widgets, how long do 100 machines take to make 100 widgets?`,
        a: 'A) 5 minutes',
        correct: 'A'
      };
    },
    () => {
      const price = 3 + Math.floor(rng()*5);
      const qty = 4 + Math.floor(rng()*6);
      const total = price*qty;
      return {
        p: `A notebook costs $${price}. If you buy ${qty} notebooks, what is the total cost?`,
        correctValue: total
      };
    }
  ];

  const t = templates[Math.floor(rng()*templates.length)]();

  let prompt, correctValue;
  if (t.correctValue != null){
    prompt = t.p;
    correctValue = t.correctValue;
  } else {
    prompt = t.p;
    correctValue = 5;
  }

  const distract = shuffle(rng, [correctValue+2, correctValue-2, correctValue+5, correctValue-5]).slice(0,3);
  const choices = shuffle(rng, [correctValue, ...distract]).slice(0,4);
  const labels = ['A','B','C','D'];
  const mapped = choices.map((v,i)=>`${labels[i]}) ${v}`);
  const ansLabel = labels[choices.indexOf(correctValue)];

  const aParam = 0.7 + rng()*0.6;
  const bParam = -0.9 + rng()*2.0;

  return {
    id: id('quant', n),
    type: 'mcq',
    kind: 'word',
    title: 'Quantitative reasoning',
    prompt,
    choices: mapped,
    answer: ansLabel,
    a: aParam, b: bParam
  };
}

export function buildQuantBank({ size=70 }={}){
  const rng = mulberry32(0x1234BEEF);
  const bank = [];
  for (let i=0;i<size;i++){
    bank.push(rng() < 0.7 ? seriesItem(rng, i+1) : wordProblem(rng, i+1));
  }
  return bank;
}
