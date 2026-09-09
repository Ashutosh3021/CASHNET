/**
 * Data source status routes.
 *
 * Provides visibility into which data sources are real, synthetic, or unavailable.
 * This is critical for maintaining transparency about what CASHNET is connected to.
 */

import { Router, type Request, type Response } from "express";
import { providerFactory } from "../providers/provider-factory";
import { integrationManager } from "../services/integration-manager";
import { logger } from "../lib/logger";

const router = Router();

interface DataSourceStatus {
  name: string;
  category: "DATA" | "API" | "MODEL" | "INTEGRATION";
  connected: boolean;
  enabled: boolean;
  status: "CONNECTED" | "NOT_CONFIGURED" | "UNAVAILABLE" | "SYNTHETIC_FALLBACK" | "DEMO_MODE" | "NOT_CONNECTED";
  message: string;
  requiresAuthorization: boolean;
}

router.get("/data-sources", async (_req: Request, res: Response) => {
  const sources: DataSourceStatus[] = [];

  // Geospatial data provider
  const geoStatus = providerFactory.getActiveProvider().getStatus();
  sources.push({
    name: "Geospatial Transaction Data",
    category: "DATA",
    connected: geoStatus.connected,
    enabled: true,
    status: geoStatus.status === "AVAILABLE" ? "CONNECTED"
      : geoStatus.status === "SYNTHETIC_FALLBACK" ? "SYNTHETIC_FALLBACK"
      : "UNAVAILABLE",
    message: geoStatus.status === "SYNTHETIC_FALLBACK"
      ? "Using synthetic demonstration data. Real public datasets can be loaded from data/public/ directory."
      : geoStatus.status === "AVAILABLE"
      ? `Loaded ${geoStatus.recordCount.transactions} records from public dataset`
      : "No data source configured",
    requiresAuthorization: false,
  });

  // ATM/Branch locations
  sources.push({
    name: "ATM / Branch Locations",
    category: "DATA",
    connected: geoStatus.recordCount.atms > 0,
    enabled: true,
    status: geoStatus.status === "SYNTHETIC_FALLBACK" ? "SYNTHETIC_FALLBACK"
      : geoStatus.recordCount.atms > 0 ? "CONNECTED"
      : "UNAVAILABLE",
    message: `${geoStatus.recordCount.atms} ATMs, ${geoStatus.recordCount.branches} branches`,
    requiresAuthorization: false,
  });

  // Blockchain API
  const blockchainConfigured = !!(process.env.ETHERSCAN_API_KEY || process.env.TRON_API_KEY);
  sources.push({
    name: "Blockchain API (ETH/BTC/TRON)",
    category: "API",
    connected: blockchainConfigured,
    enabled: true,
    status: blockchainConfigured ? "CONNECTED" : "NOT_CONFIGURED",
    message: blockchainConfigured
      ? "Public blockchain APIs configured (Etherscan, Blockstream, Trongrid)"
      : "Set ETHERSCAN_API_KEY, TRON_API_KEY to enable. Bitcoin (Blockstream) is available by default.",
    requiresAuthorization: false,
  });

  // VASP label data
  sources.push({
    name: "VASP Label Data",
    category: "DATA",
    connected: true,
    enabled: true,
    status: "CONNECTED",
    message: "Public blockchain explorer labels for known exchange addresses",
    requiresAuthorization: false,
  });

  // ML Models
  const pythonUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:5000";
  let mlConnected = false;
  try {
    const response = await fetch(`${pythonUrl}/health`, { signal: AbortSignal.timeout(3000) });
    mlConnected = response.ok;
  } catch {
    mlConnected = false;
  }
  sources.push({
    name: "ML Model Service",
    category: "MODEL",
    connected: mlConnected,
    enabled: true,
    status: mlConnected ? "CONNECTED" : "UNAVAILABLE",
    message: mlConnected
      ? "Python model server running (Models 182, 183, 184)"
      : "Python model server not reachable",
    requiresAuthorization: false,
  });

  // NCRP
  sources.push({
    name: "NCRP (National Cyber Crime Reporting Portal)",
    category: "INTEGRATION",
    connected: false,
    enabled: false,
    status: "NOT_CONNECTED",
    message: "Not connected. Requires authorized API access from NCRP/I4C. No credentials configured.",
    requiresAuthorization: true,
  });

  // SAHYOG
  sources.push({
    name: "SAHYOG (System for Automated Handling of Online Grievances)",
    category: "INTEGRATION",
    connected: false,
    enabled: false,
    status: "NOT_CONNECTED",
    message: "Not connected. Requires authorized API access. No credentials configured.",
    requiresAuthorization: true,
  });

  res.json({
    sources,
    activeProvider: providerFactory.getActiveProvider().name,
    activeMode: providerFactory.getMode(),
    timestamp: new Date().toISOString(),
    disclaimer: "CASHNET explicitly reports the connection status of all external systems. NCRP and SAHYOG are NOT connected and require authorized access.",
  });
});

export default router;
