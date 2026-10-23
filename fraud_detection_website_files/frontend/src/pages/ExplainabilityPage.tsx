import React, { useEffect, useState } from 'react';
import {
  Brain,
  HelpCircle,
  RefreshCw,
  AlertCircle,
  Sparkles,
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
import type { FeatureImportanceResponse } from '../types/api';
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle } from '../theme/charts';

export const ExplainabilityPage: React.FC = () => {
  const [data, setData] = useState<FeatureImportanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchImportance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getFeatureImportance();
      setData(res);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImportance();
  }, []);

  const chartData = (data?.features || []).slice(0, 15).map((f) => ({
    name: f.feature,
    contribution: Number(f.mean_absolute_shap_contribution.toFixed(4)),
    rank: f.rank,
  }));

  return (
    <div className="space-y-6">
      {/* Educational Banner */}
      <div className="rounded-xl bg-surface-card border border-line p-5 shadow-card space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h3 className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <Brain className="w-4 h-4 text-data-700" />
              <span>TreeSHAP Feature Attribution Methodology</span>
            </h3>
            <p className="text-xs text-ink-700 leading-relaxed">
              TreeSHAP (Tree Shapley Additive Explanations) assigns each feature an attribution value for its
              contribution to the XGBoost ensemble&apos;s log-odds output. The chart below ranks the top features by{' '}
              <strong className="text-ink-900">Mean Absolute TreeSHAP Contribution</strong> across the study dataset.
            </p>
          </div>
          <button
            onClick={fetchImportance}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:text-ink-900 bg-surface-hover hover:bg-surface-active border border-line-strong transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload SHAP Data</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-flag-600/10 border border-flag-600/30 p-3.5 text-xs text-flag-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Horizontal Bar Chart & Methodology Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Horizontal Chart Card */}
        <div className="lg:col-span-8 rounded-xl bg-surface-card border border-line p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h4 className="text-base font-bold text-ink-900">Top 15 Influential Model Features</h4>
              <p className="text-xs text-ink-500">Mean absolute TreeSHAP value |E[|SHAP|]|</p>
            </div>
            <span className="text-xs font-mono text-data-700 px-2 py-0.5 rounded bg-ink-900/10 border border-data-100">
              Total 32 Features
            </span>
          </div>

          <div className="h-96 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 25, bottom: 5 }}
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
                    formatter={(val: unknown) => [typeof val === 'number' ? val.toFixed(4) : String(val), 'Mean |SHAP|']}
                  />
                  {/* One hue, for the same reason as the overview chart: the bar
                      length is the ranking, and a red top bar would assert a
                      severity that mean |SHAP| does not measure. */}
                  <Bar
                    dataKey="contribution"
                    fill={chartColors.magnitude}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-ink-400 font-mono">
                {loading ? 'Computing and loading feature importances...' : 'No feature importance data.'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-ink-500 pt-2 border-t border-line">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-flag-600" /> Top 3 Features (C5, C13, TransactionAmt)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-hold-600" /> Ranks 4 - 7 (C1, C14, TransactionDT, card1)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-ink-900" /> Secondary Features
            </span>
          </div>
        </div>

        {/* Explainability Distinction Cards */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl bg-surface-card border border-line p-5 shadow-card space-y-3">
            <h4 className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-data-700" />
              <span>Global vs. Local Explanations</span>
            </h4>
            <div className="space-y-2 text-xs text-ink-700 leading-relaxed">
              <p>
                <strong className="text-ink-900">Global Importance:</strong> Ranks features by their overall contribution
                magnitude across thousands of transactions in the study dataset.
              </p>
              <p>
                <strong className="text-ink-900">Local Prediction Attribution:</strong> Evaluates which specific features
                increased or decreased fraud log-odds for an individual transaction during inference (available on the
                Fraud Detection page).
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-card border border-hold-600/30 p-5 shadow-card space-y-3">
            <h4 className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-hold-600" />
              <span>Attribution is Not Causation</span>
            </h4>
            <p className="text-xs text-ink-700 leading-relaxed">
              High TreeSHAP values describe statistical decision associations within the gradient-boosted decision trees.
              They <strong className="text-hold-600">do not imply causal mechanisms</strong> in financial criminal behavior.
              Features such as address region (<code className="text-ink-800">addr1</code>) or email domain are indicators,
              not the root cause of fraud.
            </p>
          </div>
        </div>
      </div>

      {/* Full 32-Feature Ranked Table */}
      <div className="rounded-xl bg-surface-card border border-line p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h4 className="text-base font-bold text-ink-900">Complete Feature Importance Ranking (All 32 Features)</h4>
            <p className="text-xs text-ink-500">Mean absolute TreeSHAP contribution values extracted from Colab evaluation</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line text-ink-600">
                <th className="py-2.5 px-4 w-16 text-right">Rank</th>
                <th className="py-2.5 px-4">Feature Name</th>
                <th className="py-2.5 px-4 text-right">Mean |SHAP| contribution</th>
                <th className="py-2.5 px-4">Relative Magnitude</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono">
              {(data?.features || []).map((f) => {
                const maxVal = data?.features[0]?.mean_absolute_shap_contribution || 1;
                const widthPercent = (f.mean_absolute_shap_contribution / maxVal) * 100;

                return (
                  <tr key={f.feature} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-2.5 px-4 text-ink-500 font-bold text-right tabular-nums">{f.rank}</td>
                    <td className="py-2.5 px-4 text-data-700 font-semibold">{f.feature}</td>
                    <td className="py-2.5 px-4 text-ink-900 font-semibold text-right tabular-nums">
                      {f.mean_absolute_shap_contribution.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-4 w-1/3">
                      <div className="h-2 w-full bg-surface-page rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-ink-900"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!data?.features || data.features.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-ink-400 font-mono">
                    {loading ? 'Loading ranking table...' : 'No features loaded.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
