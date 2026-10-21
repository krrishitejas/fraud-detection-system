import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import type { TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewPage } from './pages/OverviewPage';
import { FraudDetectionPage } from './pages/FraudDetectionPage';
import { BatchAnalysisPage } from './pages/BatchAnalysisPage';
import { ExplainabilityPage } from './pages/ExplainabilityPage';
import { ConceptDriftPage } from './pages/ConceptDriftPage';
import { ModelEvaluationPage } from './pages/ModelEvaluationPage';
import { AboutResearchPage } from './pages/AboutResearchPage';
import { apiService } from './services/api';
import type { HealthResponse } from './types/api';

const TAB_CONFIG: Record<TabId, { title: string; subtitle: string }> = {
  overview: {
    title: 'Research Dashboard Overview',
    subtitle: 'System health, validation benchmarks, and key research indicators',
  },
  'fraud-detection': {
    title: 'Real-Time Fraud Detection',
    subtitle: 'Model inference and local TreeSHAP attribution for individual transactions',
  },
  'batch-analysis': {
    title: 'Batch CSV Analysis',
    subtitle: 'High-throughput scoring and downloadable annotated CSV export',
  },
  explainability: {
    title: 'TreeSHAP Explainability',
    subtitle: 'Global feature importance rankings and model decision attributions',
  },
  'concept-drift': {
    title: 'Concept Drift & PSI Monitoring',
    subtitle: 'Population Stability Index across 5 sequential chronological evaluation blocks',
  },
  'model-evaluation': {
    title: 'Model Evaluation Benchmarks',
    subtitle: 'XGBoost baseline vs. graph prototype and sequential adaptation performance',
  },
  'about-research': {
    title: 'About the Research Project',
    subtitle: 'Academic thesis problem statement, methodology, and operational scope',
  },
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabId>('overview');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);

  const checkHealth = async () => {
    try {
      const res = await apiService.getHealth();
      setHealth(res);
    } catch {
      setHealth({
        status: 'degraded',
        model_loaded: false,
        expected_features: 32,
        initialization_error: 'Unable to reach backend server',
      });
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const currentMeta = TAB_CONFIG[currentTab];

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        health={health}
        isOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          health={health}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        {/* Page Content View */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'overview' && <OverviewPage onNavigate={setCurrentTab} />}
          {currentTab === 'fraud-detection' && <FraudDetectionPage />}
          {currentTab === 'batch-analysis' && <BatchAnalysisPage />}
          {currentTab === 'explainability' && <ExplainabilityPage />}
          {currentTab === 'concept-drift' && <ConceptDriftPage />}
          {currentTab === 'model-evaluation' && <ModelEvaluationPage />}
          {currentTab === 'about-research' && <AboutResearchPage />}
        </main>

        {/* Footer */}
        <footer className="border-t border-navy-800/60 bg-navy-950/80 px-6 py-4 text-center text-xs text-slate-500 font-mono">
          Major Project: An Explainable Dynamic Graph Learning Framework for Adaptive Financial Fraud Detection under Concept Drift
        </footer>
      </div>
    </div>
  );
};

export default App;
