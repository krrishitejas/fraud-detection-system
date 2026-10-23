import React from 'react';
import {
  Target,
  Cpu,
  Layers,
  Brain,
  Activity,
  Compass,
} from 'lucide-react';

export const AboutResearchPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title Card */}
      <div className="rounded-2xl bg-surface-sunken border border-line p-6 sm:p-8 shadow-card space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-ink-900/10 text-data-700 border border-data-100">
          <span>Major Academic Project Specification</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight leading-snug">
          An Explainable Dynamic Graph Learning Framework for Adaptive Financial Fraud Detection under Concept Drift
        </h2>
        <p className="text-sm text-ink-700 leading-relaxed">
          Comprehensive research documentation outlining the motivation, algorithmic design, empirical validation
          benchmarks, interpretability framework, and operational boundaries of this major project.
        </p>
      </div>

      {/* Section 1: Problem Statement & Motivation */}
      <div className="rounded-xl bg-surface-card border border-line p-6 shadow-card space-y-3">
        <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-flag-700" />
          <span>1. Problem Statement & Motivation</span>
        </h3>
        <div className="text-xs text-ink-700 space-y-2.5 leading-relaxed">
          <p>
            Online financial transactions are characterized by severe class imbalance (fraud typically accounts for &lt; 3.5%
            of total volume) and non-stationary transaction environments where fraud syndicates continually adapt their
            modus operandi. Traditional static supervised machine learning models degrade rapidly over time due to{' '}
            <strong className="text-ink-900">concept drift</strong>, the shift in the relationship between input transaction
            attributes and fraud outcomes (<code className="text-data-700 font-mono">P(Y|X)</code>).
          </p>
          <p>
            This project investigates how tabular gradient-boosted decision trees, graph-based relational aggregations,
            explainable AI (TreeSHAP), and sequential model retraining interact to maintain high precision-recall detection
            performance under evolving transaction distributions.
          </p>
        </div>
      </div>

      {/* Section 2: Model Architecture & Benchmark */}
      <div className="rounded-xl bg-surface-card border border-line p-6 shadow-card space-y-3">
        <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-data-700" />
          <span>2. Model Architecture & Validation Findings</span>
        </h3>
        <div className="text-xs text-ink-700 space-y-3 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-lg bg-surface-page border border-data-100 space-y-2">
              <div className="font-semibold text-ink-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-data-700" />
                <span>Tabular XGBoost, the model in service</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-ink-600 text-[11px]">
                <li>Features: 32 standardised transaction attributes</li>
                <li>Three models averaged on the log-odds scale, so one seed is not a draw</li>
                <li>
                  Held-out PR-AUC 0.5138, ROC-AUC 0.9016, over 88,081 rows scored once
                </li>
                <li>
                  Its first version scored 0.5529 PR-AUC on the validation window in 2026;
                  that figure is historical and was never measured on held-out data
                </li>
                <li>The live figures are served at /api/model/info and shown on the overview</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-surface-page border border-line space-y-2">
              <div className="font-semibold text-ink-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-ink-500" />
                <span>Multi-Entity Graph Prototype (Research Prototype)</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-ink-500 text-[11px]">
                <li>Entities: Card, Address, Email, and Device historical graphs</li>
                <li>Aggregation: Learned multi-entity neighborhood aggregation</li>
                <li>Validation PR-AUC: <strong className="text-ink-700 font-mono">0.3923</strong></li>
                <li>Validation ROC-AUC: <strong className="text-ink-700 font-mono">0.8508</strong></li>
                <li>Status: Research prototype (validation performance is below XGBoost)</li>
              </ul>
            </div>
          </div>

          <p className="text-ink-500">
            <strong className="text-ink-900">Why PR-AUC Matters:</strong> In fraud detection datasets, ROC-AUC can be
            misleadingly optimistic because the vast number of true negatives dwarfs the minority fraud class. PR-AUC
            measures the precise tradeoff between precision and recall, demonstrating that the optimized tabular XGBoost
            model provided superior fraud isolation.
          </p>
        </div>
      </div>

      {/* Section 3: Explainability & TreeSHAP */}
      <div className="rounded-xl bg-surface-card border border-line p-6 shadow-card space-y-3">
        <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
          <Brain className="w-4 h-4 text-ink-500" />
          <span>3. Interpretability & TreeSHAP Framework</span>
        </h3>
        <div className="text-xs text-ink-700 space-y-2.5 leading-relaxed">
          <p>
            For financial compliance and fraud investigator auditability, the system embeds TreeSHAP (Shapley Additive
            exPlanations), computing both:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-surface-page rounded-lg border border-line">
              <strong className="text-ink-900 block mb-1">Global Feature Attribution</strong>
              Rankings across the entire dataset highlight that features <code className="text-data-700">C5</code>,{' '}
              <code className="text-data-700">C13</code>, and <code className="text-data-700">TransactionAmt</code>{' '}
              consistently govern the ensemble&apos;s decision splits.
            </div>
            <div className="p-3 bg-surface-page rounded-lg border border-line">
              <strong className="text-ink-900 block mb-1">Local Transaction Attribution</strong>
              Each individual API prediction computes real-time Shapley values, highlighting which features increased or
              decreased risk for that specific transaction.
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Concept Drift & Sequential Adaptation */}
      <div className="rounded-xl bg-surface-card border border-line p-6 shadow-card space-y-3">
        <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-clear-700" />
          <span>4. Concept Drift (PSI) & Sequential Adaptation</span>
        </h3>
        <div className="text-xs text-ink-700 space-y-2.5 leading-relaxed">
          <p>
            To evaluate model resilience over time, the dataset was divided into 5 chronological evaluation blocks (17,616
            transactions each).
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-ink-500 pl-1">
            <li>
              <strong className="text-ink-900">Population Stability Index (PSI):</strong> Covariate shift excluding{' '}
              <code className="text-data-700">TransactionDT</code> was minimal (median PSI &lt; 0.025), confirming feature
              distributions remained stable across time blocks.
            </li>
            <li>
              <strong className="text-ink-900">Sequential Retraining Gain:</strong> Retraining models adaptively using prior
              labeled blocks yielded a <strong className="text-clear-700">+7.62% mean PR-AUC gain</strong> over a fixed
              model (with Block 5 achieving a 0.6228 PR-AUC vs. 0.4865 fixed).
            </li>
          </ul>
        </div>
      </div>

      {/* Section 5: Current Scope vs. Future Roadmap */}
      <div className="rounded-xl bg-surface-card border border-line p-6 shadow-card space-y-3">
        <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
          <Compass className="w-4 h-4 text-hold-600" />
          <span>5. Research Demo Scope vs. Production Roadmap</span>
        </h3>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-line text-ink-500 bg-surface-page/80">
                <th className="py-2.5 px-3">System Dimension</th>
                <th className="py-2.5 px-3">Current Academic Major Project Scope</th>
                <th className="py-2.5 px-3 text-data-700">Enterprise Production Roadmap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[11px]">
              <tr className="hover:bg-surface-sunken/50">
                <td className="py-2.5 px-3 text-ink-900 font-semibold">Inference Model</td>
                <td className="py-2.5 px-3 text-ink-700">Tabular XGBoost Classifier (32 standardized features)</td>
                <td className="py-2.5 px-3 text-ink-700">Continuous Dynamic Temporal GNN + Tree Ensemble hybrid</td>
              </tr>
              <tr className="hover:bg-surface-sunken/50">
                <td className="py-2.5 px-3 text-ink-900 font-semibold">Drift Monitoring</td>
                <td className="py-2.5 px-3 text-ink-700">Historical 5-block PSI summaries from Colab experiments</td>
                <td className="py-2.5 px-3 text-ink-700">Real-time streaming PSI & KS tests on Kafka transaction topics</td>
              </tr>
              <tr className="hover:bg-surface-sunken/50">
                <td className="py-2.5 px-3 text-ink-900 font-semibold">Retraining</td>
                <td className="py-2.5 px-3 text-ink-700">Offline block-based sequential retraining comparison</td>
                <td className="py-2.5 px-3 text-ink-700">Automated PSI-triggered retraining pipeline with shadow validation</td>
              </tr>
              <tr className="hover:bg-surface-sunken/50">
                <td className="py-2.5 px-3 text-ink-900 font-semibold">Categorical Encoding</td>
                <td className="py-2.5 px-3 text-ink-700">Pre-encoded numeric values strictly required</td>
                <td className="py-2.5 px-3 text-ink-700">Online feature store with string category tokenizer mappings</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
