import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import { Crosshair } from "lucide-react";
import { getBackendBase } from "@/lib/api-url";

type CorridorAtm = {
  id: string;
  name: string;
  bankName: string;
  latitude: number;
  longitude: number;
  city: string;
  district: string;
  state: string;
  pincode: string;
  dataSource: "SYNTHETIC";
  vulnerabilityScore: number;
  distanceFromLineKm: number;
  distanceFromDestKm: number;
  nearbyHotspotCount: number;
};

type CorridorResponse = {
  corridorAtms: CorridorAtm[];
  sourcePoint: { lat: number; lng: number };
  destPoint: { lat: number; lng: number };
  corridorWidthKm: number;
  totalLineKm: number;
  dataSource: "SYNTHETIC";
};

function scoreColor(score: number): string {
  if (score >= 70) return "#dc2626";
  if (score >= 40) return "#f59e0b";
  return "#22c55e";
}

function scoreFill(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#fbbf24";
  return "#4ade80";
}

const DEFAULT_SOURCE = { lat: 28.6139, lng: 77.209 };
const DEFAULT_DEST = { lat: 12.9716, lng: 77.5946 };

export default function CorridorPrediction({ caseId }: { caseId?: string }) {
  const [sourceLat, setSourceLat] = useState(String(DEFAULT_SOURCE.lat));
  const [sourceLng, setSourceLng] = useState(String(DEFAULT_SOURCE.lng));
  const [destLat, setDestLat] = useState(String(DEFAULT_DEST.lat));
  const [destLng, setDestLng] = useState(String(DEFAULT_DEST.lng));
  const [width, setWidth] = useState("5");
  const [data, setData] = useState<CorridorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [caseLabel, setCaseLabel] = useState("");

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getBackendBase()}/cases/${caseId}`);
        if (!res.ok) return;
        const detail = await res.json() as {
          reference?: string;
          title?: string;
          predictions?: {
            source_coordinates?: { lat: number; lng: number } | null;
            hotspots?: Array<{ lat: number; lng: number }>;
          };
        };
        if (cancelled) return;

        const src = detail.predictions?.source_coordinates;
        const hotspots = detail.predictions?.hotspots;
        const dest = hotspots?.[0];

        if (src && typeof src.lat === "number" && typeof src.lng === "number") {
          setSourceLat(String(src.lat));
          setSourceLng(String(src.lng));
        }
        if (dest && typeof dest.lat === "number" && typeof dest.lng === "number") {
          setDestLat(String(dest.lat));
          setDestLng(String(dest.lng));
        }
        setCaseLabel(detail.reference || detail.title || caseId);
      } catch {
        // silent — manual input stays available
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${getBackendBase()}/geospatial/corridor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLat: Number(sourceLat),
          sourceLng: Number(sourceLng),
          destLat: Number(destLat),
          destLng: Number(destLng),
          corridorWidthKm: Number(width),
        }),
      });
      if (!res.ok) throw new Error("Corridor request failed");
      setData(await res.json() as CorridorResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to compute corridor");
    } finally {
      setLoading(false);
    }
  };

  const line: [number, number][] = data
    ? [[data.sourcePoint.lat, data.sourcePoint.lng], [data.destPoint.lat, data.destPoint.lng]]
    : [[Number(sourceLat), Number(sourceLng)], [Number(destLat), Number(destLng)]];

  return (
    <div className="enter space-y-5">
      <header className="flex flex-col justify-between gap-3 lg:flex-row">
        <div>
          <div className="font-mono-data text-[10px] font-bold uppercase tracking-[.18em] text-cyan-700">
            Predictive intelligence / corridor analysis
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-800">
            ATM corridor prediction
          </h1>
          <p className="mt-2 max-w-3xl text-xs text-slate-500">
            {caseLabel
              ? <>Coordinates pulled from case <b>{caseLabel}</b> model predictions. Adjust and re-analyze as needed.</>
              : <>Given a source and destination point, identifies synthetic ATMs along the corridor ranked by vulnerability score.</>}
          </p>
        </div>
      </header>

      <section className="border border-slate-200 bg-white p-4">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
          Corridor parameters{caseLabel ? ` / ${caseLabel}` : ""}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500">
              Source lat
            </label>
            <input
              type="number"
              step="0.0001"
              value={sourceLat}
              onChange={(e) => setSourceLat(e.target.value)}
              className="field w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500">
              Source lng
            </label>
            <input
              type="number"
              step="0.0001"
              value={sourceLng}
              onChange={(e) => setSourceLng(e.target.value)}
              className="field w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500">
              Dest lat
            </label>
            <input
              type="number"
              step="0.0001"
              value={destLat}
              onChange={(e) => setDestLat(e.target.value)}
              className="field w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500">
              Dest lng
            </label>
            <input
              type="number"
              step="0.0001"
              value={destLng}
              onChange={(e) => setDestLng(e.target.value)}
              className="field w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500">
              Width (km)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.5"
                max="50"
                step="0.5"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="field min-w-0 flex-1 text-xs"
              />
              <button
                onClick={analyze}
                disabled={loading}
                className="bg-slate-800 px-4 text-xs font-bold text-amber-300 hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? "Running" : "Analyze"}
              </button>
            </div>
          </div>
        </div>
        {error && (
          <div className="mt-3 text-xs text-red-600">{error}</div>
        )}
      </section>

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["ATMs in corridor", data.corridorAtms.length],
              ["Corridor width", `${data.corridorWidthKm} km`],
              ["Line distance", `${data.totalLineKm} km`],
              ["High vulnerability", data.corridorAtms.filter((a) => a.vulnerabilityScore >= 70).length],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="border border-slate-200 bg-white p-3"
              >
                <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  {label}
                </div>
                <div className="mt-1 font-mono-data text-lg font-bold text-slate-800">
                  {String(value)}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <section className="h-[560px] overflow-hidden border border-slate-200 bg-slate-100">
              <MapContainer
                center={[
                  (data.sourcePoint.lat + data.destPoint.lat) / 2,
                  (data.sourcePoint.lng + data.destPoint.lng) / 2,
                ]}
                zoom={5}
                className="h-full w-full"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline
                  positions={line}
                  pathOptions={{
                    color: "#0ea5e9",
                    weight: 3,
                    dashArray: "8 6",
                    opacity: 0.8,
                  }}
                />
                <CircleMarker
                  center={[data.sourcePoint.lat, data.sourcePoint.lng]}
                  radius={7}
                  pathOptions={{
                    color: "#0284c7",
                    fillColor: "#0ea5e9",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <b>SOURCE</b>
                    <br />
                    {data.sourcePoint.lat.toFixed(4)},{" "}
                    {data.sourcePoint.lng.toFixed(4)}
                    <br />
                    <b>SYNTHETIC DATA</b>
                  </Popup>
                </CircleMarker>
                <CircleMarker
                  center={[data.destPoint.lat, data.destPoint.lng]}
                  radius={7}
                  pathOptions={{
                    color: "#b91c1c",
                    fillColor: "#dc2626",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <b>DESTINATION</b>
                    <br />
                    {data.destPoint.lat.toFixed(4)},{" "}
                    {data.destPoint.lng.toFixed(4)}
                    <br />
                    <b>SYNTHETIC DATA</b>
                  </Popup>
                </CircleMarker>
                {data.corridorAtms.map((atm) => (
                  <CircleMarker
                    key={atm.id}
                    center={[atm.latitude, atm.longitude]}
                    radius={Math.max(4, atm.vulnerabilityScore / 15)}
                    pathOptions={{
                      color: scoreColor(atm.vulnerabilityScore),
                      fillColor: scoreFill(atm.vulnerabilityScore),
                      fillOpacity: 0.85,
                      weight: 1,
                    }}
                  >
                    <Popup>
                      <b>{atm.name}</b>
                      <br />
                      {atm.bankName}
                      <br />
                      {atm.city}, {atm.state}
                      <br />
                      Score: <b>{atm.vulnerabilityScore}/100</b>
                      <br />
                      {atm.distanceFromLineKm} km from line
                      <br />
                      <b>SYNTHETIC DATA</b>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </section>

            <aside className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[.15em] text-cyan-700">
                  Ranked by vulnerability
                </div>
                <h2 className="mt-2 text-base font-extrabold text-slate-800">
                  Top 5 corridor ATMs
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {data.corridorAtms.slice(0, 5).map((atm, index) => (
                  <div className="p-4" key={atm.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center bg-slate-100 font-mono-data text-[10px] font-bold text-slate-600">
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            {atm.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {atm.bankName}
                          </div>
                        </div>
                      </div>
                      <span
                        className="px-2 py-1 text-[10px] font-bold text-white"
                        style={{
                          backgroundColor: scoreColor(atm.vulnerabilityScore),
                        }}
                      >
                        {atm.vulnerabilityScore}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
                      <span>{atm.distanceFromLineKm} km from line</span>
                      <span>{atm.distanceFromDestKm} km to dest</span>
                      {atm.nearbyHotspotCount > 0 && (
                        <span className="font-semibold text-amber-700">
                          {atm.nearbyHotspotCount} hotspots nearby
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {atm.city}, {atm.state} &middot; SYNTHETIC
                    </div>
                  </div>
                ))}
                {data.corridorAtms.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No ATMs found within the corridor width.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
