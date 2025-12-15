# Cognitive Assessment Suite (Non-Clinical)

Research-informed, **non-clinical** IQ-style assessment for self-tracking. Not WAIS, not Stanford–Binet, no diagnosis or clinical claims.

## Quick start
- Open `index.html` locally or host via GitHub Pages (Settings → Pages → Deploy from branch → root).
- Check the consent box, optionally set a reproducibility seed, then start (`Full` or `Quick`). Baseline norms are bundled; no server required.
- Results stay in your browser (`localStorage`), with optional JSON/CSV export.

## Features
- Adaptive CAT with MAP/EAP estimation, SEM stop rules, seeded RNG, top-k info sampling, exposure damping, and blueprint balancing per content area.
- Subtests: attention check (not scored), Fluid (SVG matrices), Verbal (analogies/vocab/logic), Quant (series/rates/proportions), Spatial (rotation), Working Memory (digit span), Processing Speed (symbol search + coding).
- Item banks from a single generator (`src/items/big_banks.js`) with deterministic seeds; speed pages use seeded builders.
- Results: IQ-style estimate **and** percentile (95% CI), per-subtest scores with CI, composite theta/SEM, fairness summary, run seed, and quality flags (tab switches, focus loss, rapid guesses, missed attention checks).
- Norm pack validator in-app (schema + friendly errors); fairness metadata supported (`fairness.flaggedItems/difMh/difLogistic/note`).
- Exports: run JSON + item-log CSV; history is local only.

## Norm packs (optional)
- Built-in baseline norms: theta→IQ mapping (mean 100 sd 15), optional age bands, index weights, fairness placeholder.
- Load a custom pack via the intro screen. Validator requires a valid `thetaToIQ.thetaMean/thetaSd`; optional `ageBands`, `indices`, and `fairness` are checked with warnings.
- Schema sketch:
  ```json
  {
    "name": "Your pack",
    "version": "1.0.0",
    "thetaToIQ": { "mean": 100, "sd": 15, "thetaMean": 0.2, "thetaSd": 0.95 },
    "ageBands": [{ "id": "18-24", "label": "18-24", "thetaMean": 0.1, "thetaSd": 0.9, "n": 120 }],
    "indices": { "fluid": { "mean": 0, "sd": 1, "weight": 1.2, "label": "Fluid Reasoning Index" } },
    "fairness": { "flaggedItems": ["F12"], "difMh": [], "difLogistic": [], "note": "DIF screened" }
  }
  ```

## Pipeline (offline, optional)
1. Collect consented run exports (JSON) from the app.
2. Build norms: `python pipeline/make_norm_pack.py --input ../runs --out norm_pack.json`
3. Optional item calibration: `python pipeline/calibrate_2pl.py --input ../runs --domain fluid --out item_params.json`
4. Optional fairness/DIF screening: `python pipeline/dif_mh.py --input ../runs --group group.sex --out dif_report_mh.csv` and `python pipeline/dif_logistic.py ...`
5. Add DIF results into your norm pack under `fairness` before loading it in the app.

## Testing
- `npm test` runs determinism, norm-pack validation, and CAT smoke tests (uses `tests/run.mjs` and fixtures).

## Ethical note
Online self-assessments are noisier than proctored instruments. Use results for self-tracking only; do not use them for gatekeeping decisions. Privacy: all data stays in the browser unless you export it.
