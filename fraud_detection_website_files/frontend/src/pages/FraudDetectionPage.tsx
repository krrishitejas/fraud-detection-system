import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { apiService, formatApiError } from '../services/api';
import type {
  CategoriesResponse,
  Classification,
  ContractPredictResponse,
} from '../types/api';

/**
 * Scoring one payment, through POST /api/model/predict.
 *
 * This page sends a payment, not a feature vector. The five text columns are
 * chosen by name -- "visa", "gmail.com" -- and the server encodes them, because
 * the code table is a training artefact and a copy of it living in the browser is
 * exactly how training and serving drift apart without anyone noticing.
 *
 * The result panel shows more than a verdict on purpose. A fraud decision that
 * cannot be reconstructed afterwards cannot be appealed, so the probability, the
 * threshold it was compared against, the model and preprocessing versions, the
 * rules that fired and what the server did with every field it was or was not
 * given are all on screen.
 */

/* The 32 columns the model reads, grouped for a form rather than for the model. */
const NUMERIC_GROUPS = [
  {
    name: 'The payment',
    hint: 'Amount is the only field the contract requires.',
    fields: [
      { key: 'TransactionAmt', label: 'Amount', required: true },
      { key: 'TransactionDT', label: 'Seconds from dataset start' },
    ],
  },
  {
    name: 'Card',
    hint: 'card1 and card2 identify the card; card3 and card5 are issuer attributes.',
    fields: [
      { key: 'card1', label: 'card1' },
      { key: 'card2', label: 'card2' },
      { key: 'card3', label: 'card3' },
      { key: 'card5', label: 'card5' },
    ],
  },
  {
    name: 'Address and distance',
    hint: 'Leave the address blank to see the geo-mismatch rule fire.',
    fields: [
      { key: 'addr1', label: 'addr1 (billing region)' },
      { key: 'addr2', label: 'addr2 (billing country)' },
      { key: 'dist1', label: 'dist1' },
      { key: 'dist2', label: 'dist2' },
    ],
  },
  {
    name: 'Counting columns (C1–C14)',
    hint:
      'Vesta published that these count things associated with the card, but not ' +
      'what each one counts. C1 at or above its 99th percentile fires a rule.',
    collapsible: true,
    fields: Array.from({ length: 14 }, (_, i) => ({
      key: `C${i + 1}`,
      label: `C${i + 1}`,
    })),
  },
  {
    name: 'Timedeltas (D1–D3)',
    hint: 'Days since a previous event on the same card.',
    fields: [
      { key: 'D1', label: 'D1' },
      { key: 'D2', label: 'D2' },
      { key: 'D3', label: 'D3' },
    ],
  },
] as const;

const CATEGORY_FIELDS = [
  { key: 'ProductCD', label: 'Product code' },
  { key: 'card4', label: 'Card network' },
  { key: 'card6', label: 'Card type' },
  { key: 'P_emaildomain', label: 'Purchaser email domain' },
  { key: 'R_emaildomain', label: 'Recipient email domain' },
] as const;

const DEFAULTS: Record<string, string> = {
  TransactionAmt: '68.5', TransactionDT: '86400',
  card1: '13926', card2: '361', card3: '150', card5: '142',
  addr1: '315', addr2: '87', dist1: '19', dist2: '',
  C1: '1', C2: '1', C3: '0', C4: '0', C5: '0', C6: '1', C7: '0',
  C8: '0', C9: '1', C10: '0', C11: '1', C12: '0', C13: '1', C14: '1',
  D1: '14', D2: '', D3: '13',
  ProductCD: 'W', card4: 'discover', card6: 'credit',
  P_emaildomain: 'gmail.com', R_emaildomain: '',
};

const OUTCOME: Record<Classification, {
  label: string; icon: React.ElementType; tone: string; chip: string; blurb: string;
}> = {
  FRAUD: {
    label: 'Flagged as fraud',
    icon: ShieldAlert,
    tone: 'border-danger-100 bg-danger-50',
    chip: 'bg-danger-600 text-white',
    blurb: 'At or above the cutoff. This payment would be held.',
  },
  REVIEW: {
    label: 'Sent to review',
    icon: Eye,
    tone: 'border-warning-100 bg-warning-50',
    chip: 'bg-warning-600 text-white',
    blurb: 'Below the cutoff but above the review floor, so an analyst decides.',
  },
  LEGITIMATE: {
    label: 'Approved',
    icon: ShieldCheck,
    tone: 'border-positive-100 bg-positive-50',
    chip: 'bg-positive-600 text-white',
    blurb: 'Below the review floor. This payment would go through.',
  },
};

export const FraudDetectionPage: React.FC = () => {
  const [form, setForm] = useState<Record<string, string>>(DEFAULTS);
  const [categories, setCategories] = useState<CategoriesResponse | null>(null);
  const [result, setResult] = useState<ContractPredictResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    'Counting columns (C1–C14)': true,
  });

  useEffect(() => {
    apiService
      .getCategories()
      .then(setCategories)
      .catch(() => setCategories(null));
  }, []);

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /* An empty box means "this payment has no such value", which is a different
     thing from zero, so the field is left out of the request entirely and the
     server fills it the way training did. */
  const body = useMemo(() => {
    const transaction: Record<string, string | number> = {};
    for (const [key, raw] of Object.entries(form)) {
      const value = raw.trim();
      if (!value) continue;
      transaction[key] = CATEGORY_FIELDS.some((f) => f.key === key)
        ? value
        : Number(value);
    }
    return transaction;
  }, [form]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiService.contractPredict({
        payload_type: 'raw_transaction',
        transaction_id: Math.floor(2_987_000 + Math.random() * 100_000),
        transaction_dt: Number(form.TransactionDT || 86400),
        return_explanation: true,
        transaction: body,
      });
      setResult(res);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const outcome = result ? OUTCOME[result.classification] : null;
  const OutcomeIcon = outcome?.icon ?? ShieldCheck;

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* ------------------------------------------------------------- form */}
      <form onSubmit={submit} className="lg:col-span-3 space-y-5">
        <section className="bg-surface-card border border-line rounded-xl shadow-card">
          <header className="px-5 py-4 border-b border-line flex items-center gap-3">
            <Sliders className="w-4 h-4 text-ink-500 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-ink-900">The payment</h2>
              <p className="text-xs text-ink-500 mt-0.5">
                Text fields are sent as text and encoded on the server. An empty box
                means absent, which is not the same as zero.
              </p>
            </div>
          </header>

          <div className="p-5 space-y-6">
            {/* categories */}
            <div>
              <h3 className="text-xs font-semibold text-ink-600 mb-3">
                Categories
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {CATEGORY_FIELDS.map((f) => {
                  const options = categories?.columns[f.key]?.values ?? [];
                  return (
                    <label key={f.key} className="block">
                      <span className="text-xs text-ink-600">{f.label}</span>
                      <select
                        value={form[f.key] ?? ''}
                        onChange={(e) => set(f.key, e.target.value)}
                        className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-line-strong bg-surface-card text-ink-800 focus:border-brand-500"
                      >
                        <option value="">(absent)</option>
                        {options.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-ink-400 font-mono">
                        {options.length > 0
                          ? `${options.length} values known`
                          : 'vocabulary unavailable'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* numerics */}
            {NUMERIC_GROUPS.map((group) => {
              const isCollapsed = collapsed[group.name];
              return (
                <div key={group.name}>
                  <button
                    type="button"
                    onClick={() =>
                      'collapsible' in group && group.collapsible
                        ? setCollapsed((p) => ({ ...p, [group.name]: !p[group.name] }))
                        : undefined
                    }
                    className="w-full flex items-center justify-between text-left mb-2"
                  >
                    <span>
                      <span className="text-xs font-semibold text-ink-600">
                        {group.name}
                      </span>
                      <span className="block text-[11px] text-ink-400 mt-0.5 normal-case font-normal tracking-normal">
                        {group.hint}
                      </span>
                    </span>
                    {'collapsible' in group && group.collapsible ? (
                      isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-ink-400 shrink-0" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-ink-400 shrink-0" />
                      )
                    ) : null}
                  </button>
                  {!isCollapsed && (
                    <div className="grid sm:grid-cols-4 gap-3">
                      {group.fields.map((f) => (
                        <label key={f.key} className="block">
                          <span className="text-xs text-ink-600">
                            {f.label}
                            {'required' in f && f.required && (
                              <span className="text-danger-600"> *</span>
                            )}
                          </span>
                          <input
                            type="number"
                            step="any"
                            value={form[f.key] ?? ''}
                            onChange={(e) => set(f.key, e.target.value)}
                            placeholder="absent"
                            className="mt-1 w-full px-3 py-2 text-sm font-mono rounded-md border border-line-strong bg-surface-card text-ink-800 placeholder:text-ink-400 focus:border-brand-500"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <footer className="px-5 py-4 border-t border-line flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4" />
              )}
              Score this payment
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(DEFAULTS);
                setResult(null);
                setError(null);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-line text-ink-700 text-sm hover:bg-surface-hover"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </footer>
        </section>
      </form>

      {/* ----------------------------------------------------------- result */}
      <div className="lg:col-span-2 space-y-5">
        {error && (
          <div className="bg-danger-50 border border-danger-100 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-danger-700">
                The service refused this request
              </p>
              <p className="text-xs text-ink-600 mt-1 break-words">{error}</p>
            </div>
          </div>
        )}

        {!result && !error && (
          <div className="bg-surface-card border border-dashed border-line rounded-xl p-8 text-center">
            <ShieldCheck className="w-7 h-7 text-ink-400 mx-auto mb-3" />
            <p className="text-sm text-ink-600">No payment scored yet.</p>
            <p className="text-xs text-ink-500 mt-1">
              The result will show the probability, the cutoff it was compared
              against, and everything needed to reconstruct the decision later.
            </p>
          </div>
        )}

        {result && outcome && (
          <>
            <section className={`rounded-xl border p-5 ${outcome.tone}`}>
              <div className="flex items-center gap-3">
                <OutcomeIcon className="w-6 h-6 text-ink-800" />
                <div className="min-w-0">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${outcome.chip}`}
                  >
                    {result.classification}
                  </span>
                  <h2 className="text-base font-semibold text-ink-900 mt-1">
                    {outcome.label}
                  </h2>
                </div>
              </div>
              <p className="text-xs text-ink-600 mt-2">{outcome.blurb}</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-surface-card/80 rounded-lg p-3 border border-line">
                  <p className="text-[11px] tracking-normal text-ink-600 font-semibold">
                    Fraud probability
                  </p>
                  <p className="text-2xl font-mono font-bold text-ink-900 mt-0.5">
                    {result.fraud_probability.toFixed(6)}
                  </p>
                </div>
                <div className="bg-surface-card/80 rounded-lg p-3 border border-line">
                  <p className="text-[11px] tracking-normal text-ink-600 font-semibold">
                    Compared against
                  </p>
                  <p className="text-2xl font-mono font-bold text-ink-900 mt-0.5">
                    {result.threshold.toFixed(6)}
                  </p>
                </div>
              </div>
            </section>

            {/* what produced this answer */}
            <section className="bg-surface-card border border-line rounded-xl shadow-card p-5">
              <h3 className="text-sm font-semibold text-ink-900 mb-3">
                What produced this answer
              </h3>
              <dl className="text-xs">
                {[
                  ['Model', result.model_version],
                  ['Preprocessing', result.preprocessing_version],
                  ['Score scale', `${result.decision.score_scale} (${result.decision.calibration})`],
                  ['Before calibration', result.raw_score.toFixed(6)],
                  ['Threshold chosen by', result.decision.selection_method],
                  ['Threshold chosen on', result.decision.selected_on_split],
                  ['Assumed cost of a miss', `${result.decision.cost_false_negative}:${result.decision.cost_false_positive}`],
                  ['Scored in', `${result.latency_ms.toFixed(1)} ms`],
                  ['Request', result.request_id.slice(0, 18)],
                  ['Stored', result.stored ? 'yes' : 'no'],
                ].map(([k, v]) => (
                  <div
                    key={k as string}
                    className="flex items-baseline justify-between gap-4 py-1.5 border-b border-line last:border-0"
                  >
                    <dt className="text-ink-500 shrink-0">{k}</dt>
                    <dd className="font-mono text-ink-800 text-right break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* rules */}
            <section className="bg-surface-card border border-line rounded-xl shadow-card p-5">
              <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-brand-600" />
                Rules
                <span className="text-xs font-normal text-ink-500">
                  {result.rules.rules_fired.length} of {result.rules.rules_evaluated} fired
                </span>
              </h3>
              {result.rules.rules_fired.length === 0 ? (
                <p className="text-xs text-ink-500 mt-2">
                  No rule fired. The rules run beside the model rather than inside
                  it, so the score above stands on its own.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {result.rules.rules_fired.map((r) => (
                    <li
                      key={r.rule_id}
                      className="border border-line rounded-lg p-3 bg-surface-sunken"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <code className="text-xs font-mono font-semibold text-ink-900">
                          {r.rule_name}
                        </code>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-danger-50 text-danger-700 border border-danger-100">
                          {r.risk_level}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-ink-600 mt-1">
                        {r.field} {r.operator} {r.threshold ?? ''}
                        {r.lift_over_base_rate != null && (
                          <span className="text-ink-400">
                            {' '}· lift {r.lift_over_base_rate.toFixed(2)}×
                          </span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* what the server did with the fields */}
            <section className="bg-surface-card border border-line rounded-xl shadow-card p-5">
              <h3 className="text-sm font-semibold text-ink-900 mb-2">
                What the server did with your fields
              </h3>
              <p className="text-xs text-ink-500">
                {result.input_report.fields_supplied} of{' '}
                {result.input_report.fields_expected} columns came from the request.
              </p>
              {(['absent', 'unknown_category', 'imputed_median'] as const).map((k) => {
                const list = result.input_report[k];
                if (!list || list.length === 0) return null;
                const title = {
                  absent: 'Treated as absent (coded −1)',
                  unknown_category: 'Not recognised (coded −1)',
                  imputed_median: 'Filled with the training median',
                }[k];
                return (
                  <div key={k} className="mt-3">
                    <p className="text-[11px] font-semibold text-ink-600">{title}</p>
                    <p className="text-[11px] font-mono text-ink-500 mt-1 break-words">
                      {list.join(', ')}
                    </p>
                  </div>
                );
              })}
              <p className="text-[11px] text-ink-400 mt-3 leading-relaxed">
                {result.input_report.note}
              </p>
            </section>

            {/* explanation */}
            {result.explanation && (
              <section className="bg-surface-card border border-line rounded-xl shadow-card p-5">
                <h3 className="text-sm font-semibold text-ink-900 mb-3">
                  Which groups of fields moved the score
                </h3>
                <ul className="space-y-2">
                  {result.explanation.groups.slice(0, 8).map((g) => {
                    const max = Math.max(
                      ...result.explanation!.groups.map((x) => Math.abs(x.contribution)),
                    );
                    const pct = max ? (Math.abs(g.contribution) / max) * 100 : 0;
                    const up = g.direction === 'increases_risk';
                    return (
                      <li key={g.group}>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-ink-700">{g.group}</span>
                          <span
                            className={`font-mono ${up ? 'text-danger-700' : 'text-positive-700'}`}
                          >
                            {g.contribution > 0 ? '+' : ''}
                            {g.contribution.toFixed(4)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-sunken mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${up ? 'bg-danger-500' : 'bg-positive-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-ink-400 mt-3 leading-relaxed">
                  {result.explanation.note}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};
