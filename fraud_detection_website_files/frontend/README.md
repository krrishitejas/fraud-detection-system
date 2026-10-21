# Adaptive Financial Fraud Detection — Frontend Dashboard

A modern, responsive React + Vite + TypeScript financial security and AI analytics dashboard for the academic major project:  
**“An Explainable Dynamic Graph Learning Framework for Adaptive Financial Fraud Detection under Concept Drift”**

---

## 1. Technologies & Architecture

- **Core Framework**: React 19 + TypeScript (ES2023)
- **Bundler & Tooling**: Vite 8 (Rolldown engine)
- **Styling**: Tailwind CSS (custom dark fintech theme: navy background, cyan/emerald/rose accents)
- **Charts & Visualization**: Recharts (bar charts, line charts, tooltips, responsive containers)
- **Iconography**: Lucide React
- **API Client**: Axios with centralized error formatting and type-safe endpoints

---

## 2. Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header.tsx              # Sticky header with active model, status indicator, and Swagger link
│   │   └── Sidebar.tsx             # Responsive sidebar with navigation, brand mark, and API badge
│   ├── pages/
│   │   ├── OverviewPage.tsx        # System health, PR-AUC & ROC-AUC benchmarks, top features preview
│   │   ├── FraudDetectionPage.tsx  # 32-feature single transaction inference with TreeSHAP waterfall
│   │   ├── BatchAnalysisPage.tsx   # Drag-and-drop CSV upload, batch scoring, and downloadable CSV
│   │   ├── ExplainabilityPage.tsx  # Global TreeSHAP horizontal bar chart & all 32 feature rankings
│   │   ├── ConceptDriftPage.tsx    # 5-block PSI drift table & chart (All Features vs. Excl. Time)
│   │   ├── ModelEvaluationPage.tsx # XGBoost vs. Graph Prototype comparison & sequential adaptation (+7.6%)
│   │   └── AboutResearchPage.tsx   # Comprehensive academic thesis documentation & roadmap
│   ├── services/
│   │   └── api.ts                  # Centralized Axios client connecting to FastAPI /api endpoints
│   ├── types/
│   │   └── api.ts                  # Strong TypeScript interfaces matching FastAPI Pydantic schemas
│   ├── App.tsx                     # Main layout & state container
│   ├── index.css                   # Tailwind directives & custom dark scrollbar styles
│   └── main.tsx                    # React DOM entry point
├── dist/                           # Compiled production build
├── .env.example                    # Environment template
├── .env                            # Local configuration (VITE_API_URL)
├── index.html                      # HTML entry with Google Fonts (Inter, JetBrains Mono)
├── package.json                    # Dependencies & scripts
├── postcss.config.js               # PostCSS config
├── tailwind.config.js              # Tailwind custom theme configuration
├── tsconfig.app.json               # TypeScript compiler options
├── vite.config.ts                  # Vite config with /api proxy to http://127.0.0.1:8000
└── README.md
```

---

## 3. Quickstart & Installation (Windows PowerShell)

Open PowerShell and navigate to the `frontend` directory:

```powershell
cd "C:\Users\Shiva\Desktop\major project\fraud_detection_website_files\frontend"
```

### Step 1: Install Dependencies
```powershell
npm.cmd install --legacy-peer-deps
```

### Step 2: Configure Environment Variables
Copy the environment template:
```powershell
Copy-Item .env.example .env
```
Ensure `VITE_API_URL` is set to your FastAPI backend:
```env
VITE_API_URL=http://127.0.0.1:8000/api
```

### Step 3: Run the Development Server
```powershell
npm.cmd run dev
```
Open your browser at: **[http://localhost:5173/](http://localhost:5173/)**

### Step 4: Build for Production
```powershell
npm.cmd run build
```
The optimized bundle is generated in `frontend/dist/`.

---

## 4. Integration with FastAPI Backend

The frontend connects directly to the following endpoints implemented in `backend/app/main.py`:

| Endpoint | Method | Purpose in Frontend |
|---|---|---|
| `/api/health` | GET | Live API status badge and model readiness verification |
| `/api/model/info` | GET | Benchmark metrics (XGBoost vs. Graph), sequential adaptation results, and limitations |
| `/api/model/sample-transaction` | GET | Populates verified median baseline feature values into the prediction form |
| `/api/predict` | POST | Scores single transaction and generates local TreeSHAP attributions |
| `/api/predict/batch` | POST | JSON batch scoring |
| `/api/predict/csv` | POST | Drag-and-drop CSV upload with optional `?as_csv=true` downloadable export |
| `/api/explainability/feature-importance` | GET | Ranks all 32 features by mean absolute SHAP contribution |
| `/api/monitoring/drift` | GET | 5-block PSI drift statistics (All Features vs. Excl. Time) |

---

## 5. Key Research Boundaries

1. **Pre-Encoded Numeric Features**: The inference model requires 32 numeric attributes. Raw strings (e.g. `"W"`, `"gmail.com"`) are rejected with informative guidance because string-to-integer mappings were not serialized in the original Colab export.
2. **Tabular XGBoost Superiority**: Validation experiments demonstrate that the tabular XGBoost baseline achieved higher PR-AUC (`0.5529`) than the learned multi-entity graph prototype (`0.3923`). Hence, XGBoost is deployed as the active inference engine.
3. **Attribution vs. Causation**: TreeSHAP values illustrate model decision weights, not real-world criminal causation.
4. **Offline Evaluation vs. Live Detection**: Historical PSI and adaptation figures represent offline Colab blocks 1–5, not live streaming drift detectors.
