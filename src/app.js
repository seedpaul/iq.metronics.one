import { buildPlan } from './plan.js';
import { formatTime, clamp, normalCdf, normalInv, downloadText, toCsv } from './engine/utils.js';
import { CATSession } from './engine/cat.js';
import { loadBaselineNorms, loadCustomNorms, clearCustomNorms, getNormsMeta, validateNormPack } from './engine/norms.js';
import { makeStimulus } from './engine/stimuli.js';

const els = {
  intro: document.getElementById('screen-intro'),
  test: document.getElementById('screen-test'),
  results: document.getElementById('screen-results'),

  agree: document.getElementById('agree'),
  seedInput: document.getElementById('seedInput'),
  ageBand: document.getElementById('ageBand'),
  btnStart: document.getElementById('btnStart'),
  btnQuick: document.getElementById('btnQuick'),
  btnReset: document.getElementById('btnReset'),

  normFile: document.getElementById('normFile'),
  btnLoadNorm: document.getElementById('btnLoadNorm'),
  btnClearNorm: document.getElementById('btnClearNorm'),
  normStatus: document.getElementById('normStatus'),

  testPill: document.getElementById('testPill'),
  metaLine: document.getElementById('metaLine'),
  qualityFlags: document.getElementById('qualityFlags'),
  timerValue: document.getElementById('timerValue'),

  qTitle: document.getElementById('qTitle'),
  qPrompt: document.getElementById('qPrompt'),
  stimulus: document.getElementById('stimulus'),
  answerArea: document.getElementById('answerArea'),
  helpText: document.getElementById('helpText'),

  btnBack: document.getElementById('btnBack'),
  btnNext: document.getElementById('btnNext'),
  btnPause: document.getElementById('btnPause'),

  resultsSummary: document.getElementById('resultsSummary'),
  historyArea: document.getElementById('historyArea'),
  btnDownloadJson: document.getElementById('btnDownloadJson'),
  btnDownloadCsv: document.getElementById('btnDownloadCsv'),
  btnRestart: document.getElementById('btnRestart')
};

const STORAGE_KEY = 'cog_suite_history_v2';
const CUSTOM_NORM_KEY = 'cog_suite_custom_norm_v1';

const state = {
  plan: null,
  runSeed: null,
  nodeIndex: 0,
  node: null,
  nodeEndsAtMs: null,
  timerHandle: null,

  paused: false,
  pauseStartedAtMs: null,

  // quality signals
  focusLosses: 0,
  tabSwitches: 0,
  suspiciousRT: 0,
  attentionMisses: 0,
  selectedAgeBand: '',

  // response log
  responses: [], // { subtestId, itemId, correct, rtMs, thetaBefore, thetaAfter, semAfter, choice, meta }
  subtests: {},  // subtestId -> CATSession or non-adaptive stats
  startedAt: null,
  endedAt: null,

  // latest rendered
  current: {
    renderedAtMs: 0,
    lastAnswer: null
  }
};

function deriveSeed(input){
  if (typeof input === 'number' && Number.isFinite(input)) return input >>> 0;
  if (typeof input === 'string'){
    const t = input.trim();
    if (t){
      let h = 2166136261 >>> 0;
      for (let i=0;i<t.length;i++){
        h ^= t.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
  }
  if (window.crypto && window.crypto.getRandomValues){
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] >>> 0;
  }
  return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
}

function showScreen(which){
  els.intro.classList.toggle('hidden', which !== 'intro');
  els.test.classList.toggle('hidden', which !== 'test');
  els.results.classList.toggle('hidden', which !== 'results');
}

function now(){ return Date.now(); }

function setTimer(secondsLeft){
  els.timerValue.textContent = formatTime(secondsLeft);
  if (secondsLeft <= 10) els.timerValue.style.opacity = '0.85';
  else els.timerValue.style.opacity = '1';
}

function clearTimer(){
  if (state.timerHandle) clearInterval(state.timerHandle);
  state.timerHandle = null;
}

function startNodeTimer(){
  const n = state.node;
  state.nodeEndsAtMs = now() + n.timeSeconds * 1000;

  clearTimer();
  state.timerHandle = setInterval(() => {
    if (state.paused) return;

    const secLeft = Math.ceil((state.nodeEndsAtMs - now()) / 1000);
    if (secLeft <= 0){
      setTimer(0);
      clearTimer();
      // auto advance when timed out
      advanceNode(true);
      return;
    }
    setTimer(secLeft);
  }, 200);

  setTimer(n.timeSeconds);
}

function renderQualityFlags(){
  els.qualityFlags.innerHTML = '';
  const flags = [];

  if (state.tabSwitches > 0) flags.push({ t: `Tab switches: ${state.tabSwitches}`, cls: 'warn' });
  if (state.focusLosses > 0) flags.push({ t: `Focus losses: ${state.focusLosses}`, cls: 'warn' });
  if (state.suspiciousRT > 0) flags.push({ t: `Rapid guesses: ${state.suspiciousRT}`, cls: 'bad' });
  if (state.attentionMisses > 0) flags.push({ t: `Attention checks missed: ${state.attentionMisses}`, cls: 'bad' });

  flags.forEach(f => {
    const d = document.createElement('div');
    d.className = `flag ${f.cls}`;
    d.textContent = f.t;
    els.qualityFlags.appendChild(d);
  });
}

function currentSession(){
  const n = state.node;
  if (!n || !n.subtestId) return null;
  return state.subtests[n.subtestId] || null;
}

function renderNode(){
  const n = state.node;
  const sess = currentSession();

  els.testPill.textContent = n.title;
  els.metaLine.textContent = n.subtitle || '';

  renderQualityFlags();

  els.helpText.textContent = n.instructions || '';

  // Determine next item
  let item = null;
  if (n.mode === 'cat'){
    item = sess.nextItem();
  } else if (n.mode === 'fixed'){
    item = n.items[sess.index] || null;
  } else if (n.mode === 'speed'){
    item = sess.nextItem(); // speed sessions use same interface
  }

  if (!item){
    // subtest done
    advanceNode(false);
    return;
  }

  state.current.renderedAtMs = now();
  els.qTitle.textContent = item.title || n.title;
  els.qPrompt.textContent = item.prompt || '';

  // stimulus (SVG / grid / key)
  els.stimulus.innerHTML = '';
  const stim = makeStimulus(n, item, sess);
  if (stim) els.stimulus.appendChild(stim);

  // answers
  renderAnswerUI(n, item, sess);
}

function renderAnswerUI(node, item, sess){
  els.answerArea.innerHTML = '';

  if (item.type === 'mcq_svg'){
    const options = Array.isArray(item.options) ? item.options : [];
    const wrap = document.createElement('div');
    wrap.className = 'answers';

    options.forEach((opt, i) => {
      const label = document.createElement('label');
      label.className = 'choice';
      label.dataset.choiceIndex = String(i + 1);

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `mcq_${item.id}`;
      input.value = String(opt.key ?? i + 1);

      const num = document.createElement('span');
      num.className = 'choiceNum';
      num.textContent = String(i + 1);

      const svgWrap = document.createElement('div');
      svgWrap.className = 'svgOption';
      const tpl = document.createElement('template');
      tpl.innerHTML = String(opt.svg || '').trim();
      const svgEl = tpl.content.firstElementChild;
      if (svgEl) svgWrap.appendChild(svgEl);

      label.appendChild(input);
      label.appendChild(num);
      label.appendChild(svgWrap);

      wrap.appendChild(label);
    });

    els.answerArea.appendChild(wrap);
    els.answerArea.appendChild(renderKeyboardHint());
    attachChoiceHotkeys(wrap);
    return;
  }

  if (item.type === 'mcq'){
    const wrap = document.createElement('div');
    wrap.className = 'answers';

    const options = (Array.isArray(item.choices) && item.choices.length)
      ? item.choices
      : (Array.isArray(item.options) ? item.options.map(opt => opt.label ?? opt.key ?? String(opt)) : []);

    options.forEach((c, idx) => {
      const label = document.createElement('label');
      label.className = 'choice';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `mcq_${item.id}`;
      input.value = String(c);
      input.tabIndex = 0;

      const span = document.createElement('span');
      span.textContent = String(c);

      label.appendChild(input);
      label.appendChild(span);

      label.dataset.choiceIndex = String(idx + 1);
      wrap.appendChild(label);
    });

    els.answerArea.appendChild(wrap);
    els.answerArea.appendChild(renderKeyboardHint());
    attachChoiceHotkeys(wrap);
    return;
  }

  if (item.type === 'short'){
    const input = document.createElement('input');
    input.className = 'textInput';
    input.type = 'text';
    input.placeholder = 'Type your answer';
    input.autocomplete = 'off';
    input.spellcheck = false;
    els.answerArea.appendChild(input);
    input.focus();

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') els.btnNext.click();
    });
    return;
  }

  if (item.type === 'digitspan'){
    const box = document.createElement('div');
    box.className = 'results';

    const display = document.createElement('div');
    display.className = 'resultRow';
    display.innerHTML = '<div class="k">Digits</div><div class="v" id="digitDisplay">--</div>';

    const input = document.createElement('input');
    input.className = 'textInput';
    input.type = 'text';
    input.placeholder = item.direction === 'backward'
      ? 'Type the digits backward'
      : 'Type the digits in order';
    input.autocomplete = 'off';
    input.inputMode = 'numeric';

    box.appendChild(display);
    box.appendChild(input);
    els.answerArea.appendChild(box);

    const digitEl = display.querySelector('#digitDisplay');
    digitEl.textContent = item.digits;

    setTimeout(() => {
      digitEl.textContent = '--';
      input.focus();
    }, item.showMs);

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') els.btnNext.click();
    });
    return;
  }

  if (item.type === 'speed-symbol-search' || item.type === 'speed-coding'){
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Use the controls in the panel above. Click Next when the timer ends or you have finished this page.';
    els.answerArea.appendChild(hint);
    return;
  }

  els.answerArea.textContent = 'Unsupported item type.';
}

function renderKeyboardHint(){
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.innerHTML = 'Tip: press <kbd>1</kbd>-<kbd>9</kbd> to select an option, then <kbd>Enter</kbd>.';
  return hint;
}

function attachChoiceHotkeys(wrap){
  const keyHandler = (ev) => {
    if (state.paused) return;
    if (ev.key >= '1' && ev.key <= '9'){
      const k = parseInt(ev.key, 10);
      const target = wrap.querySelector(`label[data-choice-index="${k}"] input`);
      if (target){ target.checked = true; }
    }
    if (ev.key === 'Enter'){
      ev.preventDefault();
      els.btnNext.click();
    }
  };
  window.addEventListener('keydown', keyHandler, { once: true });
}

function readAnswer(node, item, sess){
  if (item.type === 'mcq' || item.type === 'mcq_svg'){
    const checked = els.answerArea.querySelector('input[type="radio"]:checked');
    return checked ? checked.value : '';
  }
  if (item.type === 'short' || item.type === 'digitspan'){
    const input = els.answerArea.querySelector('input');
    return input ? String(input.value || '').trim() : '';
  }
  // speed tasks: sessions store internal score; return empty
  return '';
}

function scoreItem(node, item, answer){
  if (item.type === 'mcq' || item.type === 'mcq_svg'){
    return String(answer) === String(item.answer);
  }
  if (item.type === 'short'){
    const given = String(answer || '').trim().toLowerCase();
    const expected = String(item.answer || '').trim().toLowerCase();
    return given === expected;
  }
  if (item.type === 'digitspan'){
    const given = String(answer || '').replace(/\s+/g,'');
    const expected = item.direction === 'backward'
      ? item.digits.split('').reverse().join('')
      : item.digits;
    return given === expected;
  }
  return null;
}

function logResponse(node, item, sess, correct, answer, rtMs, thetaBefore, thetaAfter, semAfter, meta=null){
  state.responses.push({
    subtestId: node.subtestId,
    itemId: item.id,
    itemType: item.type,
    correct,
    rtMs,
    thetaBefore,
    thetaAfter,
    semAfter,
    choice: answer,
    meta
  });

  // rapid guessing heuristics (very conservative)
  if (item.type === 'mcq' && rtMs < 600) state.suspiciousRT += 1;
  if (item.type === 'short' && rtMs < 800) state.suspiciousRT += 1;

  renderQualityFlags();
}

function handleNext(){
  if (state.paused) return;

  const n = state.node;
  const sess = currentSession();
  const item = (n.mode === 'fixed') ? n.items[sess.index] : sess.currentItem;
  if (!item) return;

  const rtMs = clamp(now() - state.current.renderedAtMs, 0, 10*60*1000);
  const answer = readAnswer(n, item, sess);

  let correct = null;

  const thetaBefore = sess.theta ?? null;

  if (n.mode === 'cat'){
    correct = scoreItem(n, item, answer);
    sess.record(item, correct, rtMs);
    logResponse(n, item, sess, correct, answer, rtMs, thetaBefore, sess.theta, sess.sem, sess.lastMeta);
  } else if (n.mode === 'fixed'){
    correct = scoreItem(n, item, answer);
    sess.record(item, correct, rtMs);
    logResponse(n, item, sess, correct, answer, rtMs, thetaBefore, sess.theta, sess.sem, null);
  } else if (n.mode === 'speed'){
    // speed sessions compute their own scoring; just advance page
    sess.finishPage();
    logResponse(n, item, sess, null, '', rtMs, thetaBefore, sess.theta, sess.sem, sess.lastMeta);
  }

  if (n.subtestId === 'attention' && correct === false){
    state.attentionMisses += 1;
    renderQualityFlags();
  }

  renderNode();
}

function handleBack(){
  // For simplicity: back navigates to prior node, not prior item (keeps CAT clean).
  if (state.nodeIndex === 0) return;
  state.nodeIndex -= 1;
  state.node = state.plan.nodes[state.nodeIndex];

  // Restart timer for node (non-clinical; avoids complicated back/forward time accounting)
  startNodeTimer();
  renderNode();
}

function togglePause(){
  if (!state.node) return;

  state.paused = !state.paused;

  if (state.paused){
    state.pauseStartedAtMs = now();
    els.btnPause.textContent = 'Resume';
    els.helpText.textContent = 'Paused. Click Resume to continue.';
  } else {
    const pauseMs = now() - (state.pauseStartedAtMs || now());
    // extend timer by pause duration
    state.nodeEndsAtMs += pauseMs;
    els.btnPause.textContent = 'Pause';
    state.pauseStartedAtMs = null;
    renderNode();
  }
}

function advanceNode(timedOut){
  const n = state.node;
  if (!n) return;

  // finalize node session
  const sess = currentSession();
  if (sess && typeof sess.finalize === 'function') sess.finalize(timedOut);

  state.nodeIndex += 1;
  if (state.nodeIndex >= state.plan.nodes.length){
    finishRun();
    return;
  }

  state.node = state.plan.nodes[state.nodeIndex];
  startNodeTimer();
  renderNode();
}

function computeResults(){
  const norms = loadCustomNorms(CUSTOM_NORM_KEY) || loadBaselineNorms();

  // Subtest thetas -> indices
  const indices = [];
  for (const node of state.plan.nodes){
    if (!node.subtestId) continue;
    if (node.excludeFromComposite) continue;
    const sess = state.subtests[node.subtestId];
    if (!sess) continue;
    if (sess.reported) continue;
    sess.reported = true;

    const theta = sess.theta ?? 0;
    const sem = sess.sem ?? 0.6;

    const idx = norms.indices[node.subtestId] || { mean: 0, sd: 1, weight: 1.0, label: node.title };

    indices.push({
      subtestId: node.subtestId,
      label: idx.label || node.title,
      theta,
      sem,
      weight: idx.weight ?? 1.0,
      // transform theta to index score with mean=100 sd=15 by default
      score: (idx.scoreMean ?? 100) + (idx.scoreSd ?? 15) * ((theta - (idx.mean ?? 0)) / (idx.sd ?? 1)),
      scoreSd: (idx.scoreSd ?? 15),
      // CI in score space
      ciLow: null,
      ciHigh: null
    });
  }

  indices.forEach(i => {
    const zLow = i.theta - 1.96 * i.sem;
    const zHigh = i.theta + 1.96 * i.sem;

    i.ciLow = (100) + 15 * zLow;
    i.ciHigh = (100) + 15 * zHigh;
  });

  // composite theta: weighted average
  const totalW = indices.reduce((s,i)=>s + (i.weight||1), 0) || 1;
  const thetaComp = indices.reduce((s,i)=>s + (i.weight||1)*i.theta, 0) / totalW;

  // composite SEM: combine information (approx)
  // sem ~ 1/sqrt(sum info); info ~= 1/sem^2
  const infoSum = indices.reduce((s,i)=> s + (1/Math.max(1e-6, i.sem*i.sem)), 0);
  const semComp = infoSum > 0 ? 1/Math.sqrt(infoSum) : 0.6;

  
  const mapping = (() => {
    // Prefer age-band mapping if selected and available
    const pack = norms || {};
    if (pack && Array.isArray(pack.ageBands) && state.selectedAgeBand){
      const b = pack.ageBands.find(x => String(x.id) === String(state.selectedAgeBand));
      if (b && isFinite(b.thetaMean) && isFinite(b.thetaSd) && b.thetaSd > 0){
        return { mean: pack.thetaToIQ?.mean ?? 100, sd: pack.thetaToIQ?.sd ?? 15, thetaMean: b.thetaMean, thetaSd: b.thetaSd };
      }
    }
    if (pack && pack.thetaToIQ && isFinite(pack.thetaToIQ.thetaMean) && isFinite(pack.thetaToIQ.thetaSd) && pack.thetaToIQ.thetaSd > 0){
      return { mean: pack.thetaToIQ.mean ?? 100, sd: pack.thetaToIQ.sd ?? 15, thetaMean: pack.thetaToIQ.thetaMean, thetaSd: pack.thetaToIQ.thetaSd };
    }
    // fallback baseline
    return { mean: 100, sd: 15, thetaMean: 0, thetaSd: 1 };
  })();

  const z = (thetaComp - mapping.thetaMean) / mapping.thetaSd;
  const iq = mapping.mean + mapping.sd * z;

  // CI in theta-space then mapped to IQ-space
  const zLowT = (thetaComp - 1.96*semComp - mapping.thetaMean) / mapping.thetaSd;
  const zHighT = (thetaComp + 1.96*semComp - mapping.thetaMean) / mapping.thetaSd;

  const iqLow = mapping.mean + mapping.sd * zLowT;
  const iqHigh = mapping.mean + mapping.sd * zHighT;

  // percentile from normal CDF in mapped z-space
  const pct = normalCdf(z) * 100;
  const pctLow = normalCdf(zLowT) * 100;
  const pctHigh = normalCdf(zHighT) * 100;

  return {
    normsMeta: getNormsMeta(norms),
    indices,
    composite: {
      theta: thetaComp,
      sem: semComp,
      iq, iqLow, iqHigh,
      pct, pctLow, pctHigh
    }
  };
}

function finishRun(){
  clearTimer();
  state.endedAt = new Date().toISOString();

  const results = computeResults();

  const run = {
    version: '2.0.0',
    createdAt: state.startedAt,
    endedAt: state.endedAt,
    planId: state.plan.id,
    seed: state.runSeed,
    selectedAgeBand: state.selectedAgeBand || null,
    norms: results.normsMeta,
    quality: {
      focusLosses: state.focusLosses,
      tabSwitches: state.tabSwitches,
      suspiciousRT: state.suspiciousRT,
      attentionMisses: state.attentionMisses
    },
    results,
    responses: state.responses
  };

  saveHistory(run);
  renderResults(run);
  showScreen('results');
}

function renderResults(run){
  els.resultsSummary.innerHTML = '';

  const comp = run.results.composite;

  els.resultsSummary.appendChild(row('IQ estimate (non-clinical)', `${comp.iq.toFixed(1)}  (95% CI: ${comp.iqLow.toFixed(1)} - ${comp.iqHigh.toFixed(1)})`));
  els.resultsSummary.appendChild(row('Percentile (non-clinical)', `${comp.pct.toFixed(1)}%  (95% CI: ${comp.pctLow.toFixed(1)}% - ${comp.pctHigh.toFixed(1)}%)`));

  els.resultsSummary.appendChild(row('Composite theta', `${comp.theta.toFixed(2)}  (SEM: ${comp.sem.toFixed(2)})`));
  els.resultsSummary.appendChild(row('Quality flags', `tab switches ${run.quality.tabSwitches ?? 0}, focus losses ${run.quality.focusLosses ?? 0}, rapid guesses ${run.quality.suspiciousRT ?? 0}, attention misses ${run.quality.attentionMisses ?? 0}`));
  els.resultsSummary.appendChild(row('Norm model', `${run.norms.name} (${run.norms.version})`));
  if (run.norms.fairness){
    const f = run.norms.fairness;
    const note = f.note ? ` (${f.note})` : '';
    els.resultsSummary.appendChild(row('Fairness checks', `MH ${f.difMh ?? 0} | logistic ${f.difLogistic ?? 0} | flagged ${f.flagged ?? 0}${note}`));
  }
  els.resultsSummary.appendChild(row('Run seed (reproducible)', String(run.seed ?? 'auto')));

  const hr = document.createElement('div');
  hr.className = 'hr';
  els.resultsSummary.appendChild(hr);

  run.results.indices.forEach(idx => {
    els.resultsSummary.appendChild(row(idx.label, `${idx.score.toFixed(1)}  (95% CI ${idx.ciLow.toFixed(1)} - ${idx.ciHigh.toFixed(1)}; theta ${idx.theta.toFixed(2)}, SEM ${idx.sem.toFixed(2)})`));
  });

  renderHistory();
}

function row(k,v){
  const div = document.createElement('div');
  div.className = 'resultRow';
  const kEl = document.createElement('div');
  kEl.className = 'k'; kEl.textContent = k;
  const vEl = document.createElement('div');
  vEl.className = 'v'; vEl.textContent = v;
  div.appendChild(kEl); div.appendChild(vEl);
  return div;
}

function loadHistory(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch{ return []; }
}

function saveHistory(run){
  const history = loadHistory();
  history.unshift(run);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 30)));
}

function resetHistory(){
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
}

function renderHistory(){
  const history = loadHistory();
  els.historyArea.innerHTML = '';
  if (!history.length){
    els.historyArea.textContent = 'No saved runs yet.';
    return;
  }
  history.forEach(h => {
    const d = new Date(h.createdAt).toLocaleString();
    const iq = h?.results?.composite?.iq;
    const pct = h?.results?.composite?.pct;
    const seed = h?.seed;
    const iqText = Number.isFinite(iq) ? iq.toFixed(1) : '--';
    const pctText = Number.isFinite(pct) ? pct.toFixed(1) : '--';
    const meta = seed ? `seed ${seed}` : 'seed auto';
    els.historyArea.appendChild(row(d, `IQ ${iqText} | ${pctText}% | ${meta}`));
  });
}

function downloadRunJson(){
  const history = loadHistory();
  const latest = history[0];
  if (!latest) return;
  downloadText('assessment-run.json', JSON.stringify(latest, null, 2), 'application/json');
}

function downloadItemCsv(){
  const history = loadHistory();
  const latest = history[0];
  if (!latest) return;

  const rows = latest.responses.map(r => ({
    subtestId: r.subtestId,
    itemId: r.itemId,
    itemType: r.itemType,
    correct: r.correct,
    rtMs: r.rtMs,
    thetaBefore: r.thetaBefore,
    thetaAfter: r.thetaAfter,
    semAfter: r.semAfter,
    choice: r.choice
  }));

  downloadText('item-log.csv', toCsv(rows), 'text/csv');
}


function populateAgeBands(norms){
  if (!els.ageBand) return;

  const bands = Array.isArray(norms?.ageBands) ? norms.ageBands : [];
  const sel = els.ageBand;

  const prev = sel.value || '';
  sel.innerHTML = '';

  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'Prefer overall norms';
  sel.appendChild(opt0);

  for (const b of bands){
    const o = document.createElement('option');
    o.value = String(b.id ?? b.label ?? '');
    o.textContent = String(b.label ?? b.id ?? '');
    sel.appendChild(o);
  }

  // restore if still valid
  if (prev && [...sel.options].some(o => o.value === prev)){
    sel.value = prev;
  }
}

function updateNormStatus(){
  const custom = loadCustomNorms(CUSTOM_NORM_KEY);
  const baseline = loadBaselineNorms();
  const active = custom || baseline;
  const meta = getNormsMeta(active);

  populateAgeBands(active);

  let msg = `Active norm model: ${meta.name} (v${meta.version || 'n/a'}). ` +
    (custom ? 'Custom pack loaded.' : 'Baseline built-in.');

  if (meta.fairness){
    const f = meta.fairness;
    msg += ` Fairness: MH ${f.difMh ?? 0}, logistic ${f.difLogistic ?? 0}, flagged ${f.flagged ?? 0}.`;
    if (f.note) msg += ` ${f.note}`;
  }

  els.normStatus.textContent = msg;
}


async function loadNormFromFile(){
  const f = els.normFile.files && els.normFile.files[0];
  if (!f){
    els.normStatus.textContent = 'Pick a JSON file first.';
    return;
  }
  const text = await f.text();
  try{
    const obj = JSON.parse(text);
    const validation = validateNormPack(obj);
    if (!validation.valid){
      els.normStatus.textContent = 'Norm pack rejected: ' + validation.errors.join('; ');
      return;
    }
    localStorage.setItem(CUSTOM_NORM_KEY, JSON.stringify(obj));
    updateNormStatus();
    if (validation.warnings.length){
      els.normStatus.textContent += ' Warnings: ' + validation.warnings.join('; ');
    }
  }catch{
    els.normStatus.textContent = 'Could not parse JSON.';
  }
}

function clearNorm(){
  clearCustomNorms(CUSTOM_NORM_KEY);
  updateNormStatus();
}

function start(mode){
  state.startedAt = new Date().toISOString();
  state.endedAt = null;

  state.runSeed = deriveSeed(els.seedInput ? els.seedInput.value : '');

  // reset quality
  state.focusLosses = 0;
  state.tabSwitches = 0;
  state.suspiciousRT = 0;
  state.attentionMisses = 0;

  state.responses = [];
  state.subtests = {};

  state.plan = buildPlan(mode, { seed: state.runSeed });
  if (els.ageBand){
    state.selectedAgeBand = els.ageBand.value || '';
  }

  // create sessions for each node
  for (const node of state.plan.nodes){
    if (!node.subtestId) continue;
    if (node.excludeFromComposite) continue;

    const sess = new CATSession({
      subtestId: node.subtestId,
      mode: node.mode,
      bank: node.bank || [],
      fixedItems: node.items || [],
      maxItems: node.maxItems || 0,
      stopSem: node.stopSem ?? 0.32,
      minItems: node.minItems ?? 10,
      estimator: node.estimator || 'MAP',
      topK: node.topK ?? 5,
      priorMean: 0,
      priorSd: 1,
      blueprintTargets: node.blueprint || null,
      blueprintGoal: node.maxItems || node.minItems || 12,
      seed: deriveSeed(`${state.runSeed}:${node.subtestId || node.id || ''}`),
      speed: node.mode === 'speed',
      speedConfig: node.speedConfig || null
    });

    state.subtests[node.subtestId] = sess;
  }

  state.nodeIndex = 0;
  state.node = state.plan.nodes[0];

  state.paused = false;
  els.btnPause.textContent = 'Pause';

  showScreen('test');
  startNodeTimer();
  renderNode();
}

function wireEvents(){
  els.agree.addEventListener('change', () => {
    els.btnStart.disabled = !els.agree.checked;
  });
  if (els.ageBand){
    els.ageBand.addEventListener('change', () => {
      state.selectedAgeBand = els.ageBand.value || '';
    });
  }


  els.btnStart.addEventListener('click', () => start('full'));
  els.btnQuick.addEventListener('click', () => start('quick'));
  els.btnReset.addEventListener('click', resetHistory);

  els.btnBack.addEventListener('click', handleBack);
  els.btnNext.addEventListener('click', handleNext);
  els.btnPause.addEventListener('click', togglePause);

  els.btnDownloadJson.addEventListener('click', downloadRunJson);
  els.btnDownloadCsv.addEventListener('click', downloadItemCsv);
  els.btnRestart.addEventListener('click', () => showScreen('intro'));

  els.btnLoadNorm.addEventListener('click', loadNormFromFile);
  els.btnClearNorm.addEventListener('click', clearNorm);
}

function wireQualitySignals(){
  window.addEventListener('blur', () => {
    state.focusLosses += 1;
    renderQualityFlags();
    if (state.node){ els.helpText.textContent = 'Focus left the window; this is logged as a quality flag.'; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden){
      state.tabSwitches += 1;
      renderQualityFlags();
      if (state.node){ els.helpText.textContent = 'Tab switch detected; continue when ready.'; }
    }
  });
}

function init(){
  wireEvents();
  wireQualitySignals();
  updateNormStatus();
  renderHistory();
}

init();
