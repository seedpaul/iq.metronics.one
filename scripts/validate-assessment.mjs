import { buildPlan } from "../src/plan.js";
import { buildItemBank } from "../src/core/data/buildItemBank.js";
import { runAssessment } from "../src/core/index.js";

const MODES = ["full", "quick", "smoke"];
const SECTION_IDS = ["attention", "fluid", "verbal", "quant", "wm", "speed_symbol", "speed_coding", "spatial"];
const STEM_ALLOWLIST = new Set(["text_prompt", "svg_stem", "symbol_search_block", "coding_block"]);

function hashTextSeed(text){
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++){
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeLocalRng(seedValue){
  let value = (seedValue >>> 0) || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function sampleItems(pool, count, seed, sectionId){
  const items = Array.isArray(pool) ? [...pool] : [];
  const rng = makeLocalRng((seed ^ hashTextSeed(sectionId)) >>> 0);
  for (let i = items.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, Math.min(count, items.length));
}

function assert(condition, message){
  if (!condition) throw new Error(message);
}

function validateMode(mode, seed){
  const plan = buildPlan(mode, { seed });
  assert(plan?.nodes?.length, `Mode '${mode}' did not produce nodes.`);

  const sectionSummary = SECTION_IDS.map((sectionId) => {
    const node = plan.nodes.find((entry) => entry.id === sectionId || entry.subtestId === sectionId);
    assert(node, `Mode '${mode}' is missing section '${sectionId}'.`);

    const sourcePool = node.items || node.bank || plan.banks?.[sectionId] || [];
    assert(Array.isArray(sourcePool), `Section '${sectionId}' in mode '${mode}' has no array pool.`);
    assert(sourcePool.length > 0, `Section '${sectionId}' in mode '${mode}' has no items.`);

    const sampled = sampleItems(sourcePool, 3, seed, `${mode}:${sectionId}`);
    const built = buildItemBank({ banks: { [sectionId]: sampled } }).items;
    assert(built.length > 0, `Section '${sectionId}' in mode '${mode}' could not be normalized.`);

    const first = built[0];
    assert(first.id, `Section '${sectionId}' in mode '${mode}' produced an item without id.`);
    assert(first.domain, `Section '${sectionId}' in mode '${mode}' produced an item without domain.`);
    assert(STEM_ALLOWLIST.has(first.stem?.type), `Section '${sectionId}' in mode '${mode}' produced unsupported stem '${first.stem?.type}'.`);

    return {
      sectionId,
      source: sourcePool.length,
      sampled: sampled.length,
      built: built.length,
      firstStem: first.stem?.type || "none"
    };
  });

  return {
    mode,
    seed,
    nodes: plan.nodes.length,
    sectionSummary
  };
}

function expectedDigitSpan(item){
  return item.direction === "backward"
    ? [...(item.digits || "")].reverse().join("")
    : (item.digits || "");
}

function buildAutoResponse(ctx){
  const raw = ctx.raw || ctx.item?.raw || ctx.item;
  const stemType = ctx.item?.stem?.type || "";

  if (["symbol_search_block", "coding_block", "n_back_block"].includes(stemType)){
    return { x: 1, rtMs: 1200, meta: { simulated: true, stemType } };
  }
  if (raw?.type === "digitspan"){
    return { value: expectedDigitSpan(raw), rtMs: 1200, meta: { simulated: true } };
  }
  if (raw?.type === "speed_symbol"){
    return { choice: raw.answer, rtMs: 900, meta: { simulated: true } };
  }
  if (raw?.type === "speed_coding"){
    return { value: raw.answer, rtMs: 1100, meta: { simulated: true } };
  }

  const optionIndex = Array.isArray(ctx.item?.options)
    ? ctx.item.options.findIndex((opt) => String(opt?.key ?? opt) === String(raw?.answer ?? raw?.key))
    : -1;

  return {
    choice: optionIndex >= 0 ? optionIndex : ctx.item?.key ?? 0,
    choiceVal: optionIndex >= 0 ? (ctx.item.options[optionIndex]?.key ?? ctx.item.options[optionIndex]) : undefined,
    rtMs: 1000,
    meta: { simulated: true }
  };
}

async function validateRunExecution(mode, seed){
  const plan = buildPlan(mode, { seed });
  const result = await runAssessment(
    {
      plan,
      banks: plan.banks,
      ageYears: null,
      researchMode: true,
      integrity: { flags: [], rapidGuessingCount: 0 }
    },
    {
      presentItem: async (ctx) => buildAutoResponse(ctx)
    }
  );

  assert(result?.report?.results?.fsiq != null, `Mode '${mode}' did not produce an FSIQ result.`);
  assert(Object.keys(result?.report?.results?.domainIndices || {}).length >= 5, `Mode '${mode}' produced too few domain indices.`);
  assert(Array.isArray(result?.session?.responses) && result.session.responses.length > 0, `Mode '${mode}' produced no responses.`);
  assert(typeof result?.exports?.runJson === "string" && result.exports.runJson.length > 0, `Mode '${mode}' did not produce run JSON.`);

  return {
    responseCount: result.session.responses.length,
    fsiq: result.report.results.fsiq,
    rapidGuessingCount: result.report.integrity?.rapidGuessingCount ?? 0
  };
}

async function main(){
  const seed = 4242;
  const results = [];
  for (const mode of MODES){
    const structure = validateMode(mode, seed);
    const execution = await validateRunExecution(mode, seed);
    results.push({ ...structure, execution });
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});