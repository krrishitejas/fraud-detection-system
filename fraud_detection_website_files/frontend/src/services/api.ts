import axios, { AxiosError } from 'axios';
import type {
  HealthResponse,
  ModelInfoResponse,
  SampleTransactionResponse,
  SinglePredictionRequest,
  PredictionResult,
  BatchPredictionRequest,
  BatchPredictionResponse,
  CsvPredictionResponse,
  FeatureImportanceResponse,
  LocalExplanationResponse,
  DriftMonitoringResponse,
  ContractPredictRequest,
  ContractPredictResponse,
  ThresholdRecord,
  RuleCatalogueResponse,
  AuditResponse,
  CategoriesResponse,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

/**
 * Helper to extract human-friendly error messages from API responses.
 */
export function formatApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ detail?: string | Array<{ msg?: string; loc?: string[] }> }>;
    if (axiosErr.response?.data?.detail) {
      const detail = axiosErr.response.data.detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        return detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
      }
      return JSON.stringify(detail);
    }
    if (axiosErr.response?.status === 503) {
      return 'The ML prediction service is currently unavailable or model is loading.';
    }
    if (axiosErr.response?.status === 404) {
      return 'Requested API endpoint was not found.';
    }
    if (axiosErr.code === 'ECONNABORTED') {
      return 'Request timed out. Please check backend server status.';
    }
    if (!axiosErr.response) {
      return 'Cannot reach the API. The backend serves this page, so if you can read this the server is up but the API is not answering — check its log.';
    }
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export const apiService = {
  // Health
  getHealth: async (): Promise<HealthResponse> => {
    const res = await apiClient.get<HealthResponse>('/health');
    return res.data;
  },

  // Model & Research Information
  getModelInfo: async (): Promise<ModelInfoResponse> => {
    const res = await apiClient.get<ModelInfoResponse>('/model/info');
    return res.data;
  },

  // Sample Transaction Payload
  getSampleTransaction: async (): Promise<SampleTransactionResponse> => {
    const res = await apiClient.get<SampleTransactionResponse>('/model/sample-transaction');
    return res.data;
  },

  // Single Transaction Prediction
  predictSingle: async (request: SinglePredictionRequest): Promise<PredictionResult> => {
    const res = await apiClient.post<PredictionResult>('/predict', request);
    return res.data;
  },

  // Batch Prediction
  predictBatch: async (request: BatchPredictionRequest): Promise<BatchPredictionResponse> => {
    const res = await apiClient.post<BatchPredictionResponse>('/predict/batch', request);
    return res.data;
  },

  // CSV Prediction (JSON response)
  predictCsvJson: async (file: File): Promise<CsvPredictionResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<CsvPredictionResponse>('/predict/csv?as_csv=false', formData);
    return res.data;
  },

  // CSV Prediction (Downloadable CSV)
  predictCsvDownload: async (file: File): Promise<Blob> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/predict/csv?as_csv=true', formData, {
      responseType: 'blob',
    });
    return res.data as Blob;
  },

  // Global Feature Importance
  getFeatureImportance: async (): Promise<FeatureImportanceResponse> => {
    const res = await apiClient.get<FeatureImportanceResponse>('/explainability/feature-importance');
    return res.data;
  },

  // Local TreeSHAP Explanation
  getLocalExplanation: async (request: SinglePredictionRequest): Promise<LocalExplanationResponse> => {
    const res = await apiClient.post<LocalExplanationResponse>('/explainability/local', request);
    return res.data;
  },

  // Concept Drift Monitoring
  getDriftMonitoring: async (): Promise<DriftMonitoringResponse> => {
    const res = await apiClient.get<DriftMonitoringResponse>('/monitoring/drift');
    return res.data;
  },

  /* --- The Week 4 interface contract ------------------------------------- */

  // Score one payment under the contract. Unlike predictSingle, this accepts a
  // transaction with text categories, applies the calibration, and returns the
  // versions and threshold record the decision was made under.
  contractPredict: async (
    request: ContractPredictRequest,
  ): Promise<ContractPredictResponse> => {
    const res = await apiClient.post<ContractPredictResponse>('/model/predict', request);
    return res.data;
  },

  getThresholdRecord: async (): Promise<ThresholdRecord> => {
    const res = await apiClient.get<ThresholdRecord>('/model/threshold');
    return res.data;
  },

  getRuleCatalogue: async (): Promise<RuleCatalogueResponse> => {
    const res = await apiClient.get<RuleCatalogueResponse>('/rules');
    return res.data;
  },

  // The category vocabulary the server knows how to encode. Fetched rather than
  // hard-coded: the encoding table is a training artefact and copying it into the
  // client is how training and serving drift apart.
  getCategories: async (): Promise<CategoriesResponse> => {
    const res = await apiClient.get<CategoriesResponse>('/model/categories');
    return res.data;
  },

  getRecentDecisions: async (limit = 25): Promise<AuditResponse> => {
    const res = await apiClient.get<AuditResponse>(`/audit/recent?limit=${limit}`);
    return res.data;
  },
};
