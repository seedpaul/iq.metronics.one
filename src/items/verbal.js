import { mulberry32, choice, shuffle, id } from './common.js';

const ANALOGIES = [
  // {a,b,c,choices,answer}
  { stem: 'Book : Reading :: Fork : ?', choices: ['Cooking','Eating','Kitchen','Food'], answer: 'Eating' },
  { stem: 'Thermometer : Temperature :: Odometer : ?', choices: ['Speed','Distance','Direction','Time'], answer: 'Distance' },
  { stem: 'Seed : Tree :: Egg : ?', choices: ['Nest','Bird','Feather','Shell'], answer: 'Bird' },
  { stem: 'Artist : Painting :: Composer : ?', choices: ['Music','Instrument','Concert','Dance'], answer: 'Music' },
  { stem: 'Bark : Dog :: Meow : ?', choices: ['Cat','Cow','Bird','Lion'], answer: 'Cat' }
];

const VOCAB = [
  { w:'ephemeral', d:'lasting a very short time', wrong:['dangerous','highly valuable','made of metal'], answer:'lasting a very short time' },
  { w:'meticulous', d:'showing great attention to detail', wrong:['careless','quickly angered','easily amused'], answer:'showing great attention to detail' },
  { w:'ambiguous', d:'open to more than one interpretation', wrong:['certain','ancient','brightly colored'], answer:'open to more than one interpretation' },
  { w:'candid', d:'truthful and straightforward', wrong:['secretive','very loud','excessively polite'], answer:'truthful and straightforward' },
  { w:'pragmatic', d:'focused on practical outcomes', wrong:['theoretical','emotional','lazy'], answer:'focused on practical outcomes' }
];

const SIMILARITIES = [
  { stem:'In what way are a poem and a song alike?', best:'Both use rhythm and language to convey meaning', distract:[
    'Both are always written down',
    'Both must rhyme',
    'Both are performed only on stage'
  ]},
  { stem:'In what way are a telescope and a microscope alike?', best:'Both are instruments for magnifying and observing', distract:[
    'Both are used only at night',
    'Both measure temperature',
    'Both are types of cameras'
  ]}
];

function buildItem(rng, n){
  const kind = choice(rng, ['analogy','vocab','similarity','logic']);

  let prompt='', choices=[], answer='';

  if (kind === 'analogy'){
    const a = choice(rng, ANALOGIES);
    prompt = a.stem;
    choices = a.choices.slice();
    answer = a.answer;
  }

  if (kind === 'vocab'){
    const v = choice(rng, VOCAB);
    prompt = `Select the best definition of: “${v.w}”`;
    choices = shuffle(rng, [v.answer, ...v.wrong]);
    answer = v.answer;
  }

  if (kind === 'similarity'){
    const s = choice(rng, SIMILARITIES);
    prompt = s.stem;
    choices = shuffle(rng, [s.best, ...s.distract]);
    answer = s.best;
  }

  if (kind === 'logic'){
    // simple syllogism
    const patterns = [
      {
        p: 'All glims are plors. Some plors are nabs. Which must be true?',
        choices: [
          'Some glims are nabs',
          'All glims are plors',
          'No plors are glims',
          'All nabs are plors'
        ],
        answer: 'All glims are plors'
      },
      {
        p: 'If no ferns are trees, and all oaks are trees, then:',
        choices: [
          'Some ferns are oaks',
          'No oaks are ferns',
          'All ferns are oaks',
          'Some trees are ferns'
        ],
        answer: 'No oaks are ferns'
      }
    ];
    const t = choice(rng, patterns);
    prompt = t.p;
    choices = t.choices;
    answer = t.answer;
  }

  // convert to labeled choices A-D
  const labels = ['A','B','C','D'];
  const choiceTexts = choices.slice(0,4);
  const correctIndex = choiceTexts.indexOf(answer);
  const mapped = labels.map((L,i)=>`${L}) ${choiceTexts[i]}`);
  const correctLabel = mapped[correctIndex];

  // IRT params (verbal tends to discriminate moderately)
  const a = 0.8 + rng()*0.7;
  const b = -1.0 + rng()*2.2;

  return {
    id: id('verbal', n),
    type: 'mcq',
    kind: 'verbal',
    title: 'Verbal reasoning',
    prompt,
    choices: labels,
    answer: correctLabel,
    choiceMap: choiceTexts,
    renderChoice: mapped,
    a, b,
    // store raw for rendering
    _choiceTexts: choiceTexts
  };
}

export function buildVerbalBank({ size=70 }={}){
  const rng = mulberry32(0xBADA55);
  const bank = [];
  for (let i=0;i<size;i++){
    const it = buildItem(rng, i+1);
    // replace choices with labeled A-D, but render uses mapped
    it._choicesRendered = it.renderChoice;
    bank.push(it);
  }
  // normalize for UI: choices are A-D, prompt already includes text
  bank.forEach(it => {
    it.choices = it._choicesRendered;
    it.answer = it.answer; // 'A','B',...
  });
  return bank;
}
