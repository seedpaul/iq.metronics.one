// Adapter: IQ-Delta item banks -> Gamma (CHC) engine schema.
// Produces items with CHC domain codes, families, and normalized model fields.

import { stableHash32 } from "../engine/utils.js";

const DOMAIN_MAP = {
  fluid: "Gf",
  verbal: "Gc",
  quant: "Gq",
  spatial: "Gv",
  wm: "Gwm",
  speed_symbol: "Gs",
  speed_coding: "Gs",
  speed: "Gs",
  attention: "attention"
};

const FAMILY_FALLBACK = {
  Gf: "matrix_reasoning",
  Gc: "controlled_analogy",
  Gq: "number_pattern",
  Gv: "mental_rotation",
  Gwm: "working_memory",
  Gs: "speed_block"
};

function mapDomain(deltaDomain){
  const d = DOMAIN_MAP[deltaDomain];
  if (!d) throw new Error(`Unknown domain '${deltaDomain}'`);
  return d;
}

function mapFamily(item){
  const kind = item?.meta?.kind || item.blueprint || "";
  const domain = mapDomain(item.domain || item.subtestId || "");

  if (domain === "Gf") return "matrix_reasoning";
  if (domain === "Gv") return "mental_rotation";
  if (domain === "Gq"){
    if (["ratio","rate","mapping","algebra"].includes(kind)) return "ratio_reasoning";
    return "number_pattern";
  }
  if (domain === "Gc"){
    if (kind === "logic") return "logical_inference";
    return "controlled_analogy";
  }
  if (domain === "Gwm") return "digit_span_block";
  if (domain === "Gs"){
    if (item.type === "speed_coding") return "coding_block";
    return "symbol_search_block";
  }
  return FAMILY_FALLBACK[domain] || "misc";
}

function normalizeModel(irt = {}){
  const a = Number(irt.a);
  const b = Number(irt.b);
  const c = Number.isFinite(irt.c) ? Number(irt.c) : 0;
  return {
    model: c > 0 ? "3PL" : "2PL",
    a: Number.isFinite(a) ? a : 1.0,
    b: Number.isFinite(b) ? b : 0.0,
    c
  };
}

function keyFromAnswer(item){
  if (Array.isArray(item.choices)){
    const idx = item.choices.findIndex(c => c === item.answer || String(c) === String(item.answer));
    return idx >= 0 ? idx : null;
  }
  if (Array.isArray(item.options)){
    const idx = item.options.findIndex(opt => (opt?.key ?? opt) === item.answer || String(opt?.key ?? opt) === String(item.answer));
    return idx >= 0 ? idx : null;
  }
  return null;
}

function baseStem(item){
  if (item.type === "speed_symbol"){
    const setSize = Array.isArray(item.row) ? Math.min(6, Math.max(3, item.row.length)) : 6;
    return { type: "symbol_search_block", length: 24, setSize, trialMs: 1700 };
  }
  if (item.type === "speed_coding"){
    const keymap = {};
    for (const kp of item.keyPairs || []){
      keymap[kp.dig] = kp.sym;
    }
    return { type: "coding_block", length: Math.max(10, item.seq?.length || 16), trialMs: 2000, keymap };
  }
  if (item.type === "mcq_svg"){
    return { type: "svg_stem", prompt: item.prompt || item.title || "", html: item.stemSvg || "" };
  }
  // General MC/text
  return {
    type: "text_prompt",
    prompt: item.prompt || item.title || ""
  };
}

function normalizeItem(item){
  const domain = mapDomain(item.domain);
  const family = mapFamily(item);
  const { model, a, b, c } = normalizeModel(item.irt || {});
  const key = keyFromAnswer(item);

  return {
    id: String(item.id),
    domain,
    family,
    model,
    a,
    b,
    c,
    stem: baseStem(item),
    options: item.choices || item.options || null,
    key,
    blueprint: item.blueprint || null,
    raw: item, // keep original for UI rendering and exports
    anchor: false
  };
}

export function buildItemBank({ banks, includeDomains }){
  if (!banks || typeof banks !== "object"){
    throw new Error("buildItemBank: banks object is required.");
  }

  const items = [];
  const domainsSeen = new Set();

  for (const [k, arr] of Object.entries(banks)){
    if (includeDomains && !includeDomains.includes(k)) continue;
    if (!Array.isArray(arr)) continue;
    for (const it of arr){
      const norm = normalizeItem(it);
      items.push(norm);
      domainsSeen.add(norm.domain);
    }
  }

  validateBank(items);

  return {
    version: "omicron-adapted",
    generatedAt: new Date().toISOString(),
    domains: Array.from(domainsSeen),
    items
  };
}

export function validateBank(items){
  const ids = new Set();
  for (const it of items){
    if (!it.id) throw new Error("Item missing id");
    if (ids.has(it.id)) throw new Error(`Duplicate item id ${it.id}`);
    ids.add(it.id);
    if (!it.domain) throw new Error(`Item ${it.id} missing domain`);
    if (!Number.isFinite(it.a) || !Number.isFinite(it.b)){
      throw new Error(`Item ${it.id} has invalid IRT params`);
    }
  }
  return true;
}

export function summarizeBank(items){
  const counts = {};
  for (const it of items){
    const d = it.domain || "NA";
    const f = it.family || "NA";
    counts[d] = counts[d] || { total: 0, families: {} };
    counts[d].total += 1;
    counts[d].families[f] = (counts[d].families[f] || 0) + 1;
  }

  const lines = [];
  for (const [d, info] of Object.entries(counts)){
    const fams = Object.entries(info.families).map(([f,n]) => `${f}:${n}`).join(", ");
    lines.push(`${d}: ${info.total} items (${fams})`);
  }
  const summary = lines.join(" | ");
  console.info(`[buildItemBank] ${summary}`);
  return summary;
}

export function stableItemId(str){
  return `IT-${stableHash32(str).toString(16)}`;
}
