/**
 * GeoJSON loader — reads GeoJSON files and returns raw records with coordinates.
 */

import * as fs from "fs";

export function loadGeoJSON(filePath: string): Record<string, unknown>[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
      return data.features.map((f: any) => ({
        ...(f.properties || {}),
        latitude: f.geometry?.coordinates?.[1],
        longitude: f.geometry?.coordinates?.[0],
        geometry_type: f.geometry?.type,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export function parseGeoJSONString(geojsonContent: string): Record<string, unknown>[] {
  try {
    const data = JSON.parse(geojsonContent);
    if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
      return data.features.map((f: any) => ({
        ...(f.properties || {}),
        latitude: f.geometry?.coordinates?.[1],
        longitude: f.geometry?.coordinates?.[0],
        geometry_type: f.geometry?.type,
      }));
    }
    return [];
  } catch {
    return [];
  }
}
