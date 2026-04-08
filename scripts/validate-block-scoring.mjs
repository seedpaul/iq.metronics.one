import { summarizeBlockPerformance } from "../src/core/render/itemRenderer.js";

function assert(condition, message){
  if (!condition) throw new Error(message);
}

function approxEqual(actual, expected, tolerance = 1e-9){
  return Math.abs(actual - expected) <= tolerance;
}

function main(){
  const partial = summarizeBlockPerformance(10, [
    { correct: true, rtMs: 700 },
    { correct: false, rtMs: 900 },
    { correct: true, rtMs: 800 },
    { correct: true, rtMs: 850 }
  ]);

  assert(partial.trials === 10, "Partial block summary should preserve total trials.");
  assert(partial.responded === 4, "Partial block summary should track answered trials.");
  assert(partial.correct === 3, "Partial block summary should count correct trials.");
  assert(partial.omitted === 6, "Partial block summary should count omissions.");
  assert(approxEqual(partial.accuracy, 0.3), "Partial block accuracy should include omissions in the denominator.");
  assert(approxEqual(partial.responseRate, 0.4), "Partial block response rate should use answered trials over total trials.");
  assert(partial.medianRtMs === 825, "Partial block median RT should use answered trials only.");

  const complete = summarizeBlockPerformance(4, [
    { correct: true, rtMs: 500 },
    { correct: true, rtMs: 600 },
    { correct: false, rtMs: 700 },
    { correct: true, rtMs: 800 }
  ]);

  assert(complete.omitted === 0, "Complete block summary should report zero omissions.");
  assert(approxEqual(complete.accuracy, 0.75), "Complete block accuracy should equal correct over total trials.");
  assert(approxEqual(complete.responseRate, 1), "Complete block response rate should be 1 when every trial is answered.");

  console.log(JSON.stringify({ partial, complete }, null, 2));
}

main();