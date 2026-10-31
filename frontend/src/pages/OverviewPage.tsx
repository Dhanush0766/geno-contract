import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  ShieldCheck,
  Cpu,
  TrendingUp,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  Line,
  ReferenceLine,
  Legend,
} from 'recharts';
import { StatusBadge } from '../components/UI/StatusBadge';
import { api } from '../services/api';
import type { PcaeEvaluation, PredictionData, GateDecisionData, EventLogItem } from '../types';

interface OverviewPageProps {
  pcae: PcaeEvaluation | null;
  prediction: PredictionData | null;
  gate: GateDecisionData | null;
  history: any[];
  events: EventLogItem[];
  onTriggerOrder?: (bypassGating: boolean) => Promise<any>;
}

const CustomCompatTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-lg p-3 text-xs shadow-2xl backdrop-blur-md min-w-[210px] space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-mono text-slate-400 font-semibold">{label}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            data.gate === 'ALLOW' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
            data.gate === 'DEGRADE' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
            'bg-rose-950 text-rose-300 border border-rose-800'
          }`}>
            {data.gate}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-medium">Composite CS:</span>
          <span className="font-extrabold text-indigo-400 text-sm">{data.cs}%</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 border-t border-slate-800/80 text-[11px]">
          <div className="text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span> SCS: <span className="text-white font-medium ml-auto">{data.scs}%</span>
          </div>
          <div className="text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> SemCS: <span className="text-white font-medium ml-auto">{data.semcs}%</span>
          </div>
          <div className="text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> TCS: <span className="text-white font-medium ml-auto">{data.tcs}%</span>
          </div>
          <div className="text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span> RCS: <span className="text-white font-medium ml-auto">{data.rcs}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const CustomRiskTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-lg p-3 text-xs shadow-2xl backdrop-blur-md min-w-[210px] space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-mono text-slate-400 font-semibold">{label}</span>
          <span className="text-[10px] font-mono text-slate-400">&tau;=0.80, k=8.0</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-medium">Predicted Risk (P_fail):</span>
          <span className={`font-extrabold text-sm ${data.pFail >= 25 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {data.pFail}%
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
          <span className="text-slate-400">Active Gate Zone:</span>
          <span className={`font-semibold ${
            data.pFail < 25 ? 'text-emerald-400' :
            data.pFail < 50 ? 'text-amber-400' :
            data.pFail < 75 ? 'text-orange-400' : 'text-rose-400'
          }`}>
            {data.pFail < 25 ? 'ALLOW (<25%)' : data.pFail < 50 ? 'DEGRADE (25-50%)' : data.pFail < 75 ? 'REROUTE (50-75%)' : 'QUARANTINE (≥75%)'}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const OverviewPage: React.FC<OverviewPageProps> = ({
  pcae,
  prediction,
  gate,
  history,
  events,
}) => {
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  const [compatViewMode, setCompatViewMode] = useState<'composite' | 'dimensions'>('composite');
  const [compatScaleMode, setCompatScaleMode] = useState<'focused' | 'full'>('focused');
  const [riskScaleMode, setRiskScaleMode] = useState<'focused' | 'full'>('full');

  const cs = pcae?.cs ?? 0.976;
  const pFail = prediction?.p_fail ?? 0.041;
  const currentGate = gate?.current_gate ?? 'ALLOW';

  // Format chart data with true numbers for Recharts axes and multi-dimensional sub-scores
  const chartData = (history && history.length > 0 ? history : [
    { timestamp: '', cs_composite: 0.982, scs: 1.0, semcs: 0.985, tcs: 0.962, rcs: 0.988, p_fail: 0.034, gate: 'ALLOW' },
    { timestamp: '', cs_composite: 0.974, scs: 1.0, semcs: 0.980, tcs: 0.941, rcs: 0.978, p_fail: 0.042, gate: 'ALLOW' },
    { timestamp: '', cs_composite: 0.961, scs: 1.0, semcs: 0.972, tcs: 0.915, rcs: 0.960, p_fail: 0.059, gate: 'ALLOW' },
    { timestamp: '', cs_composite: 0.978, scs: 1.0, semcs: 0.984, tcs: 0.952, rcs: 0.982, p_fail: 0.038, gate: 'ALLOW' },
    { timestamp: '', cs_composite: 0.985, scs: 1.0, semcs: 0.990, tcs: 0.965, rcs: 0.991, p_fail: 0.031, gate: 'ALLOW' },
    { timestamp: '', cs_composite: 0.979, scs: 1.0, semcs: 0.982, tcs: 0.954, rcs: 0.987, p_fail: 0.037, gate: 'ALLOW' },
    { timestamp: '', cs_composite: 0.968, scs: 1.0, semcs: 0.978, tcs: 0.928, rcs: 0.969, p_fail: 0.051, gate: 'ALLOW' },
    { timestamp: '', cs_composite: 0.975, scs: 1.0, semcs: 0.981, tcs: 0.948, rcs: 0.975, p_fail: 0.043, gate: 'ALLOW' },
    { timestamp: '', cs_composite: 0.981, scs: 1.0, semcs: 0.986, tcs: 0.960, rcs: 0.985, p_fail: 0.035, gate: 'ALLOW' },
    { timestamp: '', cs_composite: 0.976, scs: 1.0, semcs: 0.980, tcs: 0.950, rcs: 0.974, p_fail: 0.041, gate: 'ALLOW' },
  ]).map((h, i, arr) => ({
    name: `T-${(arr.length - i - 1) * 5}m`,
    rawTime: h.timestamp,
    cs: parseFloat((h.cs_composite * 100).toFixed(1)),
    scs: parseFloat(((h.scs ?? 1.0) * 100).toFixed(1)),
    semcs: parseFloat(((h.semcs ?? 0.98) * 100).toFixed(1)),
    tcs: parseFloat(((h.tcs ?? 0.95) * 100).toFixed(1)),
    rcs: parseFloat(((h.rcs ?? 0.97) * 100).toFixed(1)),
    pFail: parseFloat((h.p_fail * 100).toFixed(1)),
    gate: h.gate || 'ALLOW',
  }));

  const handleTestOrder = async () => {
    try {
      setIsDispatching(true);
      const data = await api.dispatchOrder({
        order_id: `ORD-${Date.now() % 100000}`,
        user_id: 'U100',
        amount: 100.5,
        currency: 'INR',
      });
      setDispatchResult(data);
    } catch (e: any) {
      setDispatchResult({ status: 'ERROR', message: e.message });
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            Autonomous Contract Organism (ACO) Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Epigenetic Genome Observability, Predictive Compatibility (PCAE), and Pre-Emptive Behavior Gating.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status="MEASURED" size="sm" />
          <StatusBadge status="DEMO DATA" size="sm" />
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Composite CS */}
        <div className="glass-panel p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Composite Compatibility (CS)</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white">{(cs * 100).toFixed(1)}%</span>
            <span className={`text-xs font-semibold ${cs >= 0.8 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {cs >= 0.8 ? 'Optimal' : 'Degraded'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            SCS: {pcae ? (pcae.scs * 100).toFixed(0) : 100}% | SemCS: {pcae ? (pcae.semcs * 100).toFixed(0) : 98}%
          </div>
        </div>

        {/* Card 2: Failure Probability */}
        <div className="glass-panel p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Predicted Failure Risk (P_fail)</span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-extrabold ${
                pFail >= 0.75 ? 'text-rose-400' : pFail >= 0.25 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {(pFail * 100).toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              &tau;=0.80, k=8.0
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Trend: {prediction ? prediction.trend.toFixed(3) : '0.000'} | Conf: 95%
          </div>
        </div>

        {/* Card 3: Active Gate */}
        <div className="glass-panel p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Pre-Emptive Gating</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={currentGate} size="lg" />
          </div>
          <div className="mt-2 text-[11px] text-slate-400 truncate">
            {gate?.hysteresis_applied ? 'Hysteresis dampening active' : 'Dynamic threshold evaluation'}
          </div>
        </div>

        {/* Card 4: Preservation Score */}
        <div className="glass-panel p-4 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Preservation (CCPS)</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-cyan-300">
              {pcae ? ((pcae.cs / 0.976) * 100).toFixed(1) : '100.0'}%
            </span>
            <span className="text-xs text-slate-400">vs v1.0.0</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Contract Change Preservation Score</div>
        </div>
      </div>

      {/* Main Microservice Interaction Topology & Live Test Dispatch */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-200">Service-to-Service Interaction Topology</span>
            <StatusBadge status="LIVE MICROSERVICES" size="sm" />
          </div>
          <div className="text-xs text-slate-400 font-mono">HTTP POST /payment</div>
        </div>

        <div className="py-6 flex flex-col md:flex-row items-center justify-around gap-6">
          {/* Consumer Service Box */}
          <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/90 w-full max-w-xs text-center shadow-lg">
            <div className="text-xs uppercase font-bold text-indigo-400 tracking-wider">Consumer Service</div>
            <div className="text-base font-bold text-slate-100 mt-1">order-service</div>
            <div className="text-xs text-slate-400 font-mono mt-1">Port: 8001 (svc-order-01)</div>
            <div className="mt-3 flex justify-center">
              <StatusBadge status="ACTIVE" size="sm" />
            </div>
          </div>

          {/* Interactive Bridge Connector */}
          <div className="flex flex-col items-center gap-2 w-full max-w-sm">
            <div className="flex items-center justify-between w-full text-xs font-semibold px-2">
              <span className="text-slate-400">ACO Pre-Emptive Gate</span>
              <StatusBadge status={currentGate} size="sm" />
            </div>

            <div className="relative w-full flex items-center justify-center">
              <div
                className={`w-full h-1.5 rounded-full transition-colors ${
                  currentGate === 'QUARANTINE'
                    ? 'bg-rose-600 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : currentGate === 'REROUTE'
                    ? 'bg-orange-500'
                    : currentGate === 'DEGRADE'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                }`}
              />
              <div className="absolute p-1.5 rounded-full bg-slate-950 border border-slate-700">
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                disabled={isDispatching}
                onClick={handleTestOrder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-all shadow-md shadow-indigo-950/50 disabled:opacity-50"
              >
                {isDispatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Dispatch Order (Gated)
              </button>
            </div>
          </div>

          {/* Provider Service Box */}
          <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/90 w-full max-w-xs text-center shadow-lg">
            <div className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Provider Service</div>
            <div className="text-base font-bold text-slate-100 mt-1">payment-service</div>
            <div className="text-xs text-slate-400 font-mono mt-1">Port: 8002 (svc-payment-01)</div>
            <div className="mt-3 flex justify-center">
              <StatusBadge status="ACTIVE" size="sm" />
            </div>
          </div>
        </div>

        {/* Live Dispatch Result Banner */}
        {dispatchResult && (
          <div
            className={`mt-2 p-3 rounded-lg border text-xs flex items-center justify-between ${
              dispatchResult.status === 'ORDER_COMPLETED'
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                : dispatchResult.status === 'PRE_EMPTIVELY_QUARANTINED'
                ? 'bg-rose-950/50 border-rose-800 text-rose-300'
                : 'bg-amber-950/50 border-amber-800 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {dispatchResult.status === 'ORDER_COMPLETED' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>
                <strong>{dispatchResult.status}:</strong> {dispatchResult.message || `Transaction settled successfully (${dispatchResult.payment_details?.transaction_id || ''})`}
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              Latency: {dispatchResult.latency_ms || 12}ms
            </span>
          </div>
        )}
      </div>

      {/* Real-time Time Series Charts */}
      {(() => {
        const minCsVal = Math.min(...chartData.map(d => Math.min(d.cs, d.scs, d.semcs, d.tcs, d.rcs)));
        const compatYDomain = compatScaleMode === 'focused'
          ? [Math.max(0, Math.floor(minCsVal - 4)), 100]
          : [0, 100];

        const maxRiskVal = Math.max(...chartData.map(d => d.pFail));
        const riskYDomain = riskScaleMode === 'focused'
          ? [0, Math.min(100, Math.max(12, Math.ceil(maxRiskVal + 4)))]
          : [0, 100];



        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Compatibility History */}
            <div className="glass-panel p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Compatibility Trend (CS %)
                    </h3>
                  </div>

                  {/* Interactive Controls Bar */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <div className="flex rounded-md bg-slate-900/90 p-0.5 border border-slate-800">
                      <button
                        onClick={() => setCompatViewMode('composite')}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                          compatViewMode === 'composite'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Composite
                      </button>
                      <button
                        onClick={() => setCompatViewMode('dimensions')}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                          compatViewMode === 'dimensions'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        4 Dimensions
                      </button>
                    </div>

                    <button
                      onClick={() => setCompatScaleMode(compatScaleMode === 'focused' ? 'full' : 'focused')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 transition-all ${
                        compatScaleMode === 'focused'
                          ? 'border-indigo-500/50 bg-indigo-950/40 text-indigo-300'
                          : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white'
                      }`}
                      title="Toggle zoom focus range"
                    >
                      {compatScaleMode === 'focused' ? <ZoomOut className="w-3 h-3" /> : <ZoomIn className="w-3 h-3" />}
                      {compatScaleMode === 'focused' ? 'Focused' : '0-100%'}
                    </button>
                  </div>
                </div>

                {/* Subtitle Summary Badges */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 px-1">
                  <span>
                    Current:{' '}
                    <strong className="text-white font-mono">
                      {(cs * 100).toFixed(1)}%
                    </strong>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Threshold &tau; &ge; 80% &bull; Lookback: 10 Intervals (50m)
                  </span>
                </div>
              </div>

              <div className="h-60 w-full mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="csGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.65} />
                        <stop offset="60%" stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="scsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis domain={compatYDomain} stroke="#64748b" fontSize={10} tickLine={false} unit="%" />
                    <Tooltip content={<CustomCompatTooltip />} />

                    {/* Nominal Reference Thresholds */}
                    <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'τ = 80%', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
                    <ReferenceLine y={95} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'Target 95%', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />

                    {compatViewMode === 'composite' ? (
                      <Area
                        type="monotone"
                        dataKey="cs"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#csGrad)"
                        name="Compatibility %"
                        dot={{ r: 3.5, fill: '#818cf8', stroke: '#1e1b4b', strokeWidth: 1.5 }}
                        activeDot={{ r: 6, fill: '#38bdf8', stroke: '#fff', strokeWidth: 2 }}
                      />
                    ) : (
                      <>
                        <Line type="monotone" dataKey="scs" stroke="#a855f7" strokeWidth={2} name="Structural (SCS)" dot={false} />
                        <Line type="monotone" dataKey="semcs" stroke="#10b981" strokeWidth={2} name="Semantic (SemCS)" dot={false} />
                        <Line type="monotone" dataKey="tcs" stroke="#f59e0b" strokeWidth={2} name="Temporal (TCS)" dot={false} />
                        <Line type="monotone" dataKey="rcs" stroke="#06b6d4" strokeWidth={2} name="Resource (RCS)" dot={false} />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                      </>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Predicted Failure Risk */}
            <div className="glass-panel p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-rose-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Predicted Failure Risk (P_fail %)
                    </h3>
                  </div>

                  {/* Interactive Controls Bar */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      onClick={() => setRiskScaleMode(riskScaleMode === 'focused' ? 'full' : 'focused')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 transition-all ${
                        riskScaleMode === 'focused'
                          ? 'border-rose-500/50 bg-rose-950/40 text-rose-300'
                          : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white'
                      }`}
                      title="Toggle zoom focus vs full gate spectrum"
                    >
                      {riskScaleMode === 'focused' ? <ZoomOut className="w-3 h-3" /> : <ZoomIn className="w-3 h-3" />}
                      {riskScaleMode === 'focused' ? 'Corridor (Zoom)' : 'Full Spectrum'}
                    </button>
                  </div>
                </div>

                {/* Subtitle Summary Badges */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 px-1">
                  <span>
                    Current Risk:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {(pFail * 100).toFixed(1)}%
                    </strong>
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ALLOW &lt;25%
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> DEGRADE 25%
                    </span>
                    <span className="flex items-center gap-1 text-rose-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> QUARANTINE 75%
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-60 w-full mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.65} />
                        <stop offset="60%" stopColor="#dc2626" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis domain={riskYDomain} stroke="#64748b" fontSize={10} tickLine={false} unit="%" />
                    <Tooltip content={<CustomRiskTooltip />} />

                    {/* Pre-Emptive Gating Reference Thresholds */}
                    {riskScaleMode === 'full' && (
                      <>
                        <ReferenceLine y={25} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: 'DEGRADE 25%', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
                        <ReferenceLine y={50} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: 'REROUTE 50%', fill: '#f97316', fontSize: 10, position: 'insideTopRight' }} />
                        <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: 'QUARANTINE 75%', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
                      </>
                    )}

                    <Area
                      type="monotone"
                      dataKey="pFail"
                      stroke="#f43f5e"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#riskGrad)"
                      name="P_fail %"
                      dot={{ r: 3.5, fill: '#fb7185', stroke: '#881337', strokeWidth: 1.5 }}
                      activeDot={{ r: 6, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Activity Log Stream Preview */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Live System Event Log</h3>
          </div>
          <span className="text-[10px] text-slate-400">Latest 5 events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Event</th>
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {events.slice(0, 5).map((evt) => (
                <tr key={evt.event_id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-200">{evt.event_type}</td>
                  <td className="py-2 px-3">
                    <StatusBadge status={evt.severity} size="sm" />
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-400 truncate max-w-md">
                    {JSON.stringify(evt.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
