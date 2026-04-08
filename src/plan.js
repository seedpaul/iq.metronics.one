import { buildBanks } from './items/big_banks.js';
import { buildSpeedSymbolSearchPages, buildSpeedCodingPages } from './items/speed.js';

function buildAttentionItems(){
  return [
    {
      id: 'ATT1',
      type: 'mcq',
      title: 'Attention check',
      prompt: 'To confirm you are reading carefully, select the option labeled "Always".',
      choices: ['Always','Never','Sometimes','Rarely'],
      answer: 'Always',
      a: 1.0, b: -3,
      blueprint: 'attention'
    },
    {
      id: 'ATT2',
      type: 'mcq',
      title: 'Follow the instruction',
      prompt: 'Please choose option 4 for this item.',
      choices: ['1','2','3','4'],
      answer: '4',
      a: 1.0, b: -2,
      blueprint: 'attention'
    }
  ];
}

function deriveBlueprintTargets(bank){
  const counts = {};
  for (const it of bank){
    const tag = it.blueprint || it.meta?.kind;
    if (!tag) continue;
    counts[tag] = (counts[tag] || 0) + 1;
  }
  const total = Object.values(counts).reduce((s,v)=>s+v, 0);
  if (!total) return null;
  const targets = {};
  for (const [tag, count] of Object.entries(counts)){
    targets[tag] = count / total;
  }
  return targets;
}

function normalizeSeed(seed){
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const parsed = Number.parseInt(seed, 10);
  if (Number.isFinite(parsed)) return parsed >>> 0;
  return 0;
}

export function buildPlan(mode='full', opts = {}){
  const isQuick = mode === 'quick';
  const isSmoke = mode === 'smoke';
  const seed = normalizeSeed(opts.seed ?? Date.now());

  const sizes = {
    fluid: isSmoke ? 12 : (isQuick ? 60 : 320),
    verbal: isSmoke ? 12 : (isQuick ? 55 : 300),
    quant: isSmoke ? 12 : (isQuick ? 55 : 300),
    spatial: isSmoke ? 10 : (isQuick ? 40 : 170),
    speed_symbol: 0,
    speed_coding: 0,
    wm_digit: isSmoke ? 6 : (isQuick ? 18 : 60)
  };

  const banks = buildBanks({ seed, sizes });

  const blueprint = {
    fluid: deriveBlueprintTargets(banks.fluid),
    verbal: deriveBlueprintTargets(banks.verbal),
    quant: deriveBlueprintTargets(banks.quant),
    spatial: deriveBlueprintTargets(banks.spatial)
  };

  const symbolPages = buildSpeedSymbolSearchPages({ pages: isSmoke ? 1 : (isQuick ? 2 : 4), seed: seed ^ 0x51A5 });
  const codingPages = buildSpeedCodingPages({ pages: isSmoke ? 1 : (isQuick ? 2 : 4), seed: seed ^ 0xC0D1 });
  banks.speed_symbol = symbolPages;
  banks.speed_coding = codingPages;

  const attentionItems = isSmoke ? buildAttentionItems().slice(0, 1) : buildAttentionItems();

  const nodes = [
    {
      id: 'attention',
      mode: 'fixed',
      subtestId: 'attention',
      title: 'Attention check',
      subtitle: 'Read and follow the instruction precisely',
      timeSeconds: isSmoke ? 20 : (isQuick ? 40 : 45),
      instructions: 'These quick items confirm you are paying attention. Please answer exactly as instructed.',
      items: attentionItems,
      excludeFromComposite: true
    },
    {
      id: 'fluid',
      mode: 'cat',
      subtestId: 'fluid',
      title: 'Fluid Reasoning',
      subtitle: 'Adaptive matrices and relational patterns',
      timeSeconds: isSmoke ? 55 : (isQuick ? 6*60 : 9*60),
      minItems: isSmoke ? 1 : (isQuick ? 10 : 14),
      maxItems: isSmoke ? 1 : (isQuick ? 18 : 28),
      stopSem: 0.32,
      estimator: 'MAP',
      topK: 6,
      blueprint: blueprint.fluid,
      instructions: 'Choose the option that best completes the pattern. Work steadily. Avoid random guessing.',
      bank: banks.fluid
    },
    {
      id: 'verbal',
      mode: 'cat',
      subtestId: 'verbal',
      title: 'Verbal Reasoning',
      subtitle: 'Analogies, definitions, and similarities',
      timeSeconds: isSmoke ? 50 : (isQuick ? 5*60 : 8*60),
      minItems: isSmoke ? 1 : (isQuick ? 10 : 14),
      maxItems: isSmoke ? 1 : (isQuick ? 18 : 26),
      stopSem: 0.34,
      estimator: 'EAP',
      topK: 5,
      blueprint: blueprint.verbal,
      instructions: 'Answer as precisely as you can. If unsure, make your best choice.',
      bank: banks.verbal
    },
    {
      id: 'quant',
      mode: 'cat',
      subtestId: 'quant',
      title: 'Quantitative Reasoning',
      subtitle: 'Number series and word problems',
      timeSeconds: isSmoke ? 50 : (isQuick ? 5*60 : 8*60),
      minItems: isSmoke ? 1 : (isQuick ? 10 : 14),
      maxItems: isSmoke ? 1 : (isQuick ? 18 : 26),
      stopSem: 0.34,
      estimator: 'EAP',
      topK: 5,
      blueprint: blueprint.quant,
      instructions: 'No calculator. Use scratch paper if desired. Focus on patterns and constraints.',
      bank: banks.quant
    },
    {
      id: 'wm',
      mode: 'fixed',
      subtestId: 'wm',
      title: 'Working Memory',
      subtitle: 'Digit span (forward and backward)',
      timeSeconds: isSmoke ? 45 : (isQuick ? 4*60 : 6*60),
      instructions: 'Digits will appear briefly. Type them exactly. For backward trials, reverse the digits.',
      items: isSmoke ? banks.wm_digit.slice(0, 4) : banks.wm_digit
    },
    {
      id: 'speed_symbol',
      mode: 'speed',
      subtestId: 'speed_symbol',
      title: 'Processing Speed I',
      subtitle: 'Symbol search (yes/no matches)',
      timeSeconds: isSmoke ? 35 : (isQuick ? 3*60 : 5*60),
      instructions: 'Answer as many as you can quickly and accurately. Speed and accuracy both matter.',
      bank: symbolPages,
      speedConfig: { kind: 'symbol_search' }
    },
    {
      id: 'speed_coding',
      mode: 'speed',
      subtestId: 'speed_coding',
      title: 'Processing Speed II',
      subtitle: 'Coding (symbol + digit key)',
      timeSeconds: isSmoke ? 35 : (isQuick ? 3*60 : 5*60),
      instructions: 'Use the key to enter digits for each symbol. Work quickly; mistakes lower your score.',
      bank: codingPages,
      speedConfig: { kind: 'coding' }
    },
    {
      id: 'spatial',
      mode: 'cat',
      subtestId: 'spatial',
      title: 'Spatial Reasoning',
      subtitle: 'Mental rotation and matching',
      timeSeconds: isSmoke ? 45 : (isQuick ? 4*60 : 7*60),
      minItems: isSmoke ? 1 : (isQuick ? 8 : 12),
      maxItems: isSmoke ? 1 : (isQuick ? 14 : 22),
      stopSem: 0.36,
      estimator: 'MAP',
      topK: 4,
      blueprint: blueprint.spatial,
      instructions: 'Choose the option that matches the target after rotation (mirror images do not match unless stated).',
      bank: banks.spatial
    }
  ];

  return {
    id: isSmoke ? 'smoke' : (isQuick ? 'quick' : 'full'),
    seed,
    nodes,
    banks
  };
}
