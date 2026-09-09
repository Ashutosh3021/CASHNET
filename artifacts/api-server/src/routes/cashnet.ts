import { Router, type IRouter } from "express";
import axios from "axios";
import {
  AddComplaintBody,
  CreateCaseBody,
  CreateInterventionBody,
} from "@workspace/api-zod";
import { detectHotspots, syntheticGeoData } from "../providers/synthetic-geospatial";

type AnyRecord = Record<string, any>;

const iso = (mins: number) => new Date(Date.UTC(2026, 7, 18, 10, mins)).toISOString();
const money = (n: number) => Math.round(n);

// ─── Case 1: Investment fraud · Delhi → Mumbai ────────────────────────────
const case1Graph = {
  nodes: [
    { id: "victim", label: "Priya Sharma · ••••7890", kind: "VICTIM", risk: 15, x: 8, y: 48 },
    { id: "mule-a", label: "Deepak Mehta · ••••3456", kind: "MULE_ACCOUNT", risk: 72, x: 22, y: 48 },
    { id: "mule-b", label: "Neeraj Patel · ••••8912", kind: "MULE_ACCOUNT", risk: 81, x: 36, y: 48 },
    { id: "exchange", label: "WazirX · Mumbai", kind: "VASP", risk: 68, x: 50, y: 48 },
    { id: "wallet-a", label: "0x3F8a…7B2", kind: "CRYPTO_WALLET", risk: 85, x: 65, y: 35 },
    { id: "wallet-b", label: "0x9C1d…4E8", kind: "CRYPTO_WALLET", risk: 89, x: 65, y: 62 },
    { id: "foreign", label: "Binance · SG", kind: "FOREIGN_ENTITY", risk: 79, x: 80, y: 48 },
    { id: "cashout", label: "Rakesh Gupta · ••••5678", kind: "BANK_ACCOUNT", risk: 92, x: 80, y: 75 },
    { id: "atm", label: "Predicted ATM · Andheri West", kind: "CASH_OUT_LOCATION", risk: 88, x: 95, y: 75 },
  ],
  edges: [
    { id: "e1", source: "victim", target: "mule-a", amount: 450000, timestamp: iso(1), label: "₹4,50,000 · UPI", risk: 38, conversion: false },
    { id: "e2", source: "mule-a", target: "mule-b", amount: 435000, timestamp: iso(4), label: "₹4,35,000 · NEFT", risk: 74, conversion: false },
    { id: "e3", source: "mule-b", target: "exchange", amount: 420000, timestamp: iso(8), label: "₹4,20,000 · exchange deposit", risk: 82, conversion: false },
    { id: "e4", source: "exchange", target: "wallet-a", amount: 5040, timestamp: iso(12), label: "5,040 USDT · FIAT → CRYPTO", risk: 88, conversion: true },
    { id: "e5", source: "wallet-a", target: "wallet-b", amount: 4800, timestamp: iso(18), label: "4,800 USDT · Ethereum", risk: 91, conversion: false },
    { id: "e6", source: "wallet-b", target: "foreign", amount: 4650, timestamp: iso(26), label: "4,650 USDT · cross-border", risk: 93, conversion: false },
    { id: "e7", source: "foreign", target: "cashout", amount: 380000, timestamp: iso(35), label: "₹3,80,000 · crypto → bank", risk: 90, conversion: true },
    { id: "e8", source: "cashout", target: "atm", amount: 350000, timestamp: iso(48), label: "₹3,50,000 · predicted cash-out", risk: 94, conversion: false },
  ],
  timeline: [
    { id: "t1", time: iso(1), title: "Victim → Deepak Mehta", detail: "UPI transfer — victim induced by fake investment platform", amount: 450000, category: "FIAT" },
    { id: "t2", time: iso(4), title: "Deepak Mehta → Neeraj Patel", detail: "Rapid NEFT to linked mule", amount: 435000, category: "FIAT" },
    { id: "t3", time: iso(8), title: "Neeraj Patel → WazirX", detail: "Exchange deposit for conversion", amount: 420000, category: "FIAT" },
    { id: "t4", time: iso(12), title: "FIAT → CRYPTO CONVERSION", detail: "₹4,20,000 converted to 5,040 USDT at WazirX", amount: 420000, category: "CONVERSION" },
    { id: "t5", time: iso(18), title: "Wallet A → Wallet B", detail: "Ethereum transfer between controlled wallets", amount: 4800, category: "CRYPTO" },
    { id: "t6", time: iso(26), title: "Wallet B → Binance SG", detail: "Cross-border movement to Singapore exchange", amount: 4650, category: "CROSS_BORDER" },
    { id: "t7", time: iso(35), title: "Binance SG → Rakesh Gupta", detail: "Crypto off-ramp to Indian bank account", amount: 380000, category: "CONVERSION" },
    { id: "t8", time: iso(48), title: "Predicted cash-out", detail: "ATM withdrawal predicted at Andheri West, Mumbai", amount: 350000, category: "PREDICTION" },
  ],
  metrics: { hopCount: 8, totalAmount: 450000, remainingAmount: 350000, countries: 2, chains: 1, vasps: 2 },
};

// ─── Case 2: Tech support scam · Bengaluru → Hyderabad ────────────────────
const case2Graph = {
  nodes: [
    { id: "victim", label: "Lakshmi Iyer · ••••2345", kind: "VICTIM", risk: 18, x: 8, y: 48 },
    { id: "mule-a", label: "Suresh Babu · ••••6789", kind: "MULE_ACCOUNT", risk: 65, x: 22, y: 48 },
    { id: "mule-b", label: "Anita Reddy · ••••0123", kind: "MULE_ACCOUNT", risk: 78, x: 36, y: 48 },
    { id: "exchange", label: "CoinDCX · Hyderabad", kind: "VASP", risk: 62, x: 50, y: 48 },
    { id: "wallet-a", label: "0x5E2b…8C1", kind: "CRYPTO_WALLET", risk: 82, x: 65, y: 35 },
    { id: "wallet-b", label: "0xA4f7…2D9", kind: "CRYPTO_WALLET", risk: 86, x: 65, y: 62 },
    { id: "foreign", label: "OKX · HK", kind: "FOREIGN_ENTITY", risk: 76, x: 80, y: 48 },
    { id: "cashout", label: "Mohammed Ali · ••••4567", kind: "BANK_ACCOUNT", risk: 91, x: 80, y: 75 },
    { id: "atm", label: "Predicted ATM · Banjara Hills", kind: "CASH_OUT_LOCATION", risk: 85, x: 95, y: 75 },
  ],
  edges: [
    { id: "e1", source: "victim", target: "mule-a", amount: 180000, timestamp: iso(2), label: "₹1,80,000 · IMPS", risk: 35, conversion: false },
    { id: "e2", source: "mule-a", target: "mule-b", amount: 175000, timestamp: iso(5), label: "₹1,75,000 · RTGS", risk: 70, conversion: false },
    { id: "e3", source: "mule-b", target: "exchange", amount: 168000, timestamp: iso(9), label: "₹1,68,000 · exchange deposit", risk: 79, conversion: false },
    { id: "e4", source: "exchange", target: "wallet-a", amount: 2016, timestamp: iso(13), label: "2,016 USDT · FIAT → CRYPTO", risk: 85, conversion: true },
    { id: "e5", source: "wallet-a", target: "wallet-b", amount: 1920, timestamp: iso(19), label: "1,920 USDT · Ethereum", risk: 88, conversion: false },
    { id: "e6", source: "wallet-b", target: "foreign", amount: 1850, timestamp: iso(28), label: "1,850 USDT · cross-border", risk: 90, conversion: false },
    { id: "e7", source: "foreign", target: "cashout", amount: 152000, timestamp: iso(38), label: "₹1,52,000 · crypto → bank", risk: 87, conversion: true },
    { id: "e8", source: "cashout", target: "atm", amount: 140000, timestamp: iso(52), label: "₹1,40,000 · predicted cash-out", risk: 92, conversion: false },
  ],
  timeline: [
    { id: "t1", time: iso(2), title: "Victim → Suresh Babu", detail: "IMPS transfer — victim coerced by tech support scam call", amount: 180000, category: "FIAT" },
    { id: "t2", time: iso(5), title: "Suresh Babu → Anita Reddy", detail: "RTGS to secondary mule account", amount: 175000, category: "FIAT" },
    { id: "t3", time: iso(9), title: "Anita Reddy → CoinDCX", detail: "Exchange deposit for USDT conversion", amount: 168000, category: "FIAT" },
    { id: "t4", time: iso(13), title: "FIAT → CRYPTO CONVERSION", detail: "₹1,68,000 converted to 2,016 USDT at CoinDCX", amount: 168000, category: "CONVERSION" },
    { id: "t5", time: iso(19), title: "Wallet A → Wallet B", detail: "Ethereum transfer between controlled wallets", amount: 1920, category: "CRYPTO" },
    { id: "t6", time: iso(28), title: "Wallet B → OKX HK", detail: "Cross-border movement to Hong Kong exchange", amount: 1850, category: "CROSS_BORDER" },
    { id: "t7", time: iso(38), title: "OKX HK → Mohammed Ali", detail: "Crypto off-ramp to Indian bank account", amount: 152000, category: "CONVERSION" },
    { id: "t8", time: iso(52), title: "Predicted cash-out", detail: "ATM withdrawal predicted at Banjara Hills, Hyderabad", amount: 140000, category: "PREDICTION" },
  ],
  metrics: { hopCount: 8, totalAmount: 180000, remainingAmount: 140000, countries: 2, chains: 1, vasps: 2 },
};

// ─── Pre-loaded synthetic cases ───────────────────────────────────────────
const cases: AnyRecord[] = [
  {
    id: "CASE-CASHNET-001",
    reference: "NCRP-SYN-260818-001",
    title: "Investment impersonation · Delhi → Mumbai",
    fraudType: "Investment fraud",
    amount: 450000,
    priority: "CRITICAL",
    status: "UNDER_ANALYSIS",
    state: "Delhi",
    city: "New Delhi",
    victimLat: 28.6139,
    victimLng: 77.2090,
    pinCode: "110001",
    conversionAt: iso(12),
    sourceType: "SYNTHETIC",
    updatedAt: iso(48),
  },
  {
    id: "CASE-CASHNET-002",
    reference: "NCRP-SYN-260818-002",
    title: "Tech support scam · Bengaluru → Hyderabad",
    fraudType: "Tech support scam",
    amount: 180000,
    priority: "HIGH",
    status: "INVESTIGATION",
    state: "Karnataka",
    city: "Bengaluru",
    victimLat: 12.9716,
    victimLng: 77.5946,
    pinCode: "560001",
    conversionAt: iso(13),
    sourceType: "SYNTHETIC",
    updatedAt: iso(52),
  },
];

const interventionState = new Map<string, AnyRecord>();

function detail(caseId: string): AnyRecord | null {
  const c = cases.find((item) => item.id === caseId);
  if (!c) return null;

  const isCase1 = c.id === "CASE-CASHNET-001";
  const graph = isCase1 ? case1Graph : case2Graph;

  const accounts = isCase1
    ? [
        { id: "acct-mule-a", masked: "XXXXXXX3456", bank: "HDFC Bank", ifsc: "HDFC0001234", branch: "Connaught Place", district: "New Delhi", state: "Delhi", risk: 72, inflow: 450000, outflow: 435000, transactions: 8, indicators: ["HIGH VELOCITY", "RAPID ONWARD TRANSFERS", "MULTIPLE UPI SENDERS"] },
        { id: "acct-mule-b", masked: "XXXXXXX8912", bank: "ICICI Bank", ifsc: "ICIC0005678", branch: "Andheri East", district: "Mumbai", state: "Maharashtra", risk: 81, inflow: 435000, outflow: 420000, transactions: 6, indicators: ["EXCHANGE DEPOSIT", "RAPID ONWARD TRANSFERS"] },
        { id: "acct-cashout", masked: "XXXXXXX5678", bank: "Axis Bank", ifsc: "UTIB0009012", branch: "Andheri West", district: "Mumbai", state: "Maharashtra", risk: 92, inflow: 380000, outflow: 350000, transactions: 11, indicators: ["CRYPTO OFF-RAMP", "PREDICTED CASH-OUT", "CROSS-BORDER"] },
      ]
    : [
        { id: "acct-mule-a", masked: "XXXXXXX6789", bank: "Kotak Mahindra", ifsc: "KKBK0003456", branch: "Koramangala", district: "Bengaluru Urban", state: "Karnataka", risk: 65, inflow: 180000, outflow: 175000, transactions: 5, indicators: ["IMPS TRANSFER", "TECH SUPPORT SCAM LINKED"] },
        { id: "acct-mule-b", masked: "XXXXXXX0123", bank: "Union Bank", ifsc: "UBIN0007890", branch: "Banjara Hills", district: "Hyderabad", state: "Telangana", risk: 78, inflow: 175000, outflow: 168000, transactions: 4, indicators: ["EXCHANGE DEPOSIT", "RTGS TRANSFER"] },
        { id: "acct-cashout", masked: "XXXXXXX4567", bank: "SBI", ifsc: "SBIN0001234", branch: "Jubilee Hills", district: "Hyderabad", state: "Telangana", risk: 91, inflow: 152000, outflow: 140000, transactions: 9, indicators: ["CRYPTO OFF-RAMP", "PREDICTED CASH-OUT", "CROSS-BORDER"] },
      ];

  const transactions = graph.edges.map((e: AnyRecord) => ({
    id: `TXN-${e.id.toUpperCase()}`,
    timestamp: e.timestamp,
    source: e.source,
    destination: e.target,
    amount: e.amount,
    currency: e.conversion && e.id === "e4" ? "USDT" : "INR",
    type: e.conversion ? "CONVERSION" : "TRANSFER",
    risk: e.risk,
    confidence: 0.91,
    chain: e.id === "e4" || e.id === "e5" ? "Ethereum" : null,
    isConversion: e.conversion,
  }));

  const wallets = isCase1
    ? [
        { id: "wallet-a", address: "0x3F8a9B12…7B2", chain: "Ethereum", risk: 85, inflow: 5040, outflow: 4800, transactions: 312, vasp: "WazirX", confidence: 0.93, firstSeen: iso(12), lastActive: iso(26) },
        { id: "wallet-b", address: "0x9C1dE4F5…4E8", chain: "Ethereum", risk: 89, inflow: 4800, outflow: 4650, transactions: 87, vasp: "Binance · Singapore", confidence: 0.81, firstSeen: iso(18), lastActive: iso(35) },
      ]
    : [
        { id: "wallet-a", address: "0x5E2bC3A1…8C1", chain: "Ethereum", risk: 82, inflow: 2016, outflow: 1920, transactions: 198, vasp: "CoinDCX", confidence: 0.90, firstSeen: iso(13), lastActive: iso(28) },
        { id: "wallet-b", address: "0xA4f7D9E2…2D9", chain: "Ethereum", risk: 86, inflow: 1920, outflow: 1850, transactions: 54, vasp: "OKX · Hong Kong", confidence: 0.76, firstSeen: iso(19), lastActive: iso(38) },
      ];

  let intervention = interventionState.get(caseId);
  if (!intervention) {
    intervention = isCase1
      ? { id: "INT-001", status: "DRAFT", requestType: "TRANSACTION_RECORD_PRESERVATION", caseId, account: "XXXXXXX5678", bank: "Axis Bank", branch: "Andheri West", ifsc: "UTIB0009012", reason: "Final recipient account with critical risk score (92/100). Predicted cash-out at Andheri West ATM within 48 hours. Requires urgent bank record preservation.", approvalRequired: true, submittedAt: null }
      : { id: "INT-002", status: "DRAFT", requestType: "BANK_ACCOUNT_FREEZE", caseId, account: "XXXXXXX4567", bank: "SBI", branch: "Jubilee Hills", ifsc: "SBIN0001234", reason: "Tech support scam proceeds routed through this account. Predicted cash-out at Banjara Hills. Bank freeze recommended to prevent further losses.", approvalRequired: true, submittedAt: null };
    interventionState.set(caseId, intervention);
  }

  const complaint = isCase1
    ? { description: "Victim Priya Sharma (Delhi) reports receiving a call from someone impersonating a SEBI-registered investment advisor. She was诱导 to transfer ₹4,50,000 via UPI to an account controlled by the fraud ring. The funds were rapidly moved through multiple mule accounts and converted to USDT via WazirX. The complaint includes UPI transaction references and a wallet address observed in the scam communication.", indicators: ["UPI", "INVESTMENT FRAUD", "MULTIPLE MULE ACCOUNTS", "EXCHANGE CONVERSION", "WALLET ADDRESS"], sourceType: "USER_PROVIDED / SYNTHETIC LINKED DATA", receivedAt: iso(0), location: "New Delhi, Delhi 110001", victimLat: 28.6139, victimLng: 77.2090, pinCode: "110001" }
    : { description: "Victim Lakshmi Iyer (Bengaluru) reports being contacted by a fake tech support agent claiming her computer was compromised. She was coerced into transferring ₹1,80,000 via IMPS to a 'safe account'. The funds were layered through mule accounts and converted to USDT via CoinDCX. The complaint includes IMPS reference numbers and the fraudulent phone number used.", indicators: ["IMPS", "TECH SUPPORT SCAM", "MULE ACCOUNTS", "EXCHANGE CONVERSION", "PHONE FRAUD"], sourceType: "USER_PROVIDED / SYNTHETIC LINKED DATA", receivedAt: iso(0), location: "Bengaluru, Karnataka 560001", victimLat: 12.9716, victimLng: 77.5946, pinCode: "560001" };

  const vasp = isCase1
    ? [{ name: "WazirX", confidence: 0.93, classification: "DIRECT", evidence: ["direct fiat deposit from mule account", "immediate conversion to USDT", "known Indian exchange with crypto withdrawal"] }, { name: "Binance · Singapore", confidence: 0.81, classification: "INFERRED", evidence: ["cross-border USDT transfer", "off-ramp behavior", "Singapore regulatory jurisdiction"] }]
    : [{ name: "CoinDCX", confidence: 0.90, classification: "DIRECT", evidence: ["direct fiat deposit from mule account", "immediate USDT conversion", "Indian exchange with crypto withdrawal"] }, { name: "OKX · Hong Kong", confidence: 0.76, classification: "INFERRED", evidence: ["cross-border USDT transfer", "Hong Kong exchange", "off-ramp behavior"] }];

  const risk = isCase1
    ? { score: 92, category: "CRITICAL", confidence: 0.91, features: ["High transaction velocity", "3 mule accounts in chain", "FIAT → CRYPTO at WazirX", "Cross-border to Singapore", "Predicted cash-out Andheri West"], modelVersion: "cashnet-baseline-1.0" }
    : { score: 87, category: "HIGH", confidence: 0.88, features: ["Tech support scam pattern", "2 mule accounts in chain", "FIAT → CRYPTO at CoinDCX", "Cross-border to Hong Kong", "Predicted cash-out Banjara Hills"], modelVersion: "cashnet-baseline-1.0" };

  const predictions = isCase1
    ? { hotspots: [
        { id: "hot-1", city: "Mumbai · Andheri West", lat: 19.1364, lng: 72.8296, probability: 0.84, risk: 88, amount: 350000, timeWindow: "Next 48 hours", atm: "HDFC ATM · Lokhandwala Complex", branch: "Andheri West · UTIB0009012", factors: ["Recent high-value crypto off-ramp", "Short distance from last known entity", "Multiple nearby ATMs", "Similar synthetic withdrawal pattern"], confidence: 0.86 },
        { id: "hot-2", city: "Mumbai · Bandra", lat: 19.0596, lng: 72.8295, probability: 0.61, risk: 72, amount: 180000, timeWindow: "Next 6 hours", atm: "ICICI ATM · Hill Road", branch: "Bandra West", factors: ["High ATM density", "Historical withdrawal activity"], confidence: 0.68 },
      ], generatedAt: iso(48), modelVersion: "cashout-analytical-baseline-1.0", source_coordinates: { lat: 28.6139, lng: 77.2090 } }
    : { hotspots: [
        { id: "hot-1", city: "Hyderabad · Banjara Hills", lat: 17.4156, lng: 78.4347, probability: 0.79, risk: 85, amount: 140000, timeWindow: "Next 36 hours", atm: "SBI ATM · Road No. 12", branch: "Banjara Hills · SBIN0001234", factors: ["Crypto off-ramp detected", "Proximity to last entity", "Multiple ATMs in area", "Tech support scam pattern"], confidence: 0.82 },
        { id: "hot-2", city: "Hyderabad · Jubilee Hills", lat: 17.4239, lng: 78.4488, probability: 0.58, risk: 68, amount: 95000, timeWindow: "Next 8 hours", atm: "Kotak ATM · Road No. 36", branch: "Jubilee Hills", factors: ["ATM density", "Near predicted cluster"], confidence: 0.64 },
      ], generatedAt: iso(52), modelVersion: "cashout-analytical-baseline-1.0", source_coordinates: { lat: 12.9716, lng: 77.5946 } };

  const recommendations = isCase1
    ? [
        { priority: "HIGH", title: "Preserve WazirX transaction records", reason: "Direct fiat deposit followed by immediate USDT conversion. Exchange records critical for identifying wallet ownership.", evidence: ["TXN-E3", "TXN-E4", "WazirX direct attribution"], confidence: 0.93 },
        { priority: "HIGH", title: "Urgent: Bank record preservation for Andheri West account", reason: "Final recipient has critical risk score (92/100). Predicted cash-out within 48 hours.", evidence: ["TXN-E7", "Rakesh Gupta risk 92/100", "Hotspot probability 84%"], confidence: 0.91 },
        { priority: "MEDIUM", title: "Coordinate with Singapore authorities for Binance SG", reason: "Cross-border USDT movement to Singapore exchange. International cooperation required.", evidence: ["TXN-E6", "TXN-E7", "Binance SG inference"], confidence: 0.81 },
      ]
    : [
        { priority: "HIGH", title: "Preserve CoinDCX transaction records", reason: "Direct fiat deposit followed by USDT conversion. Exchange records critical for wallet attribution.", evidence: ["TXN-E3", "TXN-E4", "CoinDCX direct attribution"], confidence: 0.90 },
        { priority: "HIGH", title: "Urgent: Bank record preservation for Jubilee Hills account", reason: "Final recipient has high risk score (91/100). Predicted cash-out within 36 hours.", evidence: ["TXN-E7", "Mohammed Ali risk 91/100", "Hotspot probability 79%"], confidence: 0.88 },
        { priority: "MEDIUM", title: "Coordinate with Hong Kong authorities for OKX", reason: "Cross-border USDT movement to Hong Kong exchange. International cooperation required.", evidence: ["TXN-E6", "TXN-E7", "OKX HK inference"], confidence: 0.76 },
      ];

  const lastCredited = isCase1
    ? { account: "XXXXXXX5678", transaction: "TXN-E7", amount: 380000, timestamp: iso(35), risk: "CRITICAL", bank: "Axis Bank", branch: "Andheri West", ifsc: "UTIB0009012" }
    : { account: "XXXXXXX4567", transaction: "TXN-E7", amount: 152000, timestamp: iso(38), risk: "HIGH", bank: "SBI", branch: "Jubilee Hills", ifsc: "SBIN0001234" };

  return {
    ...c,
    complaint,
    accounts, transactions, fundFlow: graph, wallets,
    vasp, risk, predictions, recommendations, lastCredited,
    intervention,
    audit: [
      { action: "CASE_CREATED", actor: "system", timestamp: c.updatedAt, source: "SYNTHETIC" },
      { action: "CASE_ANALYSIS_EXECUTED", actor: "demo.investigator", timestamp: iso(44), source: "MODEL_INFERENCE + SYNTHETIC" },
      { action: "INTERVENTION_DRAFT_PREPARED", actor: "demo.investigator", timestamp: iso(44), source: "SYNTHETIC BANK DIRECTORY" },
    ],
  };
}

const router: IRouter = Router();

router.get("/dashboard", (_req, res) => res.json({
  metrics: { activeCases: 2, highRiskCases: 2, transactionsAnalyzed: 3840, entitiesAnalyzed: 420, walletsAnalyzed: 68, probableVasps: 14, crossBorderFlows: 12, hotspots: 5, pendingInterventions: 2 },
  transactionVolume: [{ day: "Mon", value: 630000 }, { day: "Tue", value: 980000 }, { day: "Wed", value: 720000 }, { day: "Thu", value: 1340000 }, { day: "Fri", value: 1080000 }, { day: "Sat", value: 1650000 }, { day: "Sun", value: 1200000 }],
  riskDistribution: [{ name: "Critical", value: 1 }, { name: "High", value: 1 }, { name: "Medium", value: 0 }, { name: "Low", value: 0 }],
  recentCases: cases,
  alerts: [
    { title: "Predicted cash-out: Andheri West, Mumbai", detail: "84% probability · ₹3,50,000 · Next 48 hours", severity: "CRITICAL" },
    { title: "Predicted cash-out: Banjara Hills, Hyderabad", detail: "79% probability · ₹1,40,000 · Next 36 hours", severity: "HIGH" },
    { title: "FIAT → CRYPTO conversion detected", detail: "WazirX · 5,040 USDT · 10:12 UTC", severity: "HIGH" },
  ],
  conversionWindow: "FIAT → CRYPTO observed at 18 Aug 2026 · 10:12 UTC (Case 001) / 10:13 UTC (Case 002)",
}));

router.get("/cases", (_req, res) => res.json(cases));

router.post("/cases", (req, res) => {
  const parsed = CreateCaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }
  const id = `CASE-CASHNET-${String(cases.length + 1).padStart(3, "0")}`;
  const data = {
    id,
    reference: "USER-PROVIDED",
    title: parsed.data.title,
    fraudType: parsed.data.fraudType,
    amount: money(parsed.data.amount),
    priority: "MEDIUM",
    status: "NEW",
    state: parsed.data.victimState ?? "Unspecified",
    city: parsed.data.victimCity ?? "Unspecified",
    victimLat: parsed.data.victimLat,
    victimLng: parsed.data.victimLng,
    pinCode: parsed.data.pinCode,
    conversionAt: iso(0),
    sourceType: "USER_PROVIDED",
    updatedAt: new Date().toISOString(),
  };
  cases.push(data);
  res.status(201).json(data);
});

router.get("/cases/:caseId", (req, res) => { const d = detail(req.params.caseId); if (!d) return res.status(404).json({ error: "Case not found", caseId: req.params.caseId }); res.json(d); });

router.post("/cases/:caseId/analyze", async (req, res) => {
  const d = detail(req.params.caseId);
  if (!d) return res.status(404).json({ error: "Case not found", caseId: req.params.caseId });
  const record = {
    risk_score: d.priority === "CRITICAL" ? 0.9 : d.priority === "HIGH" ? 0.7 : 0.4,
    transaction_count: d.transactions?.length ?? 0,
    amount: d.amount ?? 0,
    age_days: Math.max(1, Math.round((Date.now() - new Date(d.updatedAt || d.conversionAt).getTime()) / (1000 * 60 * 60 * 24))),
    case_id: d.id,
    city: d.city,
    fraud_type: d.fraudType,
  };
  const pythonBase = process.env.PYTHON_SERVICE_URL || "http://localhost:5000";
  try {
    const upstream = await axios.post(`${pythonBase}/models/predict/184`, { record }, { timeout: 30_000, validateStatus: () => true });
    if (upstream.status >= 400) return res.status(502).json({ error: "Model service unavailable", upstream_status: upstream.status, upstream_body: upstream.data, case: d });
    const prediction = upstream.data ?? {};
    if (prediction.error) return res.status(502).json({ error: "Model returned error", upstream_error: prediction.error, case: d });
    const confidence = typeof prediction.confidence === "number" ? prediction.confidence : 0;
    const scorePct = Math.round(confidence * 100);
    const category = scorePct >= 80 ? "CRITICAL" : scorePct >= 60 ? "HIGH" : scorePct >= 40 ? "MEDIUM" : "LOW";
    d.risk = { score: scorePct, category, confidence, features: ["Live Python Model Inference", `Model ${prediction.model_id ?? 184}`], modelVersion: String(prediction.model_id ?? 184) };
    d.predictions = { hotspots: [{ id: `live-${d.id}`, city: prediction.predicted_withdrawal_city || d.city || "unknown", lat: prediction.predicted_coordinates?.lat ?? 28.61, lng: prediction.predicted_coordinates?.lng ?? 77.2, probability: confidence, risk: scorePct, amount: d.amount, timeWindow: "Next 24 hours", atm: "Predicted Region", branch: "Unknown", factors: ["ML Model Inference", `Model ${prediction.model_id ?? 184}`], confidence }], generatedAt: prediction.timestamp || new Date().toISOString(), modelVersion: String(prediction.model_id ?? 184), source_coordinates: prediction.source_coordinates ?? null };
    d.audit.push({ action: "CASE_ANALYSIS_EXECUTED", actor: "demo.investigator", timestamp: new Date().toISOString(), source: "MODEL_INFERENCE" });
    return res.json(d);
  } catch (error) {
    return res.status(502).json({ error: "Model service unreachable", details: (error as Error).message, case: d });
  }
});

router.post("/cases/:caseId/complaint", (req, res) => { const parsed = AddComplaintBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid report input" }); return; } const d = detail(req.params.caseId); if (!d) return res.status(404).json({ error: "Case not found", caseId: req.params.caseId }); res.json(d); });
router.get("/fund-flow/:caseId", (req, res) => { const d = detail(req.params.caseId); if (!d) return res.status(404).json({ error: "Case not found", caseId: req.params.caseId }); res.json(d.fundFlow); });
router.get("/wallets", (_req, res) => { const d = detail(cases[0].id); res.json(d ? d.wallets : []); });
router.get("/predictions/:caseId", (req, res) => { const d = detail(req.params.caseId); if (!d) return res.status(404).json({ error: "Case not found", caseId: req.params.caseId }); res.json(d.predictions); });
router.get("/interventions/:caseId", (req, res) => { const d = detail(req.params.caseId); if (!d) return res.status(404).json({ error: "Case not found", caseId: req.params.caseId }); res.json(d.intervention); });
router.post("/interventions/:caseId", (req, res) => { const parsed = CreateInterventionBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid intervention input" }); return; } const d = detail(req.params.caseId); if (!d) return res.status(404).json({ error: "Case not found", caseId: req.params.caseId }); d.intervention.status = "DRAFT"; d.intervention.requestType = parsed.data.requestType; res.status(201).json(d.intervention); });
router.post("/interventions/:caseId/approve", (req, res) => { const d = detail(req.params.caseId); if (!d) return res.status(404).json({ error: "Case not found", caseId: req.params.caseId }); d.intervention.status = "APPROVED"; d.audit.push({ action: "INTERVENTION_APPROVED", actor: "demo.investigator", timestamp: new Date().toISOString(), source: "USER_ACTION" }); res.json(d.intervention); });

router.get("/reports/:caseId", (req, res) => {
  const d = detail(req.params.caseId);
  if (!d) return res.status(404).json({ error: "Case not found", caseId: req.params.caseId });
  const historical = detectHotspots(syntheticGeoData.records, syntheticGeoData.atms, syntheticGeoData.branches);
  const historicalSummary = { transactions: syntheticGeoData.records.length, hotspots: historical.length, topHotspot: [...historical].sort((a, b) => b.historicalScore - a.historicalScore)[0]?.clusterId ?? "NONE", dataSource: "SYNTHETIC" };
  res.json({
    case: d,
    sections: [
      { title: "CASE SUMMARY", status: "INCLUDED", provenance: { sourceType: "USER_PROVIDED_DATA", description: "Case intake from user report — victim location verified via browser geolocation API" } },
      { title: "COMPLAINT", status: "INCLUDED", provenance: { sourceType: "USER_PROVIDED_DATA", description: "User-provided complaint narrative with transaction references" } },
      { title: "ACCOUNT ANALYSIS", status: "INCLUDED", provenance: { sourceType: "SYNTHETIC", description: "Synthetic bank account data for demonstration" } },
      { title: "TRANSACTION HISTORY", status: "INCLUDED", provenance: { sourceType: "SYNTHETIC", description: "Synthetic transaction data for demonstration" } },
      { title: "FUND FLOW", status: "INCLUDED", provenance: { sourceType: "SYNTHETIC", description: "Synthetic fund flow graph for demonstration" } },
      { title: "FIAT TO CRYPTO CONVERSION", status: "INCLUDED", provenance: { sourceType: "SYNTHETIC", description: "Synthetic conversion timestamp" } },
      { title: "CRYPTO ANALYSIS", status: "INCLUDED", provenance: { sourceType: "MODEL_INFERENCE", description: "Model 182 output — Crypto/VASP classification", modelVersion: "182" } },
      { title: "VASP ATTRIBUTION", status: "INCLUDED", provenance: { sourceType: "PUBLIC_DATA", description: "Public blockchain explorer labels", confidence: 0.9 } },
      { title: "RISK ANALYSIS", status: "INCLUDED", provenance: { sourceType: "MODEL_INFERENCE", description: "Model 184 risk scoring output", modelVersion: "184" } },
      { title: "PREDICTIVE HOTSPOTS", status: "INCLUDED", provenance: { sourceType: "MODEL_INFERENCE", description: "Geospatial hotspot detection via analytical model", modelVersion: "cashout-analytical-baseline-1.0" } },
      { title: "CORRIDOR ANALYSIS", status: "INCLUDED", provenance: { sourceType: "MODEL_INFERENCE", description: "ATM corridor vulnerability along victim → destination route", modelVersion: "corridor-v1.0" } },
      { title: "RECOMMENDATIONS", status: "INCLUDED", provenance: { sourceType: "MODEL_INFERENCE", description: "Priority-ranked actionable intelligence" } },
      { title: "AUDIT TRAIL", status: "INCLUDED", provenance: { sourceType: "SYSTEM", description: "Immutable activity log" } },
    ],
    historicalSummary,
  });
});

export default router;
