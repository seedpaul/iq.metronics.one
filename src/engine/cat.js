import { clamp } from './utils.js';
import { mulberry32 } from '../items/rng.js';

/**
 * 2PL CAT engine (non-clinical).
 * Item model: P(correct|theta) = 1 / (1 + exp(-a*(theta - b))).
 * Supports MAP (default) or EAP estimation, SEM stop rules, and top-k info sampling with mild exposure control.
 */
export class CATSession {
  constructor(opts){
    this.subtestId = opts.subtestId;
    this.mode = opts.mode; // 'cat'|'fixed'|'speed'
    this.bank = (opts.bank || []).slice();
    this.fixedItems = (opts.fixedItems || []).slice();
    this.maxItems = opts.maxItems || 0;
    this.minItems = opts.minItems || 0;
    this.stopSem = opts.stopSem ?? 0.32;
    this.speed = !!opts.speed;
    this.speedConfig = opts.speedConfig || null;

    this.estimator = opts.estimator || 'MAP'; // 'MAP' | 'EAP'
    this.priorMean = opts.priorMean ?? 0;
    this.priorSd = opts.priorSd ?? 1;
    this.topK = Math.max(1, opts.topK ?? 5);

    this.seed = (opts.seed ?? Math.floor(Math.random() * 1e9)) >>> 0;
    this.rng = typeof opts.rng === 'function' ? opts.rng : mulberry32(this.seed);

    this.theta = 0.0;
    this.sem = 0.9;
    this.index = 0;

    this.administered = new Set();
    this.exposure = new Map();
    this.blueprintCounts = new Map();
    this.blueprintTargets = opts.blueprintTargets || null;
    this.blueprintGoal = opts.blueprintGoal || this.maxItems || this.minItems || 12;
    this.responses = []; // {itemId, correct, rtMs, item}
    this.currentItem = null;
    this.lastMeta = null;

    // speed task state
    this.speedState = null;
    if (this.speed){
      this._initSpeed();
    }
  }

  _initSpeed(){
    // bank is pages; each page contains generated tasks metadata
    this.speedState = {
      pageIndex: 0,
      pageScore: 0,
      totalCorrect: 0,
      totalAttempted: 0,
      // used for scoring speed sessions into theta proxy
      rtMs: 0
    };
  }

  logistic(x){
    if (x > 20) return 1;
    if (x < -20) return 0;
    return 1 / (1 + Math.exp(-x));
  }

  pCorrect(theta, item){
    const a = item.a ?? 1.0;
    const b = item.b ?? 0.0;
    return this.logistic(a * (theta - b));
  }

  itemInfo(theta, item){
    const p = this.pCorrect(theta, item);
    const a = item.a ?? 1.0;
    return (a*a) * p * (1 - p);
  }

  totalInfo(theta){
    let info = 0;
    for (const r of this.responses){
      const it = r.item;
      if (!it) continue;
      info += this.itemInfo(theta, it);
    }
    return info;
  }

  _posteriorLog(theta){
    const varPrior = this.priorSd * this.priorSd;
    let logp = -0.5 * ((theta - this.priorMean)**2) / (varPrior || 1) - 0.5 * Math.log(2*Math.PI*varPrior || 2*Math.PI);
    for (const r of this.responses){
      const it = r.item;
      const u = r.correct ? 1 : 0;
      const p = clamp(this.pCorrect(theta, it), 1e-6, 1-1e-6);
      logp += u * Math.log(p) + (1-u) * Math.log(1-p);
    }
    return logp;
  }

  _estimateMAP(){
    let theta = this.theta;
    const varPrior = this.priorSd * this.priorSd || 1;
    const priorInfo = 1 / varPrior;

    for (let iter=0; iter<14; iter++){
      let grad = -(theta - this.priorMean) * priorInfo;   // prior gradient
      let hess = -priorInfo;                              // prior hessian

      for (const r of this.responses){
        const it = r.item;
        const u = r.correct ? 1 : 0;
        const a = it.a ?? 1.0;
        const b = it.b ?? 0.0;
        const p = this.logistic(a * (theta - b));

        grad += a * (u - p);
        hess += -(a*a) * p * (1 - p);
      }

      const step = grad / Math.max(1e-6, hess);
      theta = theta - step;
      theta = clamp(theta, -4.0, 4.0);
      if (Math.abs(step) < 1e-3) break;
    }

    this.theta = theta;
    const info = Math.max(1e-6, this.totalInfo(theta) + priorInfo);
    this.sem = 1 / Math.sqrt(info);
  }

  _estimateEAP(){
    const varPrior = this.priorSd * this.priorSd || 1;
    const priorInfo = 1 / varPrior;
    const grid = [];
    const step = 0.25;
    for (let t=-4; t<=4.001; t+=step){ grid.push(t); }

    const logPosts = grid.map(t => this._posteriorLog(t));
    const maxLog = Math.max(...logPosts);
    const weights = logPosts.map(lp => Math.exp(lp - maxLog));
    const norm = weights.reduce((s,w)=>s+w, 0) || 1e-6;

    let mean = 0;
    let varPost = 0;
    for (let i=0;i<grid.length;i++){
      mean += grid[i] * weights[i];
    }
    mean /= norm;
    for (let i=0;i<grid.length;i++){
      const diff = grid[i] - mean;
      varPost += diff*diff * weights[i];
    }
    varPost = varPost / norm;

    this.theta = clamp(mean, -4, 4);
    const info = Math.max(1e-6, 1/Math.max(1e-6, varPost) + priorInfo);
    this.sem = 1 / Math.sqrt(info);
  }

  updateTheta(){
    if (this.estimator === 'EAP'){
      this._estimateEAP();
    } else {
      this._estimateMAP();
    }
  }

  selectNextByMaxInfo(){
    // top-k randomization with mild exposure penalty to reduce item overuse
    const candidates = [];

    for (const it of this.bank){
      if (this.administered.has(it.id)) continue;
      const info = this.itemInfo(this.theta, it);
      const highDiscrPenalty = 1 / (1 + 0.15 * Math.max(0, (it.a ?? 1) - 1.4));
      const seen = this.exposure.get(it.id) || 0;
      const exposurePenalty = 1 / (1 + 0.05 * seen);
      let blueprintAdj = 1;
      const tag = it.blueprint || it.meta?.kind;
      if (this.blueprintTargets && tag && this.blueprintTargets[tag] != null){
        const desiredShare = this.blueprintTargets[tag];
        const desiredCount = desiredShare * (this.blueprintGoal || (this.maxItems || this.minItems || 12));
        const seenTag = this.blueprintCounts.get(tag) || 0;
        const scarcity = desiredCount > 0 ? clamp(1.2 - (seenTag / Math.max(1, desiredCount)), 0.55, 1.35) : 1;
        blueprintAdj = scarcity;
      }
      const score = info * highDiscrPenalty * exposurePenalty * blueprintAdj;
      candidates.push({ it, score });
    }

    if (!candidates.length) return null;

    candidates.sort((a,b) => b.score - a.score);
    const top = candidates.slice(0, this.topK);
    const totalScore = top.reduce((s,c)=>s + c.score, 0);
    let pick = this.rng();
    if (totalScore <= 0){
      return top[Math.floor(this.rng() * top.length)].it;
    }
    let acc = 0;
    for (const c of top){
      acc += c.score / totalScore;
      if (pick <= acc) return c.it;
    }
    return top[0].it;
  }

  nextItem(){
    if (this.mode === 'fixed'){
      this.currentItem = this.fixedItems[this.index] || null;
      return this.currentItem;
    }

    if (this.mode === 'speed'){
      const page = this.bank[this.speedState.pageIndex] || null;
      this.currentItem = page;
      return page;
    }

    if (this.responses.length >= this.maxItems){
      this.currentItem = null;
      return null;
    }

    if (this.responses.length >= this.minItems && this.sem <= this.stopSem){
      this.currentItem = null;
      return null;
    }

    const it = this.selectNextByMaxInfo();
    this.currentItem = it;
    return it;
  }

  record(item, correct, rtMs){
    if (!item) return;

    this.administered.add(item.id);
    this.exposure.set(item.id, (this.exposure.get(item.id) || 0) + 1);
    const tag = item.blueprint || item.meta?.kind;
    if (tag){
      this.blueprintCounts.set(tag, (this.blueprintCounts.get(tag) || 0) + 1);
    }

    this.responses.push({ itemId: item.id, correct, rtMs, item });
    this.index += 1;

    this.updateTheta();

    this.lastMeta = {
      infoAtTheta: this.itemInfo(this.theta, item),
      bankRemaining: this.bank.length - this.administered.size,
      exposureCount: this.exposure.get(item.id) || 1,
      estimator: this.estimator,
      blueprintTag: tag || null,
      blueprintCount: tag ? this.blueprintCounts.get(tag) : null
    };
  }

  // Speed task interactions: stimulus will update speedState and then finishPage here.
  finishPage(){
    if (!this.speedState) return;
    if (typeof this._codingScoreFn === 'function'){
      try{ this._codingScoreFn(); }catch{}
      this._codingScoreFn = null;
    }
    this.speedState.pageIndex += 1;

    if (this.speedState.pageIndex >= this.bank.length){
      this._finalizeSpeedTheta();
      this.currentItem = null;
    }
  }

  _finalizeSpeedTheta(){
    const att = Math.max(1, this.speedState.totalAttempted);
    const cor = this.speedState.totalCorrect;

    const acc = cor / att;
    const adjAcc = (cor + 0.5) / (att + 1.0);

    const logit = Math.log(adjAcc / (1 - adjAcc));
    const scale = clamp(Math.sqrt(att / 30), 0.4, 1.25);

    this.theta = clamp(logit / 1.6, -3.0, 3.0) * scale;
    const info = Math.max(1e-6, att / 18);
    this.sem = 1 / Math.sqrt(info);
  }

  finalize(timedOut){
    if (this.speed){
      this._finalizeSpeedTheta();
    }
  }
}
