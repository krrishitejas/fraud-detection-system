import React from 'react';
import { Menu, Activity, Sparkles, ExternalLink } from 'lucide-react';
import type { HealthResponse } from '../types/api';

interface HeaderProps {
  title: string;
  subtitle: string;
  health: HealthResponse | null;
  onOpenMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  health,
  onOpenMobileNav,
}) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="sticky top-0 z-30 bg-navy-950/80 backdrop-blur-md border-b border-navy-700/60 px-4 sm:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-navy-800 rounded-lg transition-colors"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Model Identifier Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-navy-800 border border-navy-700 text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-accent-cyan" />
          <span>XGBoost Baseline (32f)</span>
        </div>

        {/* Live Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isHealthy
              ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30'
              : 'bg-accent-rose/10 text-accent-rose border-accent-rose/30'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isHealthy ? 'bg-accent-emerald' : 'bg-accent-rose'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isHealthy ? 'bg-accent-emerald' : 'bg-accent-rose'
              }`}
            />
          </span>
          <span className="font-mono text-[11px]">{isHealthy ? 'API Active' : 'API Degraded'}</span>
        </div>

        {/* Swagger link */}
        <a
          href="http://127.0.0.1:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-navy-800 hover:bg-navy-700/80 border border-navy-700/80 rounded-lg transition-colors"
        >
          <Activity className="w-3.5 h-3.5 text-accent-cyan" />
          <span>Swagger Docs</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>
      </div>
    </header>
  );
};
