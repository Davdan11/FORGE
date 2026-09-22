"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TrackPoint } from "@/lib/types";

/* Dark basemap (Carto Dark Matter, free for non-commercial / attributed use). */
const STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
// MapLibre 6 spawns a module worker from import.meta.url, which the Next
// bundler cannot serve — point it at the copy in /public/vendor instead.
if (typeof window !== "undefined") maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

export function MapView({ points, follow, locate, locateKey = 0, onLocate, className = "" }: { points: TrackPoint[]; follow?: boolean; locate?: boolean; locateKey?: number; onLocate?: (status: "ok" | "denied" | "unavailable") => void; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [points[0]?.lng ?? -73.57, points[0]?.lat ?? 45.5], zoom: points.length ? 14 : 11, attributionControl: { compact: true } });
    m.on("load", () => {
      m.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
      m.addLayer({ id: "route-glow", type: "line", source: "route", paint: { "line-color": "#D4FF3A", "line-width": 14, "line-opacity": 0.18, "line-blur": 6 }, layout: { "line-cap": "round", "line-join": "round" } });
      m.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#D4FF3A", "line-width": 4.5 }, layout: { "line-cap": "round", "line-join": "round" } });
      m.addSource("head", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "head", type: "circle", source: "head", paint: { "circle-radius": 7, "circle-color": "#D4FF3A", "circle-stroke-color": "#0A0A0A", "circle-stroke-width": 3 } });
      ready.current = true;
      draw();
      if (locate && points.length === 0) locateMe();
    });
    map.current = m;
    return () => { m.remove(); map.current = null; ready.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locateMe() {
    const m = map.current; if (!m) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) { onLocate?.("unavailable"); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const c: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      m.easeTo({ center: c, zoom: 14, duration: 1200 });
      (m.getSource("head") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } }] });
      onLocate?.("ok");
    }, (e) => onLocate?.(e.code === 1 ? "denied" : "unavailable"), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }
  useEffect(() => { if (locateKey > 0 && ready.current) locateMe(); }, [locateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function draw() {
    const m = map.current; if (!m || !ready.current) return;
    const coords = points.map((p) => [p.lng, p.lat]);
    (m.getSource("route") as maplibregl.GeoJSONSource)?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
    const last = points[points.length - 1];
    (m.getSource("head") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: last ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [last.lng, last.lat] } }] : [] });
    if (follow && last) m.easeTo({ center: [last.lng, last.lat], duration: 600 });
    else if (!follow && coords.length > 1) {
      const b = coords.reduce((bb, c) => bb.extend(c as [number, number]), new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]));
      m.fitBounds(b, { padding: 40, duration: 600, maxZoom: 16 });
    }
  }
  useEffect(() => { draw(); }, [points, follow]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`w-full h-full ${className}`} />;
}
