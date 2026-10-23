// Health Schema
export interface HealthResponse {
  status: 'healthy' | 'degraded' | string;
  model_loaded: boolean;
  model_type?: string | null;
  expected_features: number;
  boosting_rounds?: number | null;
  best_iteration?: number | null;
  initialization_error?: string | null;
}

// Prediction & Local Explainability
export interface LocalFeatureContribution {
  feature: string;
  shap_value: number;
  abs_contribution: number;
  direction: 'increases_risk' | 'decreases_risk';
}

export interface PredictionResult {
  prediction: 'fraud' | 'legitimate';
  is_fraud: boolean;
  fraud_probability: number;
  legitimate_probability: number;
  risk_category: 'low' | 'medium' | 'high';
  decision_threshold: number;
  model_identifier: string;
  status: string;
  local_explanations?: LocalFeatureContribution[] | null;
  disclaimer: string;
}

export interface SinglePredictionRequest {
  features: Record<string, number>;
  include_explanation?: boolean;
}

export interface BatchPredictionRequest {
  transactions: Record<string, number>[];
  include_explanations?: boolean;
}

export interface BatchPredictionResponse {
  total_processed: number;
  fraud_count: number;
  legitimate_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  predictions: PredictionResult[];
}

export interface CsvPredictionItem {
  row_index: number;
  prediction: 'fraud' | 'legitimate' | string;
  fraud_probability: number;
  risk_category: 'low' | 'medium' | 'high' | string;
}

export interface CsvPredictionResponse {
  filename: string;
  total_rows_scored: number;
  fraud_count: number;
  legitimate_count: number;
  fraud_rate: number;
  decision_threshold: number;
  predictions: CsvPredictionItem[];
}

export interface SampleTransactionResponse {
  features: Record<string, number>;
  include_explanation: boolean;
  feature_count: number;
  note: string;
}

// Global Feature Importance
export interface FeatureImportanceItem {
  feature: string;
  mean_absolute_shap_contribution: number;
  rank: number;
}

export interface FeatureImportanceResponse {
  total_features: number;
  features: FeatureImportanceItem[];
  method: string;
  disclaimer: string;
}

export interface LocalExplanationResponse {
  fraud_probability: number;
  risk_category: string;
  top_contributions: LocalFeatureContribution[];
  disclaimer: string;
}

// Drift Monitoring
export interface DriftBlockItem {
  time_block: number;
  transactions?: number | null;
  median_psi: number;
  mean_psi: number;
  features_psi_over_010: number;
  features_psi_over_025: number;
}

export interface DriftMonitoringResponse {
  evaluated_blocks: number;
  psi_summary_all_features: DriftBlockItem[];
  psi_summary_excluding_time: DriftBlockItem[];
  interpretation: string;
  limitations: string;
}

// Model & Research Information
export interface ModelComparisonItem {
  model: string;
  validation_pr_auc: number;
  validation_roc_auc: number;
  status: string;
}

export interface AdaptiveBlockResult {
  block: number;
  transactions: number;
  fraud_count: number;
  fixed_pr_auc: number;
  adaptive_pr_auc: number;
  fixed_roc_auc: number;
  adaptive_roc_auc: number;
  previous_labeled_transactions: number;
  pr_auc_gain: number;
  roc_auc_gain: number;
}

export interface SequentialAdaptationSummary {
  baseline_validation_pr_auc?: number;
  graph_validation_pr_auc?: number;
  graph_validation_roc_auc?: number;
  mean_sequential_adaptation_pr_auc_gain?: number;
  block_5_fixed_pr_auc?: number;
  block_5_adaptive_pr_auc?: number;
}

export interface ModelInfoResponse {
  research_title: string;
  active_inference_model: string;
  expected_features: number;
  feature_names: string[];
  model_comparison: ModelComparisonItem[];
  sequential_adaptation_summary: SequentialAdaptationSummary;
  adaptive_block_results: AdaptiveBlockResult[];
  research_limitations: string[];
  evaluation_protocol_note: string;
}

/* ------------------------------------------------------------------------- *
 * POST /api/model/predict -- the Week 4 interface contract.
 *
 * These are a different shape from the older /api/predict types above, and
 * deliberately so. The older endpoint takes a prepared 32-number feature vector
 * and answers with a label. This one takes a payment, encodes it server-side,
 * applies the calibration, and answers with a decision that carries the model
 * version, the preprocessing version, and the threshold record it was made under,
 * so somebody can reconstruct it afterwards.
 * ------------------------------------------------------------------------- */

export type PayloadType = 'raw_transaction' | 'processed_features';
export type Classification = 'FRAUD' | 'REVIEW' | 'LEGITIMATE';

export interface ContractPredictRequest {
  payload_type: PayloadType;
  transaction_id: number;
  transaction_dt: number;
  preprocessing_version?: string | null;
  model_version?: string | null;
  return_explanation?: boolean;
  transaction?: Record<string, string | number | null>;
  features?: Record<string, number>;
}

export interface DecisionBlock {
  threshold_config_id: number;
  score_scale: string;
  calibration: string;
  applies_to_model_version: string;
  selection_method: string;
  selected_on_split: string;
  cost_false_negative: number;
  cost_false_positive: number;
  cost_assumption_note: string;
  review_low: number;
  approved_by?: string | null;
  approved_at?: string | null;
}

export interface FiredRule {
  rule_id: number;
  rule_name: string;
  field: string;
  operator: string;
  threshold?: number | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  version: number;
  observed_fraud_rate_pct?: number | null;
  lift_over_base_rate?: number | null;
  rule_source?: string | null;
}

export interface RuleBlock {
  rules_evaluated: number;
  rules_fired: FiredRule[];
  highest_rule_risk?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

export interface GroupContribution {
  group: string;
  contribution: number;
  direction: 'increases_risk' | 'decreases_risk';
}

export interface ContractExplanation {
  method: string;
  base_value: number;
  groups: GroupContribution[];
  note: string;
}

export interface InputReport {
  fields_supplied: number;
  fields_expected: number;
  absent?: string[];
  unknown_category?: string[];
  imputed_median?: string[];
  note: string;
}

export interface ContractPredictResponse {
  request_id: string;
  transaction_id: number;
  fraud_probability: number;
  raw_score: number;
  threshold: number;
  classification: Classification;
  decision: DecisionBlock;
  rules: RuleBlock;
  input_report: InputReport;
  model_version: string;
  preprocessing_version: string;
  scored_at: string;
  latency_ms: number;
  stored: boolean;
  explanation?: ContractExplanation | null;
}

export interface ThresholdSensitivityRow {
  cost_ratio: number;
  threshold: number;
  alert_rate_pct: number;
  recall: number;
  cost_at_half: number;
  cost_at_best: number;
  waste_pct: number;
}

export interface ThresholdRecord extends DecisionBlock {
  value: number;
  sensitivity?: ThresholdSensitivityRow[];
}

export interface RuleCatalogueEntry extends FiredRule {
  is_active: boolean;
  description?: string;
  branch?: string;
  train_hits?: number;
  train_hit_rate_pct?: number;
  train_fraud_rate_pct?: number;
  train_lift?: number;
  validation_hits?: number;
  validation_fraud_rate_pct?: number;
  validation_lift?: number;
}

export interface RuleCatalogueResponse {
  active: number;
  total: number;
  note: string;
  rules: RuleCatalogueEntry[];
}

export interface StoredPrediction {
  prediction_id: number;
  request_id: string;
  scored_at: string;
  model_version: string;
  preprocessing_version: string;
  threshold_value: number;
  score_scale: string;
  fraud_probability: number;
  raw_score: number;
  decision: 'fraud' | 'legitimate';
  risk_band: Classification;
  highest_rule_risk?: string | null;
  rules_fired: FiredRule[];
  latency_ms: number;
}

export interface AuditResponse {
  summary: {
    enabled: boolean;
    database?: string;
    stored_predictions: number;
    flagged?: number;
    flagged_rate_pct?: number;
    mean_fraud_probability?: number | null;
    mean_latency_ms?: number | null;
    first_scored_at?: string | null;
    last_scored_at?: string | null;
  };
  predictions: StoredPrediction[];
}

export interface CategoryColumn {
  values: string[];
  count: number;
  absent_code: number;
}

export interface CategoriesResponse {
  columns: Record<string, CategoryColumn>;
  note: string;
}
