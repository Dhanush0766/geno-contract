import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import type { NavTab } from './components/Layout/Sidebar';
import { DemoBar } from './components/Layout/DemoBar';
import { useWebSocket } from './hooks/useWebSocket';
import { api } from './services/api';

// Pages
import { OverviewPage } from './pages/OverviewPage';
import { ContractExplorerPage } from './pages/ContractExplorerPage';
import { NlpAssistantPage } from './pages/NlpAssistantPage';
import { ContractDiffPage } from './pages/ContractDiffPage';
import { PcaeCompatibilityPage } from './pages/PcaeCompatibilityPage';
import { GenomeEpigenomePage } from './pages/GenomeEpigenomePage';
import { GatingExplanationPage } from './pages/GatingExplanationPage';
import { SoftwareMetricsPage } from './pages/SoftwareMetricsPage';
import { EvolutionPage } from './pages/EvolutionPage';
import { QuorumSyncPage } from './pages/QuorumSyncPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { BehaviorMorphingPage } from './pages/BehaviorMorphingPage';
import { EventHistoryPage } from './pages/EventHistoryPage';
import { PatentMappingPage } from './pages/PatentMappingPage';

// Types
import type {
  GateAction,
  PcaeEvaluation,
  PredictionData,
  GateDecisionData,
  GatingExplanation,
  Gene,
  Genotype,
  Epigenome,
  EcgIrInstruction,
  SoftwareMetrics,
  EventLogItem,
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  // Core Application State
  const [activeContract, setActiveContract] = useState<any>(null);
  const [genotype, setGenotype] = useState<Genotype | null>(null);
  const [epigenome, setEpigenome] = useState<Epigenome | null>(null);
  const [expressedGenes, setExpressedGenes] = useState<Gene[]>([]);
  const [ecgIr, setEcgIr] = useState<EcgIrInstruction[]>([]);
  const [lineage, setLineage] = useState<any[]>([]);

  const [pcae, setPcae] = useState<PcaeEvaluation | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [gate, setGate] = useState<GateDecisionData | null>(null);
  const [explanation, setExplanation] = useState<GatingExplanation | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<SoftwareMetrics | null>(null);
  const [events, setEvents] = useState<EventLogItem[]>([]);

  // Load all system data
  const loadSystemState = useCallback(async () => {
    try {
      const [contractRes, genotypeRes, pcaeRes, metricsRes, eventsRes] = await Promise.all([
        api.getActiveContract(),
        api.getActiveGenotype(),
        api.getCurrentPcae(),
        api.getAllMetrics(),
        api.getEventLogs(50),
      ]);

      setActiveContract(contractRes);
      setGenotype(genotypeRes.provider_genotype);
      setEpigenome(genotypeRes.provider_epigenome);
      setExpressedGenes(genotypeRes.expressed_genes || []);
      setEcgIr(genotypeRes.ecg_ir || []);
      setLineage(genotypeRes.lineage || []);

      setPcae(pcaeRes.evaluation);
      setPrediction(pcaeRes.prediction);
      setGate(pcaeRes.gate);
      setExplanation(pcaeRes.explanation);
      setHistory(pcaeRes.history || []);

      setMetrics(metricsRes);
      setEvents(eventsRes.events || []);
    } catch (err) {
      console.warn('Error loading initial ACO state (backend may still be starting):', err);
    }
  }, []);

  // Real-time WebSocket event handler
  const handleWebSocketEvent = useCallback((event: string, data: any) => {
    console.log('[WebSocket Event Received]:', event, data);
    if (event === 'contract.updated' || event === 'contract.rolled_back') {
      loadSystemState();
    } else if (event === 'pcae.completed') {
      setPcae(data);
    } else if (event === 'prediction.updated') {
      setPrediction(data);
    } else if (event === 'gate.changed') {
      setGate(data);
    } else if (event === 'epigenome.updated') {
      loadSystemState();
    } else if (event === 'demo.scenario_executed' || event === 'demo.reset') {
      loadSystemState();
    }
  }, [loadSystemState]);

  const { isConnected } = useWebSocket(handleWebSocketEvent);

  useEffect(() => {
    let isMounted = true;
    const fetchInitial = async () => {
      try {
        await loadSystemState();
      } catch {
        // Handled inside loadSystemState
      }
    };
    fetchInitial();

    const interval = setInterval(() => {
      if (isMounted) {
        loadSystemState();
      }
    }, 10000); // 10s fallback sync

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [loadSystemState]);

  const currentGateAction: GateAction = gate?.current_gate || 'ALLOW';
  const currentCs = pcae?.cs ?? 0.976;
  const currentPFail = prediction?.p_fail ?? 0.041;
  const versionTag = activeContract?.version || 'v1.0.0';

  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100 font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        unresolvedGating={currentGateAction === 'QUARANTINE'}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentGate={currentGateAction}
          csScore={currentCs}
          pFail={currentPFail}
          versionTag={versionTag}
          isWsConnected={isConnected}
          onRefresh={loadSystemState}
        />

        {/* Guided Demo Action Bar */}
        <DemoBar onScenarioTriggered={loadSystemState} />

        {/* Dynamic Tab Router */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewPage
              pcae={pcae}
              prediction={prediction}
              gate={gate}
              history={history}
              events={events}
            />
          )}

          {activeTab === 'contracts' && (
            <ContractExplorerPage
              contract={activeContract}
              genes={expressedGenes}
            />
          )}

          {activeTab === 'nlp' && <NlpAssistantPage />}

          {activeTab === 'diff' && (
            <ContractDiffPage
              currentContract={activeContract}
              pcae={pcae}
            />
          )}

          {activeTab === 'pcae' && (
            <PcaeCompatibilityPage
              pcae={pcae}
              prediction={prediction}
            />
          )}

          {activeTab === 'genome' && (
            <GenomeEpigenomePage
              genotype={genotype}
              epigenome={epigenome}
              expressedGenes={expressedGenes}
              ecgIr={ecgIr}
              lineage={lineage}
              onMethylationChanged={loadSystemState}
            />
          )}

          {activeTab === 'gating' && (
            <GatingExplanationPage
              gate={gate}
              explanation={explanation}
            />
          )}

          {activeTab === 'metrics' && <SoftwareMetricsPage metrics={metrics} />}

          {activeTab === 'evolution' && <EvolutionPage />}

          {activeTab === 'sync' && <QuorumSyncPage />}

          {activeTab === 'simulation' && <DigitalTwinPage />}

          {activeTab === 'morphing' && <BehaviorMorphingPage />}

          {activeTab === 'events' && <EventHistoryPage events={events} />}

          {activeTab === 'patent' && <PatentMappingPage />}
        </main>
      </div>
    </div>
  );
};

export default App;
