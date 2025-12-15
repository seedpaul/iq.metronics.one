# IQ-Omicron (Non-Clinical, Client-Side)

World-class engineering meets careful psychometrics for a **non-clinical, IQ-style** adaptive assessment. No servers, no tracking: everything runs in the browser. **Not WAIS / Stanford–Binet / clinical**; do not use for diagnosis or high-stakes decisions.

---

## What It Is
- Adaptive (CAT) multi-domain assessment using IRT (2PL/3PL) with SEM-based stopping and exposure controls.
- Clear results: IQ-style estimate + 95% CI + percentile for each domain and composite.
- Large synthetic item banks (fluid, verbal, quantitative, spatial, working memory, speed) from IQ-Delta.
- Psychometric core, research exports, integrity scaffolding from IQ-Gamma.
- Static, GitHub Pages–ready; all computation and storage stay local.

## Architecture
```
IQ-Omicron/
├── index.html, styles.css         # UI shell (static)
├── src/
│   ├── app.js                     # UI controller (single runtime path)
│   ├── plan.js                    # Mode builder (Standard/Quick) + item banks
│   ├── items/                     # IQ-Delta item generators (original content)
│   ├── core/
│   │   ├── index.js               # Unified API: runAssessment(config, io)
│   │   ├── data/buildItemBank.js  # Adapter: Delta items -> Gamma schema
│   │   ├── data/forms.json        # Forms/anchors (for research)
│   │   ├── norms.js               # Baseline/custom norm pack helpers
│   │   ├── engine/                # Gamma CAT/EAP/IRT/scoring/exposure
│   │   ├── render/                # Gamma renderers (items/blocks)
│   │   └── research/              # DIF, exports, integrity scaffolds
│   └── engine/                    # Legacy Delta engine (unused runtime)
└── pipeline/                      # Python tooling (unchanged from IQ-Delta)
    ├── calibrate_2pl.py
    ├── dif_logistic.py, dif_mh.py
    ├── make_norm_pack.py          # Builds norm packs from collected runs
    └── README.md
```

## Running
1) Open `index.html` locally or via any static server (GitHub Pages friendly).  
2) Accept the non-clinical notice, optionally set a seed for reproducibility, then choose Standard or Quick.  
3) Results show IQ-style scores + CI + percentiles; exports are local downloads (JSON/CSV).  
4) History stays in your browser; use “Reset local history” to clear.

## Items: How To Add/Adjust
- Edit `src/items/big_banks.js` (and related domain files) to add or tune generators. Keep content original; avoid copyrighted/proprietary material.  
- The adapter `src/core/data/buildItemBank.js` maps Delta items into the Gamma schema (domains → Gf/Gc/Gq/Gv/Gwm/Gs, families, model params). Keep stable IDs and clear domains/blueprints for CAT balancing.  
- After changes, rebuild banks by reloading the page; there is no build step.

## Norm Packs
- Baseline norms are bundled (`src/core/norms.js`) and always available.  
- To create a custom pack: run `pipeline/make_norm_pack.py --input <runs.jsonl> --out norm_pack.json`. The script derives `thetaToIQ` and age bands from collected runs (non-clinical, consented data only).  
- Load a custom norm pack in the UI (Intro → Norm packs). Packs are validated and persisted locally; “Clear” reverts to baseline. Fail-safe: if loading fails, baseline norms are used and the status message explains why.

## Research Mode
- Toggle in Intro → Research Mode. Persists locally; never sends data.  
- Unlocks additional exports: long CSV (per-item with parameters) and JSONL event log.  
- All research exports are client-side downloads; you control if/when data leaves the browser.

## Privacy & Ethics
- Client-side only; storage uses localStorage. No automatic uploads or analytics.  
- Non-clinical, self-tracking context. No claims of diagnostic validity.  
- Quality and fairness: exposure controls, SEM-based stopping, optional DIF tools/pipeline; norm packs validated before use.

## Testing/Verification
- Smoke test after changes: open `index.html`, run Quick mode, confirm no console errors, exports download (JSON, CSV, long CSV/JSONL in Research Mode), and norm pack load/clear works.  
- There is no automated test harness yet; manual verification is expected for changes.
