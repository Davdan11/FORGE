import type { Activity, UnitPrefs } from "./types";
import { fmtDist, fmtDuration, fmtPace } from "./units";

/* Render a 1080×1350 share card (route + stats) and hand it to the OS share
   sheet; falls back to a download when Web Share can't take files. */

export async function renderShareCard(a: Activity, units: UnitPrefs, name: string): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0A0A0A"; ctx.fillRect(0, 0, W, H);

  // Route
  if (a.points.length > 1) {
    const xs = a.points.map((p) => p.lng), ys = a.points.map((p) => p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const latScale = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
    const w = Math.max((maxX - minX) * latScale, 1e-6), h = Math.max(maxY - minY, 1e-6);
    const box = 760, s = box / Math.max(w, h);
    const ox = (W - w * s) / 2, oy = 160 + (box - h * s) / 2;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(31,199,111,.25)"; ctx.lineWidth = 34;
    ctx.beginPath(); a.points.forEach((p, i) => { const x = ox + (p.lng - minX) * latScale * s, y = oy + (maxY - p.lat) * s; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    ctx.strokeStyle = "#1FC76F"; ctx.lineWidth = 10; ctx.stroke();
    const last = a.points[a.points.length - 1];
    ctx.fillStyle = "#1FC76F"; ctx.beginPath(); ctx.arc(ox + (last.lng - minX) * latScale * s, oy + (maxY - last.lat) * s, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#0A0A0A"; ctx.lineWidth = 6; ctx.stroke();
  }

  ctx.fillStyle = "#ECE7DF";
  ctx.font = "800 96px Archivo, system-ui, sans-serif"; ctx.fillText(a.title.toUpperCase().slice(0, 18), 72, 1060);
  ctx.font = "500 32px Archivo, system-ui, sans-serif"; ctx.fillStyle = "#8F8A82";
  ctx.fillText(`${name.toUpperCase()}  ·  ${a.startedAt.slice(0, 10)}`, 72, 1110);

  const stats = [[fmtDist(a.distanceM, units), "DISTANCE"], [fmtDuration(a.durationSec), "TIME"], [fmtPace(a.avgPaceSecKm, units).replace(/ \/.*$/, ""), "PACE"], [`${Math.round(a.elevGainM)} m`, "CLIMB"]];
  stats.forEach(([v, l], i) => {
    const x = 72 + i * 240;
    ctx.fillStyle = "#ECE7DF"; ctx.font = "800 56px Archivo, system-ui, sans-serif"; ctx.fillText(v, x, 1220);
    ctx.fillStyle = "#8F8A82"; ctx.font = "500 22px Archivo, system-ui, sans-serif"; ctx.fillText(l, x, 1256);
  });
  ctx.fillStyle = "#1FC76F"; ctx.font = "800 40px Archivo, system-ui, sans-serif"; ctx.fillText("FORGE", 72, 90);
  ctx.fillStyle = "#8F8A82"; ctx.font = "500 24px Archivo, system-ui, sans-serif"; ctx.fillText(`+${a.xp} XP`, W - 200, 90);

  return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
}

export async function shareCard(a: Activity, units: UnitPrefs, name: string) {
  const blob = await renderShareCard(a, units, name);
  const file = new File([blob], `forge-${a.id.slice(0, 8)}.png`, { type: "image/png" });
  const text = `${a.title} · ${fmtDist(a.distanceM, units)} · ${fmtDuration(a.durationSec)} · +${a.xp} XP on FORGE`;
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: a.title, text }); return "shared" as const; }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded" as const;
}
