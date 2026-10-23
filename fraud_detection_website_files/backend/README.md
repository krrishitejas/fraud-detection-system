# Explainable Adaptive Financial Fraud Detection API

FastAPI backend for the academic major project:  
**“An Explainable Dynamic Graph Learning Framework for Adaptive Financial Fraud Detection under Concept Drift”**

---

## 1. Overview & Architecture

This backend serves the verified **32-feature XGBoost baseline model** trained during Google Colab experiments, together with native **TreeSHAP explainability** and historical **Population Stability Index (PSI)** concept drift monitoring data.

### Key Highlights
- **Framework**: FastAPI (async ASGI) running on Uvicorn.
- **Model Engine**: XGBoost (`xgboost.XGBClassifier` and `xgboost.Booster`) with CPU inference.
- **Explainability**: Global SHAP importance rankings + per-transaction local TreeSHAP attribution.
- **Preprocessing Pipeline**: Dedicated validation, median-based missing value imputation, and z-score standardization derived strictly from the training dataset.
- **Interactive Web Interface**: Embedded dashboard served directly at `http://localhost:8000/` featuring single prediction, CSV batch upload, SHAP charts, drift tables, and Swagger documentation at `/docs`.

### Two generations of endpoint, and why both exist

`POST /api/predict` and its batch and CSV siblings take a prepared 32-number feature
vector and answer with a label. They are what the dashboard's batch pages use and they
are unchanged.

`POST /api/model/predict` is the **Week 4 interface contract**, implemented after the
Week 8 review tabulated eight places where this service and that contract disagreed:
the path, the payload shape, where encoding happens, whether calibration is applied,
whether the cutoff is a record or a constant, whether versions are returned, whether a
version mismatch is detectable, and whether anything is stored. The review recommended
changing the service rather than the contract, and that is what the newer endpoint is.

| | Older `POST /api/predict` | `POST /api/model/predict` |
|---|---|---|
| Takes | 32 prepared numbers | a payment, with text categories |
| Encoding | the caller's problem | done on the server, from the bundle |
| Calibration | none | Platt, fitted on the first half of validation |
| Cutoff | constant in `config.py` | a record, with its model, scale, costs and approver |
| Versions in the response | model identifier only | model **and** preprocessing |
| Version mismatch | undetectable | `409`, never a best-effort score |
| Rules | not run | run beside the model |
| Afterwards | nothing stored | the decision is written down |
| Outcomes | fraud / legitimate | FRAUD / REVIEW / LEGITIMATE |

### The serving bundle

The newer endpoint reads its decision policy from `../serving/serving_config.json`
rather than from constants in `config.py`. That file is generated from the real dataset
by `WEEK 8/scripts/build_serving_bundle.py` and holds the model version, the
preprocessing version, the Platt coefficients, the threshold with the cost assumption
and split it was chosen on, the cost sweep from 1x to 50x, and the measured rule table.

This is not ceremony. The cutoff for the model this service ran before the current one
sat near **0.50**; for the current one it is an order of magnitude lower, because the
old model weighted the fraud class up by 27.41 and that inflates every score. Had the
value stayed a constant in the code, swapping the model in would have cut recall from
0.63 to 0.33 and let roughly 930 more frauds through out of 88,081 — with nothing
crashing, no test failing and nothing logged. **A cutoff belongs to one trained model
and to the score scale it was chosen on**, so it is stored with both.

Without the bundle the service still starts: the older endpoints work as before and the
contract endpoint answers `503 NO_ACTIVE_MODEL` until the bundle is generated.

---

## 2. Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── explainability.py      # GET /api/explainability/feature-importance, POST /api/explainability/local
│   │   │   ├── health.py              # GET /api/health
│   │   │   ├── model_info.py          # GET /api/model/info
│   │   │   ├── monitoring.py          # GET /api/monitoring/drift
│   │   │   ├── model_predict.py       # POST /api/model/predict and the governance reads
│   │   │   └── predict.py             # POST /api/predict, POST /api/predict/batch, POST /api/predict/csv
│   │   └── __init__.py
│   ├── core/
│   │   ├── config.py                  # Pydantic Settings & path resolver
│   │   └── __init__.py
│   ├── schemas/
│   │   ├── contract.py                # Week 4 contract request & response shapes
│   │   ├── prediction.py              # Pydantic request & response schemas
│   │   └── __init__.py
│   ├── services/
│   │   ├── codec_service.py           # Raw payment -> prepared row, encoding on the server
│   │   ├── drift_service.py           # Historical PSI summaries (with & without time)
│   │   ├── explainability_service.py  # Global TreeSHAP feature ranking
│   │   ├── model_service.py           # Singleton XGBoost loader & TreeSHAP runner
│   │   ├── preprocessing_service.py   # Validation, median imputation, standardization
│   │   ├── registry_service.py        # The serving bundle: model, calibration, cutoff, rules
│   │   ├── research_service.py        # Model comparisons & sequential adaptation results
│   │   ├── rules_service.py           # The rule engine that runs beside the model
│   │   ├── store_service.py           # prediction and audit_event tables (SQLite)
│   │   └── __init__.py
│   ├── static/
│   │   └── index.html                 # Complete interactive research web interface
│   ├── utils/
│   │   ├── logging_config.py          # Structured logging
│   │   └── __init__.py
│   ├── __init__.py
│   └── main.py                        # Application entry point & lifespan manager
├── tests/
│   ├── test_api.py                    # the older endpoints
│   └── test_contract.py               # the Week 4 contract, rule by rule
│   ├── __init__.py
│   └── test_api.py                    # 15 automated pytest tests
├── .env.example                       # Environment variables template
├── .gitignore
├── requirements.txt                   # Production dependencies
└── README.md                          # Documentation
```

---

## 3. Quickstart & Installation (Windows PowerShell)

Open PowerShell and navigate to the backend directory:

```powershell
cd "C:\Users\Shiva\Desktop\major project\fraud_detection_website_files\backend"
```

### Step 1: Create a Python Virtual Environment
```powershell
python -m venv .venv
```

### Step 2: Activate the Virtual Environment
```powershell
.\.venv\Scripts\Activate.ps1
```
*(If script execution is disabled, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first).*

### Step 3: Install Dependencies
```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
Copy the example configuration:
```powershell
Copy-Item .env.example .env
```

### Step 5: Start the FastAPI Server
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 4. Accessing the Application

Once started, open your browser to:
- **Interactive Research Dashboard**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Interactive Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 5. Running Automated Tests

To run the complete test suite (15 unit and integration tests):
```powershell
pytest tests/ -v
```

All 15 tests validate model loading, feature ordering, median imputation, unmapped categorical rejection, batch prediction, CSV uploads, TreeSHAP explainability, and drift monitoring.

---

## 6. API Endpoints Reference

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Returns server status, whether the XGBoost model is loaded, tree count, and best iteration.
- **Example Response**:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_type": "XGBoost Binary Classifier (gbtree)",
  "expected_features": 32,
  "boosting_rounds": 2038,
  "best_iteration": 1937,
  "initialization_error": null
}
```

### 2. Single Transaction Prediction
- **Endpoint**: `POST /api/predict`
- **Request Body**:
```json
{
  "features": {
    "TransactionDT": 4758851.0,
    "TransactionAmt": 68.95,
    "ProductCD": 4.0,
    "card1": 9633.0,
    "card2": 361.0,
    "card3": 150.0,
    "card4": 3.0,
    "card5": 226.0,
    "card6": 2.0,
    "addr1": 299.0,
    "addr2": 87.0,
    "dist1": 9.0,
    "dist2": 36.0,
    "P_emaildomain": 16.0,
    "R_emaildomain": -1.0,
    "C1": 1.0, "C2": 1.0, "C3": 0.0, "C4": 0.0, "C5": 0.0,
    "C6": 1.0, "C7": 0.0, "C8": 0.0, "C9": 1.0, "C10": 0.0,
    "C11": 1.0, "C12": 0.0, "C13": 2.0, "C14": 1.0,
    "D1": 0.0, "D2": 97.0, "D3": 8.0
  },
  "include_explanation": true
}
```
- **Response**:
```json
{
  "prediction": "legitimate",
  "is_fraud": false,
  "fraud_probability": 0.2351,
  "legitimate_probability": 0.7649,
  "risk_category": "medium",
  "decision_threshold": 0.5,
  "model_identifier": "XGBoost_Baseline_32f_best_iter_1937",
  "status": "success",
  "local_explanations": [
    {
      "feature": "C1",
      "shap_value": -0.3404,
      "abs_contribution": 0.3404,
      "direction": "decreases_risk"
    },
    {
      "feature": "C5",
      "shap_value": 0.2199,
      "abs_contribution": 0.2199,
      "direction": "increases_risk"
    }
  ]
}
```

### 3. Batch Prediction
- **Endpoint**: `POST /api/predict/batch`
- **Request Body**:
```json
{
  "transactions": [
    { "TransactionAmt": 150.0, "C5": 1.0 },
    { "TransactionAmt": 45.00, "C5": 0.0 }
  ],
  "include_explanations": false
}
```

### 4. CSV File Upload Prediction
- **Endpoint**: `POST /api/predict/csv`
- **Parameters**:
  - `file`: CSV file containing all 32 required feature headers.
  - `as_csv`: Optional boolean query parameter. When `true`, returns a downloadable annotated CSV with predictions appended.
- **PowerShell curl example**:
```powershell
curl.exe -F "file=@../sample_prediction_input.csv" "http://127.0.0.1:8000/api/predict/csv"
```

### 5. Explainability (Global TreeSHAP)
- **Endpoint**: `GET /api/explainability/feature-importance`
- Returns ranking of all 32 features ordered by mean absolute SHAP contribution.

### 6. Drift Monitoring
- **Endpoint**: `GET /api/monitoring/drift`
- Returns 5-block PSI summaries across all features vs. excluding temporal feature `TransactionDT`.

### 7. Model Information & Research Comparison
- **Endpoint**: `GET /api/model/info`
- Returns model comparison (XGBoost baseline vs Graph prototype), sequential adaptation gains (+7.6% mean PR-AUC gain), and documented research limitations.

---

## 7. Preprocessing & Input Schema Requirements

The model requires exactly 32 features:
`TransactionDT`, `TransactionAmt`, `ProductCD`, `card1`, `card2`, `card3`, `card4`, `card5`, `card6`, `addr1`, `addr2`, `dist1`, `dist2`, `P_emaildomain`, `R_emaildomain`, `C1`, `C2`, `C3`, `C4`, `C5`, `C6`, `C7`, `C8`, `C9`, `C10`, `C11`, `C12`, `C13`, `C14`, `D1`, `D2`, `D3`.

### Critical Compatibility Notice
- The training artifacts (`feature_preprocessing.npz`) contain numeric statistics: **medians**, **means**, and **stds** for all 32 features.
- Categorical features (`ProductCD`, `card4`, `card6`, `P_emaildomain`, `R_emaildomain`) were encoded into numeric values during training.
- Because string-to-integer category mappings were not saved in the Colab export, **raw non-numeric strings (such as "W" or "gmail.com") will be rejected with an informative 422 error**. Inputs must be numeric (pre-encoded).
- Missing numeric values are safely imputed using training set medians before z-score scaling:  
  `z = (x - mean) / std`

---

## 8. Research Integrity & Disclaimers

1. **Model Classification**: The deployed inference model is a 32-feature tabular **XGBoost Classifier**, not a Dynamic Graph Neural Network.
2. **Model Performance**: In validation experiments, the tabular XGBoost baseline achieved higher PR-AUC (`0.5529`) than the learned multi-entity graph prototype (`0.3923`).
3. **Concept Drift**: PSI measures covariate feature distribution shifts (`P(X)`). Covariate shift alone does not constitute concept drift (`P(Y|X)`).
4. **Explainability**: TreeSHAP values represent tree-split model feature attribution, not real-world causal mechanisms.
5. **Operational Use**: The risk categories (`low`, `medium`, `high`) are presentation labels. Decision thresholds must be validated against business loss tolerance before any real-world production deployment.
