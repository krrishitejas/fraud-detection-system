# Explainable Adaptive Fraud Detection

A fraud detection service for card payments, built on the IEEE-CIS Fraud Detection
dataset. A trained XGBoost model is served behind a FastAPI backend with a React
front end, with per-payment TreeSHAP explanations, drift monitoring and the results
of the research experiments behind it.

B.Tech Artificial Intelligence and Machine Learning major project.
Rishi Tejas K R and Shiva U, REVA University.

---

## What it does

| | |
|---|---|
| Model | XGBoost, 1,257 trees, scored at the early-stopping round 1,106 |
| Features | 32 columns present for every payment |
| Explanations | TreeSHAP, per payment and globally |
| Front end | React with Vite, served by the same process |
| Tests | 15, covering health, preparation, scoring, upload and failure cases |

### Measured performance

On the validation window the model reaches PR-AUC 0.582377 and ROC-AUC 0.915667.
On the 88,081 held-out payments that come after everything the model was trained on,
scored raw at the configured cutoff of 0.065, which is exactly what the service does:

| | |
|---|---:|
| PR-AUC | 0.510865 |
| ROC-AUC | 0.897739 |
| Brier | 0.022872 |
| Precision | 0.3079 |
| Recall | 0.6307 |
| Alert rate | 7.13% |
| Caught / missed | 1,933 / 1,132 |

A no-skill model would score 0.035 PR-AUC, which is the fraud rate in the data.

The model that preceded this one scored 0.4804 PR-AUC on the same blocks. It weighted
the fraud class by `scale_pos_weight = 27.41`, the full ratio of genuine to fraud,
which is the standard recipe. Removing that weighting was chosen by comparing five
strategies over three seeds each, and it is worth 0.0305 of PR-AUC and 350 more frauds
caught. `WEEK 8/experiments/` holds the comparison. Our own harness reproduces the
previous model's recorded figures to every decimal place held, 0.5528777416 and
0.9112439749, which is what made that comparison trustworthy.

---

## Running it

The model artefacts are in the repository, so no training is needed.

```bash
cd fraud_detection_website_files
pip install -r backend/requirements.txt
python run_backend.py
```

Then open <http://127.0.0.1:8000>. Interactive API docs are at `/docs`.

### Tests

```bash
cd fraud_detection_website_files/backend
python -m pytest tests/test_api.py -v
```

### Rebuilding the front end

```bash
cd fraud_detection_website_files/frontend
npm install
npm run build
```

---

## API

| Endpoint | Purpose |
|---|---|
| `POST /api/predict` | one payment, with TreeSHAP contributions if requested |
| `POST /api/predict/batch` | up to 1,000 payments at a time |
| `POST /api/predict/csv` | upload a CSV, score it, download the result |
| `GET /api/health` | model loaded, tree count, best iteration |
| `GET /api/model/info` | benchmark comparison and adaptation results |
| `GET /api/explainability/feature-importance` | global ranking over all 32 features |
| `GET /api/monitoring/drift` | PSI summaries across five time blocks |

Features must arrive already encoded as numbers. `sample_prediction_input.csv` is a
ready-to-use five-row example, and `GET /api/model/sample-transaction` returns a valid
payload.

---

## What the research found

**Retraining helps, and the usual drift detector cannot tell you when.** Across five
sequential time blocks, retraining before each block gained on average **+0.076 PR-AUC**
over a fixed model, reaching **+0.136** on the final block. The fraud rate climbs from
3.00% to 4.22% across the same window.

Yet once `TransactionDT` is excluded — the blocks are defined by time, so the clock
shifting is guaranteed and meaningless — **no feature in any block crosses the usual
0.25 PSI line, and mean PSI is 0.018.** The inputs were stable. What moved was the
relationship between the inputs and fraud, which PSI cannot see because it never looks
at the label. A retraining loop triggered by PSI would never have fired.

**A graph prototype did not help.** A learned multi-entity aggregation scored 0.3923
PR-AUC against the then-current plain model's 0.5529 on validation. It summarises
history rather than learning the
structure of the payment network. Reported because a hidden negative result is worse
than none.

---

## Honest limits

- The decision threshold is a fixed `0.065` in `core/config.py`. It is the cheapest
  cutoff on the validation window at an assumed 10:1 cost of a miss against a false
  alarm, and that ratio is our assumption, not a published figure. It is wrong either
  side of that assumption, and it belongs with the model rather than in the code: the
  previous model's correct cutoff was near 0.50, and carrying that value over to this
  model would have cut recall from 0.63 to 0.33 without anything failing.
- No calibration layer. The service returns the model's own output. The cutoff was
  therefore re-validated on that raw scale. Dropping the class weight brought Brier
  from 0.0417 to 0.0230 by itself, so an added calibration step now buys almost
  nothing, which is why its absence is no longer the gap it was.
- Nothing is persisted. Predictions, an audit trail and a review queue are designed
  and not built.
- No authentication or rate limiting. This runs locally for demonstration.
- Leaving one of the five encoded text columns out of a request fills it with that
  column's median, which is the code for the commonest category rather than for
  absent. Training coded absence as `-1`. Known, and not yet fixed.
- `TransactionDT` ranks 10th by SHAP and rises with row order, so the model may be
  learning position rather than behaviour. Removing the class weight moved it down
  from 7th and cut its share of the model from 5.4% to 3.8%, which is an improvement
  and not a fix. The column should be dropped and the model retrained.

---

## Data

The IEEE-CIS Fraud Detection dataset is **not** in this repository. It is 677 MB and
the competition licence does not allow redistribution. Download it from
[Kaggle](https://www.kaggle.com/competitions/ieee-fraud-detection/data).

The trained model and the fitted preprocessing statistics **are** included, so the
service runs without it.
