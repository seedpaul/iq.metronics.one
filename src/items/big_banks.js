import { mulberry32, randInt, choice, shuffle } from "./rng.js";

const SYMBOLS = ["<>","[]","{}","()","+-","=/","~!","%%","##","@@"];
const SHAPES = ["circle","square","triangle"];
const FILLS = ["none","solid","striped"];
const ROTATIONS = [0, 90, 180, 270];

function sanitizeSeed(seed){
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const parsed = Number.parseInt(seed, 10);
  if (Number.isFinite(parsed)) return parsed >>> 0;
  return 123456 >>> 0;
}

function baseParams(rng, difficulty){
  const a = 0.6 + rng()*1.6;
  const b = difficulty + (rng()-0.5)*0.4;
  return { a, b };
}

function frac(i, n){
  return n > 1 ? i / (n - 1) : 0;
}

// --- Fluid reasoning (matrices) ------------------------------------------------

function makeFluidMatrixBank(rng, n){
  const items = [];

  for (let i=0;i<n;i++){
    const rule = choice(rng, ["count","progress","xorFill","rotate"]);
    const diff = frac(i, n) * 6 - 3;
    const {a,b} = baseParams(rng, diff);
    const k = 6;
    const c = 1/k;

    const cellA = {
      shape: choice(rng, SHAPES),
      fill: choice(rng, FILLS),
      rot: choice(rng, ROTATIONS),
      count: randInt(rng,1,3)
    };
    const cellB = mutate(cellA, rule, rng);
    const cellC = mutate(cellA, rule, rng);
    const cellD = applyRule(cellA, cellB, cellC, rule, rng);

    const correct = cellD;
    const distractors = buildDistractors(correct, rng, k-1);

    const options = shuffle(rng, [correct, ...distractors]).map(o => ({ svg: renderGlyph(o), key: encode(o) }));
    const answerKey = encode(correct);

    items.push({
      id: "F" + (i+1),
      type: "mcq_svg",
      domain: "fluid",
      title: "Matrix reasoning",
      prompt: "Choose the option that completes the matrix.",
      stemSvg: renderMatrix(cellA, cellB, cellC),
      options,
      answer: answerKey,
      blueprint: rule,
      irt: { a, b, c, k },
      meta: { rule }
    });
  }

  return items;
}

function mutate(cell, rule, rng){
  const c = JSON.parse(JSON.stringify(cell));
  if (rule === "count"){
    c.count = ((c.count % 3) + 1);
  } else if (rule === "progress"){
    c.rot = (c.rot + 90) % 360;
  } else if (rule === "xorFill"){
    c.fill = (c.fill === "solid") ? "striped" : (c.fill === "striped" ? "none" : "solid");
  } else if (rule === "rotate"){
    c.shape = (c.shape === "circle") ? "square" : (c.shape === "square" ? "triangle" : "circle");
  }
  if (rng() < 0.15) c.rot = (c.rot + 180) % 360;
  return c;
}

function applyRule(a, b, c, rule, rng){
  const out = JSON.parse(JSON.stringify(c));
  return mutate(out, rule, rng);
}

function encode(o){
  return [o.shape,o.fill,o.rot,o.count].join("|");
}

function buildDistractors(correct, rng, n){
  const ds = [];
  const seen = new Set([encode(correct)]);
  while (ds.length < n){
    const d = JSON.parse(JSON.stringify(correct));
    const tweak = choice(rng, ["shape","fill","rot","count","two"]);
    if (tweak==="shape") d.shape = choice(rng, SHAPES.filter(x=>x!==d.shape));
    if (tweak==="fill") d.fill = choice(rng, FILLS.filter(x=>x!==d.fill));
    if (tweak==="rot") d.rot = choice(rng, ROTATIONS.filter(x=>x!==d.rot));
    if (tweak==="count") d.count = randInt(rng,1,3);
    if (tweak==="two"){
      d.shape = choice(rng, SHAPES.filter(x=>x!==d.shape));
      d.fill = choice(rng, FILLS.filter(x=>x!==d.fill));
    }
    const key = encode(d);
    if (!seen.has(key)){
      seen.add(key);
      ds.push(d);
    }
  }
  return ds;
}

function renderGlyph(o){
  const size=72;
  const g=[];
  const positions = [
    [size/2, size/2],
    [size/2-14, size/2],
    [size/2+14, size/2]
  ];
  for (let i=0;i<o.count;i++){
    const [cx, cy]=positions[i];
    g.push(shapeSvg(o.shape, cx, cy, 14, o.fill, o.rot));
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${g.join("")}</svg>`;
}

function shapeSvg(shape, cx, cy, r, fill, rot){
  const fillColor = fill==="solid" ? "rgba(232,238,252,0.85)" : "none";
  const stroke="rgba(232,238,252,0.9)";
  const strokeWidth=2;
  const hatch = (fill==="striped")
    ? `<defs>
         <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
           <line x1="0" y1="0" x2="0" y2="6" stroke="${stroke}" stroke-width="2"/>
         </pattern>
       </defs>`
    : "";
  const f = (fill==="striped") ? "url(#hatch)" : fillColor;

  const transform = `rotate(${rot} ${cx} ${cy})`;
  if (shape==="circle"){
    return `${hatch}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="${transform}" />`;
  }
  if (shape==="square"){
    const x=cx-r, y=cy-r, s=2*r;
    return `${hatch}<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="3" fill="${f}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="${transform}" />`;
  }
  const p1=[cx, cy-r], p2=[cx-r, cy+r], p3=[cx+r, cy+r];
  return `${hatch}<polygon points="${p1.join(",")} ${p2.join(",")} ${p3.join(",")}" fill="${f}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="${transform}" />`;
}

function renderMatrix(a,b,c){
  return `
  <div class="matrix">
    <div class="cell">${renderGlyph(a)}</div>
    <div class="cell">${renderGlyph(b)}</div>
    <div class="cell">${renderGlyph(c)}</div>
    <div class="cell missing">?</div>
  </div>`;
}

// --- Verbal reasoning ----------------------------------------------------------

function makeVerbalBank(rng, n){
  const items=[];
  const analogyPairs = [
    ["Book","Reading","Fork","Eating"],
    ["Bird","Nest","Bee","Hive"],
    ["Painter","Brush","Writer","Pen"],
    ["Carpenter","Wood","Baker","Flour"],
    ["Thermometer","Temperature","Scale","Weight"],
    ["Key","Lock","Password","Account"],
    ["Pilot","Cockpit","Captain","Bridge"],
    ["Heart","Blood","Pump","Water"],
    ["Seed","Plant","Spark","Fire"]
  ];
  const vocab = [
    ["lucid","clear"],["candid","honest"],["frugal","thrifty"],["abate","decrease"],
    ["tenacious","persistent"],["novel","new"],["obscure","unclear"],["placid","calm"],
    ["succinct","brief"],["arduous","difficult"],["benevolent","kind"]
  ];
  const opposites=[["reckless","cautious"],["scarce","plentiful"],["opaque","transparent"],["hostile","friendly"],["diminish","increase"],["serene","stormy"]];
  const categories=[
    ["cautious|careful|prudent|reckless","reckless"],
    ["sapphire|ruby|emerald|oak","oak"],
    ["violin|trumpet|flute|hammer","hammer"],
    ["atom|molecule|cell|galaxy","cell"],
    ["maple|pine|oak|quartz","quartz"]
  ];

  for (let i=0;i<n;i++){
    const t = choice(rng, ["analogy","vocab","opposite","oddone","syllogism"]);
    const diff=frac(i,n)*6-3;
    const {a,b}=baseParams(rng,diff);
    const k=4; const c=1/k;

    if (t==="analogy"){
      const p = choice(rng, analogyPairs);
      const stem = `${p[0]} is to ${p[1]} as ${p[2]} is to:`;
      const correct = p[3];
      const choices = shuffle(rng, [correct, ...makeDistractorWords(rng, correct, 3)]);
      items.push({id:"V"+(i+1),type:"mcq",domain:"verbal",title:"Analogy",prompt:stem,choices,answer:correct,blueprint:"analogy",irt:{a,b,c,k},meta:{kind:"analogy"}});
      continue;
    }
    if (t==="vocab"){
      const p=choice(rng, vocab);
      const stem=`Select the closest meaning to: "${p[0]}"`;
      const correct=p[1];
      const choices=shuffle(rng,[correct,...makeDistractorWords(rng,correct,3)]);
      items.push({id:"V"+(i+1),type:"mcq",domain:"verbal",title:"Vocabulary",prompt:stem,choices,answer:correct,blueprint:"vocab",irt:{a,b,c,k},meta:{kind:"vocab"}});
      continue;
    }
    if (t==="opposite"){
      const p=choice(rng, opposites);
      const stem=`Select the opposite of: "${p[0]}"`;
      const correct=p[1];
      const choices=shuffle(rng,[correct,...makeDistractorWords(rng,correct,3)]);
      items.push({id:"V"+(i+1),type:"mcq",domain:"verbal",title:"Opposites",prompt:stem,choices,answer:correct,blueprint:"opposite",irt:{a,b,c,k},meta:{kind:"opposite"}});
      continue;
    }
    if (t==="oddone"){
      const p=choice(rng,categories);
      const parts=p[0].split("|");
      const correct=p[1];
      const prompt=`Which word does NOT belong?`;
      const choices=shuffle(rng,parts);
      items.push({id:"V"+(i+1),type:"mcq",domain:"verbal",title:"Classification",prompt:`${prompt} (${choices.join(", ")})`,choices,answer:correct,blueprint:"classification",irt:{a,b,c,k},meta:{kind:"classification"}});
      continue;
    }
    const S = choice(rng, ["bloops","wugs","tazzies","norgs"]);
    const M = choice(rng, ["razzies","lazzies","vims","plens"]);
    const P = choice(rng, ["zibs","kerns","motes","daxes"]);
    const prompt = `All ${S} are ${M}. All ${M} are ${P}. Which must be true?`;
    const correct = `All ${S} are ${P}.`;
    const choices = shuffle(rng, [
      correct,
      `All ${P} are ${S}.`,
      `Some ${P} are not ${M}.`,
      `Some ${S} are not ${M}.`
    ]);
    items.push({id:"V"+(i+1),type:"mcq",domain:"verbal",title:"Logic",prompt,choices,answer:correct,blueprint:"logic",irt:{a,b,c,k},meta:{kind:"logic"}});
  }
  return items;
}

function makeDistractorWords(rng, correct, n){
  const pool = ["cooking","running","writing","walking","repairing","growing","measuring","driving","building","painting","learning","sleeping","noisy","silent","quick","slow","vast","tiny","dull","sharp","rare","common","pride","humility","order","chaos","opaque","lucent"];
  const out=[];
  while (out.length<n){
    const w=choice(rng,pool);
    if (w!==correct && !out.includes(w)) out.push(w);
  }
  return out;
}

// --- Quantitative reasoning ----------------------------------------------------

function makeQuantBank(rng,n){
  const items=[];
  for (let i=0;i<n;i++){
    const t=choice(rng,["series","mapping","word","algebra","ratio"]);
    const diff=frac(i,n)*6-3;
    const {a,b}=baseParams(rng,diff);
    const k=4; const c=1/k;

    if (t==="series"){
      const start = randInt(rng,1,6);
      const step1 = randInt(rng,2,8);
      const stepInc = randInt(rng,1,4);
      const seq=[start];
      let step=step1;
      for (let j=0;j<4;j++){ seq.push(seq[seq.length-1]+step); step+=stepInc; }
      const ans = seq[seq.length-1]+step;
      const prompt = `What comes next? ${seq.join(", ")}, ?`;
      const choices=shuffle(rng,[String(ans),String(ans+stepInc),String(ans-stepInc),String(ans+2*stepInc)]);
      items.push({id:"Q"+(i+1),type:"mcq",domain:"quant",title:"Number series",prompt,choices,answer:String(ans),blueprint:"series",irt:{a,b,c,k},meta:{kind:"series"}});
      continue;
    }
    if (t==="mapping"){
      const m = randInt(rng,2,9);
      const prompt = `${m*2} -> ${m}, ${m*3} -> ${Math.floor(m*1.5)}, ${m*5} -> ?`;
      const ans = String(Math.floor((m*5)/2));
      const choices = shuffle(rng,[ans,String(Number(ans)+1),String(Number(ans)-1),String(Number(ans)+2)]);
      items.push({id:"Q"+(i+1),type:"mcq",domain:"quant",title:"Mapping",prompt,choices,answer:ans,blueprint:"mapping",irt:{a,b,c,k},meta:{kind:"mapping"}});
      continue;
    }
    if (t==="algebra"){
      const x=randInt(rng,2,10);
      const prompt = `If 3x + 2 = ${3*x+2}, what is x?`;
      const ans=String(x);
      const choices=shuffle(rng,[ans,String(x+1),String(x-1),String(x+2)]);
      items.push({id:"Q"+(i+1),type:"mcq",domain:"quant",title:"Algebra",prompt,choices,answer:ans,blueprint:"algebra",irt:{a,b,c,k},meta:{kind:"algebra"}});
      continue;
    }
    if (t==="ratio"){
      const flour = randInt(rng,2,6);
      const sugar = flour + randInt(rng,1,4);
      const newFlour = flour + randInt(rng,1,4);
      const ratio = sugar / flour;
      const ansVal = Math.round(newFlour * ratio);
      const prompt = `A mix uses ${flour} cups flour for ${sugar} cups sugar. If you use ${newFlour} cups flour, how many cups of sugar keep the same ratio?`;
      const answer = String(ansVal);
      const choices = shuffle(rng, [answer, String(ansVal+1), String(Math.max(1, ansVal-1)), String(ansVal+2)]);
      items.push({id:"Q"+(i+1),type:"mcq",domain:"quant",title:"Proportion",prompt,choices,answer,blueprint:"ratio",irt:{a,b,c,k},meta:{kind:"ratio"}});
      continue;
    }
    const machines = randInt(rng,3,9);
    const mins = randInt(rng,3,9);
    const widgets = machines;
    const prompt = `If it takes ${machines} machines ${mins} minutes to make ${widgets} widgets, how long does it take ${machines*10} machines to make ${widgets*10} widgets?`;
    const ans=String(mins);
    const choices=shuffle(rng,[ans,String(mins*2),String(Math.max(1,mins-1)),String(mins+1)]);
    items.push({id:"Q"+(i+1),type:"mcq",domain:"quant",title:"Rate reasoning",prompt,choices,answer:ans,blueprint:"rate",irt:{a,b,c,k},meta:{kind:"rate"}});
  }
  return items;
}

// --- Spatial reasoning ---------------------------------------------------------

function makeSpatialBank(rng,n){
  const items=[];
  for (let i=0;i<n;i++){
    const diff=frac(i,n)*6-3;
    const {a,b}=baseParams(rng,diff);
    const k=4; const c=1/k;
    const rot = choice(rng,ROTATIONS);
    const base = makePoly();
    const correctSvg = polySvg(base, rot);
    const options=[{svg:correctSvg,key:String(rot)}];
    const rots = shuffle(rng,ROTATIONS.filter(r=>r!==rot)).slice(0,3);
    for (const r of rots) options.push({svg:polySvg(base,r),key:String(r)});
    const sh = shuffle(rng,options);
    items.push({
      id:"S"+(i+1),type:"mcq_svg",domain:"spatial",title:"Mental rotation",
      prompt:"Which option is the same shape rotated (not mirrored)?",
      stemSvg: polySvg(base, 0, true),
      options: sh,
      answer: String(rot),
      blueprint: "rotation",
      irt:{a,b,c,k},
      meta:{kind:"rotation"}
    });
  }
  return items;
}

function makePoly(){
  const pts=[];
  const cx=36, cy=36;
  const r1=22, r2=12;
  for (let i=0;i<5;i++){
    const ang = (Math.PI*2*i)/5;
    const r = (i===2) ? r2 : r1;
    pts.push([cx + Math.cos(ang)*r, cy + Math.sin(ang)*r]);
  }
  return pts;
}

function polySvg(pts, rotDeg, showBox=false){
  const size=72;
  const rot = `rotate(${rotDeg} 36 36)`;
  const stroke="rgba(232,238,252,0.9)";
  const fill="rgba(232,238,252,0.25)";
  const p = pts.map(x=>x.join(",")).join(" ");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    ${showBox ? `<rect x="2" y="2" width="68" height="68" rx="8" fill="none" stroke="rgba(232,238,252,0.25)"/>` : ""}
    <polygon points="${p}" transform="${rot}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  </svg>`;
}

// --- Speed and working memory --------------------------------------------------

function makeSymbolSearchBank(rng, n){
  const items=[];
  for (let i=0;i<n;i++){
    const diff=frac(i,n)*6-3;
    const {a,b}=baseParams(rng,diff);
    const irt={a:Math.min(2.2,a+0.6), b, c:0.5, k:2};
    const target=[choice(rng,SYMBOLS), choice(rng,SYMBOLS)];
    const rowLen = 10;
    const include = rng() < (0.45 + 0.1*Math.tanh(diff));
    const row=[];
    let placed=false;
    for (let j=0;j<rowLen;j++){
      if (!placed && include && rng()<0.18){
        row.push(target.slice());
        placed=true;
      } else {
        row.push([choice(rng,SYMBOLS), choice(rng,SYMBOLS)]);
      }
    }
    if (include && !placed) row[randInt(rng,0,rowLen-1)] = target.slice();
    const ans = include ? "YES" : "NO";
    items.push({ id:"SS"+(i+1),type:"speed_symbol",domain:"speed_symbol",title:"Symbol search",prompt:"Does the target pair appear in the row?",target,row,answer: ans,irt });
  }
  return items;
}

function makeCodingBank(rng, n){
  const items=[];
  for (let i=0;i<n;i++){
    const diff=frac(i,n)*6-3;
    const {a,b}=baseParams(rng,diff);
    const irt={a:Math.min(2.4,a+0.7), b, c:0, k:10};
    const keyPairs = shuffle(rng, SYMBOLS).slice(0,6).map((s,idx)=>({sym:s, dig:String(idx+1)}));
    const seq = [];
    const len = randInt(rng,6,10);
    for (let j=0;j<len;j++) seq.push(choice(rng, keyPairs).sym);
    const answer = seq.map(s=>keyPairs.find(p=>p.sym===s).dig).join("");
    items.push({ id:"CD"+(i+1),type:"speed_coding",domain:"speed_coding",title:"Coding",prompt:"Enter the digits that correspond to the symbols (use the key).",keyPairs,seq,answer,irt });
  }
  return items;
}

function digitsString(rng, len){
  let s = '';
  for (let i=0;i<len;i++){
    s += String(randInt(rng, 0, 9));
  }
  // avoid degenerate all-same strings
  if (/^(\d)\1+$/.test(s)){
    const last = Number(s.slice(-1));
    s = s.slice(0, -1) + String((last + 3) % 10);
  }
  return s;
}

function makeDigitSpanBank(rng, n){
  const items=[];
  for (let i=0;i<n;i++){
    const p = frac(i,n);
    const diff = p*6-3;
    const {a,b}=baseParams(rng,diff);
    const len = 3 + Math.floor(p*7);
    const direction = (i % 3 === 2) ? 'backward' : 'forward';
    const digits = digitsString(rng, len);
    items.push({
      id:"WM"+(i+1),
      type:"digitspan",
      domain:"wm",
      title: direction === 'backward' ? 'Digit span (backward)' : 'Digit span',
      prompt: direction === 'backward'
        ? 'Remember the digits and type them backward.'
        : 'Remember the digits and type them in order.',
      digits,
      direction,
      blueprint: direction,
      showMs: 900 + Math.max(0, 1200 - len*70),
      irt:{a:Math.min(2.0,a+0.4), b, c:0, k:10},
      meta:{len, direction}
    });
  }
  return items;
}

// --- Normalization and exports -------------------------------------------------

function normalizeItem(it){
  const irt = it.irt || {};
  const normalized = {
    ...it,
    a: irt.a,
    b: irt.b,
    c: irt.c,
    // keep original irt for pipeline exports
    irt,
  };

  if (it.type === 'mcq_svg' && !it.choices && Array.isArray(it.options)){
    normalized.choices = it.options.map((opt, idx) => String(opt.key ?? idx+1));
  }
  return normalized;
}

function normalize(items){
  return items.map(normalizeItem);
}

export function buildBanks(opts = {}){
  const seed = sanitizeSeed(opts.seed ?? 123456);
  const sizes = {
    fluid: opts?.sizes?.fluid ?? opts.fluidSize ?? 160,
    verbal: opts?.sizes?.verbal ?? opts.verbalSize ?? 220,
    quant: opts?.sizes?.quant ?? opts.quantSize ?? 220,
    spatial: opts?.sizes?.spatial ?? opts.spatialSize ?? 120,
    speed_symbol: opts?.sizes?.speed_symbol ?? opts.speedSymbolSize ?? 160,
    speed_coding: opts?.sizes?.speed_coding ?? opts.speedCodingSize ?? 140,
    wm_digit: opts?.sizes?.wm_digit ?? opts.digitSpanCount ?? 60
  };

  const rng = mulberry32(seed);

  return {
    fluid: normalize(makeFluidMatrixBank(rng, sizes.fluid)),
    verbal: normalize(makeVerbalBank(rng, sizes.verbal)),
    quant: normalize(makeQuantBank(rng, sizes.quant)),
    spatial: normalize(makeSpatialBank(rng, sizes.spatial)),
    speed_symbol: normalize(makeSymbolSearchBank(rng, sizes.speed_symbol)),
    speed_coding: normalize(makeCodingBank(rng, sizes.speed_coding)),
    wm_digit: normalize(makeDigitSpanBank(rng, sizes.wm_digit))
  };
}

export function buildFluidBank(opts = {}){
  const rng = mulberry32(sanitizeSeed(opts.seed ?? 123456));
  return normalize(makeFluidMatrixBank(rng, opts.size ?? 300));
}

export function buildVerbalBank(opts = {}){
  const rng = mulberry32(sanitizeSeed(opts.seed ?? 223456));
  return normalize(makeVerbalBank(rng, opts.size ?? 320));
}

export function buildQuantBank(opts = {}){
  const rng = mulberry32(sanitizeSeed(opts.seed ?? 323456));
  return normalize(makeQuantBank(rng, opts.size ?? 320));
}

export function buildSpatialBank(opts = {}){
  const rng = mulberry32(sanitizeSeed(opts.seed ?? 423456));
  return normalize(makeSpatialBank(rng, opts.size ?? 180));
}

export function buildDigitSpanItems(opts = {}){
  const rng = mulberry32(sanitizeSeed(opts.seed ?? 523456));
  return normalize(makeDigitSpanBank(rng, opts.count ?? 70));
}

// Speed tasks in this generator are not used directly by the app's interactive speed modules.
// The app uses its own speed page generators (more controlled timing & logging).
