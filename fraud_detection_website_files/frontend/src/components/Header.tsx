import React from 'react';
import { Menu, Activity, ExternalLink } from 'lucide-react';
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
    <header className="sticky top-0 z-30 bg-surface-card border-b border-line px-4 sm:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 text-ink-500 hover:text-ink-900 hover:bg-surface-hover rounded-lg transition-colors"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900 flex items-center gap-2">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 font-medium">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Model Identifier Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-surface-hover border border-line text-ink-700">
          <span>{health?.model_version ?? 'no model'}</span>
        </div>

        {/* Live Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isHealthy
              ? 'bg-clear-50 text-clear-700 border-clear-100'
              : 'bg-flag-600/10 text-flag-600 border-flag-600/30'
          }`}
        >
          <span className="relative flex h-2 w-2">
<span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isHealthy ? 'bg-clear-500' : 'bg-flag-600'
              }`}
            />
          </span>
          <span className="font-mono text-[11px]">{isHealthy ? 'API Active' : 'API Degraded'}</span>
        </div>

        {/* Swagger link */}
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-ink-700 hover:text-ink-900 bg-surface-hover hover:bg-surface-active/80 border border-line rounded-lg transition-colors"
        >
          <Activity className="w-3.5 h-3.5 text-data-700" />
          <span>Swagger Docs</span>
          <ExternalLink className="w-3 h-3 text-ink-500" />
        </a>
      </div>
    </header>
  );
};
