"use client";

/* ─────────────────────────────────────────────────────────────
   Proximity voice: talk to the riders around you.

   Each pair of riders in voice is a direct WebRTC audio link (no
   media server); the room's Realtime channel only carries the
   handshake. Links open for the nearest riders in voice (at most
   MAX_LINKS, within CONNECT_AT metres along the road) and close
   when they drift past DROP_AT, so a big room never means a big
   mesh. Loudness follows the gap on the road: full voice within
   NEAR, fading to silence at FAR — like talking in a bunch.

   Voice is off until the rider turns it on, and nothing is ever
   recorded. The microphone is live only while talking (push to
   talk) or while voice is on (open mic), as the rider chooses.
   ───────────────────────────────────────────────────────────── */

export const VOICE_NEAR = 20;
export const VOICE_FAR = 100;
export const CONNECT_AT = 150;
export const DROP_AT = 250;
export const MAX_LINKS = 8;
const ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

/** Handshake messages between two riders. */
export type VoiceSignal =
  | { k: "offer" | "answer"; sdp: string }
  | { k: "ice"; c: RTCIceCandidateInit }
  | { k: "bye" };

/** How loud a rider this far away (metres along the road) is heard: 1 close by, 0 out of earshot. */
export function voiceGain(gap: number): number {
  const g = Math.abs(gap);
  if (g <= VOICE_NEAR) return 1;
  if (g >= VOICE_FAR) return 0;
  const t = (g - VOICE_NEAR) / (VOICE_FAR - VOICE_NEAR);
  return (1 - t) * (1 - t);
}

/**
 * Who to be linked with: riders in voice, nearest first, at most MAX_LINKS.
 * A link already open stays until DROP_AT (so riders at the edge do not flicker
 * in and out); a new one opens within CONNECT_AT.
 */
export function chooseLinks(me: number, peers: { id: string; distance: number; voice: boolean }[], current: ReadonlySet<string>): Set<string> {
  const near = peers
    .filter((p) => p.voice && Math.abs(p.distance - me) <= (current.has(p.id) ? DROP_AT : CONNECT_AT))
    .sort((a, b) => Math.abs(a.distance - me) - Math.abs(b.distance - me))
    .slice(0, MAX_LINKS);
  return new Set(near.map((p) => p.id));
}

/** Of two riders, the one who sends the offer: the smaller id (so both never offer at once). */
export const offersTo = (me: string, other: string) => me < other;

interface Link {
  pc: RTCPeerConnection;
  gain: GainNode;
  analyser: AnalyserNode;
  el: HTMLAudioElement;
  ice: RTCIceCandidateInit[];
  ready: boolean;
  born: number;
}

export interface VoiceState {
  /** Riders heard right now (ids). */
  speaking: Set<string>;
  /** Riders linked (ids), with how loud each one is. */
  linked: Map<string, number>;
  /** My microphone is sending sound right now. */
  talking: boolean;
}

export class VoiceChat {
  private ctx: AudioContext | null = null;
  private mic: MediaStream | null = null;
  private micLevel: AnalyserNode | null = null;
  private links = new Map<string, Link>();
  private called = new Map<string, number>();
  private muted = new Set<string>();
  private open = false;
  private held = false;
  private buf = new Float32Array(512);
  private me = "";
  private send: ((to: string, s: VoiceSignal) => void) | null = null;

  /** True when the microphone was granted (otherwise voice is listen-only). */
  get hasMic() { return !!this.mic; }

  /** Turn voice on. Must be called from a tap or click (browsers only start sound and the mic then). */
  async start(): Promise<{ mic: boolean }> {
    this.ctx ??= new AudioContext();
    await this.ctx.resume().catch(() => {});
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.micLevel = this.ctx.createAnalyser();
      this.micLevel.fftSize = 512;
      this.ctx.createMediaStreamSource(this.mic).connect(this.micLevel);
    } catch { this.mic = null; }
    this.applyMic();
    return { mic: !!this.mic };
  }

  /** The room to talk in: who I am there and how to reach the others. Changing room hangs up every link. */
  setRoom(me: string, send: ((to: string, s: VoiceSignal) => void) | null) {
    if (me === this.me && send === this.send) return;
    for (const id of [...this.links.keys()]) this.close(id, true);
    this.me = me; this.send = send;
  }

  /** Open mic (true) or push to talk (false). */
  setOpenMic(open: boolean) { this.open = open; this.applyMic(); }
  /** Push to talk: the key or button is held. */
  setHeld(held: boolean) { this.held = held; this.applyMic(); }
  setMuted(id: string, muted: boolean) { if (muted) this.muted.add(id); else this.muted.delete(id); }

  private applyMic() { for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = this.open || this.held; }

  /**
   * Called a few times a second with where everyone is: opens and closes links,
   * sets how loud each rider is, and says who is speaking.
   */
  update(myDistance: number, peers: { id: string; distance: number; voice: boolean }[]): VoiceState {
    const state: VoiceState = { speaking: new Set(), linked: new Map(), talking: false };
    if (!this.ctx || !this.send) return state;
    const want = chooseLinks(myDistance, peers, new Set(this.links.keys()));
    const now = Date.now();
    // A link just answered is kept a moment: the caller's "I'm in voice" may not have reached us yet.
    for (const [id, link] of [...this.links]) if (!want.has(id) && now - link.born > 4000) this.close(id, true);
    // Call again no sooner than every 5 s, so a rider who hangs up is not called in a loop.
    for (const id of want) if (!this.links.has(id) && offersTo(this.me, id) && now - (this.called.get(id) ?? 0) > 5000) { this.called.set(id, now); void this.call(id); }

    const at = this.ctx.currentTime;
    for (const p of peers) {
      const link = this.links.get(p.id);
      if (!link) continue;
      const g = this.muted.has(p.id) ? 0 : voiceGain(p.distance - myDistance);
      link.gain.gain.setTargetAtTime(g, at, 0.15);
      state.linked.set(p.id, g);
      if (g > 0.02 && this.level(link.analyser) > 0.015) state.speaking.add(p.id);
    }
    state.talking = !!this.micLevel && (this.open || this.held) && this.level(this.micLevel) > 0.015;
    return state;
  }

  /** A handshake message from another rider in the room. */
  async receive(from: string, s: VoiceSignal) {
    if (!this.ctx || !this.send) return;
    try {
      if (s.k === "bye") { this.close(from, false); return; }
      if (s.k === "offer") {
        // They called: answer (a stale link to them is replaced).
        if (this.links.has(from)) this.close(from, false);
        const link = this.link(from);
        await link.pc.setRemoteDescription({ type: "offer", sdp: s.sdp });
        await this.flush(link);
        const answer = await link.pc.createAnswer();
        await link.pc.setLocalDescription(answer);
        this.send(from, { k: "answer", sdp: answer.sdp ?? "" });
        return;
      }
      const link = this.links.get(from);
      if (!link) return;
      if (s.k === "answer") { await link.pc.setRemoteDescription({ type: "answer", sdp: s.sdp }); await this.flush(link); }
      else if (s.k === "ice") { if (link.ready) await link.pc.addIceCandidate(s.c); else link.ice.push(s.c); }
    } catch { this.close(from, true); }
  }

  /** Voice off: hang up, release the microphone. */
  stop() {
    for (const id of [...this.links.keys()]) this.close(id, true);
    for (const t of this.mic?.getTracks() ?? []) t.stop();
    this.mic = null; this.micLevel = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private async call(id: string) {
    const link = this.link(id);
    try {
      const offer = await link.pc.createOffer();
      await link.pc.setLocalDescription(offer);
      this.send?.(id, { k: "offer", sdp: offer.sdp ?? "" });
    } catch { this.close(id, false); }
  }

  private link(id: string): Link {
    const ctx = this.ctx!;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const track = this.mic?.getAudioTracks()[0];
    // Always one audio line both ways: a rider without a microphone still hears.
    if (track && this.mic) pc.addTrack(track, this.mic); else pc.addTransceiver("audio", { direction: "recvonly" });
    const gain = ctx.createGain(); gain.gain.value = 0;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    gain.connect(ctx.destination);
    const el = new Audio(); el.muted = true; // Chrome only plays a WebRTC stream through Web Audio if an element holds it too.
    const link: Link = { pc, gain, analyser, el, ice: [], ready: false, born: Date.now() };
    pc.onicecandidate = (e) => { if (e.candidate) this.send?.(id, { k: "ice", c: e.candidate.toJSON() }); };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      el.srcObject = stream; void el.play().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser); src.connect(gain);
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") this.close(id, true); };
    this.links.set(id, link);
    return link;
  }

  private async flush(link: Link) {
    link.ready = true;
    for (const c of link.ice.splice(0)) await link.pc.addIceCandidate(c).catch(() => {});
  }

  private close(id: string, tell: boolean) {
    const link = this.links.get(id);
    if (!link) return;
    this.links.delete(id);
    if (tell) this.send?.(id, { k: "bye" });
    link.pc.close();
    link.gain.disconnect();
    link.el.srcObject = null;
  }

  private level(a: AnalyserNode): number {
    a.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    return Math.sqrt(sum / this.buf.length);
  }
}

/** Another client's word: only well-formed handshake messages, of sane size. */
export function voiceSignal(v: unknown): VoiceSignal | null {
  const s = v as { k?: unknown; sdp?: unknown; c?: unknown };
  if (!s || typeof s !== "object") return null;
  if ((s.k === "offer" || s.k === "answer") && typeof s.sdp === "string" && s.sdp.length < 20000) return { k: s.k, sdp: s.sdp };
  if (s.k === "ice" && s.c && typeof s.c === "object") return { k: "ice", c: s.c as RTCIceCandidateInit };
  if (s.k === "bye") return { k: "bye" };
  return null;
}

export type ReportReason = "abuse" | "harassment" | "hate" | "sexual" | "spam" | "other";

/** Flag a rider heard in voice (supabase/voice-reports.sql). Nothing but who, where and why is sent. */
export async function reportVoice(reported: string, name: string, room: string, reason: ReportReason): Promise<boolean> {
  const { supabase } = await import("../supabase/client");
  if (!supabase) return false;
  const { error } = await supabase.from("voice_reports").insert({ reported, reported_name: name.slice(0, 24) || "Rider", room: room.slice(0, 120), reason });
  return !error;
}
