import { ageAdjustTheta } from "./norms.js";
import { clamp, normalCdf } from "./utils.js";
import { ci95 } from "./norms.js";

/**
 * g aggregation:
 * In production, weights MUST come from a validated hierarchical factor model.
 * Here we provide a reasonable default with mild weighting toward Gf/Gq/Gwm for g.
 */
export function computeG(domainThetas){
  const w = {
    "Gf": 0.22,
    "Gv": 0.16,
    "Gq": 0.18,
    "Gwm": 0.18,
    "Gs": 0.12,
    "Gc": 0.14
  };

  let num = 0;
  let den = 0;
  for (const [k,v] of Object.entries(domainThetas)){
    if (Number.isFinite(v)){
      const wk = w[k] ?? 0;
      num += wk * v;
      den += wk;
    }
  }
  if (den <= 0) return 0;
  return num / den;
}

function mapThetaToScores(theta, sem, normPack){
  const t = normPack?.thetaToIQ || {};
  const thetaMean = isFinite(t.thetaMean) ? Number(t.thetaMean) : 0;
  const thetaSd = (isFinite(t.thetaSd) && t.thetaSd > 0) ? Number(t.thetaSd) : 1;
  const mean = isFinite(t.mean) ? Number(t.mean) : 100;
  const sd = (isFinite(t.sd) && t.sd > 0) ? Number(t.sd) : 15;

  const z = (theta - thetaMean) / thetaSd;
  const index = mean + sd * z;
  const semIndex = sd * (sem / thetaSd);
  const ci = ci95(index, semIndex);
  const pct = normalCdf(z) * 100;
  return { index, pct, ci };
}

function summarizeAdministration(subtestSummaries){
  const domains = {};
  let totalItems = 0;
  let totalCorrect = 0;
  let totalScored = 0;
  let totalRtMs = 0;
  let totalRtCount = 0;

  for (const summary of subtestSummaries){
    const responses = Array.isArray(summary?.responses) ? summary.responses : [];
    const scored = responses.filter((entry) => Number.isFinite(entry?.x));
    const timed = responses.filter((entry) => Number.isFinite(entry?.rtMs));
    const correct = scored.filter((entry) => entry.x === 1).length;
    const avgRtMs = timed.length
      ? timed.reduce((sum, entry) => sum + entry.rtMs, 0) / timed.length
      : null;

    totalItems += responses.length;
    totalCorrect += correct;
    totalScored += scored.length;
    totalRtMs += timed.reduce((sum, entry) => sum + entry.rtMs, 0);
    totalRtCount += timed.length;

    domains[summary.domain] = {
      itemsAdministered: responses.length,
      correctResponses: correct,
      accuracy: scored.length ? correct / scored.length : null,
      avgRtMs: avgRtMs != null ? round1(avgRtMs) : null,
      theta: round3(summary.theta),
      sem: round3(summary.sem)
    };
  }

  return {
    overview: {
      domainsCompleted: Object.keys(domains).length,
      itemsAdministered: totalItems,
      accuracy: totalScored ? totalCorrect / totalScored : null,
      avgRtMs: totalRtCount ? round1(totalRtMs / totalRtCount) : null
    },
    domains
  };
}

export function buildReport({ ageYears, subtestSummaries, integrity, normPack=null }){
  // Age-adjusted thetas
  const domain = {};
  const domainSem = {};

  for (const s of subtestSummaries){
    domain[s.domain] = ageAdjustTheta(s.domain, s.theta, ageYears);
    domainSem[s.domain] = s.sem; // SEM in theta metric; in real norms may require transformation
  }

  const gTheta = computeG(domain);

  // Convert to indices (demo)
  const indices = {};
  const percentiles = {};
  const ci = {};

  for (const d of Object.keys(domain)){
    const t = domain[d];
    const sem = domainSem[d];
    const s = mapThetaToScores(t, sem, normPack);
    indices[d] = s.index;
    percentiles[d] = s.pct;
    ci[d] = s.ci;
  }

  const fsiqSem = Math.sqrt(Object.values(domainSem).reduce((s,x)=>s+x*x,0) / Math.max(1,Object.values(domainSem).length)) * 0.75;
  const fsiqScores = mapThetaToScores(gTheta, fsiqSem, normPack);
  const administration = summarizeAdministration(subtestSummaries);

  return {
    meta: {
      schema: "chc-cat-report-v1",
      generatedAt: new Date().toISOString(),
      ageYears: Number(ageYears) || null
    },
    results: {
      fsiq: round1(fsiqScores.index),
      fsiqPercentile: round1(fsiqScores.pct),
      fsiqCI95: { lo: round1(fsiqScores.ci.lo), hi: round1(fsiqScores.ci.hi) },
      domainIndices: mapRound1(indices),
      domainPercentiles: mapRound1(percentiles),
      domainCI95: mapRound1Ci(ci)
    },
    thetas: {
      g: round3(gTheta),
      domains: mapRound3(domain),
      sem: mapRound3(domainSem)
    },
    administration,
    integrity
  };
}

function round1(x){ return Number.isFinite(x) ? Math.round(x*10)/10 : null; }
function round3(x){ return Number.isFinite(x) ? Math.round(x*1000)/1000 : null; }

function mapRound1(obj){
  const o = {};
  for (const [k,v] of Object.entries(obj)) o[k] = round1(v);
  return o;
}
function mapRound3(obj){
  const o = {};
  for (const [k,v] of Object.entries(obj)) o[k] = round3(v);
  return o;
}
function mapRound1Ci(obj){
  const o = {};
  for (const [k,v] of Object.entries(obj)){
    o[k] = { lo: round1(v.lo), hi: round1(v.hi) };
  }
  return o;
}
