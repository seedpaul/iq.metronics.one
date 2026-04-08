import { symbolToSvg, renderSymbolGrid, drawSymbolCanvas } from "./symbols.js";
import { nowMs, clamp } from "../engine/utils.js";

const FALLBACK_SPEED_SYMBOLS = [
  "sigil_orbit",
  "sigil_beacon",
  "sigil_frame",
  "sigil_kite",
  "sigil_pulse",
  "sigil_halo",
  "sigil_prism",
  "sigil_axis",
  "sigil_nova",
  "sigil_arc",
  "sigil_gate",
  "sigil_quartz"
];

export function renderItem({ mount, item, onSelectionChanged, practice = null }){
  mount.innerHTML = "";
  const t0 = nowMs();

  let selectedIndex = null;
  let blockResult = null;
  let cleanupFn = null;
  const optionList = Array.isArray(item.options) ? item.options : [];
  const isFluidVisual = item.domain === "Gf" && item.stem?.type === "svg_stem" && optionList.length > 0;
  const isSpatialVisual = item.domain === "Gv" && item.stem?.type === "svg_stem" && optionList.length > 0;
  const isVisualSvgMcq = item.stem?.type === "svg_stem" && optionList.length > 0;

  const layout = document.createElement("div");
  layout.className = "itemRenderer";
  if (isVisualSvgMcq) layout.classList.add("itemRendererVisual");
  if (isFluidVisual) layout.classList.add("itemRendererFluid");
  if (isSpatialVisual) layout.classList.add("itemRendererSpatial");
  mount.appendChild(layout);

  const stim = document.createElement("div");
  stim.className = isVisualSvgMcq ? "itemRendererStage" : "itemRendererStagePlain";
  layout.appendChild(stim);

  if (item.stem?.type === "text_prompt"){
    stim.innerHTML = "";
  }

  if (item.stem?.type === "svg_stem"){
    const box = document.createElement("div");
    box.className = "svgStem";
    box.innerHTML = item.stem.html ?? "";
    stim.appendChild(box);
  }

  // -------- Nonverbal / visual stems --------

  if (item.stem.type === "analogy_panels"){
    stim.appendChild(canvasBox((c, ctx) => drawFourPanels(ctx, c, item.stem.panels), 840, 280));
  }

  if (item.stem.type === "matrix_3x3"){
    stim.appendChild(canvasBox((c, ctx) => drawMatrix3x3(ctx, c, item.stem.grid), 840, 380));
  }

  if (item.stem.type === "series_panels"){
    stim.appendChild(canvasBox((c, ctx) => drawSeries(ctx, c, item.stem.panels), 840, 220));
  }

  if (item.stem.type === "rotation_match" || item.stem.type === "mirror_match"){
    const grid = document.createElement("div");
    grid.className = "grid2";

    const left = document.createElement("div");
    left.innerHTML = `<div class="muted small">Target</div>${symbolToSvg(item.stem.target, 110)}`;

    const right = document.createElement("div");
    right.innerHTML = `<div class="muted small">${item.stem.type === "mirror_match" ? "Mirror match" : "Rotate match"}</div>`;

    grid.appendChild(left);
    grid.appendChild(right);
    stim.appendChild(grid);
  }

  // -------- Quantitative / verbal-low-load stems --------

  if (item.stem.type === "numeric_sequence"){
    const seq = item.stem.sequence.join("  •  ") + "  •  ?";
    stim.appendChild(textBox("Sequence", seq, 18));
  }

  if (item.stem.type === "ratio_compare"){
    const html = `
      <div class="muted small">Target</div>
      <div style="font-size:22px;margin-top:6px"><strong>${escapeHtml(item.stem.target)}</strong></div>
      <div class="muted small" style="margin-top:10px">Choose the closest option.</div>
    `;
    stim.appendChild(htmlBox(html));
  }

  if (item.stem.type === "logic_inference"){
    const html = `
      <div class="muted small">Premises</div>
      <div style="margin-top:6px">${escapeHtml(item.stem.premises)}</div>
      <div class="divider"></div>
      <div class="muted small">Conclusion</div>
      <div style="margin-top:6px"><strong>${escapeHtml(item.stem.conclusion)}</strong></div>
    `;
    stim.appendChild(htmlBox(html));
  }

  if (item.stem.type === "verbal_analogy"){
    const html = `
      <div class="muted small">Analogy</div>
      <div style="margin-top:8px;font-size:18px">
        <strong>${escapeHtml(item.stem.a1)}</strong> : <strong>${escapeHtml(item.stem.b1)}</strong>
        &nbsp; :: &nbsp;
        <strong>${escapeHtml(item.stem.a2)}</strong> : <strong>?</strong>
      </div>
      <div class="muted small" style="margin-top:10px">Choose the best completion.</div>
    `;
    stim.appendChild(htmlBox(html));
  }

  // -------- Block tasks --------

  if (item.stem.type === "n_back_block"){
    const block = renderNBackBlock(stim, item.stem, (result) => {
      blockResult = result;
      onSelectionChanged?.(true);
    });
    cleanupFn = block.cleanup;
  }

  if (item.stem.type === "symbol_search_block"){
    const block = renderSymbolSearchBlock(stim, item.stem, (result) => {
      blockResult = result;
      onSelectionChanged?.(true);
    }, practice);
    cleanupFn = block.cleanup;
  }

  if (item.stem.type === "coding_block"){
    const block = renderCodingBlock(stim, { ...item.stem, options: item.stem.options || item.options }, (result) => {
      blockResult = result;
      onSelectionChanged?.(true);
    }, practice);
    cleanupFn = block.cleanup;
  }

  // -------- Options (MC only) --------

  const isBlock = ["n_back_block","symbol_search_block","coding_block"].includes(item.stem.type);

  if (!isBlock){
    const opts = document.createElement("div");
    if (isFluidVisual) opts.className = "options visualOptions fluidOptions";
    else if (isSpatialVisual) opts.className = "options visualOptions spatialOptions";
    else if (isVisualSvgMcq) opts.className = "options visualOptions";
    else opts.className = "options";

    if (!optionList.length){
      opts.innerHTML = "<div class=\"muted small\">No options available.</div>";
    }else{
      optionList.forEach((opt, idx) => {
        const el = document.createElement("div");
        if (isFluidVisual) el.className = "option fluidOption visualOptionCard";
        else if (isSpatialVisual) el.className = "option spatialOption visualOptionCard";
        else if (isVisualSvgMcq) el.className = "option visualOptionCard";
        else el.className = "option";
        el.dataset.index = String(idx);
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", `Option ${idx + 1}`);

        if (typeof opt === "object"){
          if (opt.svg){
            if (isFluidVisual){
              el.innerHTML = `<div class="fluidOptionInner"><div class="fluidOptionBadge">${String.fromCharCode(65 + idx)}</div>${opt.svg}</div>`;
            }else if (isSpatialVisual || isVisualSvgMcq){
              el.innerHTML = `<div class="visualOptionInner"><div class="fluidOptionBadge">${String.fromCharCode(65 + idx)}</div>${opt.svg}</div>`;
            }else{
              el.innerHTML = opt.svg;
            }
          }else{
            el.innerHTML = symbolToSvg(opt, 92);
          }
        }else if (typeof opt === "string" && opt.startsWith("sigil_")){
          el.innerHTML = symbolToSvg(opt, 92);
        }else{
          el.textContent = String(opt);
        }

        const select = () => {
          selectedIndex = idx;
          [...opts.querySelectorAll(".option")].forEach(x => x.classList.remove("selected"));
          el.classList.add("selected");
          onSelectionChanged?.(true);
        };

        el.addEventListener("click", select);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " "){
            e.preventDefault();
            select();
          }
        });

        opts.appendChild(el);
      });
    }

    layout.appendChild(opts);
  }

  return {
    getResponse(){
      const rtMs = Math.max(0, nowMs() - t0);

      if (isBlock){
        if (!blockResult) return null;
        const x = scoreBlockToBinary(item, blockResult);
        return { x, rtMs, meta: { ...blockResult, criterion: blockCriterion(item) } };
      }

      if (selectedIndex === null) return null;
      const x = (selectedIndex === item.key) ? 1 : 0;
      return { x, rtMs, meta: { selectedIndex } };
    },
    cleanup(){
      cleanupFn?.();
    }
  };
}

/* ----------------- Helpers ----------------- */

function canvasBox(drawFn, w, h){
  const wrap = document.createElement("div");
  wrap.className = "canvasWrap";
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  wrap.appendChild(c);
  const ctx = c.getContext("2d");
  drawFn(c, ctx);
  return wrap;
}

function htmlBox(innerHtml){
  const box = document.createElement("div");
  box.className = "callout";
  box.innerHTML = innerHtml;
  return box;
}

function textBox(label, text, fontSize=16){
  return htmlBox(`<div class="muted small">${escapeHtml(label)}</div><div style="font-size:${fontSize}px;margin-top:6px">${escapeHtml(text)}</div>`);
}

/* ----------------- Block scoring ----------------- */

function blockCriterion(item){
  const b = item.b ?? 0;
  return clamp(0.60 + 0.06 * b, 0.58, 0.86);
}

function scoreBlockToBinary(item, result){
  const criterion = blockCriterion(item);
  return (result.accuracy ?? 0) >= criterion ? 1 : 0;
}

export function summarizeBlockPerformance(totalTrials, responses){
  const expectedTrials = Math.max(0, Number(totalTrials) || 0);
  const answeredTrials = Array.isArray(responses) ? responses.length : 0;
  const correctTrials = Array.isArray(responses) ? responses.filter((entry) => entry.correct).length : 0;
  const omittedTrials = Math.max(0, expectedTrials - answeredTrials);
  const accuracy = expectedTrials > 0 ? (correctTrials / expectedTrials) : 0;
  const responseRate = expectedTrials > 0 ? (answeredTrials / expectedTrials) : 0;
  const medianRtMs = median(Array.isArray(responses) ? responses.map((entry) => entry.rtMs) : []);

  return {
    trials: expectedTrials,
    responded: answeredTrials,
    correct: correctTrials,
    omitted: omittedTrials,
    accuracy,
    responseRate,
    medianRtMs
  };
}

/* ----------------- Blocks ----------------- */

function renderNBackBlock(mount, cfg, onDone){
  const state = { running:false, cancelled:false, index:0, trials:[], responses:[], lastStartMs:0 };

  const wrap = document.createElement("div");
  wrap.className = "callout";
  wrap.innerHTML = `
    <div class="muted small">N-back block</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px">
      <div class="badge">n = ${cfg.n}</div>
      <div class="badge">trials = ${cfg.length}</div>
      <div class="badge">stim = ${cfg.stimMs}ms</div>
      <div class="badge">gap = ${cfg.isiMs}ms</div>
    </div>
    <div class="divider"></div>
    <div id="nbArea"></div>
    <div class="divider"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn secondary" id="btnStartBlock">Start block</button>
      <button class="btn secondary" id="btnMatch" disabled>Match</button>
      <button class="btn secondary" id="btnNoMatch" disabled>No match</button>
      <span class="muted small" id="nbStatus">Not started.</span>
    </div>
  `;
  mount.appendChild(wrap);

  const area = wrap.querySelector("#nbArea");
  const btnStart = wrap.querySelector("#btnStartBlock");
  const btnM = wrap.querySelector("#btnMatch");
  const btnN = wrap.querySelector("#btnNoMatch");
  const status = wrap.querySelector("#nbStatus");

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "canvasWrap";
  const canvas = document.createElement("canvas");
  canvas.width = 560;
  canvas.height = 320;
  canvasWrap.appendChild(canvas);
  area.appendChild(canvasWrap);

  const ctx = canvas.getContext("2d");

  function genTrials(){
    const positions = [];
    for (let i = 0; i < cfg.length; i++){
      positions.push(Math.floor(Math.random() * 9));
    }
    const lureCount = Math.floor(cfg.length * (cfg.lureRate ?? 0.2));
    for (let k = 0; k < lureCount; k++){
      const i = Math.floor(Math.random() * (cfg.length - 3)) + 3;
      const lureType = Math.random() < 0.5 ? (cfg.n - 1) : (cfg.n + 1);
      if (lureType > 0 && i - lureType >= 0){
        positions[i] = positions[i - lureType];
      }
    }
    return positions.map((pos, i) => ({ i, pos, match: (i - cfg.n >= 0) ? (pos === positions[i - cfg.n]) : false }));
  }

  function drawPos(pos, show=true){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    const pad = 50;
    const size = Math.min(canvas.width, canvas.height) - pad*2;
    const cell = size / 3;

    ctx.strokeStyle = "rgba(229,231,235,0.20)";
    ctx.lineWidth = 2;
    for (let r = 0; r < 3; r++){
      for (let c = 0; c < 3; c++){
        ctx.strokeRect(pad + c*cell, pad + r*cell, cell, cell);
      }
    }
    if (!show) return;

    const r = Math.floor(pos / 3);
    const c = pos % 3;

    ctx.fillStyle = "rgba(96,165,250,0.85)";
    ctx.beginPath();
    ctx.arc(pad + c*cell + cell/2, pad + r*cell + cell/2, cell*0.18, 0, Math.PI*2);
    ctx.fill();
  }

  function enableResponse(enabled){
    btnM.disabled = !enabled;
    btnN.disabled = !enabled;
  }

  function recordResponse(isMatch){
    if (!state.running) return;
    const trial = state.trials[state.index];
    const rtMs = Math.max(0, performance.now() - state.lastStartMs);
    state.responses.push({ i: trial.i, isMatch, correct: (isMatch === trial.match), rtMs });
    status.textContent = `Trial ${trial.i+1}/${cfg.length} recorded.`;
  }

  async function run(){
    state.running = true;
    state.cancelled = false;
    state.index = 0;
    state.trials = genTrials();
    state.responses = [];

    btnStart.disabled = true;
    enableResponse(true);
    status.textContent = "Running… respond on each trial.";

    for (state.index = 0; state.index < state.trials.length; state.index++){
      if (state.cancelled) break;

      const trial = state.trials[state.index];

      drawPos(trial.pos, true);
      state.lastStartMs = performance.now();

      await sleep(cfg.stimMs);
      drawPos(trial.pos, false);
      await sleep(cfg.isiMs);
    }

    state.running = false;
    enableResponse(false);
    btnStart.disabled = false;

    const summary = summarizeBlockPerformance(state.trials.length, state.responses);
    status.textContent = `Done. Accuracy ${(summary.accuracy*100).toFixed(1)}% • answered ${summary.responded}/${summary.trials} • median RT ${(summary.medianRtMs/1000).toFixed(2)}s`;

    onDone?.(summary);
  }

  btnStart.addEventListener("click", run);
  btnM.addEventListener("click", () => recordResponse(true));
  btnN.addEventListener("click", () => recordResponse(false));

  function onKey(e){
    if (!state.running) return;
    if (e.key === "ArrowLeft") recordResponse(true);
    if (e.key === "ArrowRight") recordResponse(false);
  }
  window.addEventListener("keydown", onKey);

  drawPos(0, false);

  return { cleanup(){ state.cancelled = true; window.removeEventListener("keydown", onKey); } };
}

function renderSymbolSearchBlock(mount, cfg, onDone, practice){
  const state = { stage:"idle", cancelled:false, index:0, responses:[], lastStartMs:0, current:null, awaitingResponse:false, pendingResolver:null, practicePassed:!!practice?.completed };

  const wrap = document.createElement("div");
  wrap.className = "callout";
  wrap.innerHTML = `
    <div class="muted small">Symbol search block</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px">
      <div class="badge">trials = ${cfg.length}</div>
      <div class="badge">set = ${cfg.setSize}</div>
      <div class="badge">time/trial = ${cfg.trialMs}ms</div>
    </div>
    <div class="muted small" style="margin-top:8px">Select <strong>Present</strong> only if the candidate pair contains the exact same two symbols as the key pair, in either order.</div>
    <div class="muted small" style="margin-top:6px">Practice is required once before the timed block starts.</div>
    <div class="divider"></div>
    <div id="ssArea"></div>
    <div class="divider"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn secondary" id="btnPracticeSS">Run practice</button>
      <button class="btn secondary" id="btnStartSS" disabled>Start block</button>
      <button class="btn secondary" id="btnPresent" disabled>Present</button>
      <button class="btn secondary" id="btnAbsent" disabled>Not present</button>
      <span class="muted small" id="ssStatus">Run the two practice trials before the timed block starts.</span>
    </div>
  `;
  mount.appendChild(wrap);

  const area = wrap.querySelector("#ssArea");
  const btnPractice = wrap.querySelector("#btnPracticeSS");
  const btnStart = wrap.querySelector("#btnStartSS");
  const btnP = wrap.querySelector("#btnPresent");
  const btnA = wrap.querySelector("#btnAbsent");
  const status = wrap.querySelector("#ssStatus");

  const board = document.createElement("div");
  board.className = "canvasWrap symbolSearchBoard";
  area.appendChild(board);

  function genTrial(){
    const alphabet = FALLBACK_SPEED_SYMBOLS;
    const target = shuffleCopy(alphabet).slice(0, 2);
    const set = shuffleCopy(alphabet).slice(0, 2);
    const present = Math.random() < 0.5;
    if (present){
      set[Math.floor(Math.random() * set.length)] = target[Math.floor(Math.random() * target.length)];
    }else{
      for (let i = 0; i < set.length; i++){
        if (target.includes(set[i])){
          set[i] = alphabet[(alphabet.indexOf(set[i]) + 2) % alphabet.length];
        }
      }
    }
    return { target, pair: set, present };
  }

  function drawTrial(trial, fade=false){
    board.innerHTML = `
      <div class="symbolSearchGrid">
        <div class="symbolSearchPanel">
          <div class="symbolSearchLabel">Target key</div>
          <div class="symbolSearchGlyph${fade ? " faded" : ""}">${symbolToSvg(trial.target, 108)}</div>
        </div>
        <div class="symbolSearchPanel">
          <div class="symbolSearchLabel">Candidate pair</div>
          <div class="symbolSearchGlyph${fade ? " faded" : ""}">${symbolToSvg(trial.pair, 108)}</div>
        </div>
      </div>
      <div class="symbolSearchHint">Respond Present only if both symbols match the key pair, in any order.</div>
    `;
  }

  function enableResponse(enabled){
    btnP.disabled = !enabled;
    btnA.disabled = !enabled;
  }

  function syncPracticeUi(){
    btnPractice.textContent = state.practicePassed ? "Review practice" : "Run practice";
  }

  function resolvePending(value){
    const resolver = state.pendingResolver;
    state.pendingResolver = null;
    resolver?.(value);
  }

  function waitForInput(){
    return new Promise((resolve) => {
      state.pendingResolver = resolve;
    });
  }

  function buildPracticeTrials(){
    const keySymbols = cfg.keySymbols || FALLBACK_SPEED_SYMBOLS.slice(0, 2);
    const distractor = FALLBACK_SPEED_SYMBOLS.find((symbol) => !keySymbols.includes(symbol)) || FALLBACK_SPEED_SYMBOLS[2];
    return [
      {
        target: keySymbols,
        pair: keySymbols.slice().reverse(),
        present: true,
        prompt: "Practice 1 of 2: this candidate pair is an exact match in reverse order."
      },
      {
        target: keySymbols,
        pair: [keySymbols[0], distractor],
        present: false,
        prompt: "Practice 2 of 2: one symbol changed, so this is not present."
      }
    ];
  }

  function resetToIdlePreview(message){
    state.stage = "idle";
    state.awaitingResponse = false;
    state.current = null;
    enableResponse(false);
    btnPractice.disabled = false;
    btnStart.disabled = !state.practicePassed;
    syncPracticeUi();
    status.textContent = message || (state.practicePassed
      ? "Practice already completed for this section. Start block when you are ready, or review practice again."
      : "Run the two practice trials before the timed block starts.");
    drawTrial({ target: cfg.keySymbols || FALLBACK_SPEED_SYMBOLS.slice(0, 2), pair: (cfg.keySymbols || FALLBACK_SPEED_SYMBOLS.slice(0, 2)).slice().reverse(), present: false }, true);
  }

  function recordResponse(present){
    if (!state.current || !state.awaitingResponse || !["practice", "running"].includes(state.stage)) return;
    state.awaitingResponse = false;

    if (state.stage === "practice"){
      resolvePending({ present, correct: present === state.current.present });
      return;
    }

    const rtMs = Math.max(0, performance.now() - state.lastStartMs);
    state.responses.push({ i: state.index, present, correct: (present === state.current.present), rtMs });
    status.textContent = `Trial ${state.index+1}/${cfg.length} recorded.`;
  }

  async function runPractice(){
    state.cancelled = false;
    state.practicePassed = false;
    state.stage = "practice";
    btnPractice.disabled = true;
    btnStart.disabled = true;
    enableResponse(true);

    const practiceTrials = buildPracticeTrials();
    for (let index = 0; index < practiceTrials.length; index++){
      const trial = practiceTrials[index];
      let correct = false;

      while (!correct){
        if (state.cancelled) return;
        state.current = trial;
        state.awaitingResponse = true;
        drawTrial(trial, false);
        status.textContent = `${trial.prompt} Answer this untimed practice item correctly to continue.`;

        const result = await waitForInput();
        if (!result || state.cancelled) return;
        correct = result.correct;
        status.textContent = correct
          ? `Practice ${index + 1}/${practiceTrials.length} correct.`
          : "Not quite. Choose Present only when both symbols match the key pair, in any order.";
        await sleep(correct ? 220 : 520);
      }
    }

    state.practicePassed = true;
    practice?.onComplete?.();
    resetToIdlePreview("Practice complete. Start block when you are ready.");
  }

  async function run(){
    state.stage = "running";
    state.cancelled = false;
    state.index = 0;
    state.responses = [];

    btnPractice.disabled = true;
    btnStart.disabled = true;
    enableResponse(true);
    status.textContent = "Running… respond on each trial.";

    for (state.index = 0; state.index < cfg.length; state.index++){
      if (state.cancelled) break;

      const trial = cfg.trials?.[state.index] || genTrial();
      state.current = trial;
      state.awaitingResponse = true;
      drawTrial(trial, false);
      state.lastStartMs = performance.now();

      await sleep(cfg.trialMs);
      state.awaitingResponse = false;
      drawTrial(trial, true);
      await sleep(120);
    }

    state.stage = "idle";
    enableResponse(false);
    btnPractice.disabled = false;
    btnStart.disabled = false;

    const summary = summarizeBlockPerformance(cfg.length, state.responses);
    status.textContent = `Done. Accuracy ${(summary.accuracy*100).toFixed(1)}% • answered ${summary.responded}/${summary.trials} • median RT ${(summary.medianRtMs/1000).toFixed(2)}s`;

    onDone?.(summary);
  }

  btnPractice.addEventListener("click", runPractice);
  btnStart.addEventListener("click", run);
  btnP.addEventListener("click", () => recordResponse(true));
  btnA.addEventListener("click", () => recordResponse(false));

  function onKey(e){
    if (!state.awaitingResponse || !["practice", "running"].includes(state.stage)) return;
    if (e.key === "ArrowLeft") recordResponse(true);
    if (e.key === "ArrowRight") recordResponse(false);
  }
  window.addEventListener("keydown", onKey);

  resetToIdlePreview();

  return { cleanup(){ state.cancelled = true; resolvePending(null); window.removeEventListener("keydown", onKey); } };
}

function renderCodingBlock(mount, cfg, onDone, practice){
  const state = { stage:"idle", cancelled:false, index:0, responses:[], lastStartMs:0, current:null, awaitingResponse:false, pendingResolver:null, practicePassed:!!practice?.completed };

  const wrap = document.createElement("div");
  wrap.className = "callout";
  wrap.innerHTML = `
    <div class="muted small">Coding block</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px">
      <div class="badge">trials = ${cfg.length}</div>
      <div class="badge">time/trial = ${cfg.trialMs}ms</div>
    </div>
    <div class="muted small" style="margin-top:8px">Look up the symbol in the key, then select the digit paired with that symbol.</div>
    <div class="muted small" style="margin-top:6px">Practice is required once before the timed block starts.</div>
    <div class="divider"></div>
    <div id="cdArea"></div>
    <div class="divider"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn secondary" id="btnPracticeCD">Run practice</button>
      <button class="btn secondary" id="btnStartCD" disabled>Start block</button>
      <span class="muted small" id="cdStatus">Run the practice items before the timed block starts.</span>
    </div>
  `;
  mount.appendChild(wrap);

  const area = wrap.querySelector("#cdArea");
  const btnPractice = wrap.querySelector("#btnPracticeCD");
  const btnStart = wrap.querySelector("#btnStartCD");
  const status = wrap.querySelector("#cdStatus");

  const key = document.createElement("div");
  key.className = "callout";
  key.style.marginTop = "10px";

  const entries = Object.entries(cfg.keymap);
  key.innerHTML = `
    <div class="muted small">Key</div>
    <div class="symbolKeyGrid">
      ${entries.map(([sym, digit]) => `
        <div class="symbolKeyCard">
          <div class="symbolKeyGlyph">${symbolToSvg(sym, 56)}</div>
          <div class="badge digitBadge">${escapeHtml(digit)}</div>
        </div>
      `).join("")}
    </div>
  `;
  area.appendChild(key);

  const targetWrap = document.createElement("div");
  targetWrap.className = "canvasWrap codingCanvasWrap codingTargetWrap";
  const responseDock = document.createElement("div");
  responseDock.className = "codingResponseDock";
  responseDock.appendChild(targetWrap);
  area.appendChild(responseDock);

  const opts = document.createElement("div");
  opts.className = "options codingOptions";
  responseDock.appendChild(opts);

  function drawTarget(symbol, fade=false){
    targetWrap.innerHTML = `
      <div class="codingTargetPanel">
        <div class="codingTargetLabel">Enter the digit that matches this symbol in the key</div>
        <div class="codingTargetGlyph${fade ? " faded" : ""}">${symbolToSvg(symbol, 126)}</div>
      </div>
    `;
  }

  function drawIdleState(){
    targetWrap.innerHTML = `
      <div class="codingTargetPanel idle">
        <div class="codingTargetLabel">Enter the digit that matches this symbol in the key</div>
        <div class="codingIdleTitle">Press Start block to begin timed coding trials.</div>
        <div class="codingIdleText">Every live target will come directly from the key shown above.</div>
      </div>
    `;
  }

  function genTrial(){
    const symbols = Object.keys(cfg.keymap);
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    return { symbol, digit: cfg.keymap[symbol] };
  }

  function enableOptions(enabled){
    [...opts.querySelectorAll(".option")].forEach(x => x.style.pointerEvents = enabled ? "auto" : "none");
  }

  function syncPracticeUi(){
    btnPractice.textContent = state.practicePassed ? "Review practice" : "Run practice";
  }

  function resolvePending(value){
    const resolver = state.pendingResolver;
    state.pendingResolver = null;
    resolver?.(value);
  }

  function waitForInput(){
    return new Promise((resolve) => {
      state.pendingResolver = resolve;
    });
  }

  function clearOptionSelection(){
    [...opts.querySelectorAll(".option")].forEach(x => x.classList.remove("selected"));
  }

  function buildPracticeTrials(){
    const unique = [];
    const seen = new Set();
    const source = Array.isArray(cfg.sequence) && cfg.sequence.length ? cfg.sequence : Object.entries(cfg.keymap).map(([symbol, digit]) => ({ symbol, digit }));
    for (const entry of source){
      if (!entry || seen.has(entry.symbol)) continue;
      seen.add(entry.symbol);
      unique.push({ symbol: entry.symbol, digit: entry.digit });
      if (unique.length === Math.min(3, Object.keys(cfg.keymap).length)) break;
    }
    return unique;
  }

  function resetToIdleState(message){
    state.stage = "idle";
    state.awaitingResponse = false;
    state.current = null;
    enableOptions(false);
    btnPractice.disabled = false;
    btnStart.disabled = !state.practicePassed;
    syncPracticeUi();
    status.textContent = message || (state.practicePassed
      ? "Practice already completed for this section. Start block when you are ready, or review practice again."
      : "Run the practice items before the timed block starts.");
    drawIdleState();
  }

  function recordResponse(digit){
    if (!state.current || !state.awaitingResponse || !["practice", "running"].includes(state.stage)) return;
    state.awaitingResponse = false;

    if (state.stage === "practice"){
      resolvePending({ digit, correct: String(digit) === String(state.current.digit) });
      return;
    }

    const rtMs = Math.max(0, performance.now() - state.lastStartMs);
    const correct = String(digit) === String(state.current.digit);
    state.responses.push({ i: state.index, digit, correct, rtMs });
    status.textContent = `Trial ${state.index+1}/${cfg.length} recorded.`;
  }

  function buildOptions(){
    opts.innerHTML = "";
    cfg.options.forEach((digit) => {
      const el = document.createElement("div");
      el.className = "option symbolOption";
      el.innerHTML = `<div class="symbolChoice"><span class="digitChoice">${escapeHtml(String(digit))}</span></div>`;
      el.addEventListener("click", () => {
        clearOptionSelection();
        el.classList.add("selected");
        recordResponse(digit);
      });
      opts.appendChild(el);
    });
  }

  async function runPractice(){
    state.cancelled = false;
    state.practicePassed = false;
    state.stage = "practice";
    btnPractice.disabled = true;
    btnStart.disabled = true;
    enableOptions(true);

    const practiceTrials = buildPracticeTrials();
    for (let index = 0; index < practiceTrials.length; index++){
      const trial = practiceTrials[index];
      let correct = false;

      while (!correct){
        if (state.cancelled) return;
        clearOptionSelection();
        state.current = trial;
        state.awaitingResponse = true;
        drawTarget(trial.symbol, false);
        status.textContent = `Practice ${index + 1}/${practiceTrials.length}: choose the digit that matches the shown symbol.`;

        const result = await waitForInput();
        if (!result || state.cancelled) return;
        correct = result.correct;
        status.textContent = correct
          ? `Practice ${index + 1}/${practiceTrials.length} correct.`
          : "Not quite. Check the key again and choose the matching digit.";
        await sleep(correct ? 220 : 520);
      }
    }

    state.practicePassed = true;
    practice?.onComplete?.();
    resetToIdleState("Practice complete. Start block when you are ready.");
  }

  async function run(){
    state.stage = "running";
    state.cancelled = false;
    state.index = 0;
    state.responses = [];

    btnPractice.disabled = true;
    btnStart.disabled = true;
    enableOptions(true);
    status.textContent = "Running… click the digit that matches the shown symbol.";

    for (state.index = 0; state.index < cfg.length; state.index++){
      if (state.cancelled) break;
      clearOptionSelection();

      const trial = cfg.sequence?.[state.index] || genTrial();
      state.current = trial;
      state.awaitingResponse = true;
      drawTarget(trial.symbol, false);
      state.lastStartMs = performance.now();

      await sleep(cfg.trialMs);
      state.awaitingResponse = false;
      drawTarget(trial.symbol, true);
      await sleep(120);
    }

    state.stage = "idle";
    enableOptions(false);
    btnPractice.disabled = false;
    btnStart.disabled = false;

    const summary = summarizeBlockPerformance(cfg.length, state.responses);
    status.textContent = `Done. Accuracy ${(summary.accuracy*100).toFixed(1)}% • answered ${summary.responded}/${summary.trials} • median RT ${(summary.medianRtMs/1000).toFixed(2)}s`;

    onDone?.(summary);
  }

  buildOptions();
  enableOptions(false);
  drawIdleState();

  btnPractice.addEventListener("click", runPractice);
  btnStart.addEventListener("click", run);

  function onKey(e){
    if (!state.awaitingResponse || !["practice", "running"].includes(state.stage)) return;
    const digit = String(e.key || "");
    if (!cfg.options.includes(digit)) return;
    const options = [...opts.querySelectorAll(".option")];
    const idx = cfg.options.indexOf(digit);
    clearOptionSelection();
    if (options[idx]) options[idx].classList.add("selected");
    recordResponse(digit);
  }
  window.addEventListener("keydown", onKey);

  resetToIdleState();

  return { cleanup(){ state.cancelled = true; resolvePending(null); window.removeEventListener("keydown", onKey); } };
}

/* ----------------- Canvas drawings ----------------- */

function drawFourPanels(ctx, canvas, panels){
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const pad = 18;
  const cellW = (w - pad*3) / 2;
  const cellH = (h - pad*3) / 2;

  const coords = [
    [pad, pad],
    [pad*2 + cellW, pad],
    [pad, pad*2 + cellH],
    [pad*2 + cellW, pad*2 + cellH]
  ];

  ctx.strokeStyle = "rgba(229,231,235,0.18)";
  ctx.lineWidth = 2;

  for (let i = 0; i < 4; i++){
    const [x,y] = coords[i];
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x,y,cellW,cellH);
    ctx.strokeRect(x,y,cellW,cellH);

    const sym = panels[i];
    if (sym){
      drawSymbolInCell(ctx, sym, x, y, cellW, cellH);
    }else{
      drawMissing(ctx, x, y, cellW, cellH);
    }
  }

  drawArrow(ctx, pad + cellW*0.88, pad + cellH/2, pad*2 + cellW + cellW*0.12, pad + cellH/2);
  drawArrow(ctx, pad + cellW*0.88, pad*2 + cellH + cellH/2, pad*2 + cellW + cellW*0.12, pad*2 + cellH + cellH/2);
}

function drawMatrix3x3(ctx, canvas, grid){
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const pad = 16;
  const cellW = (w - pad*4) / 3;
  const cellH = (h - pad*4) / 3;

  ctx.strokeStyle = "rgba(229,231,235,0.18)";
  ctx.lineWidth = 2;

  for (let r = 0; r < 3; r++){
    for (let c = 0; c < 3; c++){
      const x = pad + c*(cellW+pad);
      const y = pad + r*(cellH+pad);

      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(x,y,cellW,cellH);
      ctx.strokeRect(x,y,cellW,cellH);

      const sym = grid[r][c];
      if (sym){
        drawSymbolInCell(ctx, sym, x, y, cellW, cellH);
      }else{
        drawMissing(ctx, x, y, cellW, cellH);
      }
    }
  }
}

function drawSeries(ctx, canvas, panels){
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const pad = 14;
  const n = panels.length + 1; // include missing
  const cellW = (w - pad*(n+1)) / n;
  const cellH = h - pad*2;

  ctx.strokeStyle = "rgba(229,231,235,0.18)";
  ctx.lineWidth = 2;

  for (let i = 0; i < n; i++){
    const x = pad + i*(cellW+pad);
    const y = pad;

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x,y,cellW,cellH);
    ctx.strokeRect(x,y,cellW,cellH);

    if (i < panels.length){
      drawSymbolInCell(ctx, panels[i], x, y, cellW, cellH);
    }else{
      drawMissing(ctx, x, y, cellW, cellH);
    }

    if (i < n-1){
      drawArrow(ctx, x + cellW*0.92, y + cellH/2, x + cellW + pad*0.58, y + cellH/2);
    }
  }
}

function drawMissing(ctx, x, y, w, h){
  ctx.fillStyle = "rgba(96,165,250,0.25)";
  ctx.font = "52px system-ui, Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", x + w/2, y + h/2);
}

function drawPanelShell(ctx, x, y, w, h, label){
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, "rgba(255,255,255,0.10)");
  gradient.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(169,182,214,0.92)";
  ctx.font = "600 13px 'Segoe UI Variable', 'Aptos', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label, x + 14, y + 22);
}

function drawSymbolPairPanel(ctx, pair, x, y, w, h, alpha=1){
  const leftX = x + w * 0.28;
  const rightX = x + w * 0.72;
  const cy = y + h / 2;
  drawSymbolCanvas(ctx, pair?.[0] || "sigil_orbit", leftX, cy, Math.min(w, h) * 0.18, { alpha });
  drawSymbolCanvas(ctx, pair?.[1] || "sigil_beacon", rightX, cy, Math.min(w, h) * 0.18, { alpha });
}

function roundRectPath(ctx, x, y, w, h, r){
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shuffleCopy(arr){
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawSymbolInCell(ctx, sym, x, y, w, h){
  const c = document.createElement("canvas");
  c.width = 200; c.height = 200;
  renderSymbolGrid(c, [sym], 1);
  const size = Math.min(w,h) * 0.82;
  ctx.drawImage(c, x + w/2 - size/2, y + h/2 - size/2, size, size);
}

function drawArrow(ctx, x1,y1,x2,y2){
  const head = 10;
  const ang = Math.atan2(y2-y1,x2-x1);

  ctx.save();
  ctx.strokeStyle = "rgba(96,165,250,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();

  ctx.fillStyle = "rgba(96,165,250,0.55)";
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2 - head*Math.cos(ang - Math.PI/6), y2 - head*Math.sin(ang - Math.PI/6));
  ctx.lineTo(x2 - head*Math.cos(ang + Math.PI/6), y2 - head*Math.sin(ang + Math.PI/6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ----------------- Utils ----------------- */

function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }

function median(arr){
  if (!arr.length) return 0;
  const a = [...arr].sort((x,y)=>x-y);
  const mid = Math.floor(a.length/2);
  return a.length % 2 ? a[mid] : (a[mid-1]+a[mid]) / 2;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
