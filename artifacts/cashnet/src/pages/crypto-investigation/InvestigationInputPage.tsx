import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Crosshair,
  Database,
  Eye,
  Fingerprint,
  Globe,
  Hash,
  Layers,
  Network,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  Zap,
  BarChart3,
  Activity,
  AlertTriangle,
  FileText,
  MapPinned,
} from "lucide-react";
import type {
  BlockchainNetwork,
  InvestigationConfig,
  InvestigationResult,
  RiskLevel,
} from "@/types/investigation";
import { getRiskLevel } from "@/types/investigation";
import {
  generateScenario,
  DEMO_ADDRESSES,
  validateAddress,
  detectChain,
} from "@/lib/investigation-engine";
import {
  saveInvestigation,
  savePendingConfig,
  getCurrentInvestigation,
  getHistory,
} from "@/lib/investigation-store";

/* ------------------------------------------------------------------ */
/* Types & Constants                                                  */
/* ------------------------------------------------------------------ */
type PagePhase = "input" | "pipeline" | "results";

interface CryptoOption {
  id: BlockchainNetwork | "AUTO" | "USDT";
  label: string;
  ticker: string;
  color: string;
  icon: string;
}

const CRYPTO_OPTIONS: CryptoOption[] = [
  { id: "AUTO", label: "Find", ticker: "AUTO", color: "#06b6d4", icon: "🔍" },
  { id: "BITCOIN", label: "Bitcoin", ticker: "BTC", color: "#f7931a", icon: "₿" },
  { id: "ETHEREUM", label: "Ethereum", ticker: "ETH", color: "#627eea", icon: "Ξ" },
  { id: "SOLANA", label: "Solana", ticker: "SOL", color: "#9945ff", icon: "◎" },
  { id: "TRON", label: "Tron", ticker: "TRX", color: "#ff0013", icon: "⚡" },
  { id: "POLYGON", label: "Polygon", ticker: "MATIC", color: "#8247e5", icon: "⬡" },
  { id: "BNB", label: "BNB Chain", ticker: "BNB", color: "#f3ba2f", icon: "🔶" },
  { id: "USDT" as any, label: "USDT", ticker: "USDT", color: "#26a17b", icon: "₮" },
];

const PIPELINE_STEPS = [
  { label: "Address Validation", desc: "Verifying format & blockchain detection", icon: Search, duration: 800 },
  { label: "On-Chain Data Collection", desc: "Querying blockchain explorers & APIs", icon: Database, duration: 1200 },
  { label: "Transaction Graph Build", desc: "Constructing multi-hop transaction graph", icon: Network, duration: 1500 },
  { label: "Cluster Analysis", desc: "Identifying wallet clusters & relationships", icon: Layers, duration: 1000 },
  { label: "VASP Attribution", desc: "Matching entities to known VASPs & exchanges", icon: Globe, duration: 900 },
  { label: "Risk Scoring Engine", desc: "Computing behavioral risk indicators", icon: ShieldAlert, duration: 1100 },
  { label: "Typology Detection", desc: "Scanning for suspicious fund flow patterns", icon: AlertTriangle, duration: 800 },
  { label: "Report Generation", desc: "Compiling forensic intelligence dossier", icon: FileText, duration: 600 },
];

function truncAddr(addr: string): string {
  if (!addr) return "";
  return addr.length > 14 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "CRITICAL": return "#ef4444";
    case "HIGH": return "#f97316";
    case "MEDIUM": return "#06b6d4";
    case "LOW": return "#10b981";
    default: return "#64748b";
  }
}

/* ================================================================== */
/* MAIN COMPONENT                                                     */
/* ================================================================== */
export default function InvestigationInputPage() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<PagePhase>("input");

  // Input Form State
  const [address, setAddress] = useState("");
  const [selectedCrypto, setSelectedCrypto] = useState<string>("AUTO");
  const [hopDepth, setHopDepth] = useState(2);
  const [scopes, setScopes] = useState({
    transfer: true,
    contract: true,
    mixer: true,
    bridge: false,
  });

  // Pipeline State
  const [pipelineStep, setPipelineStep] = useState(0);
  const [pipelineComplete, setPipelineComplete] = useState(false);

  // Results State
  const [result, setResult] = useState<InvestigationResult | null>(null);

  // History
  const history = useMemo(() => getHistory(), []);

  // Address Validation
  const addressValid = address.trim().length >= 10;
  const detectedChain = useMemo(() => {
    if (!addressValid) return null;
    return detectChain(address.trim());
  }, [address, addressValid]);

  // Toggle scope
  const toggleScope = (key: keyof typeof scopes) => {
    setScopes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Start Investigation Pipeline
  const handleStartInvestigation = () => {
    if (!addressValid) return;

    const chain: BlockchainNetwork =
      selectedCrypto === "AUTO"
        ? detectedChain || "ETHEREUM"
        : selectedCrypto === "USDT"
          ? "ETHEREUM"
          : (selectedCrypto as BlockchainNetwork);

    setPhase("pipeline");
    setPipelineStep(0);
    setPipelineComplete(false);

    // Run pipeline steps with delays
    let stepIdx = 0;
    const runNext = () => {
      if (stepIdx < PIPELINE_STEPS.length) {
        setPipelineStep(stepIdx);
        stepIdx++;
        setTimeout(runNext, PIPELINE_STEPS[stepIdx - 1]?.duration || 800);
      } else {
        setPipelineComplete(true);
        // Generate the actual result
        const scopeList: any[] = [];
        if (scopes.transfer) scopeList.push("TRANSFER");
        if (scopes.contract) scopeList.push("CONTRACT");
        if (scopes.mixer) scopeList.push("MIXER");
        if (scopes.bridge) scopeList.push("BRIDGE");

        const config: InvestigationConfig = {
          address: address.trim(),
          blockchain: chain,
          depth: hopDepth,
          scopes: scopeList,
        };

        const res = generateScenario(config);
        setResult(res);
        saveInvestigation(res);
        savePendingConfig(config);

        setTimeout(() => setPhase("results"), 800);
      }
    };
    setTimeout(runNext, 500);
  };

  // Fill demo
  const handleDemoFill = (demo: typeof DEMO_ADDRESSES[0]) => {
    setAddress(demo.address);
    setSelectedCrypto(demo.chain);
  };

  // Navigate to Intelligence Graph
  const goToGraph = () => {
    setLocation("/intelligence-graph");
  };

  /* ============================================================= */
  /* PHASE 1: INPUT FORM                                            */
  /* ============================================================= */
  if (phase === "input") {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-sans">
        <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded border border-cyan-200 bg-cyan-50 px-4 py-1.5 text-[11px] font-mono text-cyan-700 mb-4">
              <span className="size-1.5 rounded-full bg-cyan-500 animate-pulse" />
              CASHNET FORENSIC ON-CHAIN INTELLIGENCE MODULE
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Crypto Investigation <span className="text-cyan-600">Command</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500 font-mono max-w-lg mx-auto">
              Enter a target wallet address, select blockchain, configure analysis depth,
              and launch the forensic intelligence pipeline.
            </p>
          </div>

          {/* Main Card */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Card Header */}
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded border border-cyan-200 bg-cyan-50 flex items-center justify-center">
                  <Crosshair className="size-5 text-cyan-600" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-slate-800 tracking-wide">
                    INITIATE FORENSIC TRACE
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    MHA / SIH Cyber Crime Investigation Bureau
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Wallet Address Input */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Target Wallet / Contract Address
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter 0x..., 1..., bc1..., T..., or Solana address"
                    className="w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all font-mono"
                  />
                  {addressValid && detectedChain && (
                    <div className="absolute right-3 top-3 flex items-center gap-1.5 text-[10px] font-mono text-emerald-600">
                      <Check size={12} />
                      <span>Detected: {detectedChain}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cryptocurrency Selector (8 options) */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select Blockchain / Cryptocurrency
                </label>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                  {CRYPTO_OPTIONS.map((opt) => {
                    const isActive = selectedCrypto === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedCrypto(opt.id)}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-all ${
                          isActive
                            ? "border-cyan-400 bg-cyan-50 shadow-sm"
                            : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-lg" style={{ color: isActive ? opt.color : undefined }}>
                          {opt.icon}
                        </span>
                        <span className={`text-[10px] font-bold ${isActive ? "text-slate-800" : "text-slate-500"}`}>
                          {opt.label}
                        </span>
                        <span className={`text-[8px] font-mono ${isActive ? "text-cyan-600" : "text-slate-400"}`}>
                          {opt.ticker}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hop Depth & Analysis Scope Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Hop Depth */}
                <div>
                  <label className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Tracing Depth (Hops)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((h) => (
                      <button
                        key={h}
                        onClick={() => setHopDepth(h)}
                        className={`flex-1 flex flex-col items-center gap-1 rounded-lg border py-3 transition-all ${
                          hopDepth === h
                            ? "border-cyan-400 bg-cyan-50 shadow-sm"
                            : "border-slate-200 bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <span className={`text-sm font-black ${hopDepth === h ? "text-cyan-600" : "text-slate-500"}`}>
                          {h}
                        </span>
                        <span className={`text-[8px] font-mono ${hopDepth === h ? "text-cyan-600" : "text-slate-400"}`}>
                          {h === 1 ? "DIRECT" : h === 2 ? "CLUSTER" : h === 3 ? "DEEP" : "MAX"}
                        </span>
                      </button>
                    ))}
                  </div>
                  {/* Visual Depth Rings */}
                  <div className="mt-3 flex justify-center">
                    <svg width="120" height="60" viewBox="0 0 120 60">
                      {[1, 2, 3, 4].map((h) => (
                        <circle
                          key={h}
                          cx="60"
                          cy="55"
                          r={12 * h}
                          fill="none"
                          stroke={h <= hopDepth ? "#06b6d4" : "#e2e8f0"}
                          strokeWidth={h <= hopDepth ? 1.5 : 0.5}
                          opacity={h <= hopDepth ? 0.7 : 0.5}
                          strokeDasharray={h <= hopDepth ? "none" : "2 2"}
                        />
                      ))}
                      <circle cx="60" cy="55" r="3" fill="#06b6d4" />
                    </svg>
                  </div>
                </div>

                {/* Analysis Scope */}
                <div>
                  <label className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Analysis Scope
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: "transfer" as const, label: "Transfer Analysis", desc: "Track fund movements", icon: ArrowRight },
                      { key: "contract" as const, label: "Contract Interaction", desc: "Smart contract calls", icon: Hash },
                      { key: "mixer" as const, label: "Mixer Detection", desc: "Tumbler/mixer patterns", icon: Activity },
                      { key: "bridge" as const, label: "Bridge Tracking", desc: "Cross-chain bridges", icon: Layers },
                    ].map((s) => {
                      const Icon = s.icon;
                      const active = scopes[s.key];
                      return (
                        <button
                          key={s.key}
                          onClick={() => toggleScope(s.key)}
                          className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                            active
                              ? "border-cyan-300 bg-cyan-50"
                              : "border-slate-200 bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <div className={`size-5 rounded flex items-center justify-center text-[10px] ${
                            active ? "bg-cyan-500 text-white" : "border border-slate-300 text-slate-400"
                          }`}>
                            {active && <Check size={12} />}
                          </div>
                          <Icon size={14} className={active ? "text-cyan-600" : "text-slate-400"} />
                          <div>
                            <div className={`text-xs font-bold ${active ? "text-slate-800" : "text-slate-500"}`}>{s.label}</div>
                            <div className="text-[9px] font-mono text-slate-400">{s.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Demo Scenarios */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Quick-Fill Demo Scenarios
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {DEMO_ADDRESSES.map((d, i) => (
                    <button
                      key={d.address}
                      onClick={() => handleDemoFill(d)}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left hover:border-cyan-300 hover:bg-cyan-50 transition-all"
                    >
                      <div className="size-8 rounded bg-slate-200 flex items-center justify-center text-xs font-black text-cyan-600 font-mono">
                        D{i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-cyan-700 truncate">{d.label}</div>
                        <div className="text-[9px] font-mono text-slate-400 truncate">{d.address}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Investigation History */}
              {history.length > 0 && (
                <div>
                  <label className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Recent Investigations
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {history.slice(0, 5).map((h) => (
                      <button
                        key={h.investigationId}
                        onClick={() => {
                          setAddress(h.address);
                          setSelectedCrypto(h.blockchain);
                        }}
                        className="shrink-0 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-slate-300 transition-colors"
                      >
                        <div className="text-[10px] font-mono text-cyan-600 font-bold">{truncAddr(h.address)}</div>
                        <div className="text-[8px] font-mono text-slate-400">{h.blockchain} · {h.riskLevel}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer: Launch Button */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
              <div className="text-[10px] font-mono text-slate-500">
                {addressValid
                  ? `Ready to trace: ${truncAddr(address)} on ${selectedCrypto === "AUTO" ? (detectedChain || "AUTO") : selectedCrypto} · ${hopDepth} hops`
                  : "Enter a wallet address to begin"}
              </div>
              <button
                onClick={handleStartInvestigation}
                disabled={!addressValid}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-black font-mono transition-all ${
                  addressValid
                    ? "bg-cyan-500 text-white hover:bg-cyan-600 shadow-sm"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                }`}
              >
                <Zap size={16} />
                START INVESTIGATION
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================= */
  /* PHASE 2: PIPELINE ROADMAP ANIMATION                           */
  /* ============================================================= */
  if (phase === "pipeline") {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono text-cyan-700 mb-3">
              <Radio size={12} className="animate-pulse text-cyan-500" />
              FORENSIC ANALYSIS PIPELINE IN PROGRESS
            </div>
            <h2 className="text-2xl font-black text-slate-900">
              Analyzing Target: <span className="text-cyan-600">{truncAddr(address)}</span>
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {selectedCrypto === "AUTO" ? "Auto-Detected" : selectedCrypto} Network · {hopDepth} Hop Depth
            </p>
          </div>

          {/* Pipeline Steps */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === pipelineStep && !pipelineComplete;
                const isDone = i < pipelineStep || pipelineComplete;
                const isPending = i > pipelineStep && !pipelineComplete;

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-all duration-500 ${
                      isActive
                        ? "border-cyan-300 bg-cyan-50 shadow-sm"
                        : isDone
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50 opacity-50"
                    }`}
                  >
                    {/* Step Number / Status */}
                    <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isActive
                          ? "bg-cyan-500 text-white animate-pulse"
                          : "bg-slate-200 text-slate-500"
                    }`}>
                      {isDone ? (
                        <Check size={16} />
                      ) : isActive ? (
                        <Icon size={16} className="animate-spin" style={{ animationDuration: "2s" }} />
                      ) : (
                        <span className="text-xs font-bold">{i + 1}</span>
                      )}
                    </div>

                    {/* Step Info */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold ${
                        isDone ? "text-emerald-700" : isActive ? "text-cyan-700" : "text-slate-500"
                      }`}>
                        {step.label}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {step.desc}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                      isDone
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : isActive
                          ? "bg-cyan-100 text-cyan-700 border border-cyan-200 animate-pulse"
                          : "text-slate-400"
                    }`}>
                      {isDone ? "COMPLETE" : isActive ? "PROCESSING..." : "PENDING"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="mt-6 rounded-full h-2 bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                style={{
                  width: pipelineComplete
                    ? "100%"
                    : `${((pipelineStep + 1) / PIPELINE_STEPS.length) * 100}%`,
                }}
              />
            </div>

            {pipelineComplete && (
              <div className="mt-4 text-center animate-in fade-in">
                <div className="inline-flex items-center gap-2 text-emerald-600 text-sm font-bold font-mono">
                  <Check size={16} />
                  ANALYSIS COMPLETE — Loading Results...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================= */
  /* PHASE 3: RESULTS DASHBOARD                                    */
  /* ============================================================= */
  if (phase === "results" && result) {
    const riskCol = getRiskColor(result.risk.level);
    const highRiskWallets = result.trackedWallets.filter((w) => w.riskScore >= 50);

    return (
      <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-sans">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Results Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-600 mb-1">
                <Check size={12} />
                INVESTIGATION COMPLETE — {result.investigationId}
              </div>
              <h1 className="text-2xl font-black text-slate-900">
                Forensic Intelligence Results
              </h1>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                Target: {truncAddr(result.wallet.address)} · {result.wallet.blockchain} · {result.config.depth} Hops · {result.trackedWallets.length} Entities
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setPhase("input"); setResult(null); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:border-slate-400 transition-colors"
              >
                <Search size={13} />
                New Investigation
              </button>
              <button
                onClick={goToGraph}
                className="flex items-center gap-2 rounded-lg bg-cyan-500 text-white px-5 py-2 text-sm font-black font-mono hover:bg-cyan-600 shadow-sm transition-all"
              >
                <Network size={16} />
                GRAPHICAL VIEW
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Top Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: "RISK SCORE", value: `${result.risk.overallScore}/100`, color: riskCol, sub: result.risk.level },
              { label: "ENTITIES", value: result.trackedWallets.length.toString(), color: "#06b6d4", sub: "Wallets" },
              { label: "TRANSACTIONS", value: result.transactions.length.toString(), color: "#f59e0b", sub: "On-chain" },
              { label: "TOTAL RECEIVED", value: `${result.wallet.totalReceived.toFixed(1)}`, color: "#10b981", sub: result.wallet.asset },
              { label: "TOTAL SENT", value: `${result.wallet.totalSent.toFixed(1)}`, color: "#f97316", sub: result.wallet.asset },
              { label: "EST. BALANCE", value: `${result.wallet.estimatedBalance.toFixed(2)}`, color: "#06b6d4", sub: result.wallet.asset },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-slate-200 bg-white p-3 text-center"
              >
                <div className="text-[9px] font-mono font-bold text-slate-500 uppercase">{stat.label}</div>
                <div className="text-xl font-black mt-1" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-[10px] font-mono text-slate-400">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Circle Risk Map */}
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target size={14} className="text-cyan-600" />
                Risk Topology Circle
              </div>
              <div className="flex justify-center">
                <svg viewBox="0 0 200 200" width="220" height="220">
                  {/* Background rings */}
                  <circle cx="100" cy="100" r="90" fill="none" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <circle cx="100" cy="100" r="65" fill="none" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <circle cx="100" cy="100" r="40" fill="none" stroke="#e2e8f0" strokeDasharray="3 3" />

                  {/* Risk Score Arc */}
                  <circle
                    cx="100" cy="100" r="85"
                    fill="none"
                    stroke={riskCol}
                    strokeWidth="4"
                    strokeDasharray={`${(result.risk.overallScore / 100) * 534} 534`}
                    strokeLinecap="round"
                    transform="rotate(-90 100 100)"
                    opacity="0.8"
                  />

                  {/* Entity dots arranged in circle */}
                  {result.trackedWallets.slice(0, 16).map((w, i) => {
                    const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
                    const r = 20 + w.hop * 20;
                    const cx = 100 + Math.cos(angle) * r;
                    const cy = 100 + Math.sin(angle) * r;
                    const wCol = getRiskColor(w.risk);
                    return (
                      <g key={w.address}>
                        <line x1="100" y1="100" x2={cx} y2={cy} stroke={wCol} strokeWidth="0.5" opacity="0.3" />
                        <circle cx={cx} cy={cy} r={w.riskScore >= 50 ? 5 : 3} fill={wCol} opacity="0.8" />
                      </g>
                    );
                  })}

                  {/* Center Target */}
                  <circle cx="100" cy="100" r="8" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
                  <text x="100" y="104" textAnchor="middle" fill="white" fontSize="6" fontFamily="monospace" fontWeight="bold">
                    TGT
                  </text>

                  {/* Score Text */}
                  <text x="100" y="160" textAnchor="middle" fill={riskCol} fontSize="18" fontFamily="monospace" fontWeight="bold">
                    {result.risk.overallScore}
                  </text>
                  <text x="100" y="172" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                    RISK SCORE
                  </text>
                </svg>
              </div>
            </div>

            {/* Wallet Profile Card */}
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Wallet size={14} className="text-cyan-600" />
                Target Wallet Profile
              </div>
              <div className="space-y-2 text-[11px] font-mono">
                {[
                  { label: "ADDRESS", value: truncAddr(result.wallet.address), color: "text-cyan-600" },
                  { label: "BLOCKCHAIN", value: result.wallet.blockchain, color: "text-slate-800" },
                  { label: "ASSET", value: result.wallet.asset, color: "text-amber-600" },
                  { label: "TYPE", value: result.wallet.walletType, color: "text-emerald-600" },
                  { label: "FIRST ACTIVITY", value: result.wallet.firstActivity, color: "text-slate-600" },
                  { label: "LAST ACTIVITY", value: result.wallet.lastActivity, color: "text-slate-600" },
                  { label: "TRANSACTIONS", value: result.wallet.transactionCount.toLocaleString(), color: "text-cyan-600" },
                  { label: "TOTAL RECEIVED", value: `${result.wallet.totalReceived.toFixed(2)} ${result.wallet.asset}`, color: "text-emerald-600" },
                  { label: "TOTAL SENT", value: `${result.wallet.totalSent.toFixed(2)} ${result.wallet.asset}`, color: "text-orange-600" },
                  { label: "EST. BALANCE", value: `${result.wallet.estimatedBalance.toFixed(2)} ${result.wallet.asset}`, color: "text-cyan-600" },
                  { label: "CLUSTER ID", value: result.wallet.clusterId, color: "text-amber-600" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-400 text-[9px] font-bold">{row.label}</span>
                    <span className={`font-bold ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* VASP & Typology Summary */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <div>
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Globe size={14} className="text-emerald-600" />
                  VASP Attribution
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-[11px] font-mono space-y-1">
                  <div className="flex justify-between"><span className="text-slate-400">Candidate</span><span className="text-emerald-600 font-bold">{result.vasp?.candidate || result.vasp?.vaspName || "Unknown"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Category</span><span className="text-slate-600">{result.vasp?.category || result.vasp?.vaspCategory || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Jurisdiction</span><span className="text-slate-600">{result.vasp?.jurisdiction || "Multi"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Confidence</span><span className="text-cyan-600 font-bold">{result.vasp?.confidence || 0}%</span></div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-600" />
                  Risk Typologies ({result.typologies.length})
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {result.typologies.map((t, i) => (
                    <div key={i} className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-red-600 font-bold">{t.name}</span>
                        <span className="text-[8px] px-1.5 py-0.2 rounded bg-red-100 text-red-600 border border-red-200 font-bold">
                          {t.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* High Risk Entities & Fund Flow Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* High Risk Wallets */}
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-600" />
                High Risk Entities ({highRiskWallets.length})
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {highRiskWallets.slice(0, 8).map((w) => (
                  <div key={w.address} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: getRiskColor(w.risk) }} />
                      <span className="text-[11px] font-mono font-bold text-slate-800">{truncAddr(w.address)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-slate-400">H{w.hop}</span>
                      <span className="text-amber-600 font-bold">{w.totalVolume.toFixed(1)} {result.wallet.asset}</span>
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-bold" style={{ color: getRiskColor(w.risk), backgroundColor: `${getRiskColor(w.risk)}15` }}>
                        {w.risk}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fund Flow Summary */}
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-amber-600" />
                Fund Flow Summary
              </div>
              <div className="space-y-3">
                {/* Flow bars */}
                {result.trackedWallets.slice(0, 6).map((w) => {
                  const pct = Math.min(100, (w.totalVolume / result.wallet.totalReceived) * 100);
                  return (
                    <div key={w.address}>
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span className="text-slate-400">{truncAddr(w.address)}</span>
                        <span className="text-amber-600 font-bold">{w.totalVolume.toFixed(1)} {result.wallet.asset}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: getRiskColor(w.risk),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom: Navigation to Other Pages */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/intelligence-graph", label: "Intelligence Graph", icon: Network, desc: "Interactive SVG graph", color: "cyan" },
              { href: "/crypto-wallet", label: "Crypto Wallet Analysis", icon: Wallet, desc: "Deep wallet profiles", color: "emerald" },
              { href: "/fund-flow-graph", label: "Fund Flow Graph", icon: TrendingUp, desc: "Sankey flow diagram", color: "amber" },
              { href: "/risk-map", label: "Risk Map", icon: MapPinned, desc: "Geospatial heatmap", color: "red" },
            ].map((nav) => {
              const Icon = nav.icon;
              return (
                <button
                  key={nav.href}
                  onClick={() => setLocation(nav.href)}
                  className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-cyan-300 hover:shadow-sm transition-all group"
                >
                  <Icon size={20} className={`text-${nav.color}-500 mb-2 group-hover:scale-110 transition-transform`} />
                  <div className="text-xs font-bold text-slate-800">{nav.label}</div>
                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">{nav.desc}</div>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-cyan-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ArrowRight size={10} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
