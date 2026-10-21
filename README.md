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
| Model | XGBoost, 2,038 trees, scored at the early-stopping round 1,937 |
| Features | 32 columns present for every payment |
| Explanations | TreeSHAP, per payment and globally |
| Front end | React with Vite, served by the same process |
| Tests | 15, covering health, preparation, scoring, upload and failure cases |

### Measured performance

Reproducing the training run from the raw data gives the recorded figures exactly:

```
validation PR-AUC   0.5528777416
validation ROC-AUC  0.9112439749
```

On the 88,081 held-out payments that come after everything the model was trained on:

| | |
|---|---:|
| PR-AUC | 0.4804 |
| ROC-AUC | 0.8913 |
| Precision | 0.3095 |
| Recall | 0.5873 |
| Alert rate | 6.60% |

A no-skill model would score 0.035 PR-AUC, which is the fraud rate in the data.

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
PR-AUC against the plain model's 0.5529. It summarises history rather than learning the
structure of the payment network. Reported because a hidden negative result is worse
than none.

---

## Honest limits

- The decision threshold is a fixed `0.50` in `core/config.py` and is labelled in the
  code as a presentation default, not a calibrated operating point. It happens to be
  near-optimal at a 10:1 cost ratio because the fraud class was weighted by 27.41
  during training, but it is wrong either side of that assumption.
- No calibration layer. The service returns the model's own output.
- Nothing is persisted. Predictions, an audit trail and a review queue are designed
  and not built.
- No authentication or rate limiting. This runs locally for demonstration.
- Leaving one of the five encoded text columns out of a request fills it with that
  column's median, which is the code for the commonest category rather than for
  absent. Training coded absence as `-1`. Known, and not yet fixed.
- `TransactionDT` ranks 6th by SHAP and rises with row order, so the model may be
  learning position rather than behaviour. It should be dropped and the model
  retrained.

---

## Data

The IEEE-CIS Fraud Detection dataset is **not** in this repository. It is 677 MB and
the competition licence does not allow redistribution. Download it from
[Kaggle](https://www.kaggle.com/competitions/ieee-fraud-detection/data).

The trained model and the fitted preprocessing statistics **are** included, so the
service runs without it.
