/**
 * DBSCAN-like spatial clustering for geospatial hotspot detection.
 * Pure algorithm — works on any transaction-like records with lat/lng.
 */

import { haversineKm } from "./distance";

export interface Clusterable {
  latitude: number;
  longitude: number;
  [key: string]: unknown;
}

export interface SpatialCluster<T extends Clusterable> {
  members: T[];
  centroidLatitude: number;
  centroidLongitude: number;
  radiusKm: number;
}

/**
 * DBSCAN-style spatial clustering using haversine distance.
 *
 * @param items - Array of records with latitude/longitude
 * @param epsilonKm - Maximum distance between neighbors in km
 * @param minPoints - Minimum cluster size (including the point itself)
 * @returns Array of clusters
 */
export function dbscanSpatial<T extends Clusterable>(
  items: T[],
  epsilonKm: number = 1.75,
  minPoints: number = 5,
): SpatialCluster<T>[] {
  const visited = new Set<number>();
  const clusters: SpatialCluster<T>[] = [];

  const neighbors = (i: number): number[] => {
    const result: number[] = [];
    for (let j = 0; j < items.length; j++) {
      if (
        haversineKm(
          items[i]!.latitude,
          items[i]!.longitude,
          items[j]!.latitude,
          items[j]!.longitude,
        ) <= epsilonKm
      ) {
        result.push(j);
      }
    }
    return result;
  };

  for (let i = 0; i < items.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const near = neighbors(i);
    if (near.length < minPoints) continue;

    const memberIds = new Set(near);
    const queue = [...near];

    while (queue.length) {
      const point = queue.pop()!;
      if (!visited.has(point)) {
        visited.add(point);
        const more = neighbors(point);
        if (more.length >= minPoints) {
          for (const item of more) {
            if (!memberIds.has(item)) {
              memberIds.add(item);
              queue.push(item);
            }
          }
        }
      }
    }

    const members = [...memberIds].map((id) => items[id]!);
    const count = members.length;
    const centroidLat =
      members.reduce((sum, m) => sum + m.latitude, 0) / count;
    const centroidLng =
      members.reduce((sum, m) => sum + m.longitude, 0) / count;
    const radiusKm = Math.max(
      ...members.map((m) =>
        haversineKm(centroidLat, centroidLng, m.latitude, m.longitude),
      ),
    );

    clusters.push({
      members,
      centroidLatitude: centroidLat,
      centroidLongitude: centroidLng,
      radiusKm,
    });
  }

  return clusters;
}
