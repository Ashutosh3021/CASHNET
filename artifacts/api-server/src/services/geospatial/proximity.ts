/**
 * Proximity search — find items within a radius, sorted by distance.
 * Pure function — works on any data source.
 */

import { haversineKm } from "./distance";

export interface ProximityResult<T> {
  item: T;
  distanceKm: number;
}

/**
 * Find all items within radiusKm of a reference point, sorted by distance.
 */
export function nearby<T extends { latitude: number; longitude: number }>(
  items: T[],
  latitude: number,
  longitude: number,
  radiusKm: number,
): (T & { distanceKm: number })[] {
  return items
    .filter(
      (item) =>
        haversineKm(latitude, longitude, item.latitude, item.longitude) <=
        radiusKm,
    )
    .map((item) => ({
      ...item,
      distanceKm: Number(
        haversineKm(latitude, longitude, item.latitude, item.longitude).toFixed(
          2,
        ),
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Find the single nearest item to a reference point.
 */
export function nearest<T extends { latitude: number; longitude: number }>(
  items: T[],
  latitude: number,
  longitude: number,
): (T & { distanceKm: number }) | null {
  if (items.length === 0) return null;
  let best: (T & { distanceKm: number }) | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const dist = haversineKm(latitude, longitude, item.latitude, item.longitude);
    if (dist < bestDist) {
      bestDist = dist;
      best = { ...item, distanceKm: Number(dist.toFixed(2)) };
    }
  }
  return best;
}

/**
 * Count items within radiusKm.
 */
export function countWithinRadius<T extends { latitude: number; longitude: number }>(
  items: T[],
  latitude: number,
  longitude: number,
  radiusKm: number,
): number {
  return items.filter(
    (item) =>
      haversineKm(latitude, longitude, item.latitude, item.longitude) <=
      radiusKm,
  ).length;
}
