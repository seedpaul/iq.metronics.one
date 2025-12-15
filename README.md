# IQ-Omicron  
**A research-grade, open, psychometric assessment engine for adaptive cognitive measurement**

---

## Overview

**IQ-Omicron** is an open, modular, research-oriented cognitive assessment engine designed around modern psychometric principles. It provides a transparent, extensible framework for building, simulating, and analyzing adaptive tests using Item Response Theory (IRT), computerized adaptive testing (CAT), norming pipelines, and fairness analysis scaffolding.

The project is intentionally **method-forward rather than product-forward**. IQ-Omicron is not a consumer test and does not attempt to replicate or replace proprietary intelligence scales. Instead, it offers a clean, inspectable implementation suitable for:

- Psychometric research and experimentation  
- Educational measurement and assessment prototyping  
- Developers building adaptive testing systems  
- Methodological learning and validation exercises  

Core design goals include **separation of concerns**, **reproducibility**, and **auditability** of measurement logic.

---

## Core Features

- Item Response Theory–based scoring (2PL-centric with extensible hooks)
- Computerized Adaptive Testing (CAT) engine
- Modular, domain-specific item banks (verbal, quantitative, spatial, working memory, etc.)
- Bayesian ability (θ) estimation pipelines (EAP-style estimation)
- Deterministic and stochastic adaptive routing
- Item exposure tracking and control scaffolding
- Norming and score transformation infrastructure
- Differential Item Functioning (DIF) analysis hooks
- Clear separation between measurement engine and UI/rendering
- Research-grade data export and reproducibility focus

---

## Repository Structure

```
IQ-Omicron/
│
├── engine/              # Core psychometric logic
│   ├── cat.js           # Adaptive routing and item selection
│   ├── irt.js           # IRT model utilities
│   ├── eap.js           # Ability estimation
│   ├── norms.js         # Norm score transformations
│   ├── exposure.js      # Item exposure tracking
│   ├── scoring.js       # Raw and scaled scoring
│   └── utils.js         # Shared engine utilities
│
├── items/               # Item banks by cognitive domain
│   ├── verbal.js
│   ├── quant.js
│   ├── spatial.js
│   ├── working_memory.js
│   └── common.js
│
├── data/                # Static data and configuration
│   ├── itembank.json
│   └── forms.json
│
├── research/            # Calibration & analysis scripts
│   ├── calibrate_2pl.py
│   ├── dif_logistic.py
│   ├── dif_mh.py
│   ├── make_norm_pack.py
│   └── utils_io.py
│
├── render/              # Presentation layer
│   ├── itemRenderer.js
│   └── symbols.js
│
├── app.js               # Application entry point
├── index.html           # Demo UI shell
├── styles.css           # UI styling
└── README.md
```

---

## Psychometric Architecture

IQ-Omicron follows a **measurement-first architecture**.

### Item Parameterization

Items are parameterized using standard IRT notation:

- **a**: discrimination  
- **b**: difficulty  
- *(optional)* **c**: guessing  

### Ability Estimation

Ability (θ) is estimated using Bayesian expected-a-posteriori (EAP) style estimation:

\[
\hat{\theta}_{EAP} = \int \theta \, p(\theta \mid \mathbf{u}) \, d\theta
\]

### Adaptive Routing

Item selection balances:
- Maximum information at current θ
- Exposure constraints
- Domain coverage requirements

### Stopping Criteria

Stopping rules may include:
- Standard error thresholds
- Item count limits
- Domain completion rules

---

## Norming & Calibration Pipeline

IQ-Omicron is designed to integrate with external statistical tooling.

- 2PL calibration scripts
- Norm pack generation
- Anchor and equating readiness
- Export compatibility with R (`mirt`, `TAM`) and Python workflows

---

## DIF & Fairness

- Mantel–Haenszel DIF detection
- Logistic regression DIF analysis
- Group-based response comparisons

Fairness is treated as a measurement property, not a UI feature.

---

## Installation & Usage

Open `index.html` in a modern browser.  
Python scripts can be executed directly for calibration and analysis.

---

## Extensibility

IQ-Omicron is designed to be extended rather than forked.

- Add new item banks
- Swap θ estimators
- Modify CAT logic
- Export data for external modeling

---

## Scientific & Legal Disclaimer

**IQ-Omicron is not a clinical or diagnostic instrument.**

It is intended strictly for **research and educational use**.

---

## Roadmap

- Multi-form equating
- Expanded norming workflows
- Bayesian priors
- Longitudinal measurement
- Secure administration hooks

---

## License & Attribution

Authored by **Paul Seed**.

IQ-Omicron draws from the open psychometric tradition including IRT, CAT, Rasch, and Bayesian measurement frameworks.
