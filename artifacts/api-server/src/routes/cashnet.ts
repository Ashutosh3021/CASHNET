import { Router, type IRouter } from "express";
import {
  AddComplaintBody,
  CreateCaseBody,
  CreateInterventionBody,
} from "@workspace/api-zod";
import { detectHotspots, syntheticGeoData } from "../providers/synthetic-geospatial";

type AnyRecord = Record<string, any>;

const iso = (mins: number) => new Date(Date.UTC(2026, 7, 18, 10, mins)).toISOString();
const money = (n: number) => Math.round(n);

const graph = {
  nodes: [
    { id: "victim", label: "Victim account", kind: "VICTIM", risk: 12, x: 8, y: 48 },
    { id: "mule-a", label: "Mule A · ••••4821", kind: "MULE_ACCOUNT", risk: 78, x: 23, y: 48 },
    { id: "mule-b", label: "Mule B · ••••1934", kind: "MULE_ACCOUNT", risk: 86, x: 39, y: 48 },
    { id: "vasp-a", label: "VASP Alpha", kind: "VASP", risk: 72, x: 55, y: 48 },
    { id: "wallet-a", label: "0x7A4C…92F", kind: "CRYPTO_WALLET", risk: 88, x: 70, y: 32 },
    { id: "wallet-b", label: "0xB19E…04D", kind: "CRYPTO_WALLET", risk: 91, x: 70, y: 64 },
    { id: "foreign-vasp", label: "Foreign VASP · SG", kind: "FOREIGN_ENTITY", risk: 83, x: 84, y: 48 },
    { id: "account-c", label: "Account C · ••••1234", kind: "BANK_ACCOUNT", risk: 94, x: 84, y: 78 },
    { id: "atm", label: "Predicted ATM · Bengaluru", kind: "CASH_OUT_LOCATION", risk: 92, x: 96, y: 78 },
  ],
  edges: [
    { id: "e1", source: "victim", target: "mule-a", amount: 200000, timestamp: iso(1), label: "₹2,00,000 · UPI", risk: 42, conversion: false },
    { id: "e2", source: "mule-a", target: "mule-b", amount: 195000, timestamp: iso(3), label: "₹1,95,000 · IMPS", risk: 77, conversion: false },
    { id: "e3", source: "mule-b", target: "vasp-a", amount: 186500, timestamp: iso(7), label: "₹1,86,500 · fiat deposit", risk: 86, conversion: false },
    { id: "e4", source: "vasp-a", target: "wallet-a", amount: 2234, timestamp: iso(11), label: "2,234 USDT · FIAT → CRYPTO", risk: 91, conversion: true },
    { id: "e5", source: "wallet-a", target: "wallet-b", amount: 2100, timestamp: iso(16), label: "2,100 USDT · Ethereum", risk: 93, conversion: false },
    { id: "e6", source: "wallet-b", target: "foreign-vasp", amount: 1980, timestamp: iso(22), label: "1,980 USDT · cross-border", risk: 95, conversion: false },
    { id: "e7", source: "foreign-vasp", target: "account-c", amount: 167000, timestamp: iso(31), label: "₹1,67,000 · crypto → bank", risk: 94, conversion: true },
    { id: "e8", source: "account-c", target: "atm", amount: 150000, timestamp: iso(42), label: "₹1,50,000 · predicted cash-out", risk: 96, conversion: false },
  ],
  timeline: [
    { id: "t1", time: iso(1), title: "Victim → Mule A", detail: "UPI transfer received", amount: 200000, category: "FIAT" },
    { id: "t2", time: iso(3), title: "Mule A → Mule B", detail: "Rapid onward transfer", amount: 195000, category: "FIAT" },
    { id: "t3", time: iso(7), title: "Mule B → VASP Alpha", detail: "Exchange deposit", amount: 186500, category: "FIAT" },
    { id: "t4", time: iso(11), title: "FIAT → CRYPTO CONVERSION", detail: "₹1,86,500 converted to 2,234 USDT at VASP Alpha", amount: 186500, category: "CONVERSION" },
    { id: "t5", time: iso(16), title: "Wallet A → Wallet B", detail: "Ethereum transfer", amount: 2100, category: "CRYPTO" },
    { id: "t6", time: iso(22), title: "Wallet B → Foreign VASP", detail: "Cross-border movement to Singapore", amount: 1980, category: "CROSS_BORDER" },
    { id: "t7", time: iso(31), title: "Foreign VASP → Account C", detail: "Crypto off-ramp", amount: 167000, category: "CONVERSION" },
    { id: "t8", time: iso(42), title: "Predicted cash-out", detail: "Analytical ATM location prediction", amount: 150000, category: "PREDICTION" },
  ],
  metrics: { hopCount: 8, totalAmount: 200000, remainingAmount: 150000, countries: 2, chains: 1, vasps: 2 },
};

const cases: AnyRecord[] = [
  { id: "CASE-CASHNET-001", reference: "NCRP-SYN-260818-001", title: "Investment impersonation · Bengaluru", fraudType: "Investment fraud", amount: 200000, priority: "CRITICAL", status: "UNDER_ANALYSIS", state: "Karnataka", city: "Bengaluru", conversionAt: iso(11), sourceType: "SYNTHETIC", updatedAt: iso(44) },
  { id: "CASE-CASHNET-002", reference: "NCRP-SYN-260818-002", title: "Crypto recovery scam · Mumbai", fraudType: "Crypto fraud", amount: 840000, priority: "HIGH", status: "INVESTIGATION", state: "Maharashtra", city: "Mumbai", conversionAt: iso(14), sourceType: "SYNTHETIC", updatedAt: iso(38) },
  { id: "CASE-CASHNET-003", reference: "NCRP-SYN-260818-003", title: "Multi-hop laundering · Hyderabad", fraudType: "Layering", amount: 1250000, priority: "HIGH", status: "HIGH_PRIORITY", state: "Telangana", city: "Hyderabad", conversionAt: iso(18), sourceType: "SYNTHETIC", updatedAt: iso(28) },
  { id: "CASE-CASHNET-004", reference: "NCRP-SYN-260818-004", title: "Incomplete wallet trail · Delhi", fraudType: "Unknown", amount: 320000, priority: "MEDIUM", status: "NEW", state: "Delhi", city: "New Delhi", conversionAt: iso(9), sourceType: "SYNTHETIC", updatedAt: iso(20) },
];

function detail(caseId: string): AnyRecord {
  const c = cases.find((item) => item.id === caseId) ?? cases[0];
  const accounts = [
    { id: "acct-mule-a", masked: "XXXXXX4821", bank: "Synthetic National Bank", ifsc: "SNBK0000421", branch: "Koramangala Branch", district: "Bengaluru Urban", state: "Karnataka", risk: 78, inflow: 200000, outflow: 195000, transactions: 12, indicators: ["HIGH VELOCITY", "RAPID ONWARD TRANSFERS", "MULTIPLE SENDERS"] },
    { id: "acct-last", masked: "XXXXXX1234", bank: "Synthetic National Bank", ifsc: "SNBK0000108", branch: "Indiranagar Branch", district: "Bengaluru Urban", state: "Karnataka", risk: 94, inflow: 167000, outflow: 150000, transactions: 9, indicators: ["CRYPTO OFF-RAMP", "PREDICTED CASH-OUT", "CROSS-BORDER"] },
  ];
  const transactions = graph.edges.map((e: AnyRecord) => ({ id: `TXN-${e.id.toUpperCase()}`, timestamp: e.timestamp, source: e.source, destination: e.target, amount: e.amount, currency: e.conversion && e.id === "e4" ? "USDT" : "INR", type: e.conversion ? "CONVERSION" : "TRANSFER", risk: e.risk, confidence: 0.91, chain: e.id === "e4" || e.id === "e5" ? "Ethereum" : null, isConversion: e.conversion }));
  const wallets = [
    { id: "wallet-a", address: "0x7A4C9D12…92F", chain: "Ethereum", risk: 88, inflow: 2234, outflow: 2100, transactions: 247, vasp: "VASP Alpha", confidence: 0.91, firstSeen: iso(11), lastActive: iso(22) },
    { id: "wallet-b", address: "0xB19E77AA…04D", chain: "Ethereum", risk: 91, inflow: 2100, outflow: 1980, transactions: 63, vasp: "Foreign VASP · Singapore", confidence: 0.78, firstSeen: iso(16), lastActive: iso(31) },
  ];
  const intervention = { id: `INT-${caseId.slice(-3)}`, status: "DRAFT", requestType: "TRANSACTION_RECORD_PRESERVATION", caseId, account: "XXXXXX1234", bank: "Synthetic National Bank", branch: "Indiranagar Branch", ifsc: "SNBK0000108", reason: "Latest known credited account in the analyzed synthetic fund flow. Requires investigator evidence review.", approvalRequired: true, submittedAt: null };
  return {
    ...c,
    complaint: { description: "User reports being induced by an impersonated investment adviser to transfer funds through UPI. The report includes payment references and a wallet indicator.", indicators: ["UPI", "BANK ACCOUNT", "WALLET ADDRESS", "PAYMENT REFERENCE"], sourceType: "USER_PROVIDED / SYNTHETIC LINKED DATA", receivedAt: iso(0) },
    accounts, transactions, fundFlow: graph, wallets,
    vasp: [{ name: "VASP Alpha", confidence: 0.91, classification: "DIRECT", evidence: ["known synthetic deposit address", "direct interaction", "fiat deposit immediately before conversion"] }, { name: "Foreign VASP · Singapore", confidence: 0.78, classification: "INFERRED", evidence: ["cross-border graph proximity", "off-ramp behavior"] }],
    risk: { score: 94, category: "CRITICAL", confidence: 0.89, features: ["High transaction velocity", "Multiple intermediary accounts", "FIAT → CRYPTO at 10:11 UTC", "Cross-border movement", "Predicted cash-out proximity"], modelVersion: "cashnet-baseline-1.0" },
    predictions: { hotspots: [{ id: "hot-1", city: "Bengaluru · Indiranagar", lat: 12.9719, lng: 77.6412, probability: 0.82, risk: 92, amount: 150000, timeWindow: "Next 60 minutes", atm: "SNB ATM · 100 Feet Road", branch: "Indiranagar Branch · SNBK0000108", factors: ["Recent high-value transfer", "Short distance from last known entity", "Multiple nearby ATMs", "Similar synthetic withdrawal pattern"], confidence: 0.84 }, { id: "hot-2", city: "Bengaluru · Koramangala", lat: 12.9352, lng: 77.6245, probability: 0.67, risk: 78, amount: 98000, timeWindow: "Next 3 hours", atm: "SNB ATM · Sony World", branch: "Koramangala Branch", factors: ["High ATM density", "Historical withdrawal activity"], confidence: 0.71 }], generatedAt: iso(44), modelVersion: "cashout-analytical-baseline-1.0" },
    recommendations: [{ priority: "HIGH", title: "Prioritize authorized investigative review", reason: "Latest recipient has critical pattern score and predicted cash-out proximity.", evidence: ["TXN-E7", "Account C risk 94/100", "Hotspot probability 82%"], confidence: 0.89 }, { priority: "MEDIUM", title: "Preserve VASP records through authorized channel", reason: "A direct synthetic fiat deposit is followed by conversion at a probable VASP.", evidence: ["TXN-E3", "TXN-E4", "VASP Alpha direct attribution"], confidence: 0.91 }],
    lastCredited: { account: "XXXXXX1234", transaction: "TXN-E7", amount: 167000, timestamp: iso(31), risk: "CRITICAL", bank: "Synthetic National Bank", branch: "Indiranagar Branch", ifsc: "SNBK0000108" },
    intervention, audit: [{ action: "CASE_ANALYSIS_EXECUTED", actor: "demo.investigator", timestamp: iso(44), source: "MODEL_INFERENCE + SYNTHETIC" }, { action: "INTERVENTION_DRAFT_PREPARED", actor: "demo.investigator", timestamp: iso(44), source: "SYNTHETIC BANK DIRECTORY" }],
  };
}

const router: IRouter = Router();
router.get("/dashboard", (_req, res) => res.json({ metrics: { activeCases: 4, highRiskCases: 3, transactionsAnalyzed: 5247, entitiesAnalyzed: 612, walletsAnalyzed: 100, probableVasps: 20, crossBorderFlows: 18, hotspots: 7, pendingInterventions: 2 }, transactionVolume: [{ day: "Mon", value: 820000 }, { day: "Tue", value: 1260000 }, { day: "Wed", value: 970000 }, { day: "Thu", value: 1840000 }, { day: "Fri", value: 1430000 }, { day: "Sat", value: 2200000 }, { day: "Sun", value: 1760000 }], riskDistribution: [{ name: "Critical", value: 12 }, { name: "High", value: 28 }, { name: "Medium", value: 41 }, { name: "Low", value: 19 }], recentCases: cases, alerts: [{ title: "Predicted cash-out cluster", detail: "Bengaluru · Indiranagar · 82%", severity: "CRITICAL" }, { title: "FIAT → CRYPTO conversion detected", detail: "VASP Alpha · 10:11 UTC", severity: "HIGH" }], conversionWindow: "FIAT → CRYPTO observed at 18 Aug 2026 · 10:11 UTC" }));
router.get("/cases", (_req, res) => res.json(cases));
router.post("/cases", (req, res) => { const parsed = CreateCaseBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid case input" }); return; } const id = `CASE-CASHNET-${String(cases.length + 1).padStart(3, "0")}`; const data = { id, reference: "USER-PROVIDED", title: parsed.data.title, fraudType: parsed.data.fraudType, amount: money(parsed.data.amount), priority: "MEDIUM", status: "NEW", state: parsed.data.victimState ?? "Unspecified", city: parsed.data.victimCity ?? "Unspecified", conversionAt: iso(0), sourceType: "USER_PROVIDED", updatedAt: new Date().toISOString() }; cases.push(data); res.status(201).json(data); });
router.get("/cases/:caseId", (req, res) => res.json(detail(req.params.caseId)));
router.post("/cases/:caseId/analyze", (req, res) => res.json(detail(req.params.caseId)));
router.post("/cases/:caseId/complaint", (req, res) => { const parsed = AddComplaintBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid report input" }); return; } res.json(detail(req.params.caseId)); });
router.get("/fund-flow/:caseId", (req, res) => res.json(detail(req.params.caseId).fundFlow));
router.get("/wallets", (_req, res) => res.json(detail(cases[0].id).wallets));
router.get("/predictions/:caseId", (req, res) => res.json(detail(req.params.caseId).predictions));
router.get("/interventions/:caseId", (req, res) => res.json(detail(req.params.caseId).intervention));
router.post("/interventions/:caseId", (req, res) => { const parsed = CreateInterventionBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid intervention input" }); return; } const d = detail(req.params.caseId); d.intervention.status = "DRAFT"; d.intervention.requestType = parsed.data.requestType; res.status(201).json(d.intervention); });
router.post("/interventions/:caseId/approve", (req, res) => { const d = detail(req.params.caseId); d.intervention.status = "APPROVED"; d.audit.push({ action: "INTERVENTION_APPROVED", actor: "demo.investigator", timestamp: new Date().toISOString(), source: "USER_ACTION" }); res.json(d.intervention); });
router.get("/reports/:caseId", (req, res) => { const d = detail(req.params.caseId); const historical = detectHotspots(syntheticGeoData.records, syntheticGeoData.atms, syntheticGeoData.branches); const historicalSummary = { transactions: syntheticGeoData.records.length, hotspots: historical.length, topHotspot: [...historical].sort((a, b) => b.historicalScore - a.historicalScore)[0]?.clusterId ?? "NONE", dataSource: "SYNTHETIC" }; res.json({ case: d, sections: [...["CASE SUMMARY", "COMPLAINT", "ACCOUNT ANALYSIS", "TRANSACTION HISTORY", "FUND FLOW", "FIAT → CRYPTO CONVERSION TIMESTAMP", "CRYPTO ANALYSIS", "VASP ATTRIBUTION", "RISK ANALYSIS", "PREDICTIVE HOTSPOTS", "ACTIONABLE INTELLIGENCE", "INTERVENTION REQUEST", "AUDIT LOG"].map((title) => ({ title, status: "INCLUDED", source: "SYNTHETIC / MODEL_INFERENCE" })), { title: "HISTORICAL SUSPICIOUS ACTIVITY", status: "INCLUDED", source: "SYNTHETIC DATA — DEMONSTRATION", summary: historicalSummary }], disclaimer: "Analytical prediction — requires investigator validation. Historical geographic activity uses synthetic demonstration data." }); });

export default router;
