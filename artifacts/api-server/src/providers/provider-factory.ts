/**
 * Provider factory — manages data provider lifecycle and switching.
 *
 * The system supports multiple data sources:
 * - synthetic: Deterministic seeded data for demo (default)
 * - public: Real public datasets (when available)
 * - user: User-uploaded data
 *
 * The factory ensures that NCRP/SAHYOG are NEVER reported as connected
 * unless explicitly authorized.
 */

import type { GeoDataProvider, ProviderStatus } from "./provider-types";
import { SyntheticGeoProvider } from "./synthetic-provider";
import { PublicGeoProvider } from "./public-provider";

export type ProviderMode = "synthetic" | "public" | "user";

class ProviderFactory {
  private providers: Map<string, GeoDataProvider> = new Map();
  private activeProvider: GeoDataProvider;
  private mode: ProviderMode;

  constructor() {
    this.mode = (process.env.CASHNET_DATA_MODE as ProviderMode) || "synthetic";

    // Register available providers
    const synthetic = new SyntheticGeoProvider();
    const publicProvider = new PublicGeoProvider();

    this.providers.set("synthetic", synthetic);
    this.providers.set("public", publicProvider);

    // Select active provider based on mode
    this.activeProvider = this.resolveProvider(this.mode);
  }

  private resolveProvider(mode: ProviderMode): GeoDataProvider {
    const provider = this.providers.get(mode);
    if (provider) return provider;

    // Fallback: synthetic is always available
    console.warn(
      `[ProviderFactory] Provider "${mode}" not found, falling back to synthetic`,
    );
    return this.providers.get("synthetic")!;
  }

  getActiveProvider(): GeoDataProvider {
    return this.activeProvider;
  }

  getProviderStatus(): ProviderStatus {
    return this.activeProvider.getStatus();
  }

  getAllProviderStatuses(): ProviderStatus[] {
    return Array.from(this.providers.values()).map((p) => p.getStatus());
  }

  switchProvider(mode: ProviderMode): ProviderStatus {
    const provider = this.resolveProvider(mode);
    this.activeProvider = provider;
    this.mode = mode;
    return provider.getStatus();
  }

  getMode(): ProviderMode {
    return this.mode;
  }
}

export const providerFactory = new ProviderFactory();
