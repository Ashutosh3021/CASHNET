import React, { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  Hash,
  Layers,
  Network,
  Search,
  Shield,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { getCurrentInvestigation, saveInvestigation } from "@/lib/investigation-store";
import { DEMO_CASES, loadDemoCase } from "@/lib/demo-data";
import type { InvestigationResult, RiskLevel } from "@/types/investigation";

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
function riskTone(l: RiskLevel) {
  switch (l) {
    case "CRITICAL": return "red";
    case "HIGH": return "amber";
    case "MEDIUM": return "cyan";
    case "LOW": return "green";
    default: return "slate";
  }
}

export default function CryptoWalletPage() {
  const [, setLocation] = useLocation();
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(() => getCurrentInvestigation());
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const handleCaseChange = useCallback((caseId: string) => {
    const data = loadDemoCase(caseId);
    if (data) {
      saveInvestigation(data);
      setInvestigation(data);
      setSelectedWallet(null);
      setExpandedTx(null);
    }
  }, []);

  const inv = investigation;

  if (!inv) {
    return (
      <div className="enter">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-mono-data text-[10px] font-bold uppercase tracking-[.18em] text-cyan-700"><span className="size-1.5 bg-amber-400" />Crypto Wallet Analysis</div>
          <h1 className="text-2xl font-extrabold tracking-[-.03em] text-slate-900 md:text-[30px]">Tracked Entities Directory</h1>
        </div>
        <div className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)] p-6">
          <div className="mb-4 text-sm font-bold text-slate-800">Select a Demo Case</div>
          <p className="mb-4 text-xs leading-5 text-slate-500">Choose a demo investigation to load wallet data and transaction history.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_CASES.map((demo) => (
              <button
                key={demo.id}
                onClick={() => handleCaseChange(demo.id)}
                className="group border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-cyan-400 hover:bg-cyan-50/30"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-cyan-700">{demo.label}</div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500">{demo.description}</div>
                <div className="mt-2 font-mono-data text-[10px] text-slate-400">{demo.data.wallet.blockchain} · {demo.data.wallet.asset} · Risk {demo.data.risk.overallScore}/100</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const wallets = inv.trackedWallets;
  const filteredWallets = wallets.filter(
    (w) =>
      w.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.relationship || w.nodeType).toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeWallet = selectedWallet
    ? wallets.find((w) => w.address === selectedWallet)
    : null;

  const walletTxns = selectedWallet
    ? inv.transactions.filter(
        (t) => t.from === selectedWallet || t.to === selectedWallet,
      )
    : [];

  return (
    <div className="enter">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono-data text-[10px] font-bold uppercase tracking-[.18em] text-cyan-700"><span className="size-1.5 bg-amber-400" />Crypto Wallet Analysis</div>
          <h1 className="text-2xl font-extrabold tracking-[-.03em] text-slate-900 md:text-[30px]">Tracked Entities Directory</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
            {wallets.length} wallets tracked across {inv.config.depth} hop depth
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
            onClick={() => { setLocation("/crypto-investigation"); }}
            className="flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-cyan-400"
          >
            <ArrowRight size={12} />
            Back
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="lg:col-span-1 border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Intelligence layer</div>
              <h2 className="mt-0.5 text-sm font-extrabold text-slate-800">Wallet Directory</h2>
            </div>
          </div>
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wallets..."
                className="w-full border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/12 font-mono-data"
              />
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
            {filteredWallets.map((w) => {
              const active = selectedWallet === w.address;
              return (
                <button
                  key={w.address}
                  onClick={() => setSelectedWallet(w.address)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    active
                      ? "bg-cyan-50/40 border-l-2 border-l-cyan-500"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: riskColor(w.risk) }}
                    />
                    <span className="text-[11px] font-mono-data font-bold text-slate-800">
                      {truncAddr(w.address)}
                    </span>
                    <span className="text-[8px] font-mono-data text-slate-400 ml-auto">
                      H{w.hop}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono-data">
                    <span className="text-slate-500">{w.relationship || w.nodeType}</span>
                    <span className="ml-auto font-bold" style={{ color: riskColor(w.risk) }}>
                      {w.riskScore}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="lg:col-span-2 space-y-4">
          {activeWallet ? (
            <>
              <section className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Shield size={14} className="text-cyan-600" />
                    Wallet Profile
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] bg-${riskTone(activeWallet.risk)}-100 text-${riskTone(activeWallet.risk)}-800`}
                  >
                    {activeWallet.risk} — {activeWallet.riskScore}/100
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {[
                    { label: "ADDRESS", value: truncAddr(activeWallet.address) },
                    { label: "BLOCKCHAIN", value: activeWallet.profile?.blockchain || inv.wallet.blockchain },
                    { label: "ASSET", value: activeWallet.profile?.asset || inv.wallet.asset },
                    { label: "TYPE", value: activeWallet.profile?.walletType || activeWallet.nodeType },
                    { label: "RELATIONSHIP", value: activeWallet.relationship || activeWallet.nodeType },
                    { label: "HOP DISTANCE", value: `Hop ${activeWallet.hop}` },
                    { label: "FIRST ACTIVITY", value: activeWallet.profile?.firstActivity || "N/A" },
                    { label: "LAST ACTIVITY", value: activeWallet.profile?.lastActivity || "N/A" },
                    { label: "TOTAL VOLUME", value: `${activeWallet.totalVolume.toFixed(2)} ${inv.wallet.asset}` },
                    { label: "INBOUND", value: `${Math.round(activeWallet.transactionCount * 0.55)} txns` },
                    { label: "OUTBOUND", value: `${Math.round(activeWallet.transactionCount * 0.45)} txns` },
                    { label: "CLUSTER ID", value: activeWallet.profile?.clusterId || "CL-DEFAULT" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="text-[8px] font-mono-data font-bold text-slate-400 uppercase">
                        {row.label}
                      </div>
                      <div className="text-xs font-mono-data font-bold text-slate-800 mt-0.5">
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)] p-5">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart3 size={14} className="text-amber-600" />
                  Balance & Activity Timeline
                </div>
                <div className="flex items-end gap-1 h-20 border-b border-l border-slate-200 px-3 pb-0 pt-5">
                  {Array.from({ length: 30 }, (_, i) => {
                    const h = Math.random() * 70 + 10;
                    const isInbound = i % 3 !== 0;
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t transition-all hover:opacity-80"
                        style={{
                          height: `${h}%`,
                          backgroundColor: isInbound
                            ? "rgba(6, 182, 212, 0.7)"
                            : "rgba(249, 115, 22, 0.7)",
                        }}
                        title={`Day ${i + 1}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] font-mono-data text-slate-400 mt-1">
                  <span>30 days ago</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-cyan-500" /> Inbound
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-orange-500" /> Outbound
                    </span>
                  </div>
                  <span>Today</span>
                </div>
              </section>

              <section className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)] overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Hash size={14} className="text-cyan-600" />
                    Transactions ({walletTxns.length})
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                  {walletTxns.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No transactions found for this wallet.
                    </div>
                  ) : (
                    walletTxns.map((tx) => {
                      const isExpanded = expandedTx === tx.hash;
                      const isInbound = tx.to === selectedWallet;
                      return (
                        <div key={tx.hash}>
                          <button
                            onClick={() => setExpandedTx(isExpanded ? null : tx.hash)}
                            className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-cyan-50/40 transition-colors"
                          >
                            <div className={`size-6 rounded flex items-center justify-center ${isInbound ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}>
                              {isInbound ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-mono-data font-bold text-slate-800 truncate">
                                {tx.hash}
                              </div>
                              <div className="text-[9px] font-mono-data text-slate-400">
                                {tx.timestamp}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-xs font-bold font-mono-data ${isInbound ? "text-emerald-600" : "text-orange-600"}`}>
                                {isInbound ? "+" : "-"}{tx.amount.toFixed(4)} {inv.wallet.asset}
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                          </button>

                          {isExpanded && (
                            <div className="bg-slate-50 border-t border-slate-100 px-4 py-3">
                              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono-data md:grid-cols-4">
                                {[
                                  { label: "Transaction Hash", value: tx.hash },
                                  { label: "Block Number", value: (tx.blockNumber || 0).toString() },
                                  { label: "Timestamp", value: tx.timestamp },
                                  { label: "From Address", value: truncAddr(tx.from) },
                                  { label: "To Address", value: truncAddr(tx.to) },
                                  { label: "Value", value: `${tx.amount.toFixed(6)} ${inv.wallet.asset}` },
                                  { label: "Gas", value: (tx.gas || 0).toString() },
                                  { label: "Gas Price", value: tx.gasPrice || "N/A" },
                                  { label: "Gas Used", value: (tx.gasUsed || 0).toString() },
                                  { label: "Transaction Fee", value: tx.transactionFee || "N/A" },
                                  { label: "Status", value: tx.status || "Success" },
                                  { label: "Nonce", value: (tx.nonce || 0).toString() },
                                  { label: "Input Data", value: tx.inputData || "0x" },
                                  { label: "Method ID", value: tx.methodId || "0x" },
                                  { label: "Contract Address", value: tx.contractAddress ? truncAddr(tx.contractAddress) : "N/A" },
                                  { label: "Confirmations", value: (tx.confirmations || 0).toString() },
                                ].map((row) => (
                                  <div key={row.label} className="border border-slate-100 bg-white px-2 py-1.5">
                                    <div className="text-[7px] font-bold text-slate-400 uppercase">{row.label}</div>
                                    <div className="text-[9px] text-cyan-700 font-bold truncate">{row.value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50/60 p-12 text-center">
              <Wallet size={48} className="text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-400 mb-1">Select a Wallet</h3>
              <p className="text-xs text-slate-500 font-mono-data">
                Click on any wallet in the directory to view its full profile and transactions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
