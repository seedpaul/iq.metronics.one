import { mulberry32, randInt, choice, shuffle } from "./rng.js";

const SYMBOLS = ["<>", "[]", "{}", "()", "+-", "=/", "~!", "%%", "##", "@@"];
const SHAPES = ["circle", "square", "triangle", "diamond"];
const FILLS = ["none", "solid", "striped"];
const ROTATIONS = [0, 90, 180, 270];
const FLUID_RULES = ["count", "rotation", "fill", "shape"];
const RULE_THEMES = {
  count: { tint: "rgba(134,239,172,0.95)", accent: "rgba(220,252,231,0.22)" },
  rotation: { tint: "rgba(125,211,252,0.95)", accent: "rgba(224,242,254,0.22)" },
  fill: { tint: "rgba(249,168,212,0.95)", accent: "rgba(252,231,243,0.22)" },
  shape: { tint: "rgba(253,186,116,0.95)", accent: "rgba(255,237,213,0.22)" }
};

const SPATIAL_TEMPLATES = [
  {
    name: "hook",
    points: [[18, 18], [52, 18], [52, 30], [70, 30], [70, 58], [46, 58], [46, 74], [24, 74], [24, 46], [18, 46]],
    markers: [{ x: 30, y: 26 }, { x: 58, y: 36 }, { x: 36, y: 64 }]
  },
  {
    name: "step",
    points: [[22, 18], [64, 18], [64, 32], [52, 32], [52, 44], [72, 44], [72, 70], [28, 70], [28, 54], [22, 54]],
    markers: [{ x: 34, y: 26 }, { x: 58, y: 50 }, { x: 40, y: 62 }]
  },
  {
    name: "fork",
    points: [[18, 20], [38, 20], [38, 34], [46, 34], [46, 20], [68, 20], [68, 38], [56, 38], [56, 72], [30, 72], [30, 38], [18, 38]],
    markers: [{ x: 28, y: 28 }, { x: 58, y: 28 }, { x: 44, y: 58 }]
  },
  {
    name: "arch",
    points: [[20, 68], [20, 26], [34, 26], [34, 54], [44, 54], [44, 18], [66, 18], [66, 68], [52, 68], [52, 32], [34, 32], [34, 68]],
    markers: [{ x: 28, y: 58 }, { x: 58, y: 28 }, { x: 58, y: 58 }]
  },
  {
    name: "zig",
    points: [[18, 24], [40, 24], [40, 18], [68, 18], [68, 38], [52, 38], [52, 54], [72, 54], [72, 74], [24, 74], [24, 56], [38, 56], [38, 42], [18, 42]],
    markers: [{ x: 30, y: 32 }, { x: 58, y: 28 }, { x: 58, y: 62 }]
  }
];

const VERBAL_ANALOGIES = [
  { a1: "Bird", b1: "Nest", a2: "Bee", correct: "Hive", distractors: ["Honey", "Pollen", "Wing"] },
  { a1: "Author", b1: "Novel", a2: "Composer", correct: "Symphony", distractors: ["Stage", "Audience", "Instrument"] },
  { a1: "Thermometer", b1: "Temperature", a2: "Scale", correct: "Weight", distractors: ["Metal", "Length", "Texture"] },
  { a1: "Key", b1: "Lock", a2: "Password", correct: "Account", distractors: ["Keyboard", "Firewall", "Website"] },
  { a1: "Painter", b1: "Brush", a2: "Writer", correct: "Pen", distractors: ["Page", "Book", "Editor"] },
  { a1: "Seed", b1: "Plant", a2: "Spark", correct: "Fire", distractors: ["Smoke", "Ash", "Heat"] },
  { a1: "Pilot", b1: "Cockpit", a2: "Captain", correct: "Bridge", distractors: ["Harbor", "Deck", "Anchor"] },
  { a1: "Carpenter", b1: "Wood", a2: "Baker", correct: "Flour", distractors: ["Oven", "Bread", "Sugar"] }
];

const VERBAL_VOCAB = [
  { prompt: 'Select the closest meaning to "lucid".', correct: "clear", distractors: ["loud", "rigid", "brief"] },
  { prompt: 'Select the closest meaning to "frugal".', correct: "thrifty", distractors: ["hungry", "fragile", "formal"] },
  { prompt: 'Select the closest meaning to "arduous".', correct: "difficult", distractors: ["careful", "ordinary", "rapid"] },
  { prompt: 'Select the closest meaning to "placid".', correct: "calm", distractors: ["empty", "bright", "strict"] },
  { prompt: 'Select the closest meaning to "succinct".', correct: "brief", distractors: ["distant", "gentle", "costly"] },
  { prompt: 'Select the closest meaning to "benevolent".', correct: "kind", distractors: ["clever", "nervous", "uneven"] }
];

const VERBAL_OPPOSITES = [
  { prompt: 'Select the opposite of "reckless".', correct: "cautious", distractors: ["fearful", "rapid", "angry"] },
  { prompt: 'Select the opposite of "scarce".', correct: "plentiful", distractors: ["costly", "fragile", "recent"] },
  { prompt: 'Select the opposite of "opaque".', correct: "transparent", distractors: ["sharp", "heavy", "plain"] },
  { prompt: 'Select the opposite of "hostile".', correct: "friendly", distractors: ["obedient", "timid", "sudden"] },
  { prompt: 'Select the opposite of "diminish".', correct: "increase", distractors: ["divide", "escape", "settle"] }
];

const VERBAL_CLASSIFICATION = [
  { words: ["sapphire", "ruby", "emerald", "oak"], correct: "oak" },
  { words: ["violin", "trumpet", "flute", "hammer"], correct: "hammer" },
  { words: ["maple", "pine", "oak", "quartz"], correct: "quartz" },
  { words: ["triangle", "circle", "square", "copper"], correct: "copper" },
  { words: ["mercury", "venus", "mars", "granite"], correct: "granite" }
];

const VERBAL_COMPLETION = [
  { prompt: "The manager praised the report because it was concise, accurate, and easy to ____.", correct: "follow", distractors: ["weigh", "borrow", "scatter"] },
  { prompt: "Although the route looked longer on the map, it was the most ____ way to avoid traffic.", correct: "efficient", distractors: ["fragile", "distant", "silent"] },
  { prompt: "Her explanation was so ____ that even the newest employees understood the process.", correct: "clear", distractors: ["costly", "partial", "narrow"] },
  { prompt: "The scientist remained ____ and waited for stronger evidence before announcing a conclusion.", correct: "cautious", distractors: ["furious", "careless", "impatient"] }
];

const VERBAL_LOGIC = [
  {
    premises: ["All orchids are flowers.", "No flowers are made of metal.", "Some gifts are orchids."],
    correct: "Some gifts are not made of metal.",
    distractors: ["All gifts are flowers.", "Some metals are orchids.", "No gifts are flowers."]
  },
  {
    premises: ["Every analyst in the team writes reports.", "Mina is an analyst in the team."],
    correct: "Mina writes reports.",
    distractors: ["Everyone who writes reports is an analyst.", "Mina manages the team.", "No analysts write reports."]
  },
  {
    premises: ["No reptiles are warm-blooded.", "All snakes are reptiles."],
    correct: "No snakes are warm-blooded.",
    distractors: ["Some snakes are warm-blooded.", "All warm-blooded animals are reptiles.", "No reptiles are snakes."]
  },
  {
    premises: ["If a document is encrypted, it requires a key.", "This file is encrypted."],
    correct: "This file requires a key.",
    distractors: ["Every file requires a key.", "The file cannot be copied.", "Encrypted files are always hidden."]
  }
];

function sanitizeSeed(seed){
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const parsed = Number.parseInt(seed, 10);
  if (Number.isFinite(parsed)) return parsed >>> 0;
  return 123456 >>> 0;
}

function baseParams(rng, difficulty){
  const a = 0.6 + rng() * 1.6;
  const b = difficulty + (rng() - 0.5) * 0.4;
  return { a, b };
}

function frac(i, n){
  return n > 1 ? i / (n - 1) : 0;
}

function cycleValue(values, value, step){
  const idx = values.indexOf(value);
  const next = (idx + step + values.length * 8) % values.length;
  return values[next];
}

function clone(obj){
  return JSON.parse(JSON.stringify(obj));
}

let svgUidCounter = 0;

function nextSvgUid(prefix = "svg"){
  svgUidCounter += 1;
  return `${prefix}-${svgUidCounter.toString(36)}`;
}

function pickDistinct(rng, values, count){
  return shuffle(rng, values).slice(0, count);
}

function toNumberChoice(value){
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

// --- Fluid reasoning ----------------------------------------------------------

function makeFluidMatrixBank(rng, n){
  const items = [];

  for (let i = 0; i < n; i++){
    const difficulty = frac(i, n);
    const { a, b } = baseParams(rng, difficulty * 6 - 3);
    const k = 6;
    const c = 1 / k;

    const [rowRule, colRule] = pickDistinct(rng, FLUID_RULES, 2);
    const rowStep = difficulty > 0.7 && rowRule !== "rotation" ? 2 : 1;
    const colStep = difficulty > 0.55 && colRule !== "rotation" ? 2 : 1;
    const theme = mergeThemes(rowRule, colRule);

    const baseCell = makeFluidCell(rng, theme, rowRule, colRule);
    const grid = buildFluidMatrixGrid(baseCell, rowRule, rowStep, colRule, colStep);
    const correct = grid[2][2];
    const distractors = buildFluidDistractors(grid, correct, rowRule, rowStep, colRule, colStep, rng, k - 1);
    const options = shuffle(rng, [correct, ...distractors]).map((opt) => ({ svg: renderGlyph(opt), key: fluidVisualKey(opt) }));

    items.push({
      id: `F${i + 1}`,
      type: "mcq_svg",
      domain: "fluid",
      title: "Matrix reasoning",
      prompt: "Each row and each column changes by a rule. Choose the tile that correctly completes the matrix.",
      stemSvg: renderMatrix(grid),
      options,
      answer: fluidVisualKey(correct),
      blueprint: `${rowRule}_${colRule}`,
      irt: { a, b, c, k },
      meta: { kind: "matrix", rowRule, colRule, rowStep, colStep }
    });
  }

  return items;
}

function makeFluidSeriesBank(rng, n){
  const items = [];

  for (let i = 0; i < n; i++){
    const difficulty = frac(i, n);
    const { a, b } = baseParams(rng, difficulty * 6 - 3);
    const k = 6;
    const c = 1 / k;
    const rule = choice(rng, FLUID_RULES);
    const step = difficulty > 0.65 && rule !== "rotation" ? 2 : 1;
    const theme = RULE_THEMES[rule];
    const baseCell = makeFluidCell(rng, theme, rule, rule);
    const sequence = [clone(baseCell)];

    for (let idx = 1; idx < 4; idx++){
      sequence.push(applyRuleSteps(sequence[idx - 1], rule, step));
    }

    const correct = sequence[3];
    const distractors = buildFluidSeriesDistractors(sequence, correct, rule, step, rng, k - 1);
    const options = shuffle(rng, [correct, ...distractors]).map((opt) => ({ svg: renderGlyph(opt), key: fluidVisualKey(opt) }));

    items.push({
      id: `FS${i + 1}`,
      type: "mcq_svg",
      domain: "fluid",
      title: "Series reasoning",
      prompt: "The figure changes by the same rule from left to right. Choose the figure that should come next.",
      stemSvg: renderFluidSeries(sequence),
      options,
      answer: fluidVisualKey(correct),
      blueprint: `series_${rule}`,
      irt: { a, b, c, k },
      meta: { kind: "series", rule, step }
    });
  }

  return items;
}

function makeFluidAnalogyBank(rng, n){
  const items = [];

  for (let i = 0; i < n; i++){
    const difficulty = frac(i, n);
    const { a, b } = baseParams(rng, difficulty * 6 - 3);
    const k = 6;
    const c = 1 / k;
    const rule = choice(rng, FLUID_RULES);
    const step = difficulty > 0.65 && rule !== "rotation" ? 2 : 1;
    const theme = RULE_THEMES[rule];
    const sourceA = makeFluidCell(rng, theme, rule, rule);
    const sourceB = applyRuleSteps(sourceA, rule, step);
    const sourceC = makeFluidCell(rng, theme, rule, rule);
    const correct = applyRuleSteps(sourceC, rule, step);
    const distractors = buildFluidAnalogyDistractors(sourceC, correct, rule, step, rng, k - 1);
    const options = shuffle(rng, [correct, ...distractors]).map((opt) => ({ svg: renderGlyph(opt), key: fluidVisualKey(opt) }));

    items.push({
      id: `FA${i + 1}`,
      type: "mcq_svg",
      domain: "fluid",
      title: "Analogical transformation",
      prompt: "Figure A changes to Figure B by a rule. Apply the same rule to Figure C and choose the correct result.",
      stemSvg: renderFluidAnalogy(sourceA, sourceB, sourceC),
      options,
      answer: fluidVisualKey(correct),
      blueprint: `analogy_${rule}`,
      irt: { a, b, c, k },
      meta: { kind: "analogy", rule, step }
    });
  }

  return items;
}

function mergeThemes(rowRule, colRule){
  const left = RULE_THEMES[rowRule];
  const right = RULE_THEMES[colRule];
  return { tint: left.tint, accent: right.accent };
}

function makeFluidCell(rng, theme, rowRule, colRule){
  const shapePool = rowRule === "rotation" || colRule === "rotation"
    ? ["triangle", "diamond", "triangle", "diamond"]
    : SHAPES;
  return {
    shape: choice(rng, shapePool),
    fill: choice(rng, FILLS),
    rot: choice(rng, ROTATIONS),
    count: randInt(rng, 1, 4),
    tint: theme.tint,
    accent: theme.accent
  };
}

function buildFluidMatrixGrid(baseCell, rowRule, rowStep, colRule, colStep){
  const grid = [];
  for (let row = 0; row < 3; row++){
    const rowCells = [];
    for (let col = 0; col < 3; col++){
      let cell = clone(baseCell);
      for (let c = 0; c < col; c++) cell = applyRuleSteps(cell, rowRule, rowStep);
      for (let r = 0; r < row; r++) cell = applyRuleSteps(cell, colRule, colStep);
      rowCells.push(cell);
    }
    grid.push(rowCells);
  }
  return grid;
}

function applyRuleSteps(cell, rule, step){
  const out = clone(cell);
  if (rule === "count") out.count = cycleValue([1, 2, 3, 4], out.count, step);
  if (rule === "rotation") out.rot = cycleValue(ROTATIONS, out.rot, step);
  if (rule === "fill") out.fill = cycleValue(FILLS, out.fill, step);
  if (rule === "shape") out.shape = cycleValue(SHAPES, out.shape, step);
  return out;
}

function fluidVisualKey(cell){
  const rotationMatters = cell.shape === "triangle" || cell.shape === "diamond";
  return [cell.shape, cell.fill, rotationMatters ? cell.rot : 0, cell.count].join("|");
}

function buildFluidDistractors(grid, correct, rowRule, rowStep, colRule, colStep, rng, n){
  const candidates = [
    applyRuleSteps(grid[2][1], rowRule, rowStep),
    applyRuleSteps(grid[1][2], colRule, colStep),
    applyRuleSteps(grid[2][1], colRule, colStep),
    applyRuleSteps(grid[1][2], rowRule, rowStep),
    applyRuleSteps(grid[2][1], rowRule, -rowStep),
    applyRuleSteps(grid[1][2], colRule, -colStep),
    applyRuleSteps(correct, rowRule, 1),
    applyRuleSteps(correct, colRule, 1),
    grid[2][1],
    grid[1][2],
    tweakFluidCell(correct, rowRule, rng),
    tweakFluidCell(correct, colRule, rng)
  ];

  const seen = new Set([fluidVisualKey(correct)]);
  const distractors = [];

  for (const candidate of candidates){
    const key = fluidVisualKey(candidate);
    if (!seen.has(key)){
      seen.add(key);
      distractors.push(candidate);
      if (distractors.length >= n) break;
    }
  }

  while (distractors.length < n){
    const mutated = tweakFluidCell(correct, choice(rng, FLUID_RULES), rng);
    const key = fluidVisualKey(mutated);
    if (!seen.has(key)){
      seen.add(key);
      distractors.push(mutated);
    }
  }

  return distractors;
}

function buildFluidSeriesDistractors(sequence, correct, rule, step, rng, n){
  const candidates = [
    applyRuleSteps(sequence[2], rule, -step),
    applyRuleSteps(correct, rule, 1),
    applyRuleSteps(correct, rule, -1),
    tweakFluidCell(correct, rule, rng),
    tweakFluidCell(correct, choice(rng, FLUID_RULES), rng)
  ];

  const seen = new Set([fluidVisualKey(correct)]);
  const distractors = [];
  for (const candidate of candidates){
    const key = fluidVisualKey(candidate);
    if (!seen.has(key)){
      seen.add(key);
      distractors.push(candidate);
      if (distractors.length >= n) break;
    }
  }
  while (distractors.length < n){
    const mutated = tweakFluidCell(correct, choice(rng, FLUID_RULES), rng);
    const key = fluidVisualKey(mutated);
    if (!seen.has(key)){
      seen.add(key);
      distractors.push(mutated);
    }
  }
  return distractors;
}

function buildFluidAnalogyDistractors(source, correct, rule, step, rng, n){
  const candidates = [
    applyRuleSteps(source, rule, -step),
    applyRuleSteps(correct, rule, 1),
    tweakFluidCell(correct, rule, rng),
    tweakFluidCell(correct, choice(rng, FLUID_RULES), rng)
  ];
  const seen = new Set([fluidVisualKey(correct)]);
  const distractors = [];
  for (const candidate of candidates){
    const key = fluidVisualKey(candidate);
    if (!seen.has(key)){
      seen.add(key);
      distractors.push(candidate);
      if (distractors.length >= n) break;
    }
  }
  while (distractors.length < n){
    const mutated = tweakFluidCell(correct, choice(rng, FLUID_RULES), rng);
    const key = fluidVisualKey(mutated);
    if (!seen.has(key)){
      seen.add(key);
      distractors.push(mutated);
    }
  }
  return distractors;
}

function tweakFluidCell(cell, preferredRule, rng){
  const out = clone(cell);
  const rule = preferredRule || choice(rng, FLUID_RULES);
  if (rule === "count") out.count = cycleValue([1, 2, 3, 4], out.count, rng() < 0.5 ? 1 : -1);
  if (rule === "rotation") out.rot = cycleValue(ROTATIONS, out.rot, rng() < 0.5 ? 1 : -1);
  if (rule === "fill") out.fill = cycleValue(FILLS, out.fill, rng() < 0.5 ? 1 : -1);
  if (rule === "shape") out.shape = cycleValue(SHAPES, out.shape, rng() < 0.5 ? 1 : -1);
  return out;
}

function renderMatrix(grid){
  const cells = [];
  for (let row = 0; row < 3; row++){
    for (let col = 0; col < 3; col++){
      if (row === 2 && col === 2){
        cells.push('<div class="cell missing">?</div>');
      } else {
        cells.push(`<div class="cell">${renderGlyph(grid[row][col])}</div>`);
      }
    }
  }
  return `
  <div class="matrixFrame fluidFrame fluidMatrixFrame">
    <div class="matrixGuide">Track the change across the row and down the column. The missing tile must satisfy both.</div>
    <div class="matrix matrixStem matrix3x3">
      ${cells.join("")}
    </div>
  </div>`;
}

function renderFluidSeries(sequence){
  const cells = sequence.map((cell, idx) => {
    const label = idx === sequence.length - 1 ? "Next" : `Step ${idx + 1}`;
    const content = idx === sequence.length - 1
      ? '<div class="cell missing">?</div>'
      : `<div class="cell">${renderGlyph(cell)}</div>`;
    return `
      <div class="fluidSeriesStep">
        <div class="fluidMiniLabel">${label}</div>
        ${content}
      </div>
    `;
  });
  return `
  <div class="matrixFrame fluidFrame fluidSeriesFrame">
    <div class="matrixGuide">Find the single rule that changes each figure from left to right, then continue that rule.</div>
    <div class="fluidSeriesStem">
      ${cells.map((cell, idx) => `${cell}${idx < cells.length - 1 ? '<div class="fluidConnector" aria-hidden="true">→</div>' : ''}`).join("")}
    </div>
  </div>`;
}

function renderFluidAnalogy(a, b, c){
  return `
  <div class="matrixFrame fluidFrame fluidAnalogyFrame">
    <div class="matrixGuide">A changes to B. Apply the same transformation to C.</div>
    <div class="fluidAnalogyTop">
      <div class="fluidAnalogyCard">
        <div class="fluidMiniLabel">A</div>
        <div class="cell">${renderGlyph(a)}</div>
      </div>
      <div class="fluidConnector" aria-hidden="true">→</div>
      <div class="fluidAnalogyCard">
        <div class="fluidMiniLabel">B</div>
        <div class="cell">${renderGlyph(b)}</div>
      </div>
    </div>
    <div class="fluidAnalogyDivider">Apply the same change to C.</div>
    <div class="fluidAnalogyBottom">
      <div class="fluidAnalogyCard">
        <div class="fluidMiniLabel">C</div>
        <div class="cell">${renderGlyph(c)}</div>
      </div>
      <div class="fluidConnector" aria-hidden="true">→</div>
      <div class="fluidAnalogyCard fluidAnalogyAnswer">
        <div class="fluidMiniLabel">Answer</div>
        <div class="cell missing">?</div>
      </div>
    </div>
  </div>`;
}

function renderGlyph(cell){
  const size = 96;
  const svgUid = nextSvgUid("fluid");
  const positions = [[size / 2, size / 2], [size / 2 - 18, size / 2], [size / 2 + 18, size / 2], [size / 2, size / 2 - 18]];
  const glyphs = [];
  for (let i = 0; i < cell.count; i++){
    const [cx, cy] = positions[i];
    glyphs.push(shapeSvg(cell, cx, cy, 16, `${svgUid}-${i}`));
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="glyphSvg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${svgUid}-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${cell.accent || "rgba(255,255,255,0.16)"}"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
      </linearGradient>
      <linearGradient id="${svgUid}-plate" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.03)"/>
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="${size - 8}" height="${size - 8}" rx="22" fill="url(#${svgUid}-plate)" stroke="rgba(255,255,255,0.16)"/>
    <rect x="8" y="8" width="${size - 16}" height="${size - 16}" rx="18" fill="url(#${svgUid}-bg)" stroke="${cell.tint || "rgba(232,238,252,0.14)"}" opacity="0.92"/>
    ${glyphs.join("")}
  </svg>`;
}

function shapeSvg(cell, cx, cy, r, uidSeed){
  const uid = uidSeed || `${cell.shape}-${cell.fill}-${cell.rot}-${Math.round(cx * 7 + cy * 11 + r * 13)}`;
  const fillColor = cell.fill === "solid" ? (cell.accent || "rgba(232,238,252,0.16)") : "none";
  const stroke = cell.tint || "rgba(232,238,252,0.95)";
  const hatch = cell.fill === "striped"
    ? `<defs>
         <pattern id="hatch-${uid}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(35)">
           <line x1="0" y1="0" x2="0" y2="7" stroke="${stroke}" stroke-width="2.2"/>
         </pattern>
       </defs>`
    : "";
  const f = cell.fill === "striped" ? `url(#hatch-${uid})` : fillColor;
  const transform = `rotate(${cell.rot} ${cx} ${cy})`;
  if (cell.shape === "circle") return `${hatch}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" stroke="${stroke}" stroke-width="2.6" transform="${transform}" />`;
  if (cell.shape === "square") return `${hatch}<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="5" fill="${f}" stroke="${stroke}" stroke-width="2.6" transform="${transform}" />`;
  if (cell.shape === "triangle"){
    const points = [[cx, cy - r], [cx - r, cy + r], [cx + r, cy + r]].map((p) => p.join(",")).join(" ");
    return `${hatch}<polygon points="${points}" fill="${f}" stroke="${stroke}" stroke-width="2.6" transform="${transform}" />`;
  }
  const points = [[cx, cy - r], [cx - r, cy], [cx, cy + r], [cx + r, cy]].map((p) => p.join(",")).join(" ");
  return `${hatch}<polygon points="${points}" fill="${f}" stroke="${stroke}" stroke-width="2.6" transform="${transform}" />`;
}

// --- Verbal reasoning ---------------------------------------------------------

function makeVerbalBank(rng, n){
  const items = [];
  const types = ["analogy", "vocab", "opposite", "classification", "logic", "completion"];

  for (let i = 0; i < n; i++){
    const difficulty = frac(i, n);
    const { a, b } = baseParams(rng, difficulty * 6 - 3);
    const k = 4;
    const c = 1 / k;
    const t = choice(rng, types);

    if (t === "analogy"){
      const tpl = choice(rng, VERBAL_ANALOGIES);
      const prompt = `Complete the analogy: ${tpl.a1} is to ${tpl.b1} as ${tpl.a2} is to ?`;
      const choices = shuffle(rng, [tpl.correct, ...tpl.distractors]);
      items.push({ id: `V${i + 1}`, type: "mcq", domain: "verbal", title: "Analogy", prompt, choices, answer: tpl.correct, blueprint: "analogy", irt: { a, b, c, k }, meta: { kind: "analogy" } });
      continue;
    }

    if (t === "vocab"){
      const tpl = choice(rng, VERBAL_VOCAB);
      const choices = shuffle(rng, [tpl.correct, ...tpl.distractors]);
      items.push({ id: `V${i + 1}`, type: "mcq", domain: "verbal", title: "Vocabulary", prompt: tpl.prompt, choices, answer: tpl.correct, blueprint: "vocab", irt: { a, b, c, k }, meta: { kind: "vocab" } });
      continue;
    }

    if (t === "opposite"){
      const tpl = choice(rng, VERBAL_OPPOSITES);
      const choices = shuffle(rng, [tpl.correct, ...tpl.distractors]);
      items.push({ id: `V${i + 1}`, type: "mcq", domain: "verbal", title: "Opposites", prompt: tpl.prompt, choices, answer: tpl.correct, blueprint: "opposite", irt: { a, b, c, k }, meta: { kind: "opposite" } });
      continue;
    }

    if (t === "classification"){
      const tpl = choice(rng, VERBAL_CLASSIFICATION);
      const choices = shuffle(rng, tpl.words);
      items.push({ id: `V${i + 1}`, type: "mcq", domain: "verbal", title: "Classification", prompt: "Choose the one word that does not belong in the group.", choices, answer: tpl.correct, blueprint: "classification", irt: { a, b, c, k }, meta: { kind: "classification" } });
      continue;
    }

    if (t === "completion"){
      const tpl = choice(rng, VERBAL_COMPLETION);
      const choices = shuffle(rng, [tpl.correct, ...tpl.distractors]);
      items.push({ id: `V${i + 1}`, type: "mcq", domain: "verbal", title: "Sentence completion", prompt: tpl.prompt, choices, answer: tpl.correct, blueprint: "completion", irt: { a, b, c, k }, meta: { kind: "completion" } });
      continue;
    }

    const tpl = choice(rng, VERBAL_LOGIC);
    const choices = shuffle(rng, [tpl.correct, ...tpl.distractors]);
    items.push({ id: `V${i + 1}`, type: "mcq", domain: "verbal", title: "Logical inference", prompt: `Premises: ${tpl.premises.join(" ")} Which conclusion must be true?`, choices, answer: tpl.correct, blueprint: "logic", irt: { a, b, c, k }, meta: { kind: "logic" } });
  }
  return items;
}

// --- Quantitative reasoning ---------------------------------------------------

function buildQuantChoices(rng, answer, distractors){
  const unique = [...new Set([String(answer), ...distractors.map((value) => String(value))])];
  let cursor = Number(answer);
  while (unique.length < 4){
    cursor += 1;
    unique.push(String(Number.isFinite(cursor) ? cursor : unique.length + 1));
  }
  return shuffle(rng, unique.slice(0, 4));
}

function makeQuantBank(rng, n){
  const items = [];
  const kinds = ["series", "algebra", "ratio", "rate", "comparison", "percent"];

  for (let i = 0; i < n; i++){
    const difficulty = frac(i, n);
    const { a, b } = baseParams(rng, difficulty * 6 - 3);
    const k = 4;
    const c = 1 / k;
    const kind = choice(rng, kinds);

    if (kind === "series"){
      const start = randInt(rng, 4, 14);
      const stepA = randInt(rng, 2, 5);
      const stepB = stepA + randInt(rng, 1, 3);
      const seq = [start];
      const steps = [stepA, stepB, stepA, stepB];
      for (const step of steps) seq.push(seq[seq.length - 1] + step);
      const answerValue = seq[seq.length - 1] + stepA;
      const answer = String(answerValue);
      const choices = buildQuantChoices(rng, answer, [
        answerValue + stepB,
        answerValue - stepA,
        seq[seq.length - 1] + (stepB - stepA)
      ]);
      items.push({ id: `Q${i + 1}`, type: "mcq", domain: "quant", title: "Number series", prompt: `The pattern alternates between adding ${stepA} and adding ${stepB}. Which number should come next in the series ${seq.join(", ")}, ?`, choices, answer, blueprint: "series", irt: { a, b, c, k }, meta: { kind: "series" } });
      continue;
    }

    if (kind === "algebra"){
      const x = randInt(rng, 2, 12);
      const coef = randInt(rng, 2, 5);
      const offset = randInt(rng, 2, 10);
      const total = coef * (x - offset);
      const answer = String(x);
      const choices = buildQuantChoices(rng, answer, [x + 1, Math.max(1, x - 1), x + offset]);
      items.push({ id: `Q${i + 1}`, type: "mcq", domain: "quant", title: "Linear equation", prompt: `Solve for x in the equation ${coef}(x - ${offset}) = ${total}.`, choices, answer, blueprint: "algebra", irt: { a, b, c, k }, meta: { kind: "algebra" } });
      continue;
    }

    if (kind === "ratio"){
      const red = randInt(rng, 2, 5);
      const blue = randInt(rng, 3, 7);
      const newRed = red * randInt(rng, 2, 4);
      const answerVal = (newRed * blue) / red;
      const answer = toNumberChoice(answerVal);
      const choices = buildQuantChoices(rng, answer, [
        toNumberChoice(answerVal + red),
        toNumberChoice(answerVal - (blue / red)),
        toNumberChoice(newRed + blue)
      ]);
      items.push({ id: `Q${i + 1}`, type: "mcq", domain: "quant", title: "Proportional reasoning", prompt: `A paint mix uses a red-to-blue ratio of ${red}:${blue}. If ${newRed} cups of red paint are used and the ratio stays the same, how many cups of blue paint are needed?`, choices, answer, blueprint: "ratio", irt: { a, b, c, k }, meta: { kind: "ratio" } });
      continue;
    }

    if (kind === "rate"){
      const miles = randInt(rng, 18, 36);
      const minutes = randInt(rng, 6, 12);
      const multiplier = randInt(rng, 2, 4);
      const targetMiles = miles * multiplier;
      const answerVal = minutes * multiplier;
      const answer = String(answerVal);
      const choices = buildQuantChoices(rng, answer, [answerVal + minutes, Math.max(1, answerVal - minutes), multiplier]);
      items.push({ id: `Q${i + 1}`, type: "mcq", domain: "quant", title: "Rate reasoning", prompt: `A runner covers ${miles} miles in ${minutes} minutes at a constant pace. At that same pace, how many minutes would it take to cover ${targetMiles} miles?`, choices, answer, blueprint: "rate", irt: { a, b, c, k }, meta: { kind: "rate" } });
      continue;
    }

    if (kind === "percent"){
      const price = randInt(rng, 40, 140);
      const percentOff = choice(rng, [10, 15, 20, 25, 30]);
      const answerValue = price * (1 - percentOff / 100);
      const answer = toNumberChoice(answerValue);
      const choices = buildQuantChoices(rng, answer, [
        toNumberChoice(price - percentOff),
        toNumberChoice(price * (percentOff / 100)),
        toNumberChoice(price * (1 + percentOff / 100))
      ]);
      items.push({ id: `Q${i + 1}`, type: "mcq", domain: "quant", title: "Percent reasoning", prompt: `A jacket costs $${price}. It is discounted by ${percentOff}%. What is the final sale price?`, choices, answer, blueprint: "percent", irt: { a, b, c, k }, meta: { kind: "percent" } });
      continue;
    }

    const base = randInt(rng, 18, 42);
    const leftStep = randInt(rng, 3, 12);
    const rightStep = randInt(rng, 3, 12);
    const quantityA = base + leftStep;
    const quantityB = base + rightStep;
    const answer = quantityA === quantityB ? "The two quantities are equal" : (quantityA > quantityB ? "Quantity A" : "Quantity B");
    const choices = ["Quantity A", "Quantity B", "The two quantities are equal", "Cannot be determined from the information given"];
    items.push({ id: `Q${i + 1}`, type: "mcq", domain: "quant", title: "Quantitative comparison", prompt: `Compare the two quantities and choose the greater one. Quantity A = ${base} + ${leftStep}. Quantity B = ${base} + ${rightStep}. If they are equal, choose "The two quantities are equal."`, choices, answer, blueprint: "comparison", irt: { a, b, c, k }, meta: { kind: "comparison" } });
  }

  return items;
}

// --- Spatial reasoning --------------------------------------------------------

function makeSpatialBank(rng, n){
  const items = [];

  for (let i = 0; i < n; i++){
    const difficulty = frac(i, n);
    const { a, b } = baseParams(rng, difficulty * 6 - 3);
    const k = 4;
    const c = 1 / k;
    const shape = makeSpatialFigure(rng);
    const rotation = choice(rng, ROTATIONS.filter((deg) => deg !== 0));
    const nextRot = cycleValue(ROTATIONS, rotation, 1);
    const prevRot = cycleValue(ROTATIONS, rotation, -1);
    const options = shuffle(rng, [
      { svg: figureSvg(shape, rotation, false), key: `${rotation}|same` },
      { svg: figureSvg(shape, rotation, true), key: `${rotation}|mirror` },
      { svg: figureSvg(shape, nextRot, false), key: `${nextRot}|same` },
      { svg: figureSvg(shape, prevRot, false), key: `${prevRot}|same` }
    ]);

    items.push({
      id: `S${i + 1}`,
      type: "mcq_svg",
      domain: "spatial",
      title: "Mental rotation",
      prompt: "Which option shows the same marked shape after rotation only, with no mirror flip?",
      stemSvg: figureSvg(shape, 0, false, true),
      options,
      answer: `${rotation}|same`,
      blueprint: `rotation_${shape.template}`,
      irt: { a, b, c, k },
      meta: { kind: "rotation", template: shape.template }
    });
  }

  return items;
}

function makeSpatialFigure(rng){
  const template = choice(rng, SPATIAL_TEMPLATES);
  return {
    template: template.name,
    points: template.points,
    marker: choice(rng, template.markers),
    tint: choice(rng, ["rgba(125,211,252,0.95)", "rgba(249,168,212,0.95)", "rgba(253,186,116,0.95)", "rgba(134,239,172,0.95)"])
  };
}

function figureSvg(shape, rotation, mirrored, framed = false){
  const size = 96;
  const svgUid = nextSvgUid("spatial");
  const pts = mirrored ? shape.points.map(([x, y]) => [size - x, y]) : shape.points;
  const markerX = mirrored ? size - shape.marker.x : shape.marker.x;
  const polygon = pts.map((p) => p.join(",")).join(" ");
  const frame = framed
    ? `<rect x="5" y="5" width="86" height="86" rx="22" fill="url(#${svgUid}-frame)" stroke="rgba(255,255,255,0.16)"/>
       <rect x="10" y="10" width="76" height="76" rx="18" fill="rgba(8,17,31,0.32)" stroke="rgba(125,211,252,0.10)"/>`
    : "";
  return `<svg viewBox="0 0 96 96" width="96" height="96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${svgUid}-frame" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.20)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
      </linearGradient>
      <linearGradient id="${svgUid}-shape" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.06)"/>
      </linearGradient>
      <filter id="${svgUid}-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(8,17,31,0.28)"/>
      </filter>
    </defs>
    ${frame}
    <g transform="rotate(${rotation} 48 48)" filter="url(#${svgUid}-shadow)">
      <polygon points="${polygon}" fill="url(#${svgUid}-shape)" stroke="${shape.tint}" stroke-width="2.8" stroke-linejoin="round"/>
      <circle cx="${markerX}" cy="${shape.marker.y}" r="6.2" fill="rgba(255,255,255,0.96)" stroke="${shape.tint}" stroke-width="2.2"/>
      <circle cx="${markerX}" cy="${shape.marker.y}" r="2.6" fill="${shape.tint}"/>
    </g>
  </svg>`;
}

// --- Speed and working memory -------------------------------------------------

function makeSymbolSearchBank(rng, n){
  const items = [];
  for (let i = 0; i < n; i++){
    const diff = frac(i, n) * 6 - 3;
    const { a, b } = baseParams(rng, diff);
    const irt = { a: Math.min(2.2, a + 0.6), b, c: 0.5, k: 2 };
    const target = [choice(rng, SYMBOLS), choice(rng, SYMBOLS)];
    const rowLen = 10;
    const include = rng() < (0.45 + 0.1 * Math.tanh(diff));
    const row = [];
    let placed = false;
    for (let j = 0; j < rowLen; j++){
      if (!placed && include && rng() < 0.18){
        row.push(target.slice());
        placed = true;
      } else {
        row.push([choice(rng, SYMBOLS), choice(rng, SYMBOLS)]);
      }
    }
    if (include && !placed) row[randInt(rng, 0, rowLen - 1)] = target.slice();
    items.push({ id: `SS${i + 1}`, type: "speed_symbol", domain: "speed_symbol", title: "Symbol search", prompt: "Select YES only if the exact target pair appears somewhere in the row, in either order.", target, row, answer: include ? "YES" : "NO", irt });
  }
  return items;
}

function makeCodingBank(rng, n){
  const items = [];
  for (let i = 0; i < n; i++){
    const diff = frac(i, n) * 6 - 3;
    const { a, b } = baseParams(rng, diff);
    const irt = { a: Math.min(2.4, a + 0.7), b, c: 0, k: 10 };
    const keyPairs = shuffle(rng, SYMBOLS).slice(0, 6).map((s, idx) => ({ sym: s, dig: String(idx + 1) }));
    const seq = [];
    const len = randInt(rng, 6, 10);
    for (let j = 0; j < len; j++) seq.push(choice(rng, keyPairs).sym);
    items.push({ id: `CD${i + 1}`, type: "speed_coding", domain: "speed_coding", title: "Coding", prompt: "Use the key to convert each symbol into its matching digit, then enter the full digit string.", keyPairs, seq, answer: seq.map((s) => keyPairs.find((p) => p.sym === s).dig).join(""), irt });
  }
  return items;
}

function digitsString(rng, len){
  let s = "";
  for (let i = 0; i < len; i++) s += String(randInt(rng, 0, 9));
  if (/^(\d)\1+$/.test(s)) s = s.slice(0, -1) + String((Number(s.slice(-1)) + 3) % 10);
  return s;
}

function makeDigitSpanBank(rng, n){
  const items = [];
  for (let i = 0; i < n; i++){
    const p = frac(i, n);
    const diff = p * 6 - 3;
    const { a, b } = baseParams(rng, diff);
    const len = 3 + Math.floor(p * 7);
    const direction = i % 3 === 2 ? "backward" : "forward";
    const digits = digitsString(rng, len);
    items.push({ id: `WM${i + 1}`, type: "digitspan", domain: "wm", title: direction === "backward" ? "Digit span (backward)" : "Digit span", prompt: direction === "backward" ? "Memorize the digits. After they disappear, type them in reverse order." : "Memorize the digits. After they disappear, type them in the same order.", digits, direction, blueprint: direction, showMs: 900 + Math.max(0, 1200 - len * 70), irt: { a: Math.min(2.0, a + 0.4), b, c: 0, k: 10 }, meta: { len, direction } });
  }
  return items;
}

// --- Normalization and exports ------------------------------------------------

function normalizeItem(it){
  const irt = it.irt || {};
  const normalized = { ...it, a: irt.a, b: irt.b, c: irt.c, irt };
  if (it.type === "mcq_svg" && !it.choices && Array.isArray(it.options)) normalized.choices = it.options.map((opt, idx) => String(opt.key ?? idx + 1));
  return normalized;
}

function normalize(items){
  return items.map(normalizeItem);
}

function buildMixedFluidBank(rng, size){
  const matrixCount = Math.max(1, Math.round(size * 0.4));
  const seriesCount = Math.max(1, Math.round(size * 0.28));
  const analogyCount = Math.max(1, size - matrixCount - seriesCount);
  return shuffle(rng, [
    ...makeFluidMatrixBank(rng, matrixCount),
    ...makeFluidSeriesBank(rng, seriesCount),
    ...makeFluidAnalogyBank(rng, analogyCount)
  ]);
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
    fluid: normalize(buildMixedFluidBank(rng, sizes.fluid)),
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
  return normalize(buildMixedFluidBank(rng, opts.size ?? 300));
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
// The app uses its own speed page generators (more controlled timing and logging).
