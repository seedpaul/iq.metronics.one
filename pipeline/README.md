# Norming & Fairness Pipeline (Optional)

The app works out of the box with a bundled baseline norm model. Use this pipeline only when you have **real, consented** runs and want a custom norm pack or fairness screening.

## Collect runs
- Host the app (GitHub Pages or local)
- Recruit participants ethically (informed consent)
- Have them download `assessment-run.json`
- Collect files securely

## Build a norm pack
```bash
python make_norm_pack.py --input ../collected_runs --out ../norm_pack.json
```
This writes theta→IQ mapping and optional age bands.

## DIF / fairness checks (screening)
Mantel–Haenszel DIF:
```bash
python dif_mh.py --input ../collected_runs --group group.sex --out dif_report_mh.csv
```

Logistic DIF (binary group):
```bash
python dif_logistic.py --input ../collected_runs --group group.nativeLanguage --out dif_report_lr.csv
```

Add DIF findings into your norm pack under `fairness` (e.g., `fairness.flaggedItems` or attach the CSV rows) so the app can display fairness summaries.

## Rough 2PL item calibration (starter)
```bash
python calibrate_2pl.py --input ../collected_runs --domain fluid --out item_params_fluid.json
```

## Notes
- A credible norm sample must be representative of your target population.
- The repo provides tooling only; do not fabricate samples or claim clinical validity.
