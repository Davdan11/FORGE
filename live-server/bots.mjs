// Load test: N pretend riders in one room (LIVE_DEV=1 server). Usage: node bots.mjs [count] [seconds] [url]
// Each rides at 7-12 m/s from a random point of a 20 km road and reports once a second, like the game.
// Prints what one rider receives (messages and bytes a second, riders in view) and the server's /health.
import WebSocket from "ws";
const N = Number(process.argv[2] || 100), SECONDS = Number(process.argv[3] || 30), BASE = process.argv[4] || "ws://localhost:8787";
const room = "indoor:ride:c14", stats = { msgs: 0, bytes: 0, view: 0, snaps: 0 };
const bots = [];
for (let i = 0; i < N; i++) {
  const ws = new WebSocket(BASE);
  ws.on("open", () => ws.send(JSON.stringify({ t: "join", room, token: `dev:bot${i}`, name: `Bot${i}` })));
  const bot = { ws, d: Math.random() * 20000, v: 7 + Math.random() * 5 };
  ws.on("message", (data) => {
    if (i !== 0) return; // measure one rider's view
    stats.msgs++; stats.bytes += data.length;
    const m = JSON.parse(data); if (m.t === "snap") { stats.snaps++; stats.view += m.r.length; }
  });
  bots.push(bot);
}
const timer = setInterval(() => {
  for (const b of bots) { b.d += b.v; if (b.ws.readyState === 1) b.ws.send(JSON.stringify({ t: "pos", d: b.d, v: b.v, lk: "3.7.0.0.1.0.0.0.0.0.0.0.0.0", c: "#FF6F9C", q: "m", cat: "B" })); }
}, 1000);
setTimeout(async () => {
  clearInterval(timer);
  const health = await (await fetch(BASE.replace("ws", "http") + "/health")).json();
  console.log(`${N} riders, ${SECONDS} s: one rider received ${(stats.msgs / SECONDS).toFixed(1)} messages/s, ${(stats.bytes / SECONDS / 1024).toFixed(1)} KB/s, ${(stats.view / Math.max(1, stats.snaps)).toFixed(0)} riders in view on average`);
  console.log("server:", JSON.stringify(health));
  for (const b of bots) b.ws.close();
  setTimeout(() => process.exit(0), 300);
}, SECONDS * 1000);
