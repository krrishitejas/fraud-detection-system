import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { apiService, formatApiError } from '../services/api';
import type { DriftMonitoringResponse } from '../types/api';
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle } from '../theme/charts';

export const ConceptDriftPage: React.FC = () => {
  const [drift, setDrift] = useState<DriftMonitoringResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrift = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getDriftMonitoring();
      setDrift(res);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrift();
  }, []);

  // Format chart data combining all features vs excluding time
  const chartData = (drift?.psi_summary_all_features || []).map((item, idx) => {
    const noTime = drift?.psi_summary_excluding_time[idx];
    return {
      block: `Block ${item.time_block}`,
      allMedian: item.median_psi,
      allMean: item.mean_psi,
      noTimeMedian: noTime?.median_psi ?? 0,
      noTimeMean: noTime?.mean_psi ?? 0,
      transactions: item.transactions ?? 17616,
    };
  });

  return (
    <div className="space-y-6">
      {/* Educational Banner */}
      <div className="rounded-xl bg-surface-card border border-line p-5 shadow-card space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h3 className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-600" />
              <span>Population Stability Index (PSI) Drift Analysis</span>
            </h3>
            <p className="text-xs text-ink-700 leading-relaxed">
              Population Stability Index (PSI) measures shifts in feature distributions over time relative to a baseline
              reference (Block 0 / Training Split). A PSI &lt; 0.10 indicates slight or no shift; 0.10 &le; PSI &lt; 0.25 indicates
              moderate shift; and PSI &ge; 0.25 indicates significant distribution drift.
            </p>
          </div>
          <button
            onClick={fetchDrift}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:text-ink-900 bg-surface-hover hover:bg-surface-active border border-line-strong transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload Drift Data</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-600/10 border border-danger-600/30 p-3.5 text-xs text-danger-600 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Distinction & Critical Finding Box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-surface-card border border-line p-5 shadow-card space-y-3">
          <h4 className="text-sm font-bold text-ink-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-brand-600" />
            <span>Temporal Distortion vs. Genuine Shift</span>
          </h4>
          <p className="text-xs text-ink-700 leading-relaxed">
            When all features are evaluated together, the mean PSI appears high (~0.40). However, this is driven almost
            entirely by <code className="text-brand-600 font-mono">TransactionDT</code>, a timestamp feature that
            monotonically increases with every new transaction block.
          </p>
          <div className="p-3 rounded-lg bg-surface-page border border-line text-xs text-ink-700 leading-relaxed">
            <strong className="text-positive-600">When TransactionDT is excluded:</strong> The feature distributions
            remain remarkably stable across all 5 chronological blocks, with median PSI between{' '}
            <span className="font-mono text-positive-600">0.0071</span> and{' '}
            <span className="font-mono text-positive-600">0.0246</span>, and at most 1 feature showing PSI &ge; 0.10.
          </div>
        </div>

        <div className="rounded-xl bg-surface-card border border-warning-600/30 p-5 shadow-card space-y-3">
          <h4 className="text-sm font-bold text-ink-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-600" />
            <span>Offline Research Experiment &bull; Not Live Streaming</span>
          </h4>
          <p className="text-xs text-ink-700 leading-relaxed">
            The metrics shown here reflect offline experimental evaluation over 5 historical Colab blocks (17,616
            transactions each). This system does <strong className="text-ink-900">not</strong> perform dynamic stream monitoring
            or automatically trigger unsupervised retraining on incoming requests.
          </p>
          <p className="text-xs text-ink-500">
            Furthermore, covariate shift (change in P(X)) does not prove concept drift (change in P(Y|X)). Concept drift
            specifically denotes changes in the conditional fraud relationship.
          </p>
        </div>
      </div>

      {/* Chart: PSI Comparison across Blocks */}
      <div className="rounded-xl bg-surface-card border border-line p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h4 className="text-base font-bold text-ink-900">Median PSI Across Chronological Blocks</h4>
            <p className="text-xs text-ink-500">Comparing All Features vs. Excluding Temporal Feature (TransactionDT)</p>
          </div>
          <span className="text-xs font-mono text-ink-500">5 Blocks &bull; ~88,000 Transactions</span>
        </div>

        <div className="h-72 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="block" stroke={chartColors.axis} fontSize={11} tickLine={false} />
                <YAxis stroke={chartColors.axis} fontSize={11} domain={[0, 0.45]} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="allMean" name="Mean PSI (All 32 Features)" fill={chartColors.series[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="noTimeMean" name="Mean PSI (Excl. TransactionDT)" fill={chartColors.series[1]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="noTimeMedian" name="Median PSI (Excl. TransactionDT)" fill={chartColors.series[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-ink-400 font-mono">
              Loading drift metrics...
            </div>
          )}
        </div>
      </div>

      {/* Comprehensive 5-Block PSI Table */}
      <div className="rounded-xl bg-surface-card border border-line p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h4 className="text-base font-bold text-ink-900">Historical 5-Block Drift Statistics Table</h4>
            <p className="text-xs text-ink-500">Detailed metric summary extracted from research artifacts</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line text-ink-600">
                <th className="py-2.5 px-3">Time Block</th>
                <th className="py-2.5 px-3">Transactions</th>
                <th className="py-2.5 px-3">Median PSI (All)</th>
                <th className="py-2.5 px-3">Mean PSI (All)</th>
                <th className="py-2.5 px-3">PSI &ge; 0.10 (All)</th>
                <th className="py-2.5 px-3 text-positive-600">Median PSI (No Time)</th>
                <th className="py-2.5 px-3 text-positive-600">Mean PSI (No Time)</th>
                <th className="py-2.5 px-3 text-positive-600">PSI &ge; 0.10 (No Time)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono">
              {(drift?.psi_summary_all_features || []).map((item, idx) => {
                const noTime = drift?.psi_summary_excluding_time[idx];
                return (
                  <tr key={item.time_block} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-2.5 px-3 text-ink-700 font-bold">Block {item.time_block}</td>
                    <td className="py-2.5 px-3 text-ink-500">{item.transactions?.toLocaleString() || '17,616'}</td>
                    <td className="py-2.5 px-3 text-ink-700">{item.median_psi.toFixed(4)}</td>
                    <td className="py-2.5 px-3 text-ink-700">{item.mean_psi.toFixed(4)}</td>
                    <td className="py-2.5 px-3 text-ink-500">{item.features_psi_over_010}</td>
                    <td className="py-2.5 px-3 text-positive-600 font-semibold">
                      {noTime?.median_psi?.toFixed(4) ?? '-'}
                    </td>
                    <td className="py-2.5 px-3 text-positive-600 font-semibold">
                      {noTime?.mean_psi?.toFixed(4) ?? '-'}
                    </td>
                    <td className="py-2.5 px-3 text-ink-700 font-semibold">
                      {noTime?.features_psi_over_010 ?? '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
