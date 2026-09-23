"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Gift, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { BADGES, SUB_RANKS, TIERS } from "@/lib/gamification";
import {
  allCampaigns, allClaims, amAdmin, claimsCsv, decideClaim, deleteCampaign, purgeOldAddresses, qualifies, RULE_LABEL, saveCampaign, uploadRewardImage,
  type Campaign, type Claim, type ClaimStatus, type RuleType,
} from "@/lib/rewards";
import { Screen, Section, Seg, ScreenSkeleton, Toast, StatRow } from "@/components/ui";
import { Page, Press } from "@/components/motion";

/* ─────────────────────────────────────────────────────────────
   The owner's panel: decide the gifts, read the claims, ship.
   The database only lets admins in (supabase/rewards.sql); this
   page just asks it, and says so to anyone else.
   ───────────────────────────────────────────────────────────── */

const EMPTY: Campaign = { id: "", title: "", description: "", image_url: null, rule_type: "rank", rule_value: "gold", starts_at: new Date().toISOString(), ends_at: null, stock: 50, daily_cap: 50, active: false };

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"claims" | "campaigns">("claims");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const refresh = useCallback(async () => {
    const [c, k] = await Promise.all([allCampaigns(), allClaims()]);
    setCampaigns(c); setClaims(k);
  }, []);

  useEffect(() => {
    let alive = true;
    amAdmin().then(async (ok) => {
      if (!alive) return;
      setAllowed(ok);
      if (!ok) return;
      await purgeOldAddresses().catch(() => 0);
      const [c, k] = await Promise.all([allCampaigns(), allClaims()]);
      if (alive) { setCampaigns(c); setClaims(k); }
    }).catch(() => alive && setAllowed(false));
    return () => { alive = false; };
  }, []);

  if (allowed === null) return <ScreenSkeleton />;
  if (!allowed) return <Screen><div className="pt-24 grid gap-3 max-w-[480px]"><h1 className="display text-3xl">Admins only.</h1><p className="text-sm text-smoke">This page is for the team. Sign in with an admin account.</p></div></Screen>;

  const pending = claims.filter((c) => c.status === "requested").length;
  return (
    <Page>
      <Screen>
        <div className="pt-[calc(var(--safe-top)+24px)] grid gap-2 mb-6">
          <p className="eyebrow">Admin</p>
          <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>Rewards <em>desk.</em></h1>
        </div>
        <StatRow items={[
          { label: "To review", value: String(pending) },
          { label: "Approved", value: String(claims.filter((c) => c.status === "approved").length) },
          { label: "Shipped", value: String(claims.filter((c) => c.status === "shipped").length) },
        ]} />
        <div className="my-6"><Seg fill value={tab} onChange={setTab} options={[{ v: "claims", label: `Claims${pending ? ` · ${pending}` : ""}` }, { v: "campaigns", label: "Gifts" }]} /></div>

        {tab === "campaigns" ? (
          editing ? (
            <CampaignForm initial={editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); say("Saved."); }} say={say} />
          ) : (
            <Section title="Gifts" aside={<button type="button" className="pill pill--sm pill--volt" onClick={() => setEditing({ ...EMPTY })}><Plus className="w-4 h-4" />New gift</button>}>
              <div className="grid gap-3">
                {campaigns.length === 0 && <p className="text-sm text-smoke">No gifts yet. Create the first one: a photo, what it takes, how many.</p>}
                {campaigns.map((c) => {
                  const taken = claims.filter((k) => k.campaign_id === c.id && k.status !== "rejected").length;
                  return (
                    <div key={c.id} className="card p-3 flex items-center gap-3">
                      {c.image_url ? <img src={c.image_url} alt="" className="w-16 h-16 rounded-xl object-cover" /> : <span className="w-16 h-16 rounded-xl bg-graphite grid place-items-center"><Gift className="w-6 h-6 text-smoke" /></span>}
                      <span className="min-w-0 flex-1 grid">
                        <strong className="truncate">{c.title}</strong>
                        <span className="text-xs text-smoke">{RULE_LABEL[c.rule_type]}: {c.rule_value} · {taken}/{c.stock} claimed · {c.daily_cap}/day max</span>
                        <span className={`text-xs font-semibold ${c.active ? "text-volt" : "text-smoke"}`}>{c.active ? "Live" : "Paused"}{c.ends_at ? ` · until ${c.ends_at.slice(0, 10)}` : ""}</span>
                      </span>
                      <button type="button" className="pill pill--sm" onClick={() => setEditing(c)}>Edit</button>
                    </div>
                  );
                })}
              </div>
            </Section>
          )
        ) : (
          <ClaimsDesk claims={claims} campaigns={campaigns} onChange={refresh} say={say} />
        )}
        <Toast text={toast} />
      </Screen>
    </Page>
  );
}

function CampaignForm({ initial, onCancel, onSaved, say }: { initial: Campaign; onCancel: () => void; onSaved: () => void; say: (m: string) => void }) {
  const [c, setC] = useState<Campaign>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC((x) => ({ ...x, [k]: v }));

  async function upload(file: File) {
    setBusy(true);
    try { set("image_url", await uploadRewardImage(file)); } catch (e) { say(e instanceof Error ? e.message : "Upload failed."); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      const { id, created_at: _created, ...rest } = c;
      void _created;
      await saveCampaign(id ? { id, ...rest } : rest);
      onSaved();
    } catch (e) { say(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  }
  async function remove() {
    if (!c.id || !confirm("Delete this gift and every claim on it?")) return;
    await deleteCampaign(c.id); onSaved();
  }

  const [tierKey, sub] = c.rule_value.split(":");
  return (
    <div className="grid gap-4 max-w-[640px]">
      <label className="grid gap-1"><span className="meta">What you give</span><input className="input" maxLength={80} value={c.title} onChange={(e) => set("title", e.target.value)} placeholder="FORGE water bottle — October" /></label>
      <label className="grid gap-1"><span className="meta">Description</span><textarea className="input min-h-[90px] py-3" maxLength={600} value={c.description} onChange={(e) => set("description", e.target.value)} placeholder="Insulated, 750 ml, keeps it cold for 24 h." /></label>

      <div className="grid gap-2">
        <span className="meta">Photo</span>
        <div className="flex items-center gap-3">
          {c.image_url ? <img src={c.image_url} alt="" className="w-24 h-24 rounded-2xl object-cover" /> : <span className="w-24 h-24 rounded-2xl bg-graphite grid place-items-center"><ImageIcon className="w-7 h-7 text-smoke" /></span>}
          <label className="pill pill--sm cursor-pointer">{busy ? "Uploading…" : c.image_url ? "Change photo" : "Upload a photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
      </div>

      <div className="grid gap-2">
        <span className="meta">Who gets it</span>
        <select className="input" value={c.rule_type} onChange={(e) => { const t = e.target.value as RuleType; set("rule_type", t); set("rule_value", t === "rank" ? "gold" : t === "badge" ? BADGES[0].id : "10"); }}>
          {(Object.keys(RULE_LABEL) as RuleType[]).map((r) => <option key={r} value={r}>{RULE_LABEL[r]}</option>)}
        </select>
        {c.rule_type === "rank" && (
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={tierKey} onChange={(e) => set("rule_value", sub ? `${e.target.value}:${sub}` : e.target.value)}>{TIERS.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select>
            <select className="input" value={sub ?? "I"} onChange={(e) => set("rule_value", e.target.value === "I" ? tierKey : `${tierKey}:${e.target.value}`)}>{SUB_RANKS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </div>
        )}
        {c.rule_type === "badge" && <select className="input" value={c.rule_value} onChange={(e) => set("rule_value", e.target.value)}>{BADGES.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.desc}</option>)}</select>}
        {(c.rule_type === "level" || c.rule_type === "streak" || c.rule_type === "sessions_month") && (
          <input className="input tnum" type="number" min={1} value={c.rule_value} onChange={(e) => set("rule_value", e.target.value)} />
        )}
        <span className="text-xs text-smoke">Example: someone at level 42 with a 6-week streak → {qualifies(c.rule_type, c.rule_value, { level: 42, xp: 0, badges: [], streakWeeks: 6, sessionsThisMonth: 10 }).ok ? "qualifies" : "does not qualify yet"}.</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1"><span className="meta">Starts</span><input className="input" type="date" value={c.starts_at.slice(0, 10)} onChange={(e) => set("starts_at", new Date(e.target.value + "T00:00:00").toISOString())} /></label>
        <label className="grid gap-1"><span className="meta">Ends (optional)</span><input className="input" type="date" value={c.ends_at?.slice(0, 10) ?? ""} onChange={(e) => set("ends_at", e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null)} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1"><span className="meta">How many (stock)</span><input className="input tnum" type="number" min={0} value={c.stock} onChange={(e) => set("stock", Number(e.target.value))} /></label>
        <label className="grid gap-1"><span className="meta">Max claims a day</span><input className="input tnum" type="number" min={1} value={c.daily_cap} onChange={(e) => set("daily_cap", Number(e.target.value))} /></label>
      </div>
      <p className="text-xs text-smoke">The daily cap is the safety net: whatever happens, no more than this many claims a day for this gift.</p>
      <label className="flex items-center gap-3"><input type="checkbox" className="tick" checked={c.active} onChange={(e) => set("active", e.target.checked)} /><span className="text-sm">Live — show it to athletes and accept claims</span></label>

      <div className="flex gap-2 flex-wrap">
        <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" disabled={busy || !c.title.trim()} onClick={save}>Save gift</button></Press>
        <button type="button" className="pill" onClick={onCancel}>Cancel</button>
        {c.id && <button type="button" className="pill pill--danger" onClick={remove}><Trash2 className="w-4 h-4" /></button>}
      </div>
    </div>
  );
}

function ClaimsDesk({ claims, campaigns, onChange, say }: { claims: Claim[]; campaigns: Campaign[]; onChange: () => Promise<void>; say: (m: string) => void }) {
  const [filter, setFilter] = useState<ClaimStatus>("requested");
  const shown = useMemo(() => claims.filter((c) => c.status === filter), [claims, filter]);
  const title = (id: string) => campaigns.find((c) => c.id === id)?.title ?? "Gift";

  function exportCsv() {
    const csv = claimsCsv(claims.filter((c) => c.status === "approved"), campaigns);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `shipping-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  async function decide(c: Claim, status: ClaimStatus) {
    const extra: { tracking?: string; admin_note?: string } = {};
    if (status === "shipped") { const t = prompt("Tracking number (optional)") ?? ""; if (t) extra.tracking = t; }
    if (status === "rejected") { const n = prompt("Reason shown to the athlete (optional)") ?? ""; if (n) extra.admin_note = n; }
    try { await decideClaim(c.id, status, extra); await onChange(); say(`Marked ${status}.`); } catch (e) { say(e instanceof Error ? e.message : "Could not update."); }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Seg scroll value={filter} onChange={setFilter} options={(["requested", "approved", "shipped", "rejected"] as ClaimStatus[]).map((s) => ({ v: s, label: `${s[0].toUpperCase()}${s.slice(1)} · ${claims.filter((c) => c.status === s).length}` }))} />
        <button type="button" className="pill pill--sm ml-auto" onClick={exportCsv}><Download className="w-4 h-4" />Shipping list (CSV)</button>
      </div>
      {shown.length === 0 && <p className="text-sm text-smoke">Nothing here.</p>}
      {shown.map((c) => {
        const r = c.report;
        return (
          <article key={c.id} className="card p-4 grid gap-3">
            <header className="flex items-baseline justify-between gap-3 flex-wrap">
              <strong className="display text-lg">{r?.name ?? c.ship_name} · {title(c.campaign_id)}</strong>
              <span className="text-xs text-smoke tnum">{new Date(c.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
            </header>
            {r?.flags?.length > 0 && (
              <ul className="grid gap-1 rounded-xl p-3 bg-[rgba(217,69,61,.08)] text-sm text-danger">
                {r.flags.map((f) => <li key={f} className="flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{f}</li>)}
              </ul>
            )}
            {r && (
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm tnum">
                <Fact k="Rank" v={`${r.rank} · lvl ${r.level}`} />
                <Fact k="Took" v={`${r.accountAgeDays} days`} />
                <Fact k="XP / day" v={`${r.xpPerDay} (${r.xp.toLocaleString("en-US")} total)`} />
                <Fact k="Sessions · sets" v={`${r.sessionsDone} · ${r.setsLogged}`} />
                <Fact k="Activities" v={`${r.activities} (${r.gpsActivities} with GPS) · ${r.distanceKm} km`} />
                <Fact k="Indoor min" v={`${r.indoorMinutes.measured} measured · ${r.indoorMinutes.estimated} est. · ${r.indoorMinutes.declared} by hand`} />
                <Fact k="Streak · badges" v={`${r.streakWeeks} wk · ${r.badges}`} />
                <Fact k="Weight" v={r.weightChangeKg != null ? `${r.weightChangeKg > 0 ? "+" : ""}${r.weightChangeKg} kg` : "—"} />
              </dl>
            )}
            {r?.recent?.length > 0 && <details className="text-xs text-smoke"><summary className="cursor-pointer">Recent training ({r.recent.length})</summary><ul className="mt-2 grid gap-0.5">{r.recent.map((x) => <li key={x}>{x}</li>)}</ul></details>}
            {c.ship_line1 ? (
              <address className="not-italic text-sm rounded-xl p-3 bg-graphite">{c.ship_name}<br />{c.ship_line1}{c.ship_line2 ? `, ${c.ship_line2}` : ""}<br />{c.ship_city}{c.ship_region ? `, ${c.ship_region}` : ""} {c.ship_postal}<br />{c.ship_country}{c.ship_phone ? ` · ${c.ship_phone}` : ""}</address>
            ) : <p className="text-xs text-smoke">Address erased (privacy retention).</p>}
            {c.tracking && <p className="text-xs">Tracking: {c.tracking}</p>}
            <div className="flex gap-2 flex-wrap">
              {c.status === "requested" && <><button type="button" className="pill pill--sm pill--volt" onClick={() => decide(c, "approved")}>Approve</button><button type="button" className="pill pill--sm pill--danger" onClick={() => decide(c, "rejected")}>Reject</button></>}
              {c.status === "approved" && <button type="button" className="pill pill--sm pill--volt" onClick={() => decide(c, "shipped")}>Mark shipped</button>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return <div className="grid"><dt className="meta !text-[.6rem]">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
