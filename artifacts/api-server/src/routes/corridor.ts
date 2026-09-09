import { Router, type IRouter, Request, Response } from "express";
import {
  haversineKm,
  detectHotspots,
  filterTransactions,
  syntheticGeoData,
  type PointOfInterest,
} from "../providers/synthetic-geospatial";

const router: IRouter = Router();

/**
 * Point-to-line-segment distance in km using haversine.
 * Projects point P onto segment AB, clamps to endpoints, returns distance.
 */
function pointToSegmentKm(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const ax = R * toRad(aLng) * Math.cos(toRad(aLat));
  const ay = R * toRad(aLat);
  const bx = R * toRad(bLng) * Math.cos(toRad(bLat));
  const by = R * toRad(bLat);
  const px = R * toRad(pLng) * Math.cos(toRad(pLat));
  const py = R * toRad(pLat);
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return haversineKm(pLat, pLng, aLat, aLng);
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const projLng = cx / (R * Math.cos(toRad(aLat + t * (bLat - aLat))));
  const projLat = cy / R;
  return haversineKm(pLat, pLng, projLat * (180 / Math.PI), projLng * (180 / Math.PI));
}

function vulnerabilityScore(
  distFromLineKm: number,
  distFromDestKm: number,
  hotspotDensity: number,
  corridorWidthKm: number,
): number {
  const proximityMax = 40;
  const proximity = Math.max(0, 1 - distFromLineKm / corridorWidthKm) * proximityMax;

  const densityMax = 35;
  const density = Math.min(1, hotspotDensity / 3) * densityMax;

  const destMax = 25;
  const destNorm = Math.max(0, 1 - distFromDestKm / 500);
  const dest = destNorm * destMax;

  const total = proximity + density + dest;
  return Math.round(Math.min(100, Math.max(0, total)));
}

router.post("/geospatial/corridor", (req: Request, res: Response) => {
  try {
    const {
      sourceLat,
      sourceLng,
      destLat,
      destLng,
      corridorWidthKm = 5,
    } = req.body as {
      sourceLat?: number;
      sourceLng?: number;
      destLat?: number;
      destLng?: number;
      corridorWidthKm?: number;
    };

    if (
      typeof sourceLat !== "number" ||
      typeof sourceLng !== "number" ||
      typeof destLat !== "number" ||
      typeof destLng !== "number"
    ) {
      return res.status(400).json({
        error:
          "sourceLat, sourceLng, destLat, destLng are required numbers",
      });
    }
    if (
      sourceLat < -90 || sourceLat > 90 ||
      sourceLng < -180 || sourceLng > 180 ||
      destLat < -90 || destLat > 90 ||
      destLng < -180 || destLng > 180
    ) {
      return res.status(400).json({ error: "Coordinates out of range" });
    }

    const width = Math.max(0.5, Math.min(50, corridorWidthKm));
    const totalLineKm = haversineKm(sourceLat, sourceLng, destLat, destLng);

    const hotspots = detectHotspots(
      syntheticGeoData.records,
      syntheticGeoData.atms,
      syntheticGeoData.branches,
    );

    const corridorAtms: Array<
      PointOfInterest & {
        vulnerabilityScore: number;
        distanceFromLineKm: number;
        distanceFromDestKm: number;
        nearbyHotspotCount: number;
      }
    > = [];

    for (const atm of syntheticGeoData.atms) {
      const distLine = pointToSegmentKm(
        atm.latitude, atm.longitude,
        sourceLat, sourceLng,
        destLat, destLng,
      );
      if (distLine > width) continue;

      const distDest = haversineKm(
        atm.latitude, atm.longitude,
        destLat, destLng,
      );

      const nearbyHotspots = hotspots.filter(
        (h) => haversineKm(atm.latitude, atm.longitude, h.centroidLatitude, h.centroidLongitude) <= 3,
      ).length;

      corridorAtms.push({
        ...atm,
        vulnerabilityScore: vulnerabilityScore(distLine, distDest, nearbyHotspots, width),
        distanceFromLineKm: Number(distLine.toFixed(2)),
        distanceFromDestKm: Number(distDest.toFixed(2)),
        nearbyHotspotCount: nearbyHotspots,
      });
    }

    corridorAtms.sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);

    return res.json({
      corridorAtms,
      sourcePoint: { lat: sourceLat, lng: sourceLng },
      destPoint: { lat: destLat, lng: destLng },
      corridorWidthKm: width,
      totalLineKm: Number(totalLineKm.toFixed(2)),
      dataSource: "SYNTHETIC",
    });
  } catch (error) {
    return res.status(500).json({ error: "Corridor analysis failed" });
  }
});

export default router;
