import { CatSubtest } from "./engine/cat.js";
import { EapEstimator } from "./engine/eap.js";
import { ExposureStore } from "./engine/exposure.js";
import { buildReport } from "./engine/scoring.js";
import { buildItemBank, summarizeBank } from "./data/buildItemBank.js";

const noop = () => {};

function domainFromNode(node){
  const d = node?.subtestId || node?.domain || node?.id;
  switch (d){
    case "fluid": return "Gf";
    case "verbal": return "Gc";
    case "quant": return "Gq";
    case "spatial": return "Gv";
    case "wm": return "Gwm";
    case "speed_symbol":
    case "speed_coding":
    case "speed":
      return "Gs";
    default:
      return d || "Gf";
  }
}

function makeCatConfig(node, domain){
  return {
    semThreshold: { [domain]: node.stopSem ?? 0.32 },
    minItems: { [domain]: node.minItems ?? 8 },
    maxItems: { [domain]: node.maxItems ?? Math.max(node.minItems ?? 8, 18) },
    maxExposurePerItem: node.maxExposure ?? 50,
    topK: node.topK ?? 5,
    anchorTargetProp: { [domain]: 0 },
    anchorMin: { [domain]: 0 },
    anchorMax: { [domain]: 0 },
    anchorAvoidFirstTwo: { [domain]: true },
    anchorMiniBlockN: { [domain]: 0 },
    familyTargets: node.blueprintTargets ? { [domain]: node.blueprintTargets } : undefined
  };
}

function computeX(resp, item){
  if (resp == null) return null;
  if (typeof resp.x === "number") return resp.x;
  if (resp.choice != null && Number.isFinite(item?.key)){
    return Number(resp.choice) === Number(item.key) ? 1 : 0;
  }
  if (resp.value != null && item?.raw?.answer != null){
    return String(resp.value).trim() === String(item.raw.answer).trim() ? 1 : 0;
  }
  return null;
}

function csvEscape(v){
  if (v == null) return "";
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows){
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const header = cols.join(",");
  const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

function estimateTheta(estimator, responses){
  const est = estimator.estimate(responses, 0, 1);
  return { theta: est.theta ?? 0, sem: est.sem ?? Math.sqrt(est.var ?? 1) };
}

function collectBanksFromPlan(plan){
  const buckets = {};
  if (!plan?.nodes) return buckets;
  for (const node of plan.nodes){
    const items = node.bank || node.items || [];
    for (const it of items){
      const d = it.domain || node.subtestId || node.domain;
      if (!d) continue;
      if (!buckets[d]) buckets[d] = [];
      buckets[d].push(it);
    }
  }
  return buckets;
}

export async function runAssessment(config, io = {}){
  const {
    plan,
    banks,
    ageYears = null,
    researchMode = false,
    exposureStore = new ExposureStore("iq_omicron_exposure_v1")
  } = config || {};

  if (!plan?.nodes?.length){
    throw new Error("runAssessment: plan with nodes is required.");
  }

  const presenter = io.presentItem || (async () => ({ x: null, rtMs: null, meta: {} }));
  const onEvent = io.onEvent || noop;

  // Build and summarize bank
  const sourceBanks = banks || config.banks || collectBanksFromPlan(plan);
  const itemBank = buildItemBank({ banks: sourceBanks });
  summarizeBank(itemBank.items);
  const byId = new Map(itemBank.items.map(it => [it.id, it]));
  const byDomain = {};
  for (const it of itemBank.items){
    if (!byDomain[it.domain]) byDomain[it.domain] = [];
    byDomain[it.domain].push(it);
  }

  const estimator = new EapEstimator({ gridMin: -4, gridMax: 4, step: 0.1 });
  const responses = [];
  const subtestSummaries = [];

  for (const node of plan.nodes){
    const domain = domainFromNode(node);
    const nodeCtx = { nodeId: node.id, subtestId: node.subtestId, domain };
    onEvent("NODE_START", { ...nodeCtx });

    if (node.mode === "cat"){
      const ids = new Set((node.bank || []).map(it => String(it.id)));
      const pool = ids.size
        ? Array.from(ids).map(id => byId.get(id)).filter(Boolean)
        : (byDomain[domain] || []);

      const cat = new CatSubtest({
        domain,
        items: pool,
        estimator,
        exposureStore,
        config: makeCatConfig(node, domain)
      });
      cat.start();

      while (true){
        const item = cat.pickNextItem();
        if (!item) break;

        const resp = await presenter({ node, item: item.raw ?? item, theta: cat.theta, sem: cat.sem });
        const x = computeX(resp, item);
        const rtMs = resp?.rtMs ?? null;
        const meta = resp?.meta ?? {};

        const est = cat.recordResponse({ item, x, rtMs, meta });

        responses.push({
          ...nodeCtx,
          itemId: item.id,
          x,
          rtMs,
          thetaAfter: cat.theta,
          semAfter: cat.sem,
          family: item.family,
          a: item.a,
          b: item.b,
          c: item.c ?? 0
        });

        onEvent("ITEM", { ...nodeCtx, itemId: item.id, thetaAfter: cat.theta, semAfter: cat.sem, x, rtMs, meta, est });

        if (cat.shouldStop()) break;
      }

      const summary = cat.summary();
      subtestSummaries.push(summary);
      onEvent("NODE_END", { ...nodeCtx, summary });
      continue;
    }

    // Fixed / speed nodes
    const items = (node.items || node.bank || []).map(it => byId.get(String(it.id)) || null).filter(Boolean);
    const seqResponses = [];

    for (const item of items){
      const resp = await presenter({ node, item: item.raw ?? item, theta: null, sem: null });
      const x = computeX(resp, item);
      const rtMs = resp?.rtMs ?? null;
      const meta = resp?.meta ?? {};
      seqResponses.push({ item, x, rtMs, meta });

      responses.push({
        ...nodeCtx,
        itemId: item.id,
        x,
        rtMs,
        thetaAfter: null,
        semAfter: null,
        family: item.family,
        a: item.a,
        b: item.b,
        c: item.c ?? 0
      });

      onEvent("ITEM", { ...nodeCtx, itemId: item.id, x, rtMs, meta });
    }

    // Estimate theta/sem for fixed blocks when items exist
    let summary = null;
    if (items.length){
      const est = estimateTheta(estimator, seqResponses);
      summary = {
        domain,
        n: seqResponses.length,
        theta: est.theta,
        sem: est.sem,
        responses: seqResponses.map(r => ({
          itemId: r.item.id,
          x: r.x,
          rtMs: r.rtMs,
          family: r.item.family,
          b: r.item.b,
          a: r.item.a
        }))
      };
      subtestSummaries.push(summary);
    }
    onEvent("NODE_END", { ...nodeCtx, summary });
  }

  // Filter to composite domains (skip attention/other if flagged)
  const compositeSummaries = subtestSummaries.filter(s => s && s.domain && s.domain !== "attention");
  const report = buildReport({ ageYears, subtestSummaries: compositeSummaries, integrity: {} });

  // Build exports
  const runJson = JSON.stringify({ planId: plan.id, ageYears, report, responses }, null, 2);
  const itemLogCsv = toCsv(responses);
  const longCsv = itemLogCsv; // placeholder; UI can request richer export via research tools

  return {
    report,
    session: {
      planId: plan.id,
      ageYears,
      responses
    },
    exports: { runJson, itemLogCsv, longCsv }
  };
}
