import { logger } from "../lib/logger";
import { integrationConfig } from "../lib/integration-config";

export interface ConnectorHealth {
  name: string;
  enabled: boolean;
  connected: boolean;
  status: "CONFIGURED" | "NOT_CONFIGURED" | "NOT_CONNECTED" | "UNAVAILABLE";
  requiresAuthorization: boolean;
  message: string;
}

export interface SubmitCaseResponse {
  status: "success" | "error";
  externalId?: string;
  systemName: string;
  error?: string;
}

export interface GetCaseStatusResponse {
  status: "success" | "error";
  externalId: string;
  externalStatus?: string;
  systemName: string;
  error?: string;
}

class IntegrationManager {
  private connectors: Map<string, any> = new Map();

  constructor() {
    this.initializeConnectors();
  }

  private initializeConnectors(): void {
    if (integrationConfig.ncrp.enabled) {
      logger.info("NCRP connector enabled");
      this.connectors.set("ncrp", integrationConfig.ncrp);
    }
    if (integrationConfig.sahyog.enabled) {
      logger.info("SAHYOG connector enabled");
      this.connectors.set("sahyog", integrationConfig.sahyog);
    }
    if (integrationConfig.vasp.enabled) {
      logger.info("VASP connector enabled");
      this.connectors.set("vasp", integrationConfig.vasp);
    }
  }

  async healthCheck(): Promise<{ integrations: ConnectorHealth[]; timestamp: string }> {
    const results: ConnectorHealth[] = [];

    // NCRP status
    const ncrpEnabled = integrationConfig.ncrp.enabled;
    results.push({
      name: "ncrp",
      enabled: ncrpEnabled,
      connected: false,
      status: ncrpEnabled ? "NOT_CONNECTED" : "NOT_CONFIGURED",
      requiresAuthorization: true,
      message: ncrpEnabled
        ? "NCRP configuration present but authorized API access is not available"
        : "NCRP requires authorized API credentials. Not configured.",
    });

    // SAHYOG status
    const sahyogEnabled = integrationConfig.sahyog.enabled;
    results.push({
      name: "sahyog",
      enabled: sahyogEnabled,
      connected: false,
      status: sahyogEnabled ? "NOT_CONNECTED" : "NOT_CONFIGURED",
      requiresAuthorization: true,
      message: sahyogEnabled
        ? "SAHYOG configuration present but authorized API access is not available"
        : "SAHYOG requires authorized API credentials. Not configured.",
    });

    // VASP status
    const vaspEnabled = integrationConfig.vasp.enabled;
    const vaspConnected = vaspEnabled && !!integrationConfig.vasp.apiUrl;
    results.push({
      name: "vasp",
      enabled: vaspEnabled,
      connected: vaspConnected,
      status: vaspEnabled
        ? vaspConnected
          ? "CONFIGURED"
          : "NOT_CONNECTED"
        : "NOT_CONFIGURED",
      requiresAuthorization: false,
      message: vaspEnabled
        ? vaspConnected
          ? "VASP provider configured"
          : "VASP configuration incomplete"
        : "VASP provider not configured",
    });

    return { integrations: results, timestamp: new Date().toISOString() };
  }

  async submitCase(
    systemName: string | string[],
    caseData: Record<string, unknown>
  ): Promise<SubmitCaseResponse> {
    const system = Array.isArray(systemName) ? systemName[0] : systemName;

    // NCRP and SAHYOG are never connected - return explicit error
    if (system === "ncrp" || system === "sahyog") {
      return {
        status: "error",
        systemName: system,
        error: `${system.toUpperCase()} integration is not available. Authorized API access is required but not configured. No external ID has been generated.`,
      };
    }

    if (!this.connectors.has(system)) {
      return {
        status: "error",
        systemName: system,
        error: `Integration ${system} not available. No external ID has been generated.`,
      };
    }

    // No real external submission is possible without authorized API access
    return {
      status: "error",
      systemName: system,
      error: `${system.toUpperCase()} integration is not available. Authorized API access is required but not configured. No external ID has been generated.`,
    };
  }

  async getCaseStatus(
    systemName: string | string[],
    externalId: string | string[]
  ): Promise<GetCaseStatusResponse> {
    const system = Array.isArray(systemName) ? systemName[0] : systemName;
    const extId = Array.isArray(externalId) ? externalId[0] : externalId;

    // NCRP and SAHYOG are never connected
    if (system === "ncrp" || system === "sahyog") {
      return {
        status: "error",
        systemName: system,
        externalId: extId,
        error: `${system.toUpperCase()} integration is not available. Authorized API access is required but not configured.`,
      };
    }

    if (!this.connectors.has(system)) {
      return {
        status: "error",
        systemName: system,
        externalId: extId,
        error: `Integration ${system} not available`,
      };
    }

    // No real external status query is possible without authorized API access
    return {
      status: "error",
      systemName: system,
      externalId: extId,
      error: `${system.toUpperCase()} status query is not available. Authorized API access is required but not configured.`,
    };
  }

  getEnabledConnectors(): string[] {
    return Array.from(this.connectors.keys());
  }
}

export const integrationManager = new IntegrationManager();
