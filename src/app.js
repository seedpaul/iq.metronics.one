import { buildPlan } from "./plan.js";
import { runAssessment } from "./core/index.js";
import { buildItemBank } from "./core/data/buildItemBank.js";
import { renderItem } from "./core/render/itemRenderer.js";
import { initIntegrityMonitors } from "./core/research/integrity.js";
import {
  getBaselineNormPack,
  loadSavedNormPack,
  saveNormPack,
  clearSavedNormPack,
  describePack,
  validateNormPack
} from "./core/norms.js";

const els = {
  intro: document.getElementById("screen-intro"),
  test: document.getElementById("screen-test"),
  lab: document.getElementById("screen-lab"),
  results: document.getElementById("screen-results"),
  agree: document.getElementById("agree"),
  seedInput: document.getElementById("seedInput"),
  btnStart: document.getElementById("btnStart"),
  btnQuick: document.getElementById("btnQuick"),
  btnSmoke: document.getElementById("btnSmoke"),
  smokeStatus: document.getElementById("smokeStatus"),
  labPassword: document.getElementById("labPassword"),
  btnLabUnlock: document.getElementById("btnLabUnlock"),
  btnLabOpen: document.getElementById("btnLabOpen"),
  labGateStatus: document.getElementById("labGateStatus"),
  btnReset: document.getElementById("btnReset"),
  normFile: document.getElementById("normFile"),
  btnLoadNorm: document.getElementById("btnLoadNorm"),
  btnClearNorm: document.getElementById("btnClearNorm"),
  normStatus: document.getElementById("normStatus"),
  testPill: document.getElementById("testPill"),
  metaLine: document.getElementById("metaLine"),
  qualityFlags: document.getElementById("qualityFlags"),
  timerValue: document.getElementById("timerValue"),
  qTitle: document.getElementById("qTitle"),
  qPrompt: document.getElementById("qPrompt"),
  stimulus: document.getElementById("stimulus"),
  answerArea: document.getElementById("answerArea"),
  helpText: document.getElementById("helpText"),
  btnBack: document.getElementById("btnBack"),
  btnNext: document.getElementById("btnNext"),
  btnPause: document.getElementById("btnPause"),
  labMeta: document.getElementById("labMeta"),
  labSection: document.getElementById("labSection"),
  labCount: document.getElementById("labCount"),
  labSeed: document.getElementById("labSeed"),
  btnLabLoad: document.getElementById("btnLabLoad"),
  btnLabClose: document.getElementById("btnLabClose"),
  labStatus: document.getElementById("labStatus"),
  labSummary: document.getElementById("labSummary"),
  labItemMeta: document.getElementById("labItemMeta"),
  labTitle: document.getElementById("labTitle"),
  labPrompt: document.getElementById("labPrompt"),
  labStimulus: document.getElementById("labStimulus"),
  labAnswerArea: document.getElementById("labAnswerArea"),
  btnLabPrev: document.getElementById("btnLabPrev"),
  btnLabSubmit: document.getElementById("btnLabSubmit"),
  btnLabNext: document.getElementById("btnLabNext"),
  labHelpText: document.getElementById("labHelpText"),
  labFeedback: document.getElementById("labFeedback"),
  resultsSummary: document.getElementById("resultsSummary"),
  historyArea: document.getElementById("historyArea"),
  btnDownloadJson: document.getElementById("btnDownloadJson"),
  btnDownloadCsv: document.getElementById("btnDownloadCsv"),
  btnDownloadLongCsv: document.getElementById("btnDownloadLongCsv"),
  btnDownloadJsonl: document.getElementById("btnDownloadJsonl"),
  researchMode: document.getElementById("researchMode"),
  btnRestart: document.getElementById("btnRestart")
};

const STORAGE_KEY = "iq_metronics_history_v1";
const CUSTOM_NORM_KEY = "iq_metronics_norm_pack_v1";
const RESEARCH_KEY = "iq_metronics_research_mode";
const LAB_ACCESS_KEY = "iq_metronics_lab_unlocked";
const LAB_ACCESS_CODE = "metronics-lab";

const state = {
  runSeed: null,
  running: false,
  currentResolver: null,
  currentItem: null,
  timerHandle: null,
  nodeEndsAt: null,
  history: loadHistory(),
  normPack: null,
  researchMode: false,
  lastExports: null,
  integrityMonitor: null,
  runAborted: false,
  currentCleanup: null,
  labUnlocked: false,
  labSession: null,
  labCleanup: null
};

function loadHistory(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch{
    return [];
  }
}

function loadNormPack(){
  const saved = loadSavedNormPack(CUSTOM_NORM_KEY);
  state.normPack = saved || getBaselineNormPack();
  updateNormStatus(saved ? "Custom norm pack loaded." : "Using baseline norms.");
}

function updateNormStatus(extra = ""){
  if (!els.normStatus) return;
  const meta = describePack(state.normPack || getBaselineNormPack());
  const fairness = meta.fairness ? ` | DIF flags: ${meta.fairness.flagged}` : "";
  const note = extra ? ` – ${extra}` : "";
  els.normStatus.textContent = `${meta.name} (v${meta.version})${fairness}${note}`;
}

function loadResearchMode(){
  try{
    const raw = localStorage.getItem(RESEARCH_KEY);
    state.researchMode = raw === "1";
  }catch{
    state.researchMode = false;
  }
  if (els.researchMode){
    els.researchMode.checked = state.researchMode;
  }
  applyResearchVisibility();
}

function setResearchMode(on){
  state.researchMode = !!on;
  try{ localStorage.setItem(RESEARCH_KEY, on ? "1" : "0"); }catch{}
  applyResearchVisibility();
}

function applyResearchVisibility(){
  const show = !!state.researchMode;
  document.querySelectorAll(".research-only").forEach(el => {
    el.classList.toggle("hidden", !show);
  });
  if (els.researchMode){
    els.researchMode.checked = show;
  }
}

function saveHistory(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history.slice(0, 10))); }catch{}
}

function formatTime(sec){
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
}

function showScreen(which){
  els.intro.classList.toggle("hidden", which !== "intro");
  els.test.classList.toggle("hidden", which !== "test");
  els.lab?.classList.toggle("hidden", which !== "lab");
  els.results.classList.toggle("hidden", which !== "results");
}

function loadLabAccess(){
  try{
    state.labUnlocked = sessionStorage.getItem(LAB_ACCESS_KEY) === "1";
  }catch{
    state.labUnlocked = false;
  }
  updateLabGateStatus(state.labUnlocked
    ? "Unlocked. Open the test lab to browse sections."
    : "Locked. Use the local access code to enable the section browser.");
}

function updateLabGateStatus(message){
  if (els.btnLabOpen) els.btnLabOpen.disabled = !state.labUnlocked;
  if (els.labGateStatus) els.labGateStatus.textContent = message;
}

function unlockLab(){
  const entered = els.labPassword?.value?.trim() || "";
  if (entered !== LAB_ACCESS_CODE){
    updateLabGateStatus("Incorrect access code. This is only a local gate for the QA tools.");
    return;
  }
  state.labUnlocked = true;
  try{ sessionStorage.setItem(LAB_ACCESS_KEY, "1"); }catch{}
  if (els.labPassword) els.labPassword.value = "";
  updateLabGateStatus("Unlocked. Open the test lab to browse sections.");
}

function deriveSeed(input){
  if (typeof input === "number" && Number.isFinite(input)) return input >>> 0;
  if (typeof input === "string"){
    const t = input.trim();
    if (t){
      let h = 2166136261 >>> 0;
      for (let i = 0; i < t.length; i++){
        h ^= t.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
  }
  const arr = new Uint32Array(1);
  crypto?.getRandomValues?.(arr);
  return arr[0] >>> 0;
}

function resetTimer(){
  if (state.timerHandle){
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
  state.nodeEndsAt = null;
  els.timerValue.textContent = "--:--";
}

function syncStartButtons(){
  const canStart = !!els.agree?.checked && !state.running;
  if (els.btnStart) els.btnStart.disabled = !canStart;
  if (els.btnQuick) els.btnQuick.disabled = !canStart;
  if (els.btnSmoke) els.btnSmoke.disabled = !canStart;
  if (els.btnSmoke) els.btnSmoke.title = canStart ? "Run the fast QA pass." : "Check the non-clinical consent box above to enable this.";
  if (els.smokeStatus) els.smokeStatus.textContent = canStart
    ? "Runs a minimal pass through every section for fast QA."
    : "Enable the consent checkbox above to unlock this testing pass.";
}

function finishCurrentPrompt(payload){
  const resolve = state.currentResolver;
  if (!resolve) return;
  const cleanup = state.currentCleanup;
  state.currentResolver = null;
  state.currentCleanup = null;
  cleanup?.();
  resolve(payload);
}

function abortRun(){
  if (!state.running) return;
  state.runAborted = true;
  finishCurrentPrompt({ aborted: true, x: null, rtMs: null, meta: {} });
}

function getIntegrityBadges(integrity){
  if (!integrity) return [];
  const badges = [];
  const focusEvents = (Number(integrity.focusLosses) || 0) + (Number(integrity.visibilityChanges) || 0);
  const rapidGuesses = Number(integrity.rapidGuessingCount) || 0;
  const pasteAttempts = Number(integrity.pasteAttempts) || 0;
  const copyAttempts = Number(integrity.copyAttempts) || 0;
  const contextMenu = Number(integrity.contextMenu) || 0;
  const attentionFailed = Number(integrity.attentionChecks?.failed) || 0;

  if (focusEvents > 0) badges.push({ tone: "bad", label: `Focus changes ${focusEvents}` });
  if (rapidGuesses > 0) badges.push({ tone: rapidGuesses >= 3 ? "bad" : "warn", label: `Rapid answers ${rapidGuesses}` });
  if (pasteAttempts > 0) badges.push({ tone: "bad", label: `Paste ${pasteAttempts}` });
  if (copyAttempts > 0) badges.push({ tone: "warn", label: `Copy ${copyAttempts}` });
  if (contextMenu > 0) badges.push({ tone: "warn", label: `Context menu ${contextMenu}` });
  if (attentionFailed > 0) badges.push({ tone: "bad", label: `Attention misses ${attentionFailed}` });

  return badges;
}

function renderQualityFlags(integrity){
  if (!els.qualityFlags) return;
  const badges = getIntegrityBadges(integrity);
  els.qualityFlags.innerHTML = badges.map(({ tone, label }) => `
    <span class="flag ${tone}">${label}</span>
  `).join("");
}

function formatIntegritySummary(integrity){
  const info = integrity && typeof integrity === "object" ? integrity : {};
  const focusChanges = (Number(info.focusLosses) || 0) + (Number(info.visibilityChanges) || 0);
  const attention = info.attentionChecks || { total: 0, passed: 0, failed: 0 };
  const parts = [
    `Attention ${attention.passed || 0}/${attention.total || 0} passed`,
    `Rapid answers ${Number(info.rapidGuessingCount) || 0}`,
    `Focus changes ${focusChanges}`,
    `Paste ${Number(info.pasteAttempts) || 0}`,
    `Copy ${Number(info.copyAttempts) || 0}`,
    `Context menu ${Number(info.contextMenu) || 0}`
  ];
  return `
    <div class="divider"></div>
    <div class="resultRow">
      <div class="k">Quality</div>
      <div class="v">${parts[0]}</div>
      <div class="muted small">${parts.slice(1).join(" · ")}</div>
    </div>
  `;
}

function startTimer(seconds){
  resetTimer();
  if (!seconds) return;
  const end = Date.now() + seconds * 1000;
  state.nodeEndsAt = end;
  els.timerValue.textContent = formatTime(seconds);
  state.timerHandle = setInterval(() => {
    const left = Math.max(0, (state.nodeEndsAt - Date.now()) / 1000);
    els.timerValue.textContent = formatTime(left);
    if (left <= 0){
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
  }, 250);
}

function renderHistory(){
  if (!els.historyArea) return;
  if (!state.history.length){
    els.historyArea.innerHTML = "<div class=\"muted\">No prior runs in this browser.</div>";
    return;
  }
  els.historyArea.innerHTML = state.history.map(h => `
    <div class="historyRow">
      <div><strong>${h.mode}</strong> · ${new Date(h.at).toLocaleString()}</div>
      <div class="muted small">FSIQ ${h.fsiq} (95% CI ${h.ci.lo}–${h.ci.hi}) · Percentile ${h.pct}</div>
    </div>
  `).join("");
}

function downloadText(filename, text, mime="text/plain"){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function renderPrompt(item){
  els.qTitle.textContent = item.title || item.domain || "Item";
  if (item.type === "digitspan"){
    const dir = item.direction === "backward" ? "Backward" : "Forward";
    els.qPrompt.textContent = `${dir} digit span. Remember the digits, then type them.`;
  }else{
    els.qPrompt.textContent = item.prompt || "Respond to continue.";
  }
}

function renderStimulus(item){
  els.stimulus.innerHTML = "";
  els.stimulus.classList.add("hidden");
  if (item.stemSvg){
    const tpl = document.createElement("div");
    tpl.innerHTML = item.stemSvg;
    const svg = tpl.firstElementChild;
    if (svg){
      els.stimulus.appendChild(svg);
      els.stimulus.classList.remove("hidden");
    }
    return;
  }
  if (item.type === "digitspan"){
    const box = document.createElement("div");
    box.className = "callout";
    box.style.fontSize = "26px";
    box.style.letterSpacing = "4px";
    box.textContent = item.digits || "";
    els.stimulus.appendChild(box);
    els.stimulus.classList.remove("hidden");
    return;
  }
  els.stimulus.textContent = "";
}

function prepareDigitSpanRecall(item, input, onReady){
  const box = els.stimulus.firstElementChild;
  const delayMs = Math.max(600, Number(item.showMs) || 1200);
  const recallPrompt = item.direction === "backward"
    ? "Digits hidden. Type them in reverse order."
    : "Digits hidden. Type them in order.";

  const timeoutId = setTimeout(() => {
    if (box){
      box.textContent = recallPrompt;
      box.style.fontSize = "16px";
      box.style.letterSpacing = "normal";
    }
    if (input){
      input.disabled = false;
      input.placeholder = item.direction === "backward" ? "Type the digits in reverse" : "Type the digits";
      input.focus();
    }
    els.helpText.textContent = recallPrompt;
    onReady?.();
  }, delayMs);

  return () => clearTimeout(timeoutId);
}

function renderOptions(item, onSelect){
  els.answerArea.innerHTML = "";
  const opts = document.createElement("div");
  opts.className = "options";
  const choices = item.choices || item.options || [];

  choices.forEach((opt, idx) => {
    const btn = document.createElement("div");
    btn.className = "option";
    btn.dataset.index = String(idx);
    btn.tabIndex = 0;
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", `Option ${idx + 1}`);
    if (typeof opt === "object" && opt.svg){
      btn.innerHTML = opt.svg;
    }else{
      btn.textContent = String(opt);
    }
    const select = () => {
      [...opts.children].forEach(c => c.classList.remove("selected"));
      btn.classList.add("selected");
      onSelect(idx);
    };
    btn.addEventListener("click", select);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " "){
        e.preventDefault();
        select();
      }
    });
    opts.appendChild(btn);
  });
  els.answerArea.appendChild(opts);
}

function renderInputField(placeholder, onInput){
  els.answerArea.innerHTML = "";
  const input = document.createElement("input");
  input.className = "textInput";
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.addEventListener("input", () => onInput(input.value));
  els.answerArea.appendChild(input);
  input.focus();
  return input;
}

function clearLabRender(){
  state.labCleanup?.();
  state.labCleanup = null;
}

function renderLabPrompt(item){
  els.labTitle.textContent = item.title || item.domain || "Lab item";
  if (item.type === "digitspan"){
    const dir = item.direction === "backward" ? "Backward" : "Forward";
    els.labPrompt.textContent = `${dir} digit span. Remember the digits, then type them.`;
  }else{
    els.labPrompt.textContent = item.prompt || "Respond to continue.";
  }
}

function renderLabStimulus(item){
  els.labStimulus.innerHTML = "";
  els.labStimulus.classList.add("hidden");
  if (item.stemSvg){
    const tpl = document.createElement("div");
    tpl.innerHTML = item.stemSvg;
    const first = tpl.firstElementChild;
    if (first){
      els.labStimulus.appendChild(first);
      els.labStimulus.classList.remove("hidden");
    }
    return;
  }
  if (item.type === "digitspan"){
    const box = document.createElement("div");
    box.className = "callout";
    box.style.fontSize = "26px";
    box.style.letterSpacing = "4px";
    box.textContent = item.digits || "";
    els.labStimulus.appendChild(box);
    els.labStimulus.classList.remove("hidden");
  }
}

function prepareLabDigitSpanRecall(item, input, onReady){
  const box = els.labStimulus.firstElementChild;
  const delayMs = Math.max(600, Number(item.showMs) || 1200);
  const prompt = item.direction === "backward"
    ? "Digits hidden. Type them in reverse order."
    : "Digits hidden. Type them in order.";

  const timeoutId = setTimeout(() => {
    if (box){
      box.textContent = prompt;
      box.style.fontSize = "16px";
      box.style.letterSpacing = "normal";
    }
    input.disabled = false;
    input.placeholder = item.direction === "backward" ? "Type the digits in reverse" : "Type the digits";
    input.focus();
    els.labHelpText.textContent = prompt;
    onReady?.();
  }, delayMs);

  return () => clearTimeout(timeoutId);
}

function renderLabOptions(item, onSelect){
  els.labAnswerArea.innerHTML = "";
  const opts = document.createElement("div");
  opts.className = "options";
  const choices = item.choices || item.options || [];

  choices.forEach((opt, idx) => {
    const btn = document.createElement("div");
    btn.className = "option";
    btn.tabIndex = 0;
    if (typeof opt === "object" && opt.svg) btn.innerHTML = opt.svg;
    else btn.textContent = String(opt);

    const select = () => {
      [...opts.children].forEach((child) => child.classList.remove("selected"));
      btn.classList.add("selected");
      onSelect(idx);
    };

    btn.addEventListener("click", select);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " "){
        e.preventDefault();
        select();
      }
    });
    opts.appendChild(btn);
  });

  els.labAnswerArea.appendChild(opts);
}

function renderLabInput(placeholder, onInput){
  els.labAnswerArea.innerHTML = "";
  const input = document.createElement("input");
  input.className = "textInput";
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.addEventListener("input", () => onInput(input.value));
  els.labAnswerArea.appendChild(input);
  input.focus();
  return input;
}

function makeLocalRng(seed){
  let value = (seed >>> 0) || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function hashTextSeed(text){
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++){
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sampleLabItems(pool, count, seed, sectionId){
  const items = Array.isArray(pool) ? [...pool] : [];
  const rng = makeLocalRng((seed ^ hashTextSeed(sectionId)) >>> 0);
  for (let i = items.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, Math.min(count, items.length));
}

function getExpectedAnswerLabel(item){
  if (!item) return "";
  if (item.type === "speed_symbol") return String(item.answer || "").toUpperCase();
  if (item.type === "speed_coding") return item.answer || "";
  if (item.type === "digitspan") return item.direction === "backward"
    ? [...(item.digits || "")].reverse().join("")
    : (item.digits || "");

  const options = item.options || [];
  const answer = item.answer ?? item.key;
  const optionIndex = options.findIndex((opt) => String(opt?.key ?? opt) === String(answer));
  if (optionIndex >= 0) return `Option ${String.fromCharCode(65 + optionIndex)}`;
  return String(answer ?? "");
}

function renderLabItemMeta(item){
  if (!els.labItemMeta) return;
  if (!item){
    els.labItemMeta.innerHTML = "";
    return;
  }

  const details = [
    ["Item", item.id || "--"],
    ["Family", item.family || item.raw?.meta?.kind || "--"],
    ["Blueprint", item.blueprint || item.raw?.meta?.kind || "--"],
    ["Difficulty", Number.isFinite(item.b) ? item.b.toFixed(2) : "--"],
    ["Discrimination", Number.isFinite(item.a) ? item.a.toFixed(2) : "--"]
  ];

  els.labItemMeta.innerHTML = details.map(([label, value]) => `
    <div class="labMetaChip"><strong>${label}</strong><span>${value}</span></div>
  `).join("");
}

function formatLabFeedback(result, item){
  if (!result) return "";
  const tone = result.x === 1 ? "feedbackGood" : (result.x === 0 ? "feedbackBad" : "feedbackNeutral");
  const label = result.x === 1 ? "Correct" : (result.x === 0 ? "Incorrect" : "Recorded");
  const expected = result.meta?.expected || getExpectedAnswerLabel(item);
  const detail = expected ? ` Correct answer: ${expected}.` : "";
  return `<div class="${tone}"><strong>${label}.</strong>${detail}</div>`;
}

function updateLabStatus(){
  const session = state.labSession;
  if (!session){
    els.labMeta.textContent = "Load a section to review items manually.";
    els.labStatus.textContent = "No section loaded.";
    if (els.labSummary) els.labSummary.innerHTML = "";
    renderLabItemMeta(null);
    return;
  }
  const responses = Object.values(session.responses);
  const scored = responses.filter((entry) => entry && Number.isFinite(entry.x));
  const correct = scored.filter((entry) => entry.x === 1).length;
  const avgRtMs = scored.length
    ? Math.round(scored.reduce((sum, entry) => sum + (Number(entry.rtMs) || 0), 0) / scored.length)
    : null;
  els.labMeta.textContent = `${session.node.title} · seed ${session.seed}`;
  els.labStatus.textContent = `Section ${session.node.title} · item ${session.index + 1} of ${session.items.length} · responses ${responses.length}`;
  if (els.labSummary){
    els.labSummary.innerHTML = [
      { label: "Loaded", value: `${session.items.length} items` },
      { label: "Answered", value: `${responses.length}/${session.items.length}` },
      { label: "Accuracy", value: scored.length ? `${Math.round((correct / scored.length) * 100)}%` : "--" },
      { label: "Avg RT", value: avgRtMs != null ? `${(avgRtMs / 1000).toFixed(2)}s` : "--" }
    ].map((entry) => `
      <div class="labStatCard">
        <div class="labStatLabel">${entry.label}</div>
        <div class="labStatValue">${entry.value}</div>
      </div>
    `).join("");
  }
}

function buildLabSession(){
  if (!state.labUnlocked){
    updateLabGateStatus("Unlock the QA lab before opening it.");
    return;
  }

  const sectionId = els.labSection?.value || "fluid";
  const requestedCount = Math.max(1, Math.min(8, Number.parseInt(els.labCount?.value || "3", 10) || 3));
  const seed = deriveSeed((els.labSeed?.value || els.seedInput?.value || "").trim());
  const plan = buildPlan("full", { seed });
  const node = plan.nodes.find((entry) => entry.subtestId === sectionId || entry.id === sectionId);

  if (!node){
    els.labStatus.textContent = "Selected section could not be loaded.";
    return;
  }

  const sourcePool = node.items || node.bank || plan.banks?.[sectionId] || [];
  const sourceItems = sampleLabItems(sourcePool, requestedCount, seed, sectionId);
  const items = buildItemBank({ banks: { [sectionId]: sourceItems } }).items;
  if (!items.length){
    state.labSession = null;
    els.labStatus.textContent = "Selected section has no items available for the lab.";
    if (els.labSummary) els.labSummary.innerHTML = "";
    return;
  }
  state.labSession = {
    node,
    sectionId,
    seed,
    items,
    index: 0,
    responses: {}
  };

  showScreen("lab");
  renderLabItem();
}

function moveLabIndex(delta){
  if (!state.labSession) return;
  const nextIndex = state.labSession.index + delta;
  if (nextIndex < 0 || nextIndex >= state.labSession.items.length) return;
  state.labSession.index = nextIndex;
  renderLabItem();
}

function renderLabItem(){
  clearLabRender();
  const session = state.labSession;
  if (!session || !session.items.length){
    updateLabStatus();
    return;
  }

  const item = session.items[session.index];
  const raw = item.raw || item;
  const stemType = item?.stem?.type || "";
  const isBlockStem = ["n_back_block", "symbol_search_block", "coding_block"].includes(stemType);
  const hasRendererOptions = Array.isArray(item?.options) && item.options.length > 0;
  const useRenderer = stemType && (isBlockStem || hasRendererOptions);

  renderLabPrompt(raw);
  if (useRenderer && stemType !== "text_prompt"){
    els.labStimulus.innerHTML = "";
    els.labStimulus.classList.add("hidden");
  }else{
    renderLabStimulus(raw);
  }

  els.labHelpText.textContent = session.node.instructions || "Answer the current item.";
  els.labFeedback.innerHTML = formatLabFeedback(session.responses[session.index], raw);
  renderLabItemMeta(item);
  els.btnLabPrev.disabled = session.index === 0;
  els.btnLabNext.disabled = session.index >= session.items.length - 1;
  els.btnLabSubmit.disabled = true;
  updateLabStatus();

  let responseStartedAt = performance.now();
  let renderer = null;
  let fallbackResponse = null;

  if (useRenderer){
    els.labAnswerArea.innerHTML = "";
    renderer = renderItem({
      mount: els.labAnswerArea,
      item,
      onSelectionChanged: (ready) => { els.btnLabSubmit.disabled = !ready; }
    });
    state.labCleanup = () => renderer.cleanup?.();
  }else{
    const enableSubmit = () => { els.btnLabSubmit.disabled = false; };
    if (raw?.type === "speed_symbol"){
      els.labAnswerArea.innerHTML = "";
      const yes = document.createElement("button");
      const no = document.createElement("button");
      yes.className = "btn";
      no.className = "btn";
      yes.textContent = "Yes";
      no.textContent = "No";
      yes.addEventListener("click", () => { fallbackResponse = { choice: "YES" }; enableSubmit(); });
      no.addEventListener("click", () => { fallbackResponse = { choice: "NO" }; enableSubmit(); });
      els.labAnswerArea.appendChild(yes);
      els.labAnswerArea.appendChild(no);
    }else if (raw?.type === "speed_coding" || raw?.type === "digitspan"){
      const input = renderLabInput(raw.type === "speed_coding" ? "Enter the digits" : "Memorize the digits first", (val) => {
        fallbackResponse = { value: val };
        els.btnLabSubmit.disabled = !(val && val.trim().length);
      });
      if (raw.type === "digitspan"){
        input.disabled = true;
        els.labHelpText.textContent = "Memorize the digits before typing.";
        state.labCleanup = prepareLabDigitSpanRecall(raw, input, () => {
          responseStartedAt = performance.now();
        });
      }
    }else{
      renderLabOptions(raw, (idx) => {
        const opt = ((raw?.choices || raw?.options || item.choices || item.options || []))[idx];
        fallbackResponse = { choice: idx, choiceVal: opt?.key ?? opt };
        enableSubmit();
      });
    }
  }

  els.btnLabSubmit.onclick = () => {
    const rtMs = Math.max(0, performance.now() - responseStartedAt);
    let result;
    if (renderer){
      const r = renderer.getResponse();
      if (!r) return;
      result = { x: r.x ?? null, rtMs: r.rtMs ?? rtMs, meta: r.meta ?? {} };
    }else{
      const scored = scoreItem(raw, fallbackResponse);
      result = { x: scored.x, rtMs, meta: scored.meta };
    }
    session.responses[session.index] = result;
    els.labFeedback.innerHTML = formatLabFeedback(result, raw);
    els.btnLabSubmit.disabled = true;
    updateLabStatus();
  };
}

function scoreItem(item, response){
  if (response == null) return { x: null, meta: {} };
  if (item.type === "speed_symbol"){
    const ans = (item.answer || "").toUpperCase();
    const x = String(response.choice || "").toUpperCase() === ans ? 1 : 0;
    return { x, meta: { choice: response.choice } };
  }
  if (item.type === "speed_coding"){
    const user = (response.value || "").trim();
    const x = user && item.answer ? (user === item.answer ? 1 : 0) : null;
    return { x, meta: { value: user } };
  }
  if (item.type === "digitspan"){
    const user = (response.value || "").trim();
    const expected = item.direction === "backward"
      ? [...item.digits].reverse().join("")
      : item.digits;
    const x = user ? (user === expected ? 1 : 0) : null;
    return { x, meta: { value: user, expected } };
  }
  // MC / SVG
  const correctKey = item.answer ?? item.key ?? null;
  const x = (response.choice != null && correctKey != null)
    ? (String(response.choiceVal ?? response.choice) === String(correctKey) ? 1 : 0)
    : null;
  return { x, meta: { choice: response.choiceVal ?? response.choice } };
}

function presentItemUI(ctx){
  const { node, item, raw } = ctx;
  return new Promise((resolve) => {
    state.currentResolver = resolve;
    state.currentItem = item;
    state.currentCleanup = null;

    els.testPill.textContent = node.title || node.id || "Test";
    els.metaLine.textContent = node.subtitle || node.mode || "";
    const stemType = item?.stem?.type || "";
    const isBlockStem = ["n_back_block","symbol_search_block","coding_block"].includes(stemType);
    const hasRendererOptions = Array.isArray(item?.options) && item.options.length > 0;
    const useRenderer = stemType && (isBlockStem || hasRendererOptions);

    renderPrompt(raw || item);
    if (useRenderer && stemType !== "text_prompt"){
      els.stimulus.innerHTML = "";
      els.stimulus.classList.add("hidden");
    }else{
      renderStimulus(raw || item);
    }
    els.helpText.textContent = node.instructions || "Respond to continue.";
    els.btnNext.disabled = true;
    els.btnBack.disabled = true;
    els.btnPause.disabled = false;
    els.btnPause.style.display = "inline-flex";

    const t0 = performance.now();
    let responseStartedAt = t0;
    let renderer = null;
    let fallbackResponse = null;

    if (useRenderer){
      els.answerArea.innerHTML = "";
      renderer = renderItem({
        mount: els.answerArea,
        item,
        onSelectionChanged: (ready) => { els.btnNext.disabled = !ready; }
      });
      state.currentCleanup = () => renderer.cleanup?.();
    }else{
      const enableNext = () => { els.btnNext.disabled = false; };
      if (raw?.type === "speed_symbol"){
        els.answerArea.innerHTML = "";
        const yes = document.createElement("button");
        const no = document.createElement("button");
        yes.className = "btn";
        no.className = "btn";
        yes.textContent = "Yes";
        no.textContent = "No";
        yes.addEventListener("click", () => { fallbackResponse = { choice: "YES" }; enableNext(); });
        no.addEventListener("click", () => { fallbackResponse = { choice: "NO" }; enableNext(); });
        els.answerArea.appendChild(yes);
        els.answerArea.appendChild(no);
      }else if (raw?.type === "speed_coding" || raw?.type === "digitspan"){
        const placeholder = raw.type === "speed_coding" ? "Enter the digits" : "Memorize the digits first";
        const input = renderInputField(placeholder, (val) => {
          fallbackResponse = { value: val };
          els.btnNext.disabled = !(val && val.trim().length);
          if (val && val.trim().length) enableNext();
        });
        if (raw.type === "digitspan"){
          input.disabled = true;
          els.helpText.textContent = "Memorize the digits before typing.";
          const existingCleanup = state.currentCleanup;
          const digitCleanup = prepareDigitSpanRecall(raw, input, () => {
            responseStartedAt = performance.now();
          });
          state.currentCleanup = () => {
            digitCleanup?.();
            existingCleanup?.();
          };
        }
      }else{
        renderOptions(raw || item, (idx) => {
          const opt = ((raw?.choices || raw?.options || item.choices || item.options || []))[idx];
          fallbackResponse = { choice: idx, choiceVal: opt?.key ?? opt };
          enableNext();
        });
      }
    }

    els.btnNext.onclick = () => {
      const rtMs = Math.max(0, performance.now() - responseStartedAt);
      if (renderer){
        const r = renderer.getResponse();
        finishCurrentPrompt({ x: r?.x ?? null, rtMs: r?.rtMs ?? rtMs, meta: r?.meta ?? {} });
        return;
      }
      const scored = scoreItem(raw || item, fallbackResponse);
      finishCurrentPrompt({ x: scored.x, rtMs, meta: scored.meta });
    };
  });
}

async function startRun(mode){
  if (state.running || !els.agree?.checked) return;
  state.running = true;
  state.runAborted = false;
  state.lastExports = null;
  syncStartButtons();

  const integrityMonitor = initIntegrityMonitors({});
  state.integrityMonitor = integrityMonitor;
  renderQualityFlags(integrityMonitor.integrity);

  state.runSeed = deriveSeed(els.seedInput.value || "");
  const plan = buildPlan(mode, { seed: state.runSeed });

  showScreen("test");
  startTimer(plan.nodes[0]?.timeSeconds || null);

  try{
    const result = await runAssessment(
      {
        plan,
        banks: plan.banks,
        ageYears: null,
        normPack: state.normPack,
        researchMode: state.researchMode,
        integrity: integrityMonitor.integrity,
        shouldStop: () => state.runAborted
      },
      { 
        presentItem: presentItemUI,
        onEvent: (type, payload) => {
          if (type === "NODE_START" && payload?.nodeId){
            const node = plan.nodes.find(n => n.id === payload.nodeId);
            if (node?.timeSeconds) startTimer(node.timeSeconds);
            return;
          }
          if (type === "ITEM"){
            if (Number.isFinite(payload?.rtMs)){
              integrityMonitor.addRapidGuess(payload.rtMs);
            }
            renderQualityFlags(integrityMonitor.integrity);
          }
        }
      }
    );
    state.lastExports = result.exports;
    renderResults(result.report);
    pushHistory(mode, result.report);
    showScreen("results");
  }catch(err){
    if (err?.code !== "RUN_ABORTED"){
      console.error(err);
      alert("Error during assessment: " + err.message);
    }
    showScreen("intro");
  }finally{
    state.currentResolver = null;
    state.currentCleanup = null;
    state.currentItem = null;
    state.integrityMonitor?.stop();
    state.integrityMonitor = null;
    state.running = false;
    state.runAborted = false;
    syncStartButtons();
    renderQualityFlags(null);
    resetTimer();
  }
}

function renderResults(report){
  if (!report?.results){
    els.resultsSummary.innerHTML = "<div class=\"muted\">No report generated.</div>";
    return;
  }
  const r = report.results;
  const admin = report.administration || { overview: {}, domains: {} };
  const overview = admin.overview || {};
  const overviewCards = [
    { label: "Domains", value: overview.domainsCompleted ?? "--" },
    { label: "Items", value: overview.itemsAdministered ?? "--" },
    { label: "Accuracy", value: Number.isFinite(overview.accuracy) ? `${Math.round(overview.accuracy * 100)}%` : "--" },
    { label: "Avg RT", value: Number.isFinite(overview.avgRtMs) ? `${(overview.avgRtMs / 1000).toFixed(2)}s` : "--" }
  ].map(({ label, value }) => `
    <div class="resultStatCard">
      <div class="resultStatLabel">${label}</div>
      <div class="resultStatValue">${value}</div>
    </div>
  `).join("");
  const rows = Object.entries(r.domainIndices || {}).map(([d, idx]) => {
    const pct = r.domainPercentiles?.[d];
    const ci = r.domainCI95?.[d];
    const domainAdmin = admin.domains?.[d] || {};
    const items = domainAdmin.itemsAdministered ?? "--";
    const accuracy = Number.isFinite(domainAdmin.accuracy) ? `${Math.round(domainAdmin.accuracy * 100)}%` : "--";
    const avgRt = Number.isFinite(domainAdmin.avgRtMs) ? `${(domainAdmin.avgRtMs / 1000).toFixed(2)}s` : "--";
    return `
      <div class="resultRow">
        <div class="k">${d}</div>
        <div class="v">Index ${idx?.toFixed?.(1) ?? "--"} · ${pct?.toFixed?.(1) ?? "--"}%</div>
        <div class="muted small">CI ${ci?.lo?.toFixed?.(1) ?? "--"}–${ci?.hi?.toFixed?.(1) ?? "--"} · items ${items} · acc ${accuracy} · avg RT ${avgRt}</div>
      </div>
    `;
  }).join("");

  els.resultsSummary.innerHTML = `
    <div class="resultRow">
      <div class="k">FSIQ</div>
      <div class="v"><strong>${r.fsiq?.toFixed?.(1) ?? "--"}</strong> · ${r.fsiqPercentile?.toFixed?.(1) ?? "--"}%</div>
      <div class="muted small">95% CI ${r.fsiqCI95?.lo?.toFixed?.(1) ?? "--"}–${r.fsiqCI95?.hi?.toFixed?.(1) ?? "--"}</div>
    </div>
    <div class="resultStatGrid">${overviewCards}</div>
    <div class="divider"></div>
    ${rows}
    ${formatIntegritySummary(report.integrity)}
  `;
}

function pushHistory(mode, report){
  const r = report?.results;
  if (!r) return;
  state.history.unshift({
    mode,
    at: new Date().toISOString(),
    fsiq: r.fsiq,
    pct: r.fsiqPercentile,
    ci: r.fsiqCI95
  });
  saveHistory();
  renderHistory();
}

function resetHistory(){
  state.history = [];
  saveHistory();
  renderHistory();
}

async function loadNormFromFile(){
  const file = els.normFile?.files?.[0];
  if (!file){
    updateNormStatus("Select a JSON file first.");
    return;
  }
  try{
    const text = await file.text();
    const obj = JSON.parse(text);
    const v = validateNormPack(obj);
    if (!v.valid){
      updateNormStatus(`Invalid norm pack: ${v.errors.join("; ")}`);
      return;
    }
    const { norm, warnings } = saveNormPack(obj, CUSTOM_NORM_KEY);
    state.normPack = norm;
    const note = warnings?.length ? warnings.join("; ") : "Custom norm pack loaded.";
    updateNormStatus(note);
  }catch(err){
    updateNormStatus(`Failed to load norm pack: ${err.message}`);
  }
}

function clearNorm(){
  clearSavedNormPack(CUSTOM_NORM_KEY);
  state.normPack = getBaselineNormPack();
  updateNormStatus("Reverted to baseline norms.");
}

function wireEvents(){
  els.agree?.addEventListener("change", () => {
    syncStartButtons();
  });
  els.btnStart?.addEventListener("click", () => startRun("full"));
  els.btnQuick?.addEventListener("click", () => startRun("quick"));
  els.btnSmoke?.addEventListener("click", () => startRun("smoke"));
  els.btnLabUnlock?.addEventListener("click", unlockLab);
  els.btnLabOpen?.addEventListener("click", buildLabSession);
  els.btnLabLoad?.addEventListener("click", buildLabSession);
  els.btnLabClose?.addEventListener("click", () => {
    clearLabRender();
    showScreen("intro");
  });
  els.btnLabPrev?.addEventListener("click", () => moveLabIndex(-1));
  els.btnLabNext?.addEventListener("click", () => moveLabIndex(1));
  els.btnReset?.addEventListener("click", resetHistory);
  els.btnPause?.addEventListener("click", abortRun);
  els.btnRestart?.addEventListener("click", () => {
    renderQualityFlags(null);
    showScreen("intro");
    syncStartButtons();
  });
  els.researchMode?.addEventListener("change", (e) => setResearchMode(e.target.checked));

  els.btnDownloadJson?.addEventListener("click", () => {
    if (!state.lastExports?.runJson) return;
    downloadText("iq-run.json", state.lastExports.runJson, "application/json");
  });
  els.btnDownloadCsv?.addEventListener("click", () => {
    if (!state.lastExports?.itemLogCsv) return;
    downloadText("iq-item-log.csv", state.lastExports.itemLogCsv, "text/csv");
  });
  els.btnDownloadLongCsv?.addEventListener("click", () => {
    if (!state.lastExports?.longCsv) return;
    downloadText("iq-long.csv", state.lastExports.longCsv, "text/csv");
  });
  els.btnDownloadJsonl?.addEventListener("click", () => {
    if (!state.lastExports?.eventsJsonl) return;
    downloadText("iq-events.jsonl", state.lastExports.eventsJsonl, "application/json");
  });

  // Norm pack UI placeholders (pipeline integration will load packs later)
  els.btnLoadNorm?.addEventListener("click", loadNormFromFile);
  els.btnClearNorm?.addEventListener("click", clearNorm);
}

function init(){
  renderHistory();
  syncStartButtons();
  renderQualityFlags(null);
  loadLabAccess();
  if (els.btnBack) els.btnBack.style.display = "none";
  if (els.btnPause) els.btnPause.style.display = "none";
  wireEvents();
  loadNormPack();
  loadResearchMode();
}

init();
