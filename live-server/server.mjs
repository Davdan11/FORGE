// FORGE live server: who is riding the same road right now, for the indoor game.
//
// One small process holds every rider's position in memory (never stored) and, twice a second, sends each
// rider only the riders near them on the road: within RANGE metres, the closest MAX_NEAR. That is what lets
// a hundred riders share a map: each one receives a few dozen positions, not everybody's messages, which is
// what a Supabase Realtime channel did (every position to every rider: 10,000 messages a second at 100).
//
// Rooms are the same as before: "indoor:ride:<course>". A room exists while someone is in it: you arrive
// whenever you want, ride, and leave; the others are simply there (Zwift's way, no start together).
//
// Connect to wss://<host>/, then send {t:"join",room:"indoor:ride:c14",token:<Supabase access token>,name:"David",lap:0}
// Client → server (JSON): {t:"pos",d,v,lk,c,q,cat,vo}  {t:"kudos",to}  {t:"chat",k}  {t:"rtc",to,s}
// Server → client:        {t:"hello",me}  {t:"snap",n,r:[[id,d,v],[id,d,v,name,look,color,q,cat,vo]...],gone:[ids]}
//                         {t:"kudos",from,n}  {t:"chat",from,n,k}  {t:"rtc",from,s}
// GET /health → {ok,rooms,riders}      GET /count?room=… → {n}
//
// Accounts: the token is checked against the Supabase project (SUPABASE_URL: its public signing keys;
// or SUPABASE_JWT_SECRET for projects still on the shared secret). With neither (LIVE_DEV=1 only), a
// "dev:<id>" token is accepted, for local tests with bots.
import http from "node:http";
import { WebSocketServer } from "ws";
import { createRemoteJWKSet, jwtVerify } from "jose";

const PORT = Number(process.env.PORT || 8787);
const RANGE = Number(process.env.RANGE || 1200);     // metres ahead and behind that a rider sees
const MAX_NEAR = Number(process.env.MAX_NEAR || 60); // at most this many riders sent to one rider
const TICK_MS = 500;                                 // snapshots: twice a second
const QUICK_LINES = new Set(["go", "bravo", "together", "attack", "wait", "thanks", "goodrace", "gg"]);

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const jwks = supabaseUrl ? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)) : null;
const secret = process.env.SUPABASE_JWT_SECRET ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET) : null;
const dev = process.env.LIVE_DEV === "1" && !jwks && !secret;

async function userId(token) {
  if (!token) return null;
  if (dev) return token.startsWith("dev:") ? token.slice(4, 60) : null;
  try {
    const { payload } = secret ? await jwtVerify(token, secret) : await jwtVerify(token, jwks);
    return payload.role === "authenticated" && typeof payload.sub === "string" ? payload.sub : null;
  } catch { return null; }
}

/** rooms: name → Map(id → rider). A rider: {id, ws, name, d, v, look, color, q, cat, vo, lap, at, known:Set} */
const rooms = new Map();

const clean = (s, n) => (typeof s === "string" ? s.replace(/[\u0000-\u001f]/g, "").trim().slice(0, n) : "");
const lookOk = (v) => typeof v === "string" && /^-?\d{1,3}(\.-?\d{1,3}){13}((\.-?\d{1,3}){6}(\.[01])?)?$/.test(v) ? v : undefined;
const colorOk = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
const send = (ws, msg) => { if (ws.readyState === 1 && ws.bufferedAmount < 256 * 1024) ws.send(JSON.stringify(msg)); };

/** Road distance between two riders: on a circuit, around the lap (the lap before is right behind). */
function gap(a, b) {
  const raw = b.d - a.d, lap = a.lap || b.lap;
  if (!lap) return raw;
  let g = ((raw % lap) + lap) % lap; if (g > lap / 2) g -= lap;
  return g;
}

function tick() {
  const now = Date.now();
  for (const [name, room] of rooms) {
    // Riders silent for 10 s (a frozen tab), or 30 s without ever riding, are dropped even if the socket lingers.
    for (const [id, r] of room) if (now - r.at > (r.d >= 0 ? 10000 : 30000)) { r.ws.terminate(); room.delete(id); }
    if (room.size === 0) { rooms.delete(name); continue; }
    const all = [...room.values()].filter((r) => r.d >= 0);
    for (const me of room.values()) {
      const near = [];
      for (const o of all) {
        if (o === me) continue;
        const g = me.d >= 0 ? gap(me, o) : 0;
        if (Math.abs(g) <= RANGE) near.push([Math.abs(g), o]);
      }
      near.sort((a, b) => a[0] - b[0]);
      const shown = new Set(), r = [];
      for (const [, o] of near.slice(0, MAX_NEAR)) {
        shown.add(o.id);
        // Name and outfit only the first time this rider sees them; then only where they are.
        if (me.known.has(o.id)) r.push([o.id, o.d, o.v]);
        else r.push([o.id, o.d, o.v, o.name, o.look ?? "", o.color ?? "", o.q ?? "", o.cat ?? "", o.vo ? 1 : 0]);
      }
      const gone = [...me.known].filter((id) => !shown.has(id));
      me.known = shown;
      send(me.ws, { t: "snap", n: room.size, r, gone });
    }
  }
}
setInterval(tick, TICK_MS);
// Processor use over the last 5 s (share of one core), for /health.
const load = { cpu: 0 }; let lastCpu = process.cpuUsage(), lastAt = Date.now();
setInterval(() => { const c = process.cpuUsage(lastCpu), now = Date.now(); load.cpu = Math.round((c.user + c.system) / 1000 / (now - lastAt) * 1000) / 10; lastCpu = process.cpuUsage(); lastAt = now; }, 5000);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/health") {
    let riders = 0; for (const r of rooms.values()) riders += r.size;
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, riders, cpu: load.cpu, memMB: Math.round(process.memoryUsage().rss / 1048576) }));
  }
  if (url.pathname === "/count") return res.end(JSON.stringify({ n: rooms.get(url.searchParams.get("room") ?? "")?.size ?? 0 }));
  res.statusCode = 404; res.end("{}");
});

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
wss.on("connection", (ws) => {
  // The first message says who and where: {t:"join",room,token,name,lap} (the token never goes in the URL,
  // where a proxy's log could keep it). Nothing else is accepted before it, and it must come within 5 s.
  let me = null, room = null, id = null, joining = false;
  const timeout = setTimeout(() => { if (!me) ws.close(4001, "no join"); }, 5000);
  ws.on("message", async (data) => {
    if (me || joining) return;
    let m; try { m = JSON.parse(data); } catch { return; }
    if (m?.t !== "join") return;
    joining = true;
    const roomName = clean(m.room, 120);
    id = await userId(typeof m.token === "string" ? m.token : "");
    if (!id || !/^indoor:(ride|run):[\w:.-]+$/.test(roomName)) { ws.close(4001, "unauthorized"); return; }
    clearTimeout(timeout);
    room = rooms.get(roomName); if (!room) rooms.set(roomName, room = new Map());
    room.get(id)?.ws.close(4002, "joined elsewhere"); // one place per account
    me = { id, ws, name: clean(m.name, 24) || "Rider", d: -1, v: 0, lap: Math.max(0, Number(m.lap) || 0), at: Date.now(), known: new Set(), budget: 20, lastChat: 0 };
    room.set(id, me);
    send(ws, { t: "hello", me: id });
    ws.on("message", (data) => onMessage(data));
  });
  ws.on("close", () => { clearTimeout(timeout); if (me && room?.get(id) === me) room.delete(id); });
  ws.on("error", () => {});

  function onMessage(data) {
    // At most ~10 messages a second on average (a burst of 20): a runaway client is cut off.
    if (--me.budget < -20) { ws.close(4008, "too many messages"); return; }
    let m; try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== "object") return;
    const peer = (to) => (typeof to === "string" ? room.get(to) : undefined);
    switch (m.t) {
      case "pos":
        if (typeof m.d !== "number" || typeof m.v !== "number" || !Number.isFinite(m.d) || m.d < 0 || m.d > 1e6 || m.v < 0 || m.v > 30) return;
        me.d = m.d; me.v = m.v; me.at = Date.now();
        me.look = lookOk(m.lk) ?? me.look; me.color = colorOk(m.c) ?? me.color;
        me.q = m.q === "m" || m.q === "e" || m.q === "d" ? m.q : me.q;
        me.cat = typeof m.cat === "string" && /^[ABCD]$/.test(m.cat) ? m.cat : me.cat;
        me.vo = m.vo === 1;
        break;
      case "kudos": { const p = peer(m.to); if (p && p !== me) send(p.ws, { t: "kudos", from: id, n: me.name }); break; }
      case "chat": {
        const now = Date.now();
        if (!QUICK_LINES.has(m.k) || now - me.lastChat < 2000) return;
        me.lastChat = now;
        // A quick line is heard by the riders around, not the whole map.
        for (const o of room.values()) if (o !== me && o.d >= 0 && Math.abs(gap(me, o)) <= RANGE) send(o.ws, { t: "chat", from: id, n: me.name, k: m.k });
        break;
      }
      case "rtc": { const p = peer(m.to); if (p && p !== me && JSON.stringify(m.s ?? null).length < 8000) send(p.ws, { t: "rtc", from: id, s: m.s }); break; }
    }
  }
});
setInterval(() => { for (const room of rooms.values()) for (const r of room.values()) r.budget = Math.min(20, r.budget + 10); }, 1000);

server.listen(PORT, () => console.log(`FORGE live server on :${PORT}${dev ? " (dev tokens)" : supabaseUrl ? " (Supabase " + supabaseUrl + ")" : ""}`));
