import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileDown,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { apiService, formatApiError } from '../services/api';
import type { CsvPredictionResponse } from '../types/api';

export const BatchAnalysisPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CsvPredictionResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 15;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    setError(null);
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a valid CSV file (.csv format).');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File exceeds maximum allowed upload size of 10MB.');
      return;
    }
    setFile(f);
    setResults(null);
  };

  const handleScoreJson = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.predictCsvJson(file);
      setResults(res);
      setCurrentPage(1);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!file) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await apiService.predictCsvDownload(file);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scored_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const sample = await apiService.getSampleTransaction();
      const headers = Object.keys(sample.features);
      const values = Object.values(sample.features);
      const csvContent = headers.join(',') + '\n' + values.join(',');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_32_features.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not generate sample CSV. Ensure backend is running.');
    }
  };

  // Filtered predictions
  const filteredPredictions = (results?.predictions || []).filter((p) => {
    const matchesSearch =
      searchTerm === '' ||
      `#${p.row_index + 1}`.includes(searchTerm) ||
      p.prediction.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === 'all' || p.risk_category.toLowerCase() === riskFilter.toLowerCase();
    return matchesSearch && matchesRisk;
  });

  const totalPages = Math.ceil(filteredPredictions.length / PAGE_SIZE) || 1;
  const paginatedPredictions = filteredPredictions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      {/* Informational Guidance Notice */}
      <div className="rounded-xl bg-surface-card border border-line-strong p-5 shadow-lg">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h3 className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-brand-600" />
              <span>Batch CSV Transaction Scoring</span>
            </h3>
            <p className="text-xs text-ink-700 leading-relaxed">
              Upload a comma-separated values file containing the{' '}
              <strong className="text-ink-900">32 verified feature columns</strong>. All values must be numeric or pre-encoded.
              Missing numerical values are imputed with training set medians before model inference.
            </p>
            <p className="text-[11px] text-ink-500 font-mono">
              Maximum supported limits: 5,000 rows &bull; 10MB file size
            </p>
          </div>
          <button
            onClick={handleDownloadSample}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-ink-700 hover:text-ink-900 bg-surface-hover hover:bg-surface-active border border-line-strong transition-colors"
          >
            <FileDown className="w-4 h-4 text-brand-600" />
            <span>Download 32-Feature Sample CSV</span>
          </button>
        </div>
      </div>

      {/* Upload Box */}
      <div className="rounded-xl bg-surface-card border border-line-strong p-6 shadow-lg space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all ${
            dragOver
              ? 'border-brand-600 bg-brand-600/5'
              : 'border-line-strong bg-surface-page/50 hover:border-line-strong'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center mx-auto mb-3 text-brand-600 shadow-card">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h4 className="text-sm font-semibold text-ink-900 mb-1">
            Drag and drop your transaction CSV here
          </h4>
          <p className="text-xs text-ink-500 mb-4">
            Supports standard UTF-8 encoded .csv files with header row
          </p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-surface-hover hover:bg-surface-active text-ink-800 border border-line-strong transition-colors"
          >
            Browse Local File
          </button>

          {file && (
            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface-sunken border border-brand-600/30 text-xs font-mono text-brand-600">
              <FileSpreadsheet className="w-4 h-4" />
              <span>{file.name}</span>
              <span className="text-ink-500">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-danger-600/10 border border-danger-600/30 p-3.5 text-xs text-danger-600 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">CSV Processing Error</p>
              <p className="text-ink-700 mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleDownloadCsv}
            disabled={!file || loading || downloading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-surface-hover hover:bg-surface-active text-ink-800 border border-line-strong disabled:opacity-40 transition-colors"
          >
            <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
            <span>{downloading ? 'Exporting...' : 'Download Scored CSV'}</span>
          </button>
          <button
            onClick={handleScoreJson}
            disabled={!file || loading || downloading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:brightness-110 disabled:opacity-40 transition-all shadow-card"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Scoring Rows...' : 'Score & View in Dashboard'}</span>
          </button>
        </div>
      </div>

      {/* Results View */}
      {results && (
        <div className="rounded-xl bg-surface-card border border-line-strong p-6 shadow-lg space-y-6">
          {/* Summary Cards */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-line-strong">
              <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-positive-600" />
                <span>Batch Evaluation Results: {results.filename}</span>
              </h3>
              <span className="text-xs font-mono text-ink-500">
                Decision Threshold: {results.decision_threshold}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-surface-page border border-line">
                <div className="text-xs text-ink-500 font-mono">Total Processed</div>
                <div className="text-2xl font-bold font-mono text-ink-900 mt-1">
                  {results.total_rows_scored.toLocaleString()}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-surface-page border border-danger-600/30">
                <div className="text-xs text-danger-600 font-mono">Predicted Fraud</div>
                <div className="text-2xl font-bold font-mono text-danger-600 mt-1">
                  {results.fraud_count.toLocaleString()}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-surface-page border border-positive-600/30">
                <div className="text-xs text-positive-600 font-mono">Predicted Legitimate</div>
                <div className="text-2xl font-bold font-mono text-positive-600 mt-1">
                  {results.legitimate_count.toLocaleString()}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-surface-page border border-brand-600/30">
                <div className="text-xs text-brand-600 font-mono">Batch Fraud Rate</div>
                <div className="text-2xl font-bold font-mono text-brand-600 mt-1">
                  {(results.fraud_rate * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-ink-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter row # or prediction..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-page border border-line-strong rounded-lg text-ink-900 font-mono focus:outline-none focus:border-brand-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-ink-500" />
              <select
                value={riskFilter}
                onChange={(e) => {
                  setRiskFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-surface-page border border-line-strong rounded-lg text-ink-800 font-mono focus:outline-none focus:border-brand-600"
              >
                <option value="all">All Risk Tiers</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line-strong text-ink-500 font-mono uppercase bg-surface-page/80">
                  <th className="py-2.5 px-4">Row #</th>
                  <th className="py-2.5 px-4">Fraud Probability</th>
                  <th className="py-2.5 px-4">Classification</th>
                  <th className="py-2.5 px-4">Risk Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono">
                {paginatedPredictions.map((row) => {
                  const isFraud = row.prediction === 'fraud';
                  const riskBadgeClass =
                    row.risk_category === 'high'
                      ? 'bg-danger-600/10 text-danger-600 border-danger-600/30'
                      : row.risk_category === 'medium'
                      ? 'bg-warning-600/10 text-warning-600 border-warning-600/30'
                      : 'bg-positive-600/10 text-positive-600 border-positive-600/30';

                  return (
                    <tr key={row.row_index} className="hover:bg-surface-sunken/50 transition-colors">
                      <td className="py-2.5 px-4 text-ink-700 font-semibold">
                        #{row.row_index + 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-ink-900">
                          {(row.fraud_probability * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            isFraud
                              ? 'bg-danger-600/20 text-danger-600 border border-danger-600/30'
                              : 'bg-positive-600/20 text-positive-600 border-positive-600/30'
                          }`}
                        >
                          {row.prediction}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded border text-[11px] uppercase ${riskBadgeClass}`}>
                          {row.risk_category}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {paginatedPredictions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-ink-400 font-mono text-xs">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between text-xs text-ink-500 font-mono pt-2">
            <div>
              Showing {filteredPredictions.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to{' '}
              {Math.min(currentPage * PAGE_SIZE, filteredPredictions.length)} of{' '}
              {filteredPredictions.length} records
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="px-2.5 py-1 rounded bg-surface-hover text-ink-700 border border-line-strong disabled:opacity-40 hover:bg-surface-active"
              >
                Prev
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="px-2.5 py-1 rounded bg-surface-hover text-ink-700 border border-line-strong disabled:opacity-40 hover:bg-surface-active"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
