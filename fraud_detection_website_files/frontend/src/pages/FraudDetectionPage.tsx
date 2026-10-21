import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Sliders,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiService, formatApiError } from '../services/api';
import type { PredictionResult, LocalFeatureContribution } from '../types/api';

// Group 32 features for human readability and clear form navigation
const FEATURE_GROUPS = [
  {
    name: 'Transaction Overview',
    description: 'Transaction amount and temporal timestamp',
    features: ['TransactionAmt', 'TransactionDT', 'ProductCD'],
  },
  {
    name: 'Payment Card Profile',
    description: 'Numeric encoded card attributes (card1 - card6)',
    features: ['card1', 'card2', 'card3', 'card4', 'card5', 'card6'],
  },
  {
    name: 'Geographic & Address',
    description: 'Numeric billing and distance indicators',
    features: ['addr1', 'addr2', 'dist1', 'dist2'],
  },
  {
    name: 'Email Domains (Pre-encoded)',
    description: 'Numeric encoded purchaser and recipient domain indices',
    features: ['P_emaildomain', 'R_emaildomain'],
  },
  {
    name: 'Activity Counts (C1 - C14)',
    description: 'Aggregated transaction frequency counters',
    features: [
      'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7',
      'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14',
    ],
  },
  {
    name: 'Timedeltas (D1 - D3)',
    description: 'Days since previous transaction events',
    features: ['D1', 'D2', 'D3'],
  },
];

export const FraudDetectionPage: React.FC = () => {
  const [features, setFeatures] = useState<Record<string, number>>({});
  const [loadingSample, setLoadingSample] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'Activity Counts (C1 - C14)': false,
  });

  // Load sample transaction on initial mount
  useEffect(() => {
    loadSample();
  }, []);

  const loadSample = async () => {
    setLoadingSample(true);
    setError(null);
    try {
      const sample = await apiService.getSampleTransaction();
      setFeatures(sample.features);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoadingSample(false);
    }
  };

  const handleInputChange = (key: string, valStr: string) => {
    const val = parseFloat(valStr);
    setFeatures((prev) => ({
      ...prev,
      [key]: isNaN(val) ? 0 : val,
    }));
  };

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    // Validate all numeric
    for (const [k, v] of Object.entries(features)) {
      if (typeof v !== 'number' || isNaN(v)) {
        setError(`Feature '${k}' must be a valid number.`);
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await apiService.predictSingle({
        features,
        include_explanation: true,
      });
      setResult(res);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Find maximum TreeSHAP value for relative bar width
  const maxShap = result?.local_explanations
    ? Math.max(...result.local_explanations.map((x) => x.abs_contribution), 0.001)
    : 1;

  return (
    <div className="space-y-6">
      {/* Informational Guidance Notice */}
      <div className="rounded-xl bg-navy-900 border border-accent-cyan/30 p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-accent-cyan flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs text-slate-300">
            <h3 className="font-semibold text-white text-sm">
              Input Preprocessing & Encoding Notice
            </h3>
            <p>
              The trained model artifact requires <strong className="text-white">32 numeric, pre-encoded features</strong>.
              Categorical attributes (<code className="text-accent-cyan font-mono">ProductCD</code>,{' '}
              <code className="text-accent-cyan font-mono">card4</code>,{' '}
              <code className="text-accent-cyan font-mono">card6</code>,{' '}
              <code className="text-accent-cyan font-mono">P_emaildomain</code>,{' '}
              <code className="text-accent-cyan font-mono">R_emaildomain</code>) were converted to numeric values during Colab
              training. Raw strings cannot be evaluated without the original category mappings.
            </p>
            <p className="text-slate-400">
              Use the <span className="text-accent-cyan font-medium">Load Baseline Sample</span> button below to populate the
              form with verified training medians, then modify amounts or count values to test decision boundaries.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Left Input Form, Right Result Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Panel */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-700/60 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-white">Transaction Features</h3>
                <p className="text-xs text-slate-400">Provide 32 numeric attributes for XGBoost inference</p>
              </div>
              <button
                type="button"
                onClick={loadSample}
                disabled={loadingSample}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent-cyan bg-accent-cyan/10 hover:bg-accent-cyan/20 border border-accent-cyan/30 transition-all"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loadingSample ? 'animate-spin' : ''}`} />
                <span>Load Baseline Sample</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {FEATURE_GROUPS.map((group) => {
                const isCollapsed = collapsedGroups[group.name];
                return (
                  <div
                    key={group.name}
                    className="rounded-lg bg-navy-950/60 border border-navy-800 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.name)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-navy-800/40 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{group.name}</div>
                        <div className="text-[11px] text-slate-400">{group.description}</div>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {!isCollapsed && (
                      <div className="p-4 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-navy-800/60">
                        {group.features.map((feat) => (
                          <div key={feat} className="space-y-1">
                            <label className="block text-[11px] font-mono text-slate-400 truncate" title={feat}>
                              {feat}
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={features[feat] ?? ''}
                              onChange={(e) => handleInputChange(feat, e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-mono bg-navy-900 border border-navy-700 rounded-md text-white focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-colors"
                              placeholder="0.0"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {error && (
                <div className="rounded-lg bg-accent-rose/10 border border-accent-rose/30 p-3 text-xs text-accent-rose flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-accent-cyan to-accent-blue text-navy-950 hover:brightness-110 transition-all shadow-glow-cyan disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                  <span>{submitting ? 'Evaluating Model...' : 'Score Transaction'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Prediction Results Panel */}
        <div className="lg:col-span-5 space-y-4">
          {/* Main Result Card */}
          <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-700/60">
              <h3 className="text-base font-bold text-white">Prediction & Assessment</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-navy-800 text-slate-400 border border-navy-700">
                Threshold: 0.50
              </span>
            </div>

            {result ? (
              <div className="space-y-4">
                {/* Score Banner */}
                <div
                  className={`p-5 rounded-xl border text-center space-y-2 ${
                    result.is_fraud
                      ? 'bg-accent-rose/10 border-accent-rose/40 text-accent-rose'
                      : 'bg-accent-emerald/10 border-accent-emerald/40 text-accent-emerald'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {result.is_fraud ? (
                      <ShieldAlert className="w-6 h-6 text-accent-rose" />
                    ) : (
                      <ShieldCheck className="w-6 h-6 text-accent-emerald" />
                    )}
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider">
                      Model Classification
                    </span>
                  </div>

                  <div className="text-4xl font-extrabold font-mono tracking-tight">
                    {(result.fraud_probability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-300">Fraud Probability Score</div>

                  <div className="pt-2 flex items-center justify-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        result.is_fraud
                          ? 'bg-accent-rose text-navy-950'
                          : 'bg-accent-emerald text-navy-950'
                      }`}
                    >
                      {result.prediction}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-mono uppercase bg-navy-950/80 text-white border border-navy-700">
                      {result.risk_category} Risk Tier
                    </span>
                  </div>
                </div>

                {/* Model Metadata */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-navy-950/60 p-3 rounded-lg border border-navy-800 text-slate-400">
                  <div>
                    <span className="text-slate-500">Legitimate Prob:</span>{' '}
                    <span className="text-slate-200">
                      {(result.legitimate_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Threshold:</span>{' '}
                    <span className="text-slate-200">{result.decision_threshold}</span>
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="text-slate-500">Model:</span>{' '}
                    <span className="text-slate-200">{result.model_identifier}</span>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="p-3 rounded-lg bg-navy-950 border border-navy-800 text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-300">Research Disclaimer:</strong> This score is a demonstration of the
                  academic XGBoost baseline model. Presentation risk tiers (low, medium, high) require empirical loss-matrix
                  calibration before production deployment.
                </div>
              </div>
            ) : (
              <div className="py-12 px-4 text-center space-y-3">
                <Sliders className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-medium text-slate-300">No Prediction Evaluated Yet</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Populate transaction values and click &quot;Score Transaction&quot; to inspect model probabilities and local
                  TreeSHAP attributions.
                </p>
              </div>
            )}
          </div>

          {/* Local TreeSHAP Waterfall Card */}
          <div className="rounded-xl bg-navy-900 border border-navy-700/60 p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-700/60">
              <div>
                <h3 className="text-base font-bold text-white">Local Feature Attribution</h3>
                <p className="text-xs text-slate-400">TreeSHAP breakdown for this transaction</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30">
                TreeSHAP
              </span>
            </div>

            {result?.local_explanations && result.local_explanations.length > 0 ? (
              <div className="space-y-2.5">
                {result.local_explanations.map((item: LocalFeatureContribution) => {
                  const isPositive = item.direction === 'increases_risk';
                  const widthPercent = Math.min((item.abs_contribution / maxShap) * 100, 100);

                  return (
                    <div key={item.feature} className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-300 font-semibold">{item.feature}</span>
                        <span
                          className={
                            isPositive ? 'text-accent-rose font-semibold' : 'text-accent-emerald font-semibold'
                          }
                        >
                          {isPositive ? '+' : ''}
                          {item.shap_value.toFixed(4)} ({isPositive ? 'Increases Risk' : 'Decreases Risk'})
                        </span>
                      </div>
                      <div className="h-2 w-full bg-navy-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isPositive ? 'bg-accent-rose' : 'bg-accent-emerald'
                          }`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-slate-500 pt-1">
                  Positive values push prediction toward Fraud; negative values push toward Legitimate.
                </p>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                Submit a transaction to view local feature contributions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
