import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  FileSpreadsheet,
  Brain,
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
} from 'lucide-react';
import type { HealthResponse } from '../types/api';

export type TabId =
  | 'overview'
  | 'fraud-detection'
  | 'batch-analysis'
  | 'explainability'
  | 'concept-drift'
  | 'model-evaluation'
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-navy-900 border-r border-navy-700/60 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-navy-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent-cyan via-accent-blue to-accent-purple flex items-center justify-center shadow-glow-cyan">
              <ShieldAlert className="w-5 h-5 text-navy-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                AdaptiveFraud<span className="text-accent-cyan font-mono text-xs px-1.5 py-0.5 rounded bg-accent-cyan/10 border border-accent-cyan/30">AI</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Major Academic Project</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            Navigation
          </div>
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
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/25 shadow-glow-cyan'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-accent-cyan' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* API Health & Server Info */}
        <div className="p-4 border-t border-navy-700/60 bg-navy-950/60 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Backend API</span>
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] border ${
                isHealthy
                  ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30'
                  : 'bg-accent-rose/10 text-accent-rose border-accent-rose/30'
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

          <div className="text-[11px] font-mono text-slate-400 bg-navy-900/90 rounded-md p-2.5 border border-navy-700/50 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Model:</span>
              <span className="text-slate-300 font-semibold truncate max-w-[120px]">
                {health?.model_type ? 'XGBoost (32f)' : 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Features:</span>
              <span className="text-slate-300">{health?.expected_features ?? 32} features</span>
            </div>
            {health?.best_iteration && (
              <div className="flex justify-between">
                <span className="text-slate-500">Best Round:</span>
                <span className="text-slate-300">#{health.best_iteration}</span>
              </div>
            )}
          </div>

          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-slate-400 hover:text-accent-cyan bg-navy-800/40 hover:bg-navy-800 rounded-md border border-navy-700/60 transition-colors"
          >
            <span>FastAPI Docs (Swagger)</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </aside>
    </>
  );
};
