# iq.metronics.one (non-clinical, client-side)

**What this is**  
Non-clinical, browser-only adaptive cognitive assessment. Uses original item generators, IRT (2PL/3PL), CAT routing, SEM-based stopping, and optional research exports. No servers, no tracking; everything runs locally. **Not WAIS / Stanford–Binet. Not clinical or diagnostic.**

**What ships here**
- Static web app: `index.html`, `styles.css`, `src/app.js`, `src/plan.js`
- Item generators from the Delta banks: `src/items/*` (original content)
- Unified psychometric core from Gamma: `src/core/*` (IRT/CAT/scoring, renderers, research tools)
- Norm support: built-in baseline norms + optional custom norm packs (`src/core/norms.js`)
- Research Mode: long CSV and JSONL exports (client-side downloads only)
- Python pipeline (unchanged from Delta): calibration, DIF, norm-pack builder (`pipeline/`)

**How to run**
1) Open `index.html` locally or via any static host (GitHub Pages friendly).  
2) Accept the non-clinical notice; choose Standard or Quick; optional seed for reproducibility.  
3) Results show IQ-style estimate + 95% CI + percentile; downloads are local JSON/CSV (plus research exports when enabled).  
4) History and custom norms live in `localStorage`; use “Reset”/“Clear norm pack” in the UI to remove them.

**Norm packs**
- Baseline norms are always available.  
- Build a custom pack with `pipeline/make_norm_pack.py --input <runs.jsonl> --out norm_pack.json`; load it via the Norm packs section. Invalid packs fall back to baseline with a message. No upload occurs; files stay local.

**Research Mode**
- Toggle in the Intro screen. Unlocks long CSV + JSONL event exports. Data is never sent anywhere automatically; downloads are user-initiated only.  
- Fairness/DIF scripts live in `pipeline/` and `src/core/research/*` for offline analysis.

**Safety & ethics**
- Original items only; avoid any proprietary/clinical content.  
- Non-clinical use; no diagnostic claims.  
- Client-side privacy by default; no analytics or network calls.

**Repo map**
```
index.html, styles.css          # UI shell
src/
  app.js                        # UI controller (single execution path)
  plan.js                       # Standard/Quick plans and bank assembly
  items/                        # Delta item generators (content source)
  core/                         # Gamma psychometric core + renderers + research
    index.js                    # runAssessment(config, io)
    norms.js                    # baseline/custom norm handling
pipeline/                       # Python calibration/norm/DIF tools (unchanged)
```

**Quick checks after changes**
- Open `index.html`, run Quick mode, confirm no console errors.  
- Verify downloads (JSON, CSV; long CSV/JSONL in Research Mode).  
- Load/clear a norm pack; ensure status updates and baseline fallback works.  
- Run `node scripts/validate-assessment.mjs` to verify `full`, `quick`, and `smoke` plans still build valid section banks, normalize sampled items, and complete a simulated end-to-end assessment run.  
- Keep branding as `iq.metronics.one` in titles/README/UI chips.

**QA lab**
- The Advanced panel includes a local QA lab gate for manual section review.  
- The lab uses the chosen seed to sample items deterministically from the full section bank, and it exposes item metadata plus aggregate accuracy/RT stats for fast QA passes.  
