import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { apiService, formatApiError } from '../services/api';
import type { ModelInfoResponse } from '../types/api';
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle } from '../theme/charts';

export const ModelEvaluationPage: React.FC = () => {
  const [data, setData] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModelInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getModelInfo();
      setData(res);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModelInfo();
  }, []);

  // Comparison chart data
  const comparisonData = (data?.model_comparison || []).map((m) => ({
    model: m.model.includes('XGBoost') ? 'XGBoost Baseline' : 'Graph Prototype',
    prAuc: Number(m.validation_pr_auc.toFixed(4)),
    rocAuc: Number(m.validation_roc_auc.toFixed(4)),
    status: m.status,
  }));

  // Sequential adaptation chart data
  const adaptationData = (data?.adaptive_block_results || []).map((b) => ({
    block: `Block ${b.block}`,
    fixedPrAuc: Number(b.fixed_pr_auc.toFixed(4)),
    adaptivePrAuc: Number(b.adaptive_pr_auc.toFixed(4)),
    gain: Number(((b.pr_auc_gain ?? 0) * 100).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl bg-surface-card border border-line-strong p-5 shadow-lg space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h3 className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-600" />
              <span>Model Evaluation & Sequential Adaptation Benchmarks</span>
            </h3>
            <p className="text-xs text-ink-700 leading-relaxed">
              Comparison of the baseline tabular XGBoost classifier against the learned multi-entity graph
              prototype, alongside sequential block adaptation experiments evaluating precision-recall area under the curve
              (PR-AUC).
            </p>
          </div>
          <button
            onClick={fetchModelInfo}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:text-ink-900 bg-surface-hover hover:bg-surface-active border border-line-strong transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload Model Info</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-600/10 border border-danger-600/30 p-3.5 text-xs text-danger-600 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Model Benchmark Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Comparison Chart */}
        <div className="lg:col-span-7 rounded-xl bg-surface-card border border-line-strong p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-strong">
            <div>
              <h4 className="text-base font-bold text-ink-900">Validation Metric Benchmark</h4>
              <p className="text-xs text-ink-500">Precision-Recall AUC vs. ROC-AUC on Validation Split</p>
            </div>
            <span className="text-xs font-mono text-positive-600 px-2 py-0.5 rounded bg-positive-600/10 border border-positive-600/30">
              Verified Metrics
            </span>
          </div>

          <div className="h-64 w-full">
            {comparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="model" stroke={chartColors.axis} fontSize={11} tickLine={false} />
                  <YAxis stroke={chartColors.axis} fontSize={11} domain={[0, 1.0]} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="prAuc" name="PR-AUC" fill={chartColors.series[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rocAuc" name="ROC-AUC" fill={chartColors.series[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-ink-400 font-mono">
                Loading comparison metrics...
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-surface-page border border-line text-xs text-ink-700 space-y-1">
            <div className="font-semibold text-ink-900">Key Research Outcome:</div>
            <p className="text-ink-500 leading-relaxed">
              In imbalanced fraud detection where the minority fraud class represents &lt; 3.5% of transactions,{' '}
              <strong className="text-ink-900">PR-AUC is the definitive metric</strong>. The tabular XGBoost baseline
              achieved a PR-AUC of <span className="text-brand-600 font-mono font-semibold">0.5529</span>, significantly
              outperforming the learned graph prototype (<span className="text-ink-700 font-mono">0.3923</span>).
              Hence, XGBoost is deployed as the production inference model.
            </p>
          </div>
        </div>

        {/* Model Comparison Table */}
        <div className="lg:col-span-5 rounded-xl bg-surface-card border border-line-strong p-6 shadow-lg space-y-4">
          <div className="pb-3 border-b border-line-strong">
            <h4 className="text-base font-bold text-ink-900">Architecture Summary</h4>
            <p className="text-xs text-ink-500">Recorded experimental validation performance</p>
          </div>

          <div className="space-y-3">
            {(data?.model_comparison || []).map((m) => (
              <div
                key={m.model}
                className={`p-4 rounded-xl border ${
                  m.status === 'Baseline'
                    ? 'bg-brand-600/5 border-brand-600/30'
                    : 'bg-surface-page border-line'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-ink-900 flex items-center gap-2">
                    {m.status === 'Baseline' ? (
                      <Cpu className="w-4 h-4 text-brand-600" />
                    ) : (
                      <Layers className="w-4 h-4 text-violet-600" />
                    )}
                    <span>{m.model}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                      m.status === 'Baseline'
                        ? 'bg-positive-600 text-white'
                        : 'bg-surface-hover text-ink-500 border border-line-strong'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-line font-mono text-xs">
                  <div>
                    <span className="text-ink-400">PR-AUC:</span>{' '}
                    <span className="font-semibold text-ink-900">{m.validation_pr_auc.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-ink-400">ROC-AUC:</span>{' '}
                    <span className="font-semibold text-ink-900">{m.validation_roc_auc.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-ink-500 bg-surface-page p-3 rounded-lg border border-line">
            <strong>Inference Status:</strong> The XGBoost model loaded into the backend incorporates 2,038 boosted
            trees, with the optimal tree cutoff selected at iteration #1937.
          </div>
        </div>
      </div>

      {/* Sequential Adaptation Experiment Section */}
      <div className="rounded-xl bg-surface-card border border-line-strong p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line-strong flex-wrap gap-2">
          <div>
            <h4 className="text-base font-bold text-ink-900">Sequential Adaptation Performance</h4>
            <p className="text-xs text-ink-500">
              PR-AUC improvement across 5 chronological blocks when retraining on previous labeled blocks
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-positive-600/10 text-positive-600 border border-positive-600/30">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Mean Adaptation Gain: +7.62%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Adaptation Line Chart */}
          <div className="lg:col-span-7 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={adaptationData} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="block" stroke={chartColors.axis} fontSize={11} tickLine={false} />
                <YAxis stroke={chartColors.axis} fontSize={11} domain={[0.35, 0.7]} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="fixedPrAuc"
                  name="Fixed Model PR-AUC"
                  stroke={chartColors.axis}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="adaptivePrAuc"
                  name="Adaptive Retrained PR-AUC"
                  stroke={chartColors.series[0]}
                  strokeWidth={2.5}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Adaptation Table */}
          <div className="lg:col-span-5 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line-strong text-ink-500 font-mono uppercase bg-surface-page/80">
                  <th className="py-2.5 px-3">Block</th>
                  <th className="py-2.5 px-3">Fixed</th>
                  <th className="py-2.5 px-3">Adaptive</th>
                  <th className="py-2.5 px-3">Net Gain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono">
                {(data?.adaptive_block_results || []).map((b) => (
                  <tr key={b.block} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-2 px-3 text-ink-700 font-bold">Block {b.block}</td>
                    <td className="py-2 px-3 text-ink-500">{b.fixed_pr_auc.toFixed(4)}</td>
                    <td className="py-2 px-3 text-brand-600 font-semibold">{b.adaptive_pr_auc.toFixed(4)}</td>
                    <td className="py-2 px-3 text-positive-600 font-semibold">
                      +{((b.pr_auc_gain ?? 0) * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-surface-page border border-line text-xs text-ink-500 leading-relaxed">
          <strong className="text-ink-800">Evaluation Protocol Note:</strong> {data?.evaluation_protocol_note ||
            'Sequential adaptation evaluation: earlier block labels are used only for later blocks. Do not describe the full sequence as an untouched heldout evaluation.'}
        </div>
      </div>

      {/* Explicit Academic Limitations */}
      <div className="rounded-xl bg-surface-card border border-line-strong p-6 shadow-lg space-y-3">
        <h4 className="text-base font-bold text-ink-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning-600" />
          <span>Documented Research Limitations</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {(data?.research_limitations || []).map((limitation, i) => (
            <div
              key={i}
              className="p-3.5 rounded-lg bg-surface-page border border-line text-xs text-ink-700 flex items-start gap-2.5"
            >
              <div className="w-5 h-5 rounded-full bg-warning-600/10 text-warning-600 font-mono font-bold flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">
                {i + 1}
              </div>
              <p className="leading-relaxed">{limitation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
