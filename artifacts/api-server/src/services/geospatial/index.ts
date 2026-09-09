/**
 * Reusable geospatial analytical services.
 *
 * These pure functions operate identically regardless of data source:
 * PUBLIC_DATA, AUTHORIZED_API, USER_PROVIDED_DATA, SYNTHETIC, or MODEL_INFERENCE.
 */

export { haversineKm, bearingDeg, offsetLatLng, centroid, validateCoordinates } from "./distance";
export { dbscanSpatial, type Clusterable, type SpatialCluster } from "./clustering";
export { nearby, nearest, countWithinRadius, type ProximityResult } from "./proximity";
export { scoreHotspot, computeHistoricalScores, type Scoreable, type ScoredHotspot } from "./hotspot-scoring";
export { extractTransactionFeatures, extractLocationFeatures, type TransactionFeatures, type LocationFeatures } from "./feature-engineering";
