import { mulberry32, choice, shuffle, id, clamp } from './common.js';

function basePoly(rng){
  // generate a simple non-symmetric polygon
  const pts = [
    [-35,-25],
    [ 10,-35],
    [ 35,-10],
    [ 18, 35],
    [-25, 25],
    [-40,  0]
  ];
  // random jitter
  const j = (v)=> v + Math.floor((rng()-0.5)*10);
  return pts.map(([x,y])=>[j(x),j(y)]);
}

function rotatePts(pts, deg){
  const rad = deg*Math.PI/180;
  const c = Math.cos(rad), s = Math.sin(rad);
  return pts.map(([x,y])=>[Math.round(x*c - y*s), Math.round(x*s + y*c)]);
}

function item(rng, n){
  const pts = basePoly(rng);
  const rot = choice(rng, [0, 45, 90, 135, 180, 225, 270]);
  const target = { points: pts, rot: 0, fill:'rgba(234,240,255,0.72)', stroke:'rgba(234,240,255,0.22)' };

  const correctRot = rot;
  const correctPts = rotatePts(pts, correctRot);
  const correct = { points: correctPts, rot: 0, fill:'rgba(234,240,255,0.72)', stroke:'rgba(234,240,255,0.22)' };

  // distractors: wrong rotations
  const rotOptions = shuffle(rng, [45,90,135,180,225,270].filter(x=>x!==correctRot)).slice(0,3);
  const distract = rotOptions.map(d => ({ points: rotatePts(pts, d), rot:0, fill:'rgba(234,240,255,0.72)', stroke:'rgba(234,240,255,0.22)' }));

  const optionPolys = shuffle(rng, [correct, ...distract]);
  const labels = ['A','B','C','D'];
  const answer = labels[optionPolys.indexOf(correct)];

  // store preview: first option for illustration
  const preview = optionPolys[0];

  const choices = labels.slice();

  const aParam = 0.85 + rng()*0.65;
  const bParam = -0.9 + (Math.abs(correctRot)/180)*1.3 + (rng()-0.5)*0.3;

  return {
    id: id('spatial', n),
    type: 'mcq',
    kind: 'spatial-rotate',
    title: 'Mental rotation',
    prompt: 'Which option is the same shape after rotation?',
    stimulusType: 'spatial-rotate',
    target,
    preview,
    options: optionPolys,
    choices,
    answer,
    a: aParam,
    b: clamp(bParam, -2.0, 2.8)
  };
}

export function buildSpatialBank({ size=45 }={}){
  const rng = mulberry32(0x51A71AL);
  const bank = [];
  for (let i=0;i<size;i++){
    bank.push(item(rng, i+1));
  }
  return bank;
}
