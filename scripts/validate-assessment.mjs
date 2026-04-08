import { buildPlan } from "../src/plan.js";
import { buildItemBank } from "../src/core/data/buildItemBank.js";
import { runAssessment } from "../src/core/index.js";
import { MIN_SYMBOL_VISUAL_DISTANCE, measureSymbolSetSeparation } from "../src/items/speed.js";

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

function matchesPairExactly(pair, keySymbols){
  if (!Array.isArray(pair) || !Array.isArray(keySymbols) || pair.length !== 2 || keySymbols.length !== 2) return false;
  if (new Set(pair).size !== 2 || new Set(keySymbols).size !== 2) return false;
  return pair.every((symbol) => keySymbols.includes(symbol));
}

function longestRun(values){
  let longest = 0;
  let current = 0;
  let previous = null;
  for (const value of values){
    if (value === previous){
      current += 1;
    }else{
      current = 1;
      previous = value;
    }
    if (current > longest) longest = current;
  }
  return longest;
}

function hasDistinctValues(values){
  return new Set(values.map((value) => String(value))).size === values.length;
}

function validateNodeClarity(node, mode){
  assert(typeof node?.title === "string" && node.title.trim().length > 0, `Mode '${mode}' node '${node?.id}' is missing a title.`);
  assert(typeof node?.instructions === "string" && node.instructions.trim().length >= 24, `Mode '${mode}' node '${node?.id}' is missing clear instructions.`);
}

function validatePromptText(text, context){
  assert(typeof text === "string" && text.trim().length >= 12, `${context} is missing a sufficiently clear prompt.`);
  assert(!/\s{2,}/.test(text), `${context} contains accidental repeated spaces.`);
}

function extractSvgIds(markup){
  const ids = [];
  const pattern = /id="([^"]+)"/g;
  for (const match of String(markup || "").matchAll(pattern)) ids.push(match[1]);
  return ids;
}

function validateSvgMarkup(markup, context){
  const text = String(markup || "");
  assert(text.includes("<svg"), `${context} is missing an svg root.`);
  assert(text.includes("xmlns=\"http://www.w3.org/2000/svg\""), `${context} is missing the SVG namespace.`);
}

function validateVisualSvgContent(sectionId, sourcePool, mode){
  if (!["fluid", "spatial"].includes(sectionId)) return;

  sourcePool.forEach((item, index) => {
    validateSvgMarkup(item.stemSvg, `Mode '${mode}' ${sectionId} item ${index + 1} stem`);
    assert(Array.isArray(item.options) && item.options.length >= 4, `Mode '${mode}' ${sectionId} item ${index + 1} must have SVG answer options.`);

    const combinedIds = new Set();
    const stemIds = extractSvgIds(item.stemSvg);
    stemIds.forEach((svgId) => {
      assert(!combinedIds.has(svgId), `Mode '${mode}' ${sectionId} item ${index + 1} reuses SVG id '${svgId}' in the stem.`);
      combinedIds.add(svgId);
    });

    item.options.forEach((option, optionIndex) => {
      validateSvgMarkup(option?.svg, `Mode '${mode}' ${sectionId} item ${index + 1} option ${optionIndex + 1}`);
      const optionIds = extractSvgIds(option?.svg);
      optionIds.forEach((svgId) => {
        assert(!combinedIds.has(svgId), `Mode '${mode}' ${sectionId} item ${index + 1} reuses SVG id '${svgId}' between stem and options.`);
        combinedIds.add(svgId);
      });
    });
  });
}

function validateSectionContent(sectionId, sourcePool, mode){
  if (sectionId === "attention"){
    sourcePool.forEach((item, index) => {
      validatePromptText(item.prompt, `Mode '${mode}' attention item ${index + 1}`);
      assert(Array.isArray(item.choices) && item.choices.length === 4, `Mode '${mode}' attention item ${index + 1} must have four choices.`);
      assert(hasDistinctValues(item.choices), `Mode '${mode}' attention item ${index + 1} has duplicate answer choices.`);
    });
    return;
  }

  if (["fluid", "verbal", "quant", "wm", "spatial"].includes(sectionId)){
    sourcePool.forEach((item, index) => {
      validatePromptText(item.prompt || item.title, `Mode '${mode}' ${sectionId} item ${index + 1}`);
    });
  }

  if (sectionId === "verbal"){
    sourcePool.forEach((item, index) => {
      assert(Array.isArray(item.choices) && item.choices.length === 4, `Mode '${mode}' verbal item ${index + 1} must have four choices.`);
      assert(hasDistinctValues(item.choices), `Mode '${mode}' verbal item ${index + 1} has duplicate choices.`);
    });
  }

  if (sectionId === "quant"){
    sourcePool.forEach((item, index) => {
      assert(Array.isArray(item.choices) && item.choices.length === 4, `Mode '${mode}' quant item ${index + 1} must have four choices.`);
      assert(hasDistinctValues(item.choices), `Mode '${mode}' quant item ${index + 1} has duplicate choices.`);
    });
  }

  if (sectionId === "wm"){
    sourcePool.forEach((item, index) => {
      assert(typeof item.digits === "string" && item.digits.length >= 3, `Mode '${mode}' working-memory item ${index + 1} is missing digits.`);
      assert(["forward", "backward"].includes(item.direction), `Mode '${mode}' working-memory item ${index + 1} has invalid direction.`);
    });
  }

  if (sectionId === "spatial"){
    const templates = new Set();
    sourcePool.forEach((item, index) => {
      assert(Array.isArray(item.options) && item.options.length === 4, `Mode '${mode}' spatial item ${index + 1} must have four options.`);
      if (item?.meta?.template) templates.add(item.meta.template);
    });
    assert(templates.size >= 3, `Mode '${mode}' spatial bank should contain at least three distinct figure templates.`);
  }

  validateVisualSvgContent(sectionId, sourcePool, mode);
}

function validateNormalizedSectionConsistency(sectionId, sampled, built, mode){
  assert(sampled.length === built.length, `Mode '${mode}' section '${sectionId}' changed item count during normalization.`);

  built.forEach((item, index) => {
    const raw = sampled[index];
    const options = Array.isArray(item.options) ? item.options : [];

    if (["attention", "verbal", "quant", "spatial"].includes(sectionId)){
      assert(options.length >= 4, `Mode '${mode}' section '${sectionId}' item ${index + 1} lost answer options during normalization.`);
      assert(Number.isInteger(item.key) && item.key >= 0 && item.key < options.length, `Mode '${mode}' section '${sectionId}' item ${index + 1} has an invalid normalized answer key.`);
    }

    if (sectionId === "wm"){
      assert(item.stem?.type === "text_prompt", `Mode '${mode}' working-memory item ${index + 1} should normalize to text prompt.`);
      assert(typeof raw?.digits === "string" && raw.digits.length >= 3, `Mode '${mode}' working-memory item ${index + 1} lost its digit sequence.`);
    }

    if (sectionId === "speed_symbol"){
      assert(item.stem?.type === "symbol_search_block", `Mode '${mode}' speed symbol item ${index + 1} normalized to the wrong stem type.`);
      assert(Array.isArray(item.stem?.trials) && item.stem.trials.length > 0, `Mode '${mode}' speed symbol item ${index + 1} has no normalized trials.`);
      item.stem.trials.forEach((trial, trialIndex) => {
        const pairMatches = Array.isArray(trial.pair) && Array.isArray(item.stem.keySymbols)
          ? trial.pair.every((symbol) => item.stem.keySymbols.includes(symbol)) && new Set(trial.pair).size === 2
          : false;
        assert(Boolean(trial.present) === pairMatches, `Mode '${mode}' speed symbol item ${index + 1} trial ${trialIndex + 1} is mismatched after normalization.`);
      });
    }

    if (sectionId === "speed_coding"){
      assert(item.stem?.type === "coding_block", `Mode '${mode}' speed coding item ${index + 1} normalized to the wrong stem type.`);
      assert(Array.isArray(item.stem?.sequence) && item.stem.sequence.length > 0, `Mode '${mode}' speed coding item ${index + 1} has no normalized sequence.`);
      const keymap = item.stem?.keymap || {};
      item.stem.sequence.forEach((entry, seqIndex) => {
        assert(Object.hasOwn(keymap, entry.symbol), `Mode '${mode}' speed coding item ${index + 1} sequence ${seqIndex + 1} references a symbol missing from the keymap.`);
        assert(String(entry.digit) === String(keymap[entry.symbol]), `Mode '${mode}' speed coding item ${index + 1} sequence ${seqIndex + 1} has mismatched symbol-to-digit mapping.`);
      });
    }
  });
}

function validateSpeedContent(sectionId, sourcePool, mode){
  if (sectionId === "speed_symbol"){
    sourcePool.forEach((page, pageIndex) => {
      assert(Array.isArray(page.keySymbols) && page.keySymbols.length === 2, `Mode '${mode}' speed symbol page ${pageIndex + 1} has invalid key symbols.`);
      assert(measureSymbolSetSeparation(page.keySymbols) >= MIN_SYMBOL_VISUAL_DISTANCE, `Mode '${mode}' speed symbol page ${pageIndex + 1} uses key icons that are too visually similar.`);
      assert(Array.isArray(page.rows) && page.rows.length >= 12, `Mode '${mode}' speed symbol page ${pageIndex + 1} has too few rows.`);

      const kindCounts = { exact: 0, one_overlap: 0, no_overlap: 0 };
      page.rows.forEach((row, rowIndex) => {
        assert(Array.isArray(row.pair) && row.pair.length === 2, `Mode '${mode}' speed symbol page ${pageIndex + 1} row ${rowIndex + 1} has invalid pair.`);
        assert(new Set(row.pair).size === 2, `Mode '${mode}' speed symbol page ${pageIndex + 1} row ${rowIndex + 1} repeats a symbol.`);
        const expected = matchesPairExactly(row.pair, page.keySymbols);
        assert(Boolean(row.answer) === expected, `Mode '${mode}' speed symbol page ${pageIndex + 1} row ${rowIndex + 1} answer does not match exact-pair rule.`);
        if (row.kind && Object.hasOwn(kindCounts, row.kind)) kindCounts[row.kind] += 1;
      });

      assert(kindCounts.exact > 0, `Mode '${mode}' speed symbol page ${pageIndex + 1} has no exact-match trials.`);
      assert(kindCounts.one_overlap > 0, `Mode '${mode}' speed symbol page ${pageIndex + 1} has no one-overlap distractors.`);
      assert(kindCounts.no_overlap > 0, `Mode '${mode}' speed symbol page ${pageIndex + 1} has no no-overlap distractors.`);
    });
  }

  if (sectionId === "speed_coding"){
    sourcePool.forEach((page, pageIndex) => {
      assert(Array.isArray(page.key) && page.key.length >= 5, `Mode '${mode}' speed coding page ${pageIndex + 1} has too small a key.`);
      const symbols = page.key.map((entry) => entry.sym);
      const digits = page.key.map((entry) => entry.digit);
      assert(new Set(symbols).size === symbols.length, `Mode '${mode}' speed coding page ${pageIndex + 1} repeats symbols in the key.`);
      assert(new Set(digits).size === digits.length, `Mode '${mode}' speed coding page ${pageIndex + 1} repeats digits in the key.`);
      assert(measureSymbolSetSeparation(symbols) >= MIN_SYMBOL_VISUAL_DISTANCE, `Mode '${mode}' speed coding page ${pageIndex + 1} includes icons that are too visually similar.`);
      assert(Array.isArray(page.prompts) && Array.isArray(page.answers) && page.prompts.length === page.answers.length, `Mode '${mode}' speed coding page ${pageIndex + 1} has misaligned prompts and answers.`);

      const keyMap = Object.fromEntries(page.key.map((entry) => [entry.sym, entry.digit]));
      page.prompts.forEach((symbol, promptIndex) => {
        assert(Object.hasOwn(keyMap, symbol), `Mode '${mode}' speed coding page ${pageIndex + 1} prompt ${promptIndex + 1} references a symbol not in the key.`);
        assert(String(page.answers[promptIndex]) === String(keyMap[symbol]), `Mode '${mode}' speed coding page ${pageIndex + 1} prompt ${promptIndex + 1} has the wrong keyed answer.`);
      });

      assert(longestRun(page.prompts) <= 2, `Mode '${mode}' speed coding page ${pageIndex + 1} repeats the same symbol too many times in a row.`);
    });
  }
}

function validateMode(mode, seed){
  const plan = buildPlan(mode, { seed });
  assert(plan?.nodes?.length, `Mode '${mode}' did not produce nodes.`);
  plan.nodes.forEach((node) => validateNodeClarity(node, mode));

  const sectionSummary = SECTION_IDS.map((sectionId) => {
    const node = plan.nodes.find((entry) => entry.id === sectionId || entry.subtestId === sectionId);
    assert(node, `Mode '${mode}' is missing section '${sectionId}'.`);

    const sourcePool = node.items || node.bank || plan.banks?.[sectionId] || [];
    assert(Array.isArray(sourcePool), `Section '${sectionId}' in mode '${mode}' has no array pool.`);
    assert(sourcePool.length > 0, `Section '${sectionId}' in mode '${mode}' has no items.`);
    validateSectionContent(sectionId, sourcePool, mode);
    validateSpeedContent(sectionId, sourcePool, mode);

    const sampled = sampleItems(sourcePool, 3, seed, `${mode}:${sectionId}`);
    const built = buildItemBank({ banks: { [sectionId]: sampled } }).items;
    assert(built.length > 0, `Section '${sectionId}' in mode '${mode}' could not be normalized.`);
    validateNormalizedSectionConsistency(sectionId, sampled, built, mode);

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