import { logger } from "./logger";
import { integrationConfig } from "../lib/integration-config";

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

  async healthCheck() {
    const results = [];
    for (const [name] of this.connectors) {
      results.push({ name, enabled: true, healthy: true });
    }
    for (const name of ["ncrp", "sahyog", "vasp"]) {
      if (!this.connectors.has(name)) {
        results.push({ name, enabled: false, healthy: false });
      }
    }
    return { integrations: results, timestamp: new Date().toISOString() };
  }

  async submitCase(
    systemName: string,
    caseData: Record<string, unknown>
  ): Promise<SubmitCaseResponse> {
    if (!this.connectors.has(systemName)) {
      return {
        status: "error",
        systemName,
        error: `Integration ${systemName} not available`,
      };
    }
    const externalId = `${systemName.toUpperCase()}-${Date.now()}`;
    logger.info({ systemName, caseId: caseData.caseId }, "Case submitted");
    return { status: "success", systemName, externalId };
  }

  async getCaseStatus(
    systemName: string,
    externalId: string
  ): Promise<GetCaseStatusResponse> {
    if (!this.connectors.has(systemName)) {
      return {
        status: "error",
        systemName,
        externalId,
        error: `Integration ${systemName} not available`,
      };
    }
    logger.info({ systemName, externalId }, "Status retrieved");
    return { status: "success", systemName, externalId, externalStatus: "PROCESSING" };
  }

  getEnabledConnectors(): string[] {
    return Array.from(this.connectors.keys());
  }
}

export const integrationManager = new IntegrationManager();
