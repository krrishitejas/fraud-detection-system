import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  History,
  ListChecks,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { apiService, formatApiError } from '../services/api';
import type {
  AuditResponse,
  RuleCatalogueResponse,
  ThresholdRecord,
} from '../types/api';

/**
 * Decision governance.
 *
 * This page exists because of the clearest finding in the project: a decision
 * threshold is not a constant, it is a record. It belongs to one trained model and
 * to the score scale it was chosen on, and when either changes it has to change with
 * them. The model this service ran before the current one had its boundary near
 * 0.50; this one has it at 0.065. Had the value stayed a constant in the code,
 * swapping the model in would have cut recall from 0.63 to 0.33 and let roughly 930
 * more frauds through -- with nothing crashing, no test failing and nothing logged.
 *
 * So the threshold, the rules and the stored decisions are shown here as what they
 * are: governed configuration with a provenance, not settings.
 */

const Card: React.FC<{
  title: string;
  icon: React.ElementType;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, icon: Icon, subtitle, children }) => (
  <section className="bg-surface-card border border-line rounded-xl shadow-card">
    <header className="px-5 py-4 border-b border-line flex items-start gap-3">
      <Icon className="mt-0.5 w-4 h-4 text-ink-500 shrink-0" />
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-2 border-b border-line last:border-0">
    <dt className="text-xs text-ink-500 shrink-0">{label}</dt>
    <dd className="text-xs font-mono text-ink-800 text-right break-all">{children}</dd>
  </div>
);

const riskChip = (level?: string | null) => {
  const map: Record<string, string> = {
    HIGH: 'bg-danger-50 text-danger-700 border-danger-100',
    MEDIUM: 'bg-warning-50 text-warning-700 border-warning-100',
    LOW: 'bg-brand-50 text-brand-700 border-brand-100',
  };
  const cls = (level && map[level]) || 'bg-surface-sunken text-ink-500 border-line';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-mono font-semibold ${cls}`}>
      {level ?? 'none'}
    </span>
  );
};

export const GovernancePage: React.FC = () => {
  const [threshold, setThreshold] = useState<ThresholdRecord | null>(null);
  const [rules, setRules] = useState<RuleCatalogueResponse | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, r, a] = await Promise.all([
        apiService.getThresholdRecord(),
        apiService.getRuleCatalogue(),
        apiService.getRecentDecisions(25),
      ]);
      setThreshold(t);
      setRules(r);
      setAudit(a);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-ink-500">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading the serving configuration…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger-50 border border-danger-100 rounded-xl p-5 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-danger-700">
            Could not read the serving configuration
          </p>
          <p className="text-xs text-ink-600 mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-surface-card border border-line-strong text-ink-700 hover:bg-surface-hover"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------- */}
      <Card
        title="The decision threshold, as a record"
        icon={Gauge}
        subtitle="Stored with the model and the score scale it belongs to, never as a bare constant"
      >
        {threshold && (
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              <div className="bg-surface-sunken rounded-lg p-4 border border-line">
                <p className="text-[11px] tracking-normal text-ink-600 font-semibold">
                  Flag at or above
                </p>
                <p className="text-2xl font-mono font-bold text-ink-900 mt-1">
                  {threshold.value.toFixed(6)}
                </p>
              </div>
              <div className="bg-surface-sunken rounded-lg p-4 border border-line">
                <p className="text-[11px] tracking-normal text-ink-600 font-semibold">
                  Send to review at
                </p>
                <p className="text-2xl font-mono font-bold text-ink-900 mt-1">
                  {threshold.review_low.toFixed(6)}
                </p>
              </div>
              <div className="bg-surface-sunken rounded-lg p-4 border border-line">
                <p className="text-[11px] tracking-normal text-ink-600 font-semibold">
                  Assumed cost of a miss
                </p>
                <p className="text-2xl font-mono font-bold text-ink-900 mt-1">
                  {threshold.cost_false_negative}:{threshold.cost_false_positive}
                </p>
              </div>
            </div>

            <dl>
              <Field label="Applies to model">{threshold.applies_to_model_version}</Field>
              <Field label="Score scale">
                {threshold.score_scale} ({threshold.calibration})
              </Field>
              <Field label="Chosen by">{threshold.selection_method}</Field>
              <Field label="Chosen on">{threshold.selected_on_split}</Field>
              <Field label="Threshold config">#{threshold.threshold_config_id}</Field>
              <Field label="Approved by">{threshold.approved_by ?? '—'}</Field>
            </dl>

            <p className="mt-4 text-xs text-ink-600 bg-warning-50 border border-warning-100 rounded-lg p-3">
              <strong className="text-warning-700">The cost ratio is an assumption.</strong>{' '}
              {threshold.cost_assumption_note}
            </p>

            {threshold.sensitivity && threshold.sensitivity.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold text-ink-700 mb-2">
                  What the cutoff would be under other cost assumptions
                </p>
                <div className="overflow-x-auto border border-line rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-sunken text-ink-500">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">A miss costs</th>
                        <th className="text-right font-semibold px-3 py-2">Cheapest cut</th>
                        <th className="text-right font-semibold px-3 py-2">Alerts</th>
                        <th className="text-right font-semibold px-3 py-2">Recall</th>
                        <th className="text-right font-semibold px-3 py-2">0.50 wastes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono text-ink-700">
                      {threshold.sensitivity.map((row) => {
                        const active = Math.abs(row.threshold - threshold.value) < 1e-6;
                        return (
                          <tr key={row.cost_ratio} className={active ? 'bg-brand-50' : ''}>
                            <td className="px-3 py-2 text-left">
                              {row.cost_ratio}×{active && (
                                <span className="ml-2 text-[10px] text-brand-700 font-sans font-semibold">
                                  in use
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">{row.threshold.toFixed(4)}</td>
                            <td className="px-3 py-2 text-right">{row.alert_rate_pct.toFixed(2)}%</td>
                            <td className="px-3 py-2 text-right">{row.recall.toFixed(4)}</td>
                            <td className="px-3 py-2 text-right">{row.waste_pct.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card
        title="The rule table"
        icon={ListChecks}
        subtitle={
          rules ? `${rules.active} active of ${rules.total}, measured on training rows only` : ''
        }
      >
        {rules && (
          <>
            <div className="space-y-3">
              {rules.rules.map((rule) => (
                <article
                  key={rule.rule_id}
                  className={`rounded-lg border p-4 ${
                    rule.is_active
                      ? 'border-line bg-surface-card'
                      : 'border-line bg-surface-sunken'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      {rule.is_active ? (
                        <CheckCircle2 className="w-4 h-4 text-positive-700 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-ink-400 shrink-0" />
                      )}
                      <code className="text-xs font-mono font-semibold text-ink-900">
                        {rule.rule_name}
                      </code>
                      <span className="text-[11px] text-ink-400 font-mono">v{rule.version}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {riskChip(rule.risk_level)}
                      <code className="text-[11px] font-mono text-ink-600 bg-surface-sunken border border-line rounded px-2 py-0.5">
                        {rule.field} {rule.operator}{' '}
                        {rule.threshold === null || rule.threshold === undefined
                          ? ''
                          : rule.threshold}
                      </code>
                    </div>
                  </div>

                  {rule.description && (
                    <p className="text-xs text-ink-600 mt-2 leading-relaxed">{rule.description}</p>
                  )}

                  <div className="grid sm:grid-cols-3 gap-3 mt-3 text-[11px] font-mono">
                    <div className="bg-surface-sunken border border-line rounded px-2.5 py-1.5">
                      <span className="text-ink-400">fires on </span>
                      <span className="text-ink-800">
                        {rule.train_hit_rate_pct?.toFixed(2) ?? '—'}%
                      </span>
                      <span className="text-ink-400"> of training rows</span>
                    </div>
                    <div className="bg-surface-sunken border border-line rounded px-2.5 py-1.5">
                      <span className="text-ink-400">fraud rate </span>
                      <span className="text-ink-800">
                        {rule.train_fraud_rate_pct?.toFixed(2) ?? '—'}%
                      </span>
                    </div>
                    <div className="bg-surface-sunken border border-line rounded px-2.5 py-1.5">
                      <span className="text-ink-400">lift </span>
                      <span
                        className={
                          (rule.train_lift ?? 0) >= 2 ? 'text-positive-700' : 'text-ink-800'
                        }
                      >
                        {rule.train_lift?.toFixed(2) ?? '—'}×
                      </span>
                    </div>
                  </div>

                  {!rule.is_active && (
                    <p className="text-[11px] text-ink-500 mt-3 italic">
                      Switched off. It stays in the table with its measurement attached,
                      because a rule a reader can see was tried and rejected is worth more
                      than one that quietly disappeared.
                    </p>
                  )}
                </article>
              ))}
            </div>
            <p className="text-xs text-ink-500 mt-4">{rules.note}</p>
          </>
        )}
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card
        title="Stored decisions"
        icon={History}
        subtitle="Every scoring through the contract endpoint is written down and can be retrieved"
      >
        {audit && (
          <>
            <div className="grid sm:grid-cols-4 gap-3 mb-4">
              {[
                ['Stored', audit.summary.stored_predictions.toLocaleString()],
                ['Flagged', `${audit.summary.flagged ?? 0}`],
                [
                  'Flag rate',
                  audit.summary.flagged_rate_pct !== undefined
                    ? `${audit.summary.flagged_rate_pct.toFixed(2)}%`
                    : '—',
                ],
                [
                  'Mean latency',
                  audit.summary.mean_latency_ms
                    ? `${audit.summary.mean_latency_ms.toFixed(1)} ms`
                    : '—',
                ],
              ].map(([label, value]) => (
                <div key={label} className="bg-surface-sunken border border-line rounded-lg p-3">
                  <p className="text-[11px] tracking-normal text-ink-600 font-semibold">
                    {label}
                  </p>
                  <p className="text-lg font-mono font-bold text-ink-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {audit.predictions.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-line rounded-lg">
                <ShieldCheck className="w-6 h-6 text-ink-400 mx-auto mb-2" />
                <p className="text-sm text-ink-600">Nothing scored yet.</p>
                <p className="text-xs text-ink-500 mt-1">
                  Score a payment on the Fraud Detection page and it will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-surface-sunken text-ink-500">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2">Scored at</th>
                      <th className="text-left font-semibold px-3 py-2">Request</th>
                      <th className="text-right font-semibold px-3 py-2">Probability</th>
                      <th className="text-left font-semibold px-3 py-2">Outcome</th>
                      <th className="text-left font-semibold px-3 py-2">Rules</th>
                      <th className="text-right font-semibold px-3 py-2">ms</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {audit.predictions.map((p) => (
                      <tr key={p.prediction_id} className="hover:bg-surface-hover">
                        <td className="px-3 py-2 font-mono text-ink-600 whitespace-nowrap">
                          {p.scored_at.replace('T', ' ').slice(0, 19)}
                        </td>
                        <td className="px-3 py-2 font-mono text-ink-500">
                          {p.request_id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2 font-mono text-right text-ink-900">
                          {p.fraud_probability.toFixed(6)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-mono font-semibold ${
                              p.risk_band === 'FRAUD'
                                ? 'bg-danger-50 text-danger-700 border-danger-100'
                                : p.risk_band === 'REVIEW'
                                ? 'bg-warning-50 text-warning-700 border-warning-100'
                                : 'bg-positive-50 text-positive-700 border-positive-100'
                            }`}
                          >
                            {p.risk_band}
                          </span>
                        </td>
                        <td className="px-3 py-2">{riskChip(p.highest_rule_risk)}</td>
                        <td className="px-3 py-2 font-mono text-right text-ink-600">
                          {p.latency_ms.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={load}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-surface-card border border-line-strong text-ink-700 hover:bg-surface-hover"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </>
        )}
      </Card>
    </div>
  );
};
