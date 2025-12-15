import { mulberry32, choice, shuffle, id } from './common.js';

const SHAPES = ['circle','square','triangle','diamond','plus'];
const FILLS = [
  'rgba(234,240,255,0.78)',
  'rgba(140,211,255,0.78)',
  'rgba(255,180,120,0.72)',
  'rgba(190,255,170,0.70)'
];

function makeGlyph(rng, base={}){
  return {
    shape: base.shape ?? choice(rng, SHAPES),
    fill: base.fill ?? choice(rng, FILLS),
    rot: base.rot ?? (Math.floor(rng()*4)*45),
    count: base.count ?? (1 + Math.floor(rng()*3)),
    stroke: 'rgba(234,240,255,0.18)',
    size: base.size ?? (16 + Math.floor(rng()*8))
  };
}

/**
 * Generate a matrix with a simple rule:
 * - shape changes across columns
 * - count changes across rows
 * - rotation increments per column
 *
 * We keep rules simple but varied and parameterized to support CAT.
 */
function generateMatrixItem(rng, n){
  const shapeRow = shuffle(rng, SHAPES).slice(0,3);
  const baseRot = Math.floor(rng()*8)*15;
  const rotStep = [15,30,45,60][Math.floor(rng()*4)];
  const countRow = [1,2,3].map(x => x + Math.floor(rng()*2)); // 1-4

  const fill = choice(rng, FILLS);

  const matrix = [];
  for (let r=0;r<3;r++){
    for (let c=0;c<3;c++){
      const idx = r*3+c;
      if (idx === 8){ matrix.push(null); continue; } // missing last cell
      matrix.push(makeGlyph(rng, { shape: shapeRow[c], count: countRow[r], rot: baseRot + c*rotStep, fill }));
    }
  }

  const answerGlyph = makeGlyph(rng, { shape: shapeRow[2], count: countRow[2], rot: baseRot + 2*rotStep, fill });

  // distractors: perturb one parameter
  const distractors = [];
  distractors.push(makeGlyph(rng, { shape: shapeRow[1], count: countRow[2], rot: baseRot + 2*rotStep, fill }));
  distractors.push(makeGlyph(rng, { shape: shapeRow[2], count: countRow[1], rot: baseRot + 2*rotStep, fill }));
  distractors.push(makeGlyph(rng, { shape: shapeRow[2], count: countRow[2], rot: baseRot + 1*rotStep, fill }));
  distractors.push(makeGlyph(rng, { shape: shapeRow[2], count: countRow[2], rot: baseRot + 2*rotStep, fill: choice(rng, FILLS) }));

  // pick 6-8 options
  const options = shuffle(rng, [answerGlyph, ...distractors]).slice(0,6);
  if (!options.includes(answerGlyph)){
    options[0] = answerGlyph;
  }
  const optionsShuffled = shuffle(rng, options);
  const answerIndex = optionsShuffled.indexOf(answerGlyph);

  const labels = ['A','B','C','D','E','F','G','H'].slice(0, optionsShuffled.length);
  const answer = labels[answerIndex];

  const choices = labels;

  // IRT parameters (heuristic)
  const a = 0.9 + rng()*0.8;
  const b = -1.2 + rng()*2.4;

  return {
    id: id('fluid', n),
    type: 'mcq',
    kind: 'matrix',
    title: 'Matrix reasoning',
    prompt: 'Choose the option that completes the 3×3 pattern.',
    stimulusType: 'matrix',
    matrix,
    choiceGlyphs: optionsShuffled,
    choices,
    answer,
    a, b
  };
}

export function buildFluidBank({ size=80 }={}){
  const rng = mulberry32(0xC0FFEE);
  const bank = [];
  for (let i=0;i<size;i++){
    bank.push(generateMatrixItem(rng, i+1));
  }
  return bank;
}
