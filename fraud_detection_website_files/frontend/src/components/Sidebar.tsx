import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  FileSpreadsheet,
  Brain,
  Activity,
  BarChart3,
  BookOpen,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
} from 'lucide-react';
import type { HealthResponse } from '../types/api';
import { Mark } from './Mark';

export type TabId =
  | 'overview'
  | 'fraud-detection'
  | 'batch-analysis'
  | 'explainability'
  | 'concept-drift'
  | 'model-evaluation'
  | 'governance'
  | 'about-research';

interface SidebarProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  health: HealthResponse | null;
  isOpen: boolean;
  onCloseMobile: () => void;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'fraud-detection', label: 'Fraud Detection', icon: ShieldAlert },
  { id: 'batch-analysis', label: 'Batch Analysis', icon: FileSpreadsheet },
  { id: 'explainability', label: 'Explainability', icon: Brain },
  { id: 'concept-drift', label: 'Concept Drift', icon: Activity },
  { id: 'model-evaluation', label: 'Model Evaluation', icon: BarChart3 },
  { id: 'governance', label: 'Decision Governance', icon: Gauge },
  { id: 'about-research', label: 'About the Research', icon: BookOpen },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  health,
  isOpen,
  onCloseMobile,
}) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-ink-900/25 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-surface-card border-r border-line flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Mark className="w-9 h-9 shrink-0" />
            <div>
              <div className="font-bold text-base tracking-tight text-ink-900 flex items-center gap-1.5">
                AdaptiveFraud
              </div>
              <p className="text-[11px] text-ink-500 font-medium">Major Academic Project</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-ink-500 hover:text-ink-900 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id as TabId);
                  onCloseMobile();
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-ink-900/10 text-data-700 border border-ink-900/25 shadow-card'
                    : 'text-ink-500 hover:text-ink-800 hover:bg-surface-hover/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-data-700' : 'text-ink-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* API Health & Server Info */}
        <div className="p-4 border-t border-line bg-surface-page/60 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-500">Backend API</span>
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] border ${
                isHealthy
                  ? 'bg-clear-50 text-clear-700 border-clear-100'
                  : 'bg-flag-600/10 text-flag-600 border-flag-600/30'
              }`}
            >
              {isHealthy ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>ONLINE</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  <span>OFFLINE</span>
                </>
              )}
            </div>
          </div>

          <div className="text-[11px] font-mono text-ink-500 bg-surface-card/90 rounded-md p-2.5 border border-line space-y-1">
            <div className="flex justify-between">
              <span className="text-ink-500">Model:</span>
              <span className="text-ink-700 font-semibold truncate max-w-[130px]">
                {health?.model_version ?? 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Features:</span>
              <span className="text-ink-700">{health?.expected_features ?? 32} features</span>
            </div>
            {health?.boosting_rounds && (
              <div className="flex justify-between">
                <span className="text-ink-500">Trees:</span>
                <span className="text-ink-700 tabular-nums">
                  {health.boosting_rounds.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-ink-500 hover:text-data-700 bg-surface-hover/40 hover:bg-surface-hover rounded-md border border-line transition-colors"
          >
            <span>FastAPI Docs (Swagger)</span>
            <ExternalLink className="w-3.5 h-3.5 text-ink-500" />
          </a>
        </div>
      </aside>
    </>
  );
};
