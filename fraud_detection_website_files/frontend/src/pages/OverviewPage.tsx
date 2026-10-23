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
} from 'recharts';
import { apiService, formatApiError } from '../services/api';
import type {
  HealthResponse,
  ModelInfoResponse,
  DriftMonitoringResponse,
  FeatureImportanceResponse,
} from '../types/api';
import type { TabId } from '../components/Sidebar';
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle } from '../theme/charts';

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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-surface-card via-surface-sunken to-surface-card border border-line-strong p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-brand-600/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-brand-600/10 text-brand-600 border border-brand-600/30">
            <span>Academic Major Project Demonstration</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight leading-snug">
            An Explainable Dynamic Graph Learning Framework for Adaptive Financial Fraud Detection under Concept Drift
          </h2>
          <p className="text-sm text-ink-700 leading-relaxed">
            This dashboard integrates the verified 32-feature XGBoost baseline model artifact,
            TreeSHAP feature attributions, and historical Population Stability Index (PSI) analysis
            evaluated across sequential time blocks.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('fraud-detection')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-600/90 transition-all shadow-card"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Test Fraud Predictor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('batch-analysis')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-surface-hover text-ink-800 hover:bg-surface-active/80 border border-line-strong transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Score Batch CSV</span>
            </button>
            <button
              onClick={fetchOverviewData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-ink-500 hover:text-ink-900 bg-surface-hover/40 border border-line-strong hover:bg-surface-hover transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error alert if backend offline */}
      {error && (
        <div className="rounded-xl bg-danger-600/10 border border-danger-600/30 p-4 text-sm text-danger-600 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Backend Connection Issue</p>
            <p className="text-xs text-ink-700">{error}</p>
          </div>
        </div>
      )}

      {/* Key Research Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Model */}
        <div className="rounded-xl bg-surface-card border border-line-strong p-5 space-y-2">
          <div className="flex items-center justify-between text-ink-500">
            <span className="text-xs font-medium uppercase font-mono">Active Model</span>
            <Cpu className="w-4 h-4 text-brand-600" />
          </div>
          <div className="text-xl font-bold text-ink-900 tracking-tight">
            XGBoost Baseline
          </div>
          <div className="text-xs text-ink-500 flex items-center justify-between pt-1 border-t border-line">
            <span>Validation PR-AUC:</span>
            <span className="font-mono text-brand-600 font-semibold">
              {modelInfo?.sequential_adaptation_summary?.baseline_validation_pr_auc
                ? modelInfo.sequential_adaptation_summary.baseline_validation_pr_auc.toFixed(4)
                : '0.5529'}
            </span>
          </div>
        </div>

        {/* Card 2: Graph Prototype Comparison */}
        <div className="rounded-xl bg-surface-card border border-line-strong p-5 space-y-2">
          <div className="flex items-center justify-between text-ink-500">
            <span className="text-xs font-medium uppercase font-mono">Graph Prototype</span>
            <Layers className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-xl font-bold text-ink-900 tracking-tight">
            Multi-Entity Prototype
          </div>
          <div className="text-xs text-ink-500 flex items-center justify-between pt-1 border-t border-line">
            <span>Validation PR-AUC:</span>
            <span className="font-mono text-ink-700">
              {modelInfo?.sequential_adaptation_summary?.graph_validation_pr_auc
                ? modelInfo.sequential_adaptation_summary.graph_validation_pr_auc.toFixed(4)
                : '0.3923'}
            </span>
          </div>
        </div>

        {/* Card 3: Sequential Adaptation Gain */}
        <div className="rounded-xl bg-surface-card border border-line-strong p-5 space-y-2">
          <div className="flex items-center justify-between text-ink-500">
            <span className="text-xs font-medium uppercase font-mono">Adaptation Gain</span>
            <TrendingUp className="w-4 h-4 text-positive-600" />
          </div>
          <div className="text-xl font-bold text-positive-600 font-mono tracking-tight">
            +
            {(
              (modelInfo?.sequential_adaptation_summary?.mean_sequential_adaptation_pr_auc_gain ?? 0.0762) *
              100
            ).toFixed(2)}
            %
          </div>
          <div className="text-xs text-ink-500 flex items-center justify-between pt-1 border-t border-line">
            <span>Mean PR-AUC Gain:</span>
            <span className="font-mono text-ink-700">Blocks 1 &rarr; 5</span>
          </div>
        </div>

        {/* Card 4: Historical Stability */}
        <div className="rounded-xl bg-surface-card border border-line-strong p-5 space-y-2">
          <div className="flex items-center justify-between text-ink-500">
            <span className="text-xs font-medium uppercase font-mono">Covariate Shift</span>
            <Activity className="w-4 h-4 text-warning-600" />
          </div>
          <div className="text-xl font-bold text-ink-900 font-mono tracking-tight">
            Median PSI &lt; 0.025
          </div>
          <div className="text-xs text-ink-500 flex items-center justify-between pt-1 border-t border-line">
            <span>Non-Temporal Drift:</span>
            <span className="text-positive-600 font-medium">Stable</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Architecture Validation & Top SHAP Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Benchmark Comparison Chart */}
        <div className="rounded-xl bg-surface-card border border-line-strong p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink-900">Validation Benchmark Comparison</h3>
              <p className="text-xs text-ink-500">XGBoost Baseline vs. Graph Prototype on Validation Split</p>
            </div>
            <button
              onClick={() => onNavigate('model-evaluation')}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Full Details</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-60 w-full">
            {comparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" stroke={chartColors.axis} fontSize={11} tickLine={false} />
                  <YAxis dataKey="prAuc" stroke={chartColors.axis} fontSize={11} domain={[0, 1]} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Bar dataKey="prAuc" name="PR-AUC" fill={chartColors.series[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rocAuc" name="ROC-AUC" fill={chartColors.series[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-ink-400 font-mono">
                Loading model benchmark metrics...
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-surface-page/80 border border-line text-xs text-ink-700 leading-relaxed">
            <span className="font-semibold text-brand-600">Key Finding:</span> The tabular XGBoost baseline
            demonstrated higher precision-recall validation performance (0.5529 PR-AUC) than the learned
            multi-entity aggregation prototype (0.3923 PR-AUC). The deployed inference endpoint serves the verified
            XGBoost model.
          </div>
        </div>

        {/* Top 5 SHAP Contributing Features */}
        <div className="rounded-xl bg-surface-card border border-line-strong p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink-900">Top Influential Features (TreeSHAP)</h3>
              <p className="text-xs text-ink-500">Mean absolute attribution values across historical records</p>
            </div>
            <button
              onClick={() => onNavigate('explainability')}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1 font-medium"
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
                  <XAxis type="number" stroke={chartColors.axis} fontSize={11} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={chartColors.axis}
                    fontSize={11}
                    tickLine={false}
                    width={110}
                    interval={0}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  {/* One hue. Bar length already carries the ranking; colouring the
                      top bar red would encode it twice and imply a severity the
                      number does not carry. */}
                  <Bar
                    dataKey="value"
                    name="Mean |SHAP|"
                    fill={chartColors.magnitude}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-ink-400 font-mono">
                Loading feature importance...
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-surface-page/80 border border-line text-xs text-ink-500">
            <span className="font-semibold text-ink-800">Interpretability Note:</span> Features{' '}
            <code className="text-brand-600 font-mono">C5</code>,{' '}
            <code className="text-brand-600 font-mono">C13</code>, and{' '}
            <code className="text-brand-600 font-mono">TransactionAmt</code> hold the largest decision weight.
            TreeSHAP describes tree split attributions, not real-world causal fraud mechanisms.
          </div>
        </div>
      </div>

      {/* Historical Sequential Drift & Adaptation Summary */}
      <div className="rounded-xl bg-surface-card border border-line-strong p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold text-ink-900">Sequential Adaptation Under Temporal Drift</h3>
            <p className="text-xs text-ink-500">
              Model performance evaluated across 5 chronological blocks (Fixed Model vs. Adaptive Retrained Model)
            </p>
          </div>
          <button
            onClick={() => onNavigate('concept-drift')}
            className="text-xs text-brand-600 hover:underline flex items-center gap-1 font-medium"
          >
            <span>PSI Drift Analysis</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line-strong text-ink-500 font-mono uppercase bg-surface-page/60">
                <th className="py-2.5 px-3">Evaluation Block</th>
                <th className="py-2.5 px-3">Transactions</th>
                <th className="py-2.5 px-3">Fixed PR-AUC</th>
                <th className="py-2.5 px-3">Adaptive PR-AUC</th>
                <th className="py-2.5 px-3">Net Gain</th>
                <th className="py-2.5 px-3">Covariate Shift (Excl. Time)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono">
              {(modelInfo?.adaptive_block_results || []).map((row, idx) => {
                const driftBlock = drift?.psi_summary_excluding_time[idx];
                return (
                  <tr key={row.block} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-2.5 px-3 text-ink-700 font-semibold">Block {row.block}</td>
                    <td className="py-2.5 px-3 text-ink-500">{row.transactions.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-ink-700">{row.fixed_pr_auc.toFixed(4)}</td>
                    <td className="py-2.5 px-3 text-brand-600 font-semibold">{row.adaptive_pr_auc.toFixed(4)}</td>
                    <td className="py-2.5 px-3 text-positive-600 font-semibold">
                      +{((row.pr_auc_gain ?? 0) * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-ink-500">
                      Median PSI: {driftBlock ? driftBlock.median_psi.toFixed(4) : '0.0137'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-ink-500 bg-surface-page/80 p-3 rounded-lg border border-line">
          <span className="font-semibold text-ink-700">Sequential Protocol Notice:</span> Earlier block labels were
          used exclusively to retrain the adaptive model for later blocks. This represents an offline sequential
          adaptation experiment rather than a live streaming detection pipeline.
        </div>
      </div>
    </div>
  );
};
