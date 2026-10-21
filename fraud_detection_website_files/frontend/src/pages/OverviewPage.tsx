import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Cpu,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { apiService, formatApiError } from '../services/api';
import type {
  HealthResponse,
  ModelInfoResponse,
  DriftMonitoringResponse,
  FeatureImportanceResponse,
} from '../types/api';
import type { TabId } from '../components/Sidebar';

interface OverviewPageProps {
  onNavigate: (tab: TabId) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const [, setHealth] = useState<HealthResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [drift, setDrift] = useState<DriftMonitoringResponse | null>(null);
  const [importance, setImportance] = useState<FeatureImportanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverviewData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, mRes, dRes, iRes] = await Promise.allSettled([
        apiService.getHealth(),
        apiService.getModelInfo(),
        apiService.getDriftMonitoring(),
        apiService.getFeatureImportance(),
      ]);

      if (hRes.status === 'fulfilled') setHealth(hRes.value);
      if (mRes.status === 'fulfilled') setModelInfo(mRes.value);
      if (dRes.status === 'fulfilled') setDrift(dRes.value);
      if (iRes.status === 'fulfilled') setImportance(iRes.value);

      if (hRes.status === 'rejected') {
        setError(formatApiError(hRes.reason));
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  // Top 5 features data for mini chart
  const topFeaturesData = (importance?.features || []).slice(0, 5).map((f) => ({
    name: f.feature,
    value: Number(f.mean_absolute_shap_contribution.toFixed(4)),
  }));

  // Model comparison data for chart
  const comparisonData = (modelInfo?.model_comparison || []).map((m) => ({
    name: m.model.includes('XGBoost') ? 'XGBoost Baseline' : 'Graph Prototype',
    prAuc: Number(m.validation_pr_auc.toFixed(4)),
    rocAuc: Number(m.validation_roc_auc.toFixed(4)),
    status: m.status,
  }));

  return (
    <div className="space-y-6">
      {/* Research Project Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 border border-navy-700/80 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-accent-cyan/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30">
            <span>Academic Major Project Demonstration</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
            An Explainable Dynamic Graph Learning Framework for Adaptive Financial Fraud Detection under Concept Drift
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            This dashboard integrates the verified 32-feature XGBoost baseline model artifact,
            TreeSHAP feature attributions, and historical Population Stability Index (PSI) analysis
            evaluated across sequential time blocks.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('fraud-detection')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-cyan text-navy-950 hover:bg-accent-cyan/90 transition-all shadow-glow-cyan"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Test Fraud Predictor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('batch-analysis')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-navy-800 text-slate-200 hover:bg-navy-700/80 border border-navy-600 transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Score Batch CSV</span>
            </button>
            <button
              onClick={fetchOverviewData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-navy-800/40 border border-navy-700 hover:bg-navy-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error alert if backend offline */}
      {error && (
        <div className="rounded-xl bg-accent-rose/10 border border-accent-rose/30 p-4 text-sm text-accent-rose flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Backend Connection Issue</p>
            <p className="text-xs text-slate-300">{error}</p>
          </div>
        </div>
      )}

      {/* Key Research Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Model */}
        <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase font-mono">Active Model</span>
            <Cpu className="w-4 h-4 text-accent-cyan" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            XGBoost Baseline
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-navy-800">
            <span>Validation PR-AUC:</span>
            <span className="font-mono text-accent-cyan font-semibold">
              {modelInfo?.sequential_adaptation_summary?.baseline_validation_pr_auc
                ? modelInfo.sequential_adaptation_summary.baseline_validation_pr_auc.toFixed(4)
                : '0.5529'}
            </span>
          </div>
        </div>

        {/* Card 2: Graph Prototype Comparison */}
        <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase font-mono">Graph Prototype</span>
            <Layers className="w-4 h-4 text-accent-purple" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            Multi-Entity Prototype
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-navy-800">
            <span>Validation PR-AUC:</span>
            <span className="font-mono text-slate-300">
              {modelInfo?.sequential_adaptation_summary?.graph_validation_pr_auc
                ? modelInfo.sequential_adaptation_summary.graph_validation_pr_auc.toFixed(4)
                : '0.3923'}
            </span>
          </div>
        </div>

        {/* Card 3: Sequential Adaptation Gain */}
        <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase font-mono">Adaptation Gain</span>
            <TrendingUp className="w-4 h-4 text-accent-emerald" />
          </div>
          <div className="text-xl font-bold text-accent-emerald font-mono tracking-tight">
            +
            {(
              (modelInfo?.sequential_adaptation_summary?.mean_sequential_adaptation_pr_auc_gain ?? 0.0762) *
              100
            ).toFixed(2)}
            %
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-navy-800">
            <span>Mean PR-AUC Gain:</span>
            <span className="font-mono text-slate-300">Blocks 1 &rarr; 5</span>
          </div>
        </div>

        {/* Card 4: Historical Stability */}
        <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase font-mono">Covariate Shift</span>
            <Activity className="w-4 h-4 text-accent-amber" />
          </div>
          <div className="text-xl font-bold text-white font-mono tracking-tight">
            Median PSI &lt; 0.025
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-navy-800">
            <span>Non-Temporal Drift:</span>
            <span className="text-accent-emerald font-medium">Stable</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Architecture Validation & Top SHAP Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Benchmark Comparison Chart */}
        <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Validation Benchmark Comparison</h3>
              <p className="text-xs text-slate-400">XGBoost Baseline vs. Graph Prototype on Validation Split</p>
            </div>
            <button
              onClick={() => onNavigate('model-evaluation')}
              className="text-xs text-accent-cyan hover:underline flex items-center gap-1 font-medium"
            >
              <span>Full Details</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-60 w-full">
            {comparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis dataKey="prAuc" stroke="#64748b" fontSize={11} domain={[0, 1]} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0c1220',
                      border: '1px solid #1e2f4f',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="prAuc" name="PR-AUC" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rocAuc" name="ROC-AUC" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                Loading model benchmark metrics...
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-navy-950/80 border border-navy-800 text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-accent-cyan">Key Finding:</span> The tabular XGBoost baseline
            demonstrated higher precision-recall validation performance (0.5529 PR-AUC) than the learned
            multi-entity aggregation prototype (0.3923 PR-AUC). The deployed inference endpoint serves the verified
            XGBoost model.
          </div>
        </div>

        {/* Top 5 SHAP Contributing Features */}
        <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Top Influential Features (TreeSHAP)</h3>
              <p className="text-xs text-slate-400">Mean absolute attribution values across historical records</p>
            </div>
            <button
              onClick={() => onNavigate('explainability')}
              className="text-xs text-accent-cyan hover:underline flex items-center gap-1 font-medium"
            >
              <span>View All 32</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-60 w-full">
            {topFeaturesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topFeaturesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0c1220',
                      border: '1px solid #1e2f4f',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value" name="Mean |SHAP|" radius={[0, 4, 4, 0]}>
                    {topFeaturesData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? '#f43f5e' : index === 1 ? '#f59e0b' : '#38bdf8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                Loading feature importance...
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-navy-950/80 border border-navy-800 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Interpretability Note:</span> Features{' '}
            <code className="text-accent-cyan font-mono">C5</code>,{' '}
            <code className="text-accent-cyan font-mono">C13</code>, and{' '}
            <code className="text-accent-cyan font-mono">TransactionAmt</code> hold the largest decision weight.
            TreeSHAP describes tree split attributions, not real-world causal fraud mechanisms.
          </div>
        </div>
      </div>

      {/* Historical Sequential Drift & Adaptation Summary */}
      <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold text-white">Sequential Adaptation Under Temporal Drift</h3>
            <p className="text-xs text-slate-400">
              Model performance evaluated across 5 chronological blocks (Fixed Model vs. Adaptive Retrained Model)
            </p>
          </div>
          <button
            onClick={() => onNavigate('concept-drift')}
            className="text-xs text-accent-cyan hover:underline flex items-center gap-1 font-medium"
          >
            <span>PSI Drift Analysis</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-navy-700 text-slate-400 font-mono uppercase bg-navy-950/60">
                <th className="py-2.5 px-3">Evaluation Block</th>
                <th className="py-2.5 px-3">Transactions</th>
                <th className="py-2.5 px-3">Fixed PR-AUC</th>
                <th className="py-2.5 px-3">Adaptive PR-AUC</th>
                <th className="py-2.5 px-3">Net Gain</th>
                <th className="py-2.5 px-3">Covariate Shift (Excl. Time)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 font-mono">
              {(modelInfo?.adaptive_block_results || []).map((row, idx) => {
                const driftBlock = drift?.psi_summary_excluding_time[idx];
                return (
                  <tr key={row.block} className="hover:bg-navy-850/50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-300 font-semibold">Block {row.block}</td>
                    <td className="py-2.5 px-3 text-slate-400">{row.transactions.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-300">{row.fixed_pr_auc.toFixed(4)}</td>
                    <td className="py-2.5 px-3 text-accent-cyan font-semibold">{row.adaptive_pr_auc.toFixed(4)}</td>
                    <td className="py-2.5 px-3 text-accent-emerald font-semibold">
                      +{((row.pr_auc_gain ?? 0) * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      Median PSI: {driftBlock ? driftBlock.median_psi.toFixed(4) : '0.0137'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-slate-400 bg-navy-950/80 p-3 rounded-lg border border-navy-800">
          <span className="font-semibold text-slate-300">Sequential Protocol Notice:</span> Earlier block labels were
          used exclusively to retrain the adaptive model for later blocks. This represents an offline sequential
          adaptation experiment rather than a live streaming detection pipeline.
        </div>
      </div>
    </div>
  );
};
