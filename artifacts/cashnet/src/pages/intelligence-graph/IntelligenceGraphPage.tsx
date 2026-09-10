import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Database,
  Eye,
  Globe,
  Layers,
  Maximize2,
  Minimize2,
  Network,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Target,
  Wallet,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getCurrentInvestigation, getHistory } from "@/lib/investigation-store";
import type {
  InvestigationResult,
  RiskLevel,
  GraphNode,
  GraphEdge,
  TrackedWallet,
} from "@/types/investigation";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function truncAddr(a: string): string {
  if (!a) return "";
  return a.length > 14 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

function riskColor(l: RiskLevel): string {
  switch (l) {
    case "CRITICAL": return "#ef4444";
    case "HIGH": return "#f97316";
    case "MEDIUM": return "#06b6d4";
    case "LOW": return "#10b981";
    default: return "#64748b";
  }
}

function riskBgColor(l: RiskLevel): string {
  switch (l) {
    case "CRITICAL": return "bg-red-50 text-red-700 border-red-200";
    case "HIGH": return "bg-orange-50 text-orange-700 border-orange-200";
    case "MEDIUM": return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "LOW": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default: return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function nodeTypeIcon(type: string): string {
  switch (type) {
    case "TARGET": return "🎯";
    case "LINKED_WALLET": return "🔗";
    case "INTERMEDIARY": return "🔄";
    case "CLUSTER_MEMBER": return "👥";
    case "VASP": return "🏦";
    case "HIGH_RISK": return "⚠️";
    default: return "❓";
  }
}

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  zoom: number;
  panX: number;
  panY: number;
}

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function IntelligenceGraphPage() {
  const [, setLocation] = useLocation();
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(
    () => getCurrentInvestigation()
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [showLabels, setShowLabels] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphState, setGraphState] = useState<GraphState>({
    nodes: [],
    edges: [],
    zoom: 1,
    panX: 0,
    panY: 0,
  });

  // History
  const history = useMemo(() => getHistory(), []);

  // Build graph from investigation data
  useEffect(() => {
    if (!investigation) return;

    const { graphNodes, graphEdges, trackedWallets, wallet } = investigation;

    // If graphNodes exist, use them; otherwise build from trackedWallets
    let nodes: GraphNode[];
    let edges: GraphEdge[];

    if (graphNodes && graphNodes.length > 0) {
      nodes = graphNodes;
      edges = graphEdges || [];
    } else {
      // Build nodes from tracked wallets
      nodes = trackedWallets.map((w, i) => {
        const angle = (i / trackedWallets.length) * Math.PI * 2;
        const radius = 150 + w.hop * 80;
        const centerX = 400;
        const centerY = 300;

        return {
          id: w.address,
          label: truncAddr(w.address),
          nodeType: w.nodeType as any,
          risk: w.risk,
          riskScore: w.riskScore,
          hop: w.hop,
          transactionCount: w.transactionCount,
          totalVolume: w.totalVolume,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      });

      // Build edges from wallet relationships
      edges = [];
      for (let i = 0; i < trackedWallets.length; i++) {
        for (let j = i + 1; j < trackedWallets.length; j++) {
          const w1 = trackedWallets[i];
          const w2 = trackedWallets[j];
          // Connect wallets that are within 1 hop of each other
          if (Math.abs(w1.hop - w2.hop) <= 1) {
            edges.push({
              source: w1.address,
              target: w2.address,
              amount: Math.min(w1.totalVolume, w2.totalVolume) * 0.1,
              asset: wallet.asset,
              direction: "OUTGOING",
              risk: w1.riskScore > w2.riskScore ? w1.risk : w2.risk,
              transactionCount: Math.floor(Math.random() * 5) + 1,
            });
          }
        }
      }
    }

    setGraphState((prev) => ({
      ...prev,
      nodes,
      edges,
    }));
  }, [investigation]);

  // Filter nodes based on filter
  const filteredNodes = useMemo(() => {
    if (filter === "ALL") return graphState.nodes;
    return graphState.nodes.filter((n) => {
      switch (filter) {
        case "HIGH_RISK": return n.riskScore >= 50;
        case "VASP": return n.nodeType === "VASP";
        case "CLUSTER": return n.nodeType === "CLUSTER_MEMBER";
        default: return true;
      }
    });
  }, [graphState.nodes, filter]);

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  const filteredEdges = useMemo(
    () =>
      graphState.edges.filter(
        (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
      ),
    [graphState.edges, filteredNodeIds]
  );

  // Selected node details
  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    return graphState.nodes.find((n) => n.id === selectedNode) || null;
  }, [selectedNode, graphState.nodes]);

  // Tracked wallet details for selected node
  const selectedWalletDetails = useMemo(() => {
    if (!selectedNode || !investigation) return null;
    return investigation.trackedWallets.find(
      (w) => w.address === selectedNode
    ) || null;
  }, [selectedNode, investigation]);

  // Edge details
  const selectedEdgeData = useMemo(() => {
    if (!selectedEdge) return null;
    const [source, target] = selectedEdge.split("->");
    return graphState.edges.find(
      (e) => e.source === source && e.target === target
    ) || null;
  }, [selectedEdge, graphState.edges]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setGraphState((prev) => ({
      ...prev,
      zoom: Math.min(prev.zoom + 0.2, 3),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setGraphState((prev) => ({
      ...prev,
      zoom: Math.max(prev.zoom - 0.2, 0.3),
    }));
  }, []);

  const handleResetView = useCallback(() => {
    setGraphState((prev) => ({
      ...prev,
      zoom: 1,
      panX: 0,
      panY: 0,
    }));
  }, []);

  // Node click handler
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
    setSelectedEdge(null);
  }, []);

  // Edge click handler
  const handleEdgeClick = useCallback(
    (source: string, target: string) => {
      setSelectedEdge(`${source}->${target}`);
      setSelectedNode(null);
    },
    []
  );

  // Close selection
  const handleCloseSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  if (!investigation) {
    return (
      <div className="enter">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 font-mono-data text-[10px] font-bold uppercase tracking-[.18em] text-cyan-700">
            <span className="size-1.5 bg-amber-400" />
            Intelligence Graph
          </div>
          <h1 className="text-2xl font-extrabold tracking-[-.03em] text-slate-900 md:text-[30px]">
            Transaction Network Visualization
          </h1>
        </div>
        <div className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)] p-6">
          <div className="mb-4 text-sm font-bold text-slate-800">
            No Investigation Data
          </div>
          <p className="mb-4 text-xs leading-5 text-slate-500">
            Run a crypto investigation first to visualize the transaction
            network graph.
          </p>
          <button
            onClick={() => setLocation("/crypto-investigation")}
            className="flex items-center gap-2 bg-cyan-500 text-white px-4 py-2 text-xs font-bold hover:bg-cyan-600"
          >
            <Network size={14} />
            Start Investigation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="enter">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono-data text-[10px] font-bold uppercase tracking-[.18em] text-cyan-700">
            <span className="size-1.5 bg-amber-400" />
            Intelligence Graph
          </div>
          <h1 className="text-2xl font-extrabold tracking-[-.03em] text-slate-900 md:text-[30px]">
            Transaction Network Visualization
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
            Target: {truncAddr(investigation.wallet.address)} ·{" "}
            {investigation.wallet.blockchain} ·{" "}
            {graphState.nodes.length} entities · {graphState.edges.length}{" "}
            connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={investigation.investigationId}
            onChange={(e) => {
              const hist = history.find(
                (h) => h.investigationId === e.target.value
              );
              if (hist) {
                // Reload from history if available
                window.location.reload();
              }
            }}
            className="border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-cyan-400"
          >
            <option value={investigation.investigationId}>
              Current Investigation
            </option>
          </select>
          <button
            onClick={() => setLocation("/crypto-investigation")}
            className="flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-cyan-400"
          >
            <ArrowRight size={12} />
            Back
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr_280px]">
        {/* Left Panel - Controls */}
        <section className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
                Controls
              </div>
              <h2 className="mt-0.5 text-sm font-extrabold text-slate-800">
                Graph Settings
              </h2>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {/* Zoom Controls */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Zoom
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleZoomOut}
                  className="flex items-center justify-center size-8 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                >
                  <ZoomOut size={14} />
                </button>
                <div className="flex-1 text-center text-xs font-mono-data text-slate-700">
                  {Math.round(graphState.zoom * 100)}%
                </div>
                <button
                  onClick={handleZoomIn}
                  className="flex items-center justify-center size-8 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={handleResetView}
                  className="flex items-center justify-center size-8 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            {/* Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Filter Nodes
              </label>
              <div className="space-y-1">
                {[
                  { value: "ALL", label: "All Nodes" },
                  { value: "HIGH_RISK", label: "High Risk (≥50)" },
                  { value: "VASP", label: "VASP Entities" },
                  { value: "CLUSTER", label: "Cluster Members" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                      filter === opt.value
                        ? "bg-cyan-50 text-cyan-700 border-l-2 border-l-cyan-500"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Display Options */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Display
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="size-3.5 accent-cyan-500"
                  />
                  <span className="text-xs text-slate-600">Node Labels</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEdgeLabels}
                    onChange={(e) => setShowEdgeLabels(e.target.checked)}
                    className="size-3.5 accent-cyan-500"
                  />
                  <span className="text-xs text-slate-600">Edge Labels</span>
                </label>
              </div>
            </div>

            {/* Legend */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Legend
              </label>
              <div className="space-y-1.5">
                {[
                  { type: "TARGET", label: "Target Wallet", icon: "🎯" },
                  { type: "LINKED_WALLET", label: "Linked Wallet", icon: "🔗" },
                  { type: "INTERMEDIARY", label: "Intermediary", icon: "🔄" },
                  { type: "VASP", label: "VASP/Exchange", icon: "🏦" },
                  { type: "HIGH_RISK", label: "High Risk", icon: "⚠️" },
                  { type: "CLUSTER_MEMBER", label: "Cluster", icon: "👥" },
                ].map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center gap-2 text-[10px]"
                  >
                    <span>{item.icon}</span>
                    <span className="text-slate-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Levels */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Risk Levels
              </label>
              <div className="space-y-1">
                {[
                  { level: "CRITICAL", color: "#ef4444" },
                  { level: "HIGH", color: "#f97316" },
                  { level: "MEDIUM", color: "#06b6d4" },
                  { level: "LOW", color: "#10b981" },
                ].map((item) => (
                  <div
                    key={item.level}
                    className="flex items-center gap-2 text-[10px]"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-600">{item.level}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Center - SVG Graph */}
        <section className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)] overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
                Network Topology
              </div>
              <h2 className="mt-0.5 text-sm font-extrabold text-slate-800">
                Interactive Graph
              </h2>
            </div>
            <div className="text-[10px] font-mono-data text-slate-500">
              {filteredNodes.length} nodes · {filteredEdges.length} edges
            </div>
          </div>

          <div className="relative bg-slate-50 min-h-[500px]">
            <svg
              ref={svgRef}
              width="100%"
              height="500"
              viewBox="0 0 800 600"
              className="bg-slate-50"
            >
              <g
                transform={`translate(${graphState.panX}, ${graphState.panY}) scale(${graphState.zoom})`}
              >
                {/* Grid pattern */}
                <defs>
                  <pattern
                    id="grid"
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="800" height="600" fill="url(#grid)" />

                {/* Edges */}
                {filteredEdges.map((edge, i) => {
                  const sourceNode = graphState.nodes.find(
                    (n) => n.id === edge.source
                  );
                  const targetNode = graphState.nodes.find(
                    (n) => n.id === edge.target
                  );
                  if (!sourceNode || !targetNode) return null;

                  const edgeKey = `${edge.source}->${edge.target}`;
                  const isSelected = selectedEdge === edgeKey;
                  const edgeColor = edge.risk ? riskColor(edge.risk) : "#94a3b8";

                  return (
                    <g key={i}>
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={edgeColor}
                        strokeWidth={isSelected ? 3 : 1.5}
                        strokeOpacity={isSelected ? 1 : 0.5}
                        className="cursor-pointer hover:stroke-[3] hover:stroke-opacity-100 transition-all"
                        onClick={() =>
                          handleEdgeClick(edge.source, edge.target)
                        }
                      />
                      {showEdgeLabels && (
                        <text
                          x={(sourceNode.x + targetNode.x) / 2}
                          y={(sourceNode.y + targetNode.y) / 2 - 5}
                          textAnchor="middle"
                          fill="#64748b"
                          fontSize="8"
                          fontFamily="monospace"
                        >
                          {edge.amount.toFixed(2)} {edge.asset}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {filteredNodes.map((node) => {
                  const isSelected = selectedNode === node.id;
                  const isHovered = hoveredNode === node.id;
                  const nodeColor = riskColor(node.risk);
                  const nodeSize = node.nodeType === "TARGET" ? 20 : 14;

                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer"
                      onClick={() => handleNodeClick(node.id)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      {/* Glow effect for selected/hovered */}
                      {(isSelected || isHovered) && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={nodeSize + 8}
                          fill="none"
                          stroke={nodeColor}
                          strokeWidth="2"
                          strokeOpacity="0.3"
                          className="animate-pulse"
                        />
                      )}

                      {/* Node circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={nodeSize}
                        fill={nodeColor}
                        stroke={isSelected ? "#1e293b" : "#ffffff"}
                        strokeWidth={isSelected ? 3 : 2}
                        className="transition-all"
                      />

                      {/* Node icon */}
                      <text
                        x={node.x}
                        y={node.y + 4}
                        textAnchor="middle"
                        fill="white"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {nodeTypeIcon(node.nodeType)}
                      </text>

                      {/* Node label */}
                      {showLabels && (
                        <text
                          x={node.x}
                          y={node.y + nodeSize + 14}
                          textAnchor="middle"
                          fill="#475569"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {node.label}
                        </text>
                      )}

                      {/* Risk score badge */}
                      {node.riskScore >= 50 && (
                        <g>
                          <circle
                            cx={node.x + nodeSize - 2}
                            cy={node.y - nodeSize + 2}
                            r="8"
                            fill="#ffffff"
                            stroke={nodeColor}
                            strokeWidth="1.5"
                          />
                          <text
                            x={node.x + nodeSize - 2}
                            y={node.y - nodeSize + 5}
                            textAnchor="middle"
                            fill={nodeColor}
                            fontSize="7"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {node.riskScore}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Center target marker */}
                {graphState.nodes.some((n) => n.nodeType === "TARGET") && (
                  <g>
                    <circle
                      cx="400"
                      cy="300"
                      r="6"
                      fill="#06b6d4"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x="400"
                      y="303"
                      textAnchor="middle"
                      fill="white"
                      fontSize="5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      TGT
                    </text>
                  </g>
                )}
              </g>
            </svg>

            {/* Tooltip for hovered node */}
            {hoveredNode && !selectedNode && (
              <div className="absolute top-4 right-4 border border-slate-200 bg-white p-3 shadow-lg max-w-[200px]">
                <div className="text-[10px] font-bold text-slate-800 mb-1">
                  {
                    graphState.nodes.find((n) => n.id === hoveredNode)
                      ?.nodeType
                  }
                </div>
                <div className="text-[9px] font-mono-data text-cyan-600 font-bold truncate">
                  {truncAddr(hoveredNode)}
                </div>
                <div className="text-[9px] text-slate-500 mt-1">
                  Risk:{" "}
                  <span
                    style={{
                      color: riskColor(
                        graphState.nodes.find((n) => n.id === hoveredNode)
                          ?.risk || "LOW"
                      ),
                    }}
                    className="font-bold"
                  >
                    {
                      graphState.nodes.find((n) => n.id === hoveredNode)
                        ?.riskScore
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Panel - Node Details */}
        <section className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(25,42,67,.04)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
                {selectedNode ? "Node Details" : selectedEdge ? "Edge Details" : "Selection"}
              </div>
              <h2 className="mt-0.5 text-sm font-extrabold text-slate-800">
                {selectedNode
                  ? "Wallet Profile"
                  : selectedEdge
                  ? "Transaction"
                  : "Click a Node"}
              </h2>
            </div>
            {(selectedNode || selectedEdge) && (
              <button
                onClick={handleCloseSelection}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="p-4">
            {/* Selected Node */}
            {selectedNode && selectedNodeData && (
              <div className="space-y-4">
                {/* Risk Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] ${riskBgColor(
                    selectedNodeData.risk
                  )}`}
                >
                  <Shield size={12} />
                  {selectedNodeData.risk} — {selectedNodeData.riskScore}/100
                </div>

                {/* Address */}
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                    Address
                  </label>
                  <div className="font-mono-data text-xs text-cyan-700 font-bold break-all">
                    {selectedNodeData.id}
                  </div>
                </div>

                {/* Node Info */}
                <div className="space-y-2">
                  {[
                    { label: "TYPE", value: selectedNodeData.nodeType },
                    { label: "HOP DISTANCE", value: `Hop ${selectedNodeData.hop}` },
                    { label: "TRANSACTIONS", value: selectedNodeData.transactionCount.toString() },
                    {
                      label: "TOTAL VOLUME",
                      value: `${selectedNodeData.totalVolume.toFixed(4)} ${investigation.wallet.asset}`,
                    },
                    {
                      label: "RELATIONSHIP",
                      value: selectedWalletDetails?.relationship || selectedNodeData.nodeType,
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between border-b border-slate-100 pb-2"
                    >
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        {row.label}
                      </span>
                      <span className="text-[11px] font-mono-data font-bold text-slate-700">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Wallet Profile Details */}
                {selectedWalletDetails?.profile && (
                  <div className="mt-4">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-2">
                      Profile
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "BLOCKCHAIN", value: selectedWalletDetails.profile.blockchain },
                        { label: "ASSET", value: selectedWalletDetails.profile.asset },
                        { label: "TYPE", value: selectedWalletDetails.profile.walletType },
                        { label: "CLUSTER", value: selectedWalletDetails.profile.clusterId },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="border border-slate-100 bg-slate-50 px-2 py-1.5"
                        >
                          <div className="text-[7px] font-bold text-slate-400 uppercase">
                            {row.label}
                          </div>
                          <div className="text-[9px] text-slate-700 font-bold">
                            {row.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connected Nodes */}
                <div className="mt-4">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-2">
                    Connected Nodes
                  </label>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {graphState.edges
                      .filter(
                        (e) =>
                          e.source === selectedNode ||
                          e.target === selectedNode
                      )
                      .slice(0, 5)
                      .map((edge, i) => {
                        const connectedId =
                          edge.source === selectedNode
                            ? edge.target
                            : edge.source;
                        const connectedNode = graphState.nodes.find(
                          (n) => n.id === connectedId
                        );
                        return (
                          <button
                            key={i}
                            onClick={() => handleNodeClick(connectedId)}
                            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 transition-colors"
                          >
                            <span
                              className="size-2 rounded-full"
                              style={{
                                backgroundColor: connectedNode
                                  ? riskColor(connectedNode.risk)
                                  : "#94a3b8",
                              }}
                            />
                            <span className="text-[9px] font-mono-data text-slate-600 truncate">
                              {truncAddr(connectedId)}
                            </span>
                            <ChevronRight
                              size={10}
                              className="ml-auto text-slate-400"
                            />
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* Selected Edge */}
            {selectedEdge && selectedEdgeData && (
              <div className="space-y-4">
                {/* Risk Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] ${
                    selectedEdgeData.risk
                      ? riskBgColor(selectedEdgeData.risk)
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  <Network size={12} />
                  {selectedEdgeData.risk || "UNKNOWN"} Risk
                </div>

                {/* From */}
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                    From
                  </label>
                  <button
                    onClick={() => handleNodeClick(selectedEdgeData.source)}
                    className="font-mono-data text-xs text-cyan-700 font-bold hover:underline break-all"
                  >
                    {selectedEdgeData.source}
                  </button>
                </div>

                {/* To */}
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                    To
                  </label>
                  <button
                    onClick={() => handleNodeClick(selectedEdgeData.target)}
                    className="font-mono-data text-xs text-cyan-700 font-bold hover:underline break-all"
                  >
                    {selectedEdgeData.target}
                  </button>
                </div>

                {/* Edge Info */}
                <div className="space-y-2">
                  {[
                    { label: "AMOUNT", value: `${selectedEdgeData.amount.toFixed(4)} ${selectedEdgeData.asset}` },
                    { label: "DIRECTION", value: selectedEdgeData.direction },
                    { label: "TRANSACTIONS", value: selectedEdgeData.transactionCount.toString() },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between border-b border-slate-100 pb-2"
                    >
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        {row.label}
                      </span>
                      <span className="text-[11px] font-mono-data font-bold text-slate-700">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Selection */}
            {!selectedNode && !selectedEdge && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Target
                  size={40}
                  className="text-slate-300 mb-3"
                />
                <h3 className="text-sm font-bold text-slate-400 mb-1">
                  Select a Node or Edge
                </h3>
                <p className="text-[10px] text-slate-500 font-mono-data max-w-[180px]">
                  Click on any node or edge in the graph to view its details
                  and connections.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Bottom Summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "TARGET WALLET",
            value: truncAddr(investigation.wallet.address),
            color: "text-cyan-600",
          },
          {
            label: "RISK SCORE",
            value: `${investigation.risk.overallScore}/100`,
            color:
              investigation.risk.overallScore >= 70
                ? "text-red-600"
                : "text-amber-600",
          },
          {
            label: "ENTITIES",
            value: graphState.nodes.length.toString(),
            color: "text-slate-700",
          },
          {
            label: "CONNECTIONS",
            value: graphState.edges.length.toString(),
            color: "text-slate-700",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border border-slate-200 bg-white p-3 text-center"
          >
            <div className="text-[9px] font-mono-data font-bold text-slate-500 uppercase">
              {stat.label}
            </div>
            <div className={`text-lg font-black mt-1 font-mono-data ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
