import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Hash,
  Layers,
  Network,
  Search,
  Shield,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { getCurrentInvestigation, saveInvestigation } from "@/lib/investigation-store";
import { DEMO_CASES, loadDemoCase } from "@/lib/demo-data";
import type { RiskLevel } from "@/types/investigation";

function truncAddr(a: string) {
  return a.length > 14 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}
function riskColor(l: RiskLevel) {
  switch (l) {
    case "CRITICAL": return "#ef4444";
    case "HIGH": return "#f97316";
    case "MEDIUM": return "#06b6d4";
    case "LOW": return "#10b981";
    default: return "#64748b";
  }
}

interface FlowEdge {
  from: string;
  to: string;
  volume: number;
  risk: RiskLevel;
  txCount: number;
  label: string;
}

export default function FundFlowGraphPage() {
  const [, setLocation] = useLocation();
  const [investigation, setInvestigation] = useState(() => getCurrentInvestigation());
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [minAmount, setMinAmount] = useState(0);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "ALL">("ALL");
  const [animPhase, setAnimPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setAnimPhase((p) => (p + 1) % 100), 50);
    return () => clearInterval(timer);
  }, []);

  const handleCaseChange = useCallback((caseId: string) => {
    const data = loadDemoCase(caseId);
    if (data) {
      saveInvestigation(data);
      setInvestigation(data);
      setSelectedEdge(null);
      setMinAmount(0);
      setRiskFilter("ALL");
    }
  }, []);

  const inv = investigation;

  if (!inv) {
    return (
      <div className="enter">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-mono-data text-[10px] font-bold uppercase tracking-[.18em] text-cyan-700"><span className="size-1.5 bg-amber-400" />Fund Flow Graph</div>
          <h1 className="text-2xl font-extrabold tracking-[-.03em] text-slate-900 md:text-[30px]">Sankey Flow Visualization</h1>
        </div>
        <div className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)] p-6">
          <div className="mb-4 text-sm font-bold text-slate-800">Select a Demo Case</div>
          <p className="mb-4 text-xs leading-5 text-slate-500">Choose a demo investigation to visualize fund flows and transaction corridors.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_CASES.map((demo) => (
              <button
                key={demo.id}
                onClick={() => handleCaseChange(demo.id)}
                className="group border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-cyan-400 hover:bg-cyan-50/30"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-cyan-700">{demo.label}</div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500">{demo.description}</div>
                <div className="mt-2 font-mono-data text-[10px] text-slate-400">{demo.data.wallet.blockchain} · {demo.data.wallet.asset} · {demo.data.trackedWallets.length} wallets</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const flowEdges: FlowEdge[] = useMemo(() => {
    const edges: FlowEdge[] = [];
    const wallets = inv.trackedWallets;
    for (let i = 0; i < wallets.length; i++) {
      for (let j = i + 1; j < Math.min(wallets.length, i + 4); j++) {
        const vol = Math.random() * wallets[i].totalVolume * 0.5 + 0.1;
        edges.push({
          from: wallets[i].address,
          to: wallets[j].address,
          volume: vol,
          risk: wallets[i].risk,
          txCount: Math.floor(Math.random() * 20 + 1),
          label: `${wallets[i].relationship || wallets[i].nodeType} -> ${wallets[j].relationship || wallets[j].nodeType}`,
        });
      }
    }
    return edges;
  }, [inv]);

  const filteredEdges = flowEdges.filter(
    (e) =>
      e.volume >= minAmount &&
      (riskFilter === "ALL" || e.risk === riskFilter),
  );

  const maxVol = Math.max(...filteredEdges.map((e) => e.volume), 1);

  const sourceNodes = inv.trackedWallets.filter((w) => w.hop === 0 || w.hop === 1);
  const intermediaryNodes = inv.trackedWallets.filter((w) => w.hop === 2);
  const destNodes = inv.trackedWallets.filter((w) => w.hop >= 3);

  const allSources = sourceNodes.length > 0 ? sourceNodes : inv.trackedWallets.slice(0, 3);
  const allMid = intermediaryNodes.length > 0 ? intermediaryNodes : inv.trackedWallets.slice(3, 7);
  const allDest = destNodes.length > 0 ? destNodes : inv.trackedWallets.slice(7);

  return (
    <div className="enter">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono-data text-[10px] font-bold uppercase tracking-[.18em] text-cyan-700"><span className="size-1.5 bg-amber-400" />Fund Flow Graph</div>
          <h1 className="text-2xl font-extrabold tracking-[-.03em] text-slate-900 md:text-[30px]">Sankey Flow Visualization</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
            {filteredEdges.length} flow corridors | {inv.trackedWallets.length} entities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={inv.investigationId}
            onChange={(e) => handleCaseChange(e.target.value)}
            className="border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-cyan-400"
          >
            {DEMO_CASES.map((demo) => (
              <option key={demo.id} value={demo.id}>{demo.label}</option>
            ))}
          </select>
          <button
            onClick={() => setLocation("/crypto-investigation")}
            className="flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-cyan-400"
          >
            Back
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[10px] font-mono-data text-slate-400">
          <Filter size={12} />
          FILTERS:
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono-data text-slate-500">Min Amount:</span>
          <input
            type="range"
            min="0"
            max={Math.ceil(maxVol)}
            value={minAmount}
            onChange={(e) => setMinAmount(Number(e.target.value))}
            className="w-24 accent-cyan-500"
          />
          <span className="text-[9px] font-mono-data text-cyan-700">{minAmount.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono-data text-slate-500">Risk:</span>
          {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`text-[8px] font-mono-data font-bold px-2 py-0.5 rounded transition-colors ${
                riskFilter === r
                  ? "bg-slate-800 text-amber-300"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <section className="scanline border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)] p-4 mb-4">
        <div className="relative min-h-[430px] overflow-hidden bg-[hsl(var(--sidebar))] p-5 rounded">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #84a3b8 1px, transparent 0)', backgroundSize: '22px 22px' }} />
          <svg viewBox="0 0 1000 500" width="100%" height="400" className="overflow-visible relative z-10">
            <text x="80" y="20" textAnchor="middle" fill="#b7c9d2" fontSize="10" fontFamily="monospace" fontWeight="bold">SOURCE</text>
            <text x="500" y="20" textAnchor="middle" fill="#b7c9d2" fontSize="10" fontFamily="monospace" fontWeight="bold">INTERMEDIARY</text>
            <text x="920" y="20" textAnchor="middle" fill="#b7c9d2" fontSize="10" fontFamily="monospace" fontWeight="bold">DESTINATION</text>

            {allSources.slice(0, 6).map((src, si) => {
              const sy = 40 + si * 70;
              return allMid.slice(0, 6).map((mid, mi) => {
                const my = 40 + mi * 70;
                const vol = Math.random() * src.totalVolume * 0.3 + 0.1;
                const w = Math.max(1, (vol / maxVol) * 12);
                const col = riskColor(src.risk);
                return (
                  <g key={`s${si}-m${mi}`}>
                    <path
                      d={`M 140 ${sy + 15} C 300 ${sy + 15}, 340 ${my + 15}, 460 ${my + 15}`}
                      fill="none"
                      stroke={col}
                      strokeWidth={w}
                      opacity="0.35"
                    />
                    <circle r="3" fill={col} opacity="0.8">
                      <animateMotion
                        dur={`${3 + si * 0.5}s`}
                        repeatCount="indefinite"
                        path={`M 140 ${sy + 15} C 300 ${sy + 15}, 340 ${my + 15}, 460 ${my + 15}`}
                      />
                    </circle>
                  </g>
                );
              });
            })}

            {allMid.slice(0, 6).map((mid, mi) => {
              const my = 40 + mi * 70;
              return allDest.slice(0, 6).map((dst, di) => {
                const dy = 40 + di * 70;
                const vol = Math.random() * mid.totalVolume * 0.3 + 0.1;
                const w = Math.max(1, (vol / maxVol) * 12);
                const col = riskColor(mid.risk);
                return (
                  <g key={`m${mi}-d${di}`}>
                    <path
                      d={`M 540 ${my + 15} C 700 ${my + 15}, 740 ${dy + 15}, 860 ${dy + 15}`}
                      fill="none"
                      stroke={col}
                      strokeWidth={w}
                      opacity="0.35"
                    />
                    <circle r="2.5" fill={col} opacity="0.7">
                      <animateMotion
                        dur={`${2.5 + mi * 0.3}s`}
                        repeatCount="indefinite"
                        path={`M 540 ${my + 15} C 700 ${my + 15}, 740 ${dy + 15}, 860 ${dy + 15}`}
                      />
                    </circle>
                  </g>
                );
              });
            })}

            {allSources.slice(0, 6).map((w, i) => {
              const y = 40 + i * 70;
              return (
                <g key={`src-${w.address}`}>
                  <rect x="10" y={y} width="130" height="30" rx="4" fill="#1e2c3a" stroke={riskColor(w.risk)} strokeWidth="1" />
                  <text x="75" y={y + 13} textAnchor="middle" fill={riskColor(w.risk)} fontSize="8" fontFamily="monospace" fontWeight="bold">
                    {truncAddr(w.address)}
                  </text>
                  <text x="75" y={y + 23} textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">
                    {w.totalVolume.toFixed(1)} {inv.wallet.asset}
                  </text>
                </g>
              );
            })}

            {allMid.slice(0, 6).map((w, i) => {
              const y = 40 + i * 70;
              return (
                <g key={`mid-${w.address}`}>
                  <rect x="460" y={y} width="80" height="30" rx="4" fill="#1e2c3a" stroke={riskColor(w.risk)} strokeWidth="1" />
                  <circle cx="470" cy={y + 15} r="4" fill={riskColor(w.risk)} opacity="0.6" />
                  <text x="500" y={y + 13} textAnchor="middle" fill="#cbd5e1" fontSize="7" fontFamily="monospace">
                    {(w.relationship || w.nodeType).slice(0, 10)}
                  </text>
                  <text x="500" y={y + 23} textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="monospace">
                    H{w.hop}
                  </text>
                </g>
              );
            })}

            {allDest.slice(0, 6).map((w, i) => {
              const y = 40 + i * 70;
              return (
                <g key={`dst-${w.address}`}>
                  <rect x="860" y={y} width="130" height="30" rx="4" fill="#1e2c3a" stroke={riskColor(w.risk)} strokeWidth="1" />
                  <text x="925" y={y + 13} textAnchor="middle" fill={riskColor(w.risk)} fontSize="8" fontFamily="monospace" fontWeight="bold">
                    {truncAddr(w.address)}
                  </text>
                  <text x="925" y={y + 23} textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="monospace">
                    {w.totalVolume.toFixed(1)} {inv.wallet.asset}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <section className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Intelligence layer</div>
            <h2 className="mt-0.5 text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Layers size={14} className="text-cyan-600" />
              Flow Corridor Details ({filteredEdges.length})
            </h2>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
          {filteredEdges.slice(0, 20).map((e, i) => (
            <div
              key={i}
              onClick={() => setSelectedEdge(i === selectedEdge ? null : i)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                selectedEdge === i ? "bg-cyan-50/40" : "hover:bg-slate-50"
              }`}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: riskColor(e.risk) }} />
              <span className="text-[10px] font-mono-data font-bold text-slate-800 w-24 truncate">{truncAddr(e.from)}</span>
              <ArrowRight size={10} className="text-slate-300 shrink-0" />
              <span className="text-[10px] font-mono-data font-bold text-slate-800 w-24 truncate">{truncAddr(e.to)}</span>
              <div className="flex-1 mx-2">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(e.volume / maxVol) * 100}%`, backgroundColor: riskColor(e.risk) }}
                  />
                </div>
              </div>
              <span className="text-[10px] font-mono-data font-bold text-amber-600 w-20 text-right">
                {e.volume.toFixed(2)} {inv.wallet.asset}
              </span>
              <span className="text-[8px] font-mono-data text-slate-400 w-12 text-right">{e.txCount} tx</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
