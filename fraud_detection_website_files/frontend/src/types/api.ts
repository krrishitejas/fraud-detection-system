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
