/**
 * Synthetic data provider — wraps existing seeded data into the provider interface.
 * This is the DEFAULT fallback for demo mode.
 */

import type { GeoDataProvider, ProviderStatus, GeoFilters, HistoricalTransaction, PointOfInterest } from "./provider-types";
import {
  syntheticGeoData,
  filterTransactions,
  type GeoFilters as LegacyGeoFilters,
} from "./synthetic-geospatial";

export class SyntheticGeoProvider implements GeoDataProvider {
  readonly name = "CASHNET Synthetic Demo Data";
  readonly sourceType = "SYNTHETIC" as const;

  getTransactions(filters?: GeoFilters): HistoricalTransaction[] {
    const legacyFilters: LegacyGeoFilters = filters ? {
      startDate: filters.startDate,
      endDate: filters.endDate,
      city: filters.city,
      state: filters.state,
      district: filters.district,
      fraudType: filters.fraudType,
      riskCategory: filters.riskCategory,
      minAmount: filters.minAmount,
      maxAmount: filters.maxAmount,
      locationType: filters.locationType,
      caseId: filters.caseId,
    } : {};

    return filterTransactions(syntheticGeoData.records, legacyFilters) as unknown as HistoricalTransaction[];
  }

  getAtms(filters?: { city?: string; state?: string }): PointOfInterest[] {
    return syntheticGeoData.atms.filter(
      (item) =>
        (!filters?.city || item.city === filters.city) &&
        (!filters?.state || item.state === filters.state),
    ) as unknown as PointOfInterest[];
  }

  getBranches(filters?: { city?: string; state?: string }): PointOfInterest[] {
    return syntheticGeoData.branches.filter(
      (item) =>
        (!filters?.city || item.city === filters.city) &&
        (!filters?.state || item.state === filters.state),
    ) as unknown as PointOfInterest[];
  }

  getStatus(): ProviderStatus {
    return {
      name: this.name,
      sourceType: this.sourceType,
      connected: true,
      enabled: true,
      status: "SYNTHETIC_FALLBACK",
      recordCount: {
        transactions: syntheticGeoData.records.length,
        atms: syntheticGeoData.atms.length,
        branches: syntheticGeoData.branches.length,
      },
      lastUpdated: null,
    };
  }
}
