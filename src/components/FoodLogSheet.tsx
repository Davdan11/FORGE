"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScanBarcode, Search, X } from "lucide-react";
import { db } from "@/lib/db";
import { eatenTotals, SLOT_LABEL } from "@/lib/nutrition/engine";
import { getMeal } from "@/lib/nutrition/recipes";
import { mealName } from "@/lib/nutrition/cookbook";
import { cleanBarcode, entryFrom, newId, portion, recentFoods, rememberFood, searchLocal, type FoodItem } from "@/lib/nutrition/foodlog";
import { lookupBarcode, RateLimited, searchOff } from "@/lib/nutrition/off";
import { useLang, useT, locale } from "@/lib/i18n";
import { Press, motion, AnimatePresence } from "@/components/motion";
import type { FoodEntry, NutritionDay } from "@/lib/types";

/* "J'ai mangé autre chose": find a food (the built-in table first, then
   Open Food Facts, or a barcode), say how much, and it counts in the day.
   Search and scan logic live in lib/nutrition/foodlog.ts and off.ts. */

type Step = "find" | "scan" | "qty" | "manual";
type OffState = "idle" | "loading" | "done" | "error" | "limited";

const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const numIn = (s: string) => { const n = Number(s.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };

/** Save a portion on the day (and mark the meal it replaces), then say where the day stands. */
async function saveExtra(day: NutritionDay, entry: FoodEntry, replaces: number | null) {
  const extras = [...(day.extras ?? []), entry].sort((a, b) => a.time.localeCompare(b.time));
  const meals = replaces == null ? day.meals : day.meals.map((m, i) => (i === replaces ? { ...m, skipped: true, done: false } : m));
  await db.nutrition.update(day.id, { extras, meals, dirty: 1, updatedAt: new Date().toISOString() });
  return eatenTotals({ ...day, extras, meals }).kcal - day.targets.kcal;
}

export function FoodLogSheet({ day, open, onClose, onLogged }: { day: NutritionDay; open: boolean; onClose: () => void; onLogged: (text: string) => void }) {
  const t = useT(), lang = useLang();
  const [step, setStep] = useState<Step>("find");
  const [query, setQuery] = useState("");
  const [off, setOff] = useState<{ q: string; items: FoodItem[]; state: OffState }>({ q: "", items: [], state: "idle" });
  const [recents, setRecents] = useState<FoodItem[]>([]);
  const [item, setItem] = useState<FoodItem | null>(null);
  const [fromRecent, setFromRecent] = useState(false);
  const [manualCode, setManualCode] = useState<string | undefined>(undefined);

  const reset = () => { setStep("find"); setQuery(""); setItem(null); setManualCode(undefined); };
  const close = () => { reset(); onClose(); };

  // Recents come from this device's storage: read when the sheet opens, not during render.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setRecents(recentFoods()), 0);
    return () => clearTimeout(id);
  }, [open]);

  // Open Food Facts after a pause in typing (their search limit is ~10 a minute).
  useEffect(() => {
    const q = query.trim();
    if (!open || step !== "find" || q.length < 3) return;
    let live = true;
    const id = setTimeout(async () => {
      setOff({ q, items: [], state: "loading" });
      try { const items = await searchOff(q, lang); if (live) setOff({ q, items, state: "done" }); }
      catch (e) { if (live) setOff({ q, items: [], state: e instanceof RateLimited ? "limited" : "error" }); }
    }, 700);
    return () => { live = false; clearTimeout(id); };
  }, [query, open, step, lang]);

  const local = useMemo(() => searchLocal(query, lang), [query, lang]);
  const offShown = off.q === query.trim() ? off : { q: "", items: [], state: "idle" as OffState };

  const choose = (x: FoodItem, recent = false) => { setItem(x); setFromRecent(recent); setStep("qty"); };
  const logRecentNow = async (x: FoodItem) => {
    const grams = x.lastGrams ?? x.servingG ?? 100;
    const entry = entryFrom(x, grams, nowHHMM(), true);
    rememberFood({ ...x, lastGrams: grams });
    const over = await saveExtra(day, entry, null);
    onLogged(loggedText(entry, over));
    close();
  };
  const loggedText = (e: FoodEntry, over: number) => over > 0
    ? t(`${e.name} : noté. +${Math.round(over)} kcal au-dessus de ta cible aujourd’hui — pas grave, le bilan de la semaine en tient compte.`, `${e.name} logged. +${Math.round(over)} kcal over today’s target — no big deal, the weekly check-in accounts for it.`)
    : t(`${e.name} : noté (${e.kcal} kcal).`, `${e.name} logged (${e.kcal} kcal).`);

  return (
    <AnimatePresence>{open && (
      <motion.div className="fixed inset-0 z-[80] grid items-end lg:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button type="button" aria-label={t("Fermer", "Close")} className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={close} />
        <motion.div role="dialog" aria-modal="true" aria-label={t("J’ai mangé autre chose", "I ate something else")}
          initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="relative bg-carbon rounded-t-[28px] lg:rounded-[28px] w-full lg:max-w-[520px] max-h-[88dvh] overflow-y-auto p-5 pb-[calc(var(--safe-bottom)+20px)] grid gap-4 content-start shadow-[0_-20px_60px_-20px_rgba(0,0,0,.35)]">
          <span className="mx-auto w-10 h-1 rounded-full bg-ink/15 lg:hidden" aria-hidden />
          <div className="flex items-start gap-3">
            <div className="grid gap-1 flex-1">
              <span className="meta">{t("Hors plan", "Off the plan")}</span>
              <p className="display text-2xl leading-none">{t("J’ai mangé autre chose", "I ate something else")}</p>
            </div>
            <button type="button" className="p-2 -m-2 text-smoke" aria-label={t("Fermer", "Close")} onClick={close}><X size={20} /></button>
          </div>

          {step === "find" && (<>
            <div className="flex gap-2">
              <label className="relative flex-1">
                <span className="sr-only">{t("Chercher un aliment", "Search a food")}</span>
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke pointer-events-none" aria-hidden />
                <input className="input !pl-9" type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Pomme, yogourt, barre tendre…", "Apple, yogurt, granola bar…")} enterKeyHint="search" />
              </label>
              <button type="button" className="pill" onClick={() => setStep("scan")} aria-label={t("Scanner un code-barres", "Scan a barcode")}><ScanBarcode size={18} /><span className="hidden sm:inline ml-1">{t("Scanner", "Scan")}</span></button>
            </div>

            {!query.trim() && recents.length > 0 && (
              <div className="grid gap-2">
                <span className="meta">{t("Récents", "Recent")}</span>
                <ul className="grid gap-2">{recents.slice(0, 8).map((x) => (
                  <li key={x.key} className="flex items-center gap-2">
                    <button type="button" className="flex-1 min-w-0" onClick={() => choose(x, true)}><FoodRow x={x} /></button>
                    <button type="button" className="pill pill--sm shrink-0 tnum" onClick={() => logRecentNow(x)} aria-label={t(`Noter ${x.name} encore`, `Log ${x.name} again`)}>+ {Math.round(x.lastGrams ?? x.servingG ?? 100)} g</button>
                  </li>
                ))}</ul>
              </div>
            )}

            {local.length > 0 && (
              <div className="grid gap-2">
                <span className="meta">{t("Aliments courants", "Common foods")}</span>
                <ul className="grid gap-2">{local.map((x) => <li key={x.key}><button type="button" className="w-full" onClick={() => choose(x)}><FoodRow x={x} /></button></li>)}</ul>
              </div>
            )}

            {query.trim().length >= 3 && (
              <div className="grid gap-2">
                <span className="meta">Open Food Facts</span>
                {offShown.state === "loading" || (offShown.state === "idle" && query.trim().length >= 3) ? <p className="text-sm text-smoke">{t("Recherche…", "Searching…")}</p>
                  : offShown.state === "limited" ? <p className="text-sm text-smoke">{t("Beaucoup de recherches d’un coup : attends une minute, ou scanne le code-barres.", "Lots of searches at once: wait a minute, or scan the barcode.")}</p>
                  : offShown.state === "error" ? <p className="text-sm text-smoke">{t("Open Food Facts ne répond pas pour l’instant (hors ligne, ou leur service est occupé). Les aliments courants, le code-barres et l’entrée manuelle marchent quand même.", "Open Food Facts is not answering right now (offline, or their service is busy). Common foods, barcodes and manual entry still work.")}</p>
                  : offShown.items.length === 0 ? <p className="text-sm text-smoke">{t("Aucun produit trouvé.", "No product found.")}</p>
                  : <ul className="grid gap-2">{offShown.items.map((x) => <li key={x.key}><button type="button" className="w-full" onClick={() => choose(x)}><FoodRow x={x} /></button></li>)}</ul>}
              </div>
            )}

            <button type="button" className="text-sm underline text-smoke justify-self-start" onClick={() => setStep("manual")}>{t("Entrer les valeurs à la main", "Enter the numbers by hand")}</button>
            {query.trim().length >= 3 && <p className="text-[11px] text-smoke">{t("Données produits : Open Food Facts (ODbL), base ouverte et collaborative — vérifie l’étiquette au besoin.", "Product data: Open Food Facts (ODbL), an open collaborative database — check the label when in doubt.")}</p>}
          </>)}

          {step === "scan" && <Scanner onBack={() => setStep("find")} onFound={(x) => choose(x)} onUnknown={(code) => { setManualCode(code); setStep("manual"); }} />}

          {step === "qty" && item && <Quantity key={item.key} item={item} day={day} onBack={() => setStep("find")} onSave={async (grams, time, replaces) => {
            const entry = entryFrom(item, grams, time, fromRecent);
            rememberFood({ ...item, lastGrams: grams });
            const over = await saveExtra(day, entry, replaces);
            onLogged(loggedText(entry, over));
            close();
          }} />}

          {step === "manual" && <Manual barcode={manualCode} day={day} onBack={() => setStep("find")} onSave={async (entry, per100Item, replaces) => {
            if (per100Item) rememberFood(per100Item);
            const over = await saveExtra(day, entry, replaces);
            onLogged(loggedText(entry, over));
            close();
          }} />}
        </motion.div>
      </motion.div>
    )}</AnimatePresence>
  );
}

function FoodRow({ x }: { x: FoodItem }) {
  const t = useT();
  return (
    <span className="flex items-center gap-3 p-2.5 rounded-xl border border-line text-left">
      {x.image ? <img src={x.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-bone shrink-0" loading="lazy" /> : <span className="w-10 h-10 rounded-lg bg-ink/5 shrink-0 grid place-items-center text-xs text-smoke" aria-hidden>{x.name.slice(0, 1).toUpperCase()}</span>}
      <span className="flex-1 min-w-0 grid">
        <span className="text-sm font-medium leading-tight truncate">{x.name}</span>
        <span className="text-xs text-smoke truncate">{x.brand ? `${x.brand} · ` : ""}{Math.round(x.per100.kcal)} kcal / 100 g{x.lastGrams ? t(` · dernière fois ${Math.round(x.lastGrams)} g`, ` · last time ${Math.round(x.lastGrams)} g`) : ""}</span>
      </span>
    </span>
  );
}

/** Which planned (not yet eaten) meal this food replaced, if any. */
function ReplacesPicker({ day, value, onChange }: { day: NutritionDay; value: number | null; onChange: (v: number | null) => void }) {
  const t = useT(), lang = useLang();
  const open = day.meals.map((m, i) => ({ m, i })).filter(({ m }) => !m.done && !m.skipped);
  if (!open.length) return null;
  return (
    <label className="field"><span className="meta">{t("Ça remplace un repas prévu?", "Did it replace a planned meal?")}</span>
      <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
        <option value="">{t("Non, en plus", "No, on top")}</option>
        {open.map(({ m, i }) => { const r = getMeal(m.mealId); return <option key={i} value={i}>{m.time} · {SLOT_LABEL[m.slot][lang]}{r ? ` — ${mealName(r, lang)}` : ""}</option>; })}
      </select>
    </label>
  );
}

function Quantity({ item, day, onBack, onSave }: { item: FoodItem; day: NutritionDay; onBack: () => void; onSave: (grams: number, time: string, replaces: number | null) => Promise<void> }) {
  const t = useT();
  const hasServing = !!item.servingG && item.servingG > 0;
  const [mode, setMode] = useState<"g" | "serving">(hasServing && !item.lastGrams ? "serving" : "g");
  const [grams, setGrams] = useState(String(Math.round(item.lastGrams ?? (hasServing ? item.servingG! : 100))));
  const [servings, setServings] = useState("1");
  const [time, setTime] = useState(nowHHMM);
  const [replaces, setReplaces] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const g = mode === "serving" && hasServing ? numIn(servings) * item.servingG! : numIn(grams);
  const p = portion(item.per100, g);
  const over = Math.round(eatenTotals(day).kcal + p.kcal - day.targets.kcal);

  return (<>
    <div className="grid gap-0.5">
      <p className="text-base font-semibold leading-tight">{item.name}</p>
      <p className="text-xs text-smoke">{item.brand ? `${item.brand} · ` : ""}{Math.round(item.per100.kcal)} kcal / 100 g{hasServing && item.servingLabel ? ` · ${t("portion", "serving")} : ${item.servingLabel}` : ""}</p>
    </div>
    {hasServing && (
      <div className="flex gap-2" role="group" aria-label={t("Unité", "Unit")}>
        <button type="button" aria-pressed={mode === "serving"} className={`pill pill--sm ${mode === "serving" ? "pill--volt" : ""}`} onClick={() => setMode("serving")}>{t("Portions", "Servings")} ({Math.round(item.servingG!)} g)</button>
        <button type="button" aria-pressed={mode === "g"} className={`pill pill--sm ${mode === "g" ? "pill--volt" : ""}`} onClick={() => setMode("g")}>{t("Grammes", "Grams")}</button>
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
      {mode === "serving" && hasServing
        ? <label className="field"><span className="meta">{t("Portions", "Servings")}</span><input className="input tnum" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} /></label>
        : <label className="field"><span className="meta">{t("Quantité (g)", "Amount (g)")}</span><input className="input tnum" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} /></label>}
      <label className="field"><span className="meta">{t("Heure", "Time")}</span><input className="input tnum" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
    </div>
    <MacroLine kcal={p.kcal} protein={p.protein} carbs={p.carbs} fat={p.fat} grams={g} />
    <ReplacesPicker day={day} value={replaces} onChange={setReplaces} />
    {replaces == null && over > 0 && g > 0 && <p className="text-xs text-smoke">{t(`Avec ça, +${over.toLocaleString(locale())} kcal au-dessus de ta cible aujourd’hui — pas grave, le bilan de la semaine en tient compte.`, `With this, +${over.toLocaleString(locale())} kcal over today’s target — no big deal, the weekly check-in accounts for it.`)}</p>}
    <div className="flex gap-2">
      <Press><button type="button" className="pill pill--volt" disabled={!g || busy || !/^\d\d:\d\d$/.test(time)} onClick={async () => { setBusy(true); try { await onSave(g, time, replaces); } finally { setBusy(false); } }}>{t("Noter", "Log it")}</button></Press>
      <button type="button" className="pill" onClick={onBack}>{t("Retour", "Back")}</button>
    </div>
  </>);
}

function MacroLine({ kcal, protein, carbs, fat, grams }: { kcal: number; protein: number; carbs: number; fat: number; grams: number }) {
  const t = useT();
  return (
    <div className="grid grid-cols-4 divide-x divide-line card text-center tnum" aria-live="polite">
      <span className="py-2.5 grid"><strong className="text-base">{Math.round(kcal)}</strong><span className="meta">kcal</span></span>
      <span className="py-2.5 grid"><strong className="text-base">{Math.round(protein)} g</strong><span className="meta">{t("protéines", "protein")}</span></span>
      <span className="py-2.5 grid"><strong className="text-base">{Math.round(carbs)} g</strong><span className="meta">{t("glucides", "carbs")}</span></span>
      <span className="py-2.5 grid"><strong className="text-base">{Math.round(fat)} g</strong><span className="meta">{t("lipides", "fat")}</span></span>
      <span className="sr-only">{Math.round(grams)} g</span>
    </div>
  );
}

function Manual({ barcode, day, onBack, onSave }: { barcode?: string; day: NutritionDay; onBack: () => void; onSave: (e: FoodEntry, recent: FoodItem | null, replaces: number | null) => Promise<void> }) {
  const t = useT();
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const [v, setV] = useState({ kcal: "", protein: "", carbs: "", fat: "" });
  const [time, setTime] = useState(nowHHMM);
  const [replaces, setReplaces] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const kcal = numIn(v.kcal), g = numIn(grams);
  const ok = name.trim().length > 0 && kcal > 0 && /^\d\d:\d\d$/.test(time);
  const save = async () => {
    const n = { kcal: Math.round(kcal), protein: numIn(v.protein), carbs: numIn(v.carbs), fat: numIn(v.fat) };
    const entry: FoodEntry = { id: newId(), time, name: name.trim(), grams: Math.round(g), ...n, source: "manual", ...(barcode ? { barcode } : {}) };
    // With a weight, it can be re-logged at another amount later: keep it per 100 g.
    const k = g > 0 ? 100 / g : 0;
    const recent: FoodItem | null = k ? { key: `manual:${name.trim().toLowerCase()}`, name: name.trim(), per100: { kcal: n.kcal * k, protein: n.protein * k, carbs: n.carbs * k, fat: n.fat * k }, source: "manual", lastGrams: g, ...(barcode ? { barcode } : {}) } : null;
    setBusy(true);
    try { await onSave(entry, recent, replaces); } finally { setBusy(false); }
  };
  const field = (key: keyof typeof v, label: string) => (
    <label className="field"><span className="meta">{label}</span><input className="input tnum" inputMode="decimal" value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} /></label>
  );
  return (<>
    {barcode && <p className="text-sm text-smoke">{t(`Le code ${barcode} n’est pas dans Open Food Facts (ou sans calories). Entre les valeurs de l’étiquette pour la portion mangée.`, `Code ${barcode} is not in Open Food Facts (or has no calories). Enter the label’s numbers for the portion eaten.`)}</p>}
    <label className="field"><span className="meta">{t("Aliment", "Food")}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Ex. : poutine, part de pizza", "E.g. burrito, slice of pizza")} /></label>
    <div className="grid grid-cols-2 gap-3">
      {field("kcal", t("Calories (kcal)", "Calories (kcal)"))}
      <label className="field"><span className="meta">{t("Poids (g, optionnel)", "Weight (g, optional)")}</span><input className="input tnum" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} /></label>
      {field("protein", t("Protéines (g)", "Protein (g)"))}
      {field("carbs", t("Glucides (g)", "Carbs (g)"))}
      {field("fat", t("Lipides (g)", "Fat (g)"))}
      <label className="field"><span className="meta">{t("Heure", "Time")}</span><input className="input tnum" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
    </div>
    <ReplacesPicker day={day} value={replaces} onChange={setReplaces} />
    <div className="flex gap-2">
      <Press><button type="button" className="pill pill--volt" disabled={!ok || busy} onClick={save}>{t("Noter", "Log it")}</button></Press>
      <button type="button" className="pill" onClick={onBack}>{t("Retour", "Back")}</button>
    </div>
  </>);
}

/* ── Barcode ──────────────────────────────────────────────────
   The camera path uses the browser's BarcodeDetector (Chrome and
   Android WebView have it; Safari and iOS do not). Typing the code
   always works. No native scanner plugin is installed. */

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o?: { formats?: string[] }) => Detector;
const detectorCtor = (): DetectorCtor | null => (typeof window !== "undefined" && "BarcodeDetector" in window ? (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector : null);
const canCamera = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!detectorCtor();

function Scanner({ onBack, onFound, onUnknown }: { onBack: () => void; onFound: (x: FoodItem) => void; onUnknown: (code: string) => void }) {
  const t = useT(), lang = useLang();
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"off" | "on" | "denied" | "unsupported">(() => (canCamera() ? "off" : "unsupported"));
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"idle" | "looking" | "error" | "limited">("idle");
  const busy = useRef(false);

  const look = async (raw: string) => {
    const code = cleanBarcode(raw);
    if (!code || busy.current) return;
    busy.current = true; setState("looking");
    try {
      const x = await lookupBarcode(code, lang);
      if (x) onFound(x); else onUnknown(code);
    } catch (e) { setState(e instanceof RateLimited ? "limited" : "error"); busy.current = false; }
  };
  const lookRef = useRef(look);
  useEffect(() => { lookRef.current = look; });

  useEffect(() => {
    if (camera !== "on") return;
    const Ctor = detectorCtor();
    if (!Ctor) return;
    let stream: MediaStream | null = null, timer: ReturnType<typeof setInterval> | null = null, stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        const v = video.current; if (!v) return;
        v.srcObject = stream; await v.play();
        const det = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        timer = setInterval(async () => {
          if (busy.current || v.readyState < 2) return;
          try { const found = await det.detect(v); const code = found.map((f) => f.rawValue).find((c) => cleanBarcode(c)); if (code) { navigator.vibrate?.(60); lookRef.current(code); } } catch {}
        }, 300);
      } catch { if (!stopped) setCamera("denied"); }
    })();
    return () => { stopped = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((tr) => tr.stop()); };
  }, [camera]);

  return (<>
    {camera === "on" ? (
      <div className="relative rounded-2xl overflow-hidden bg-ink aspect-[4/3]">
        <video ref={video} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
        <span className="absolute inset-x-8 top-1/2 h-0.5 bg-volt/80 shadow-[0_0_12px_var(--volt)]" aria-hidden />
      </div>
    ) : camera === "off" ? (
      <Press><button type="button" className="pill pill--volt w-full" onClick={() => setCamera("on")}><ScanBarcode size={18} className="mr-1" />{t("Ouvrir la caméra", "Open the camera")}</button></Press>
    ) : (
      <p className="text-sm text-smoke card p-3">{camera === "denied" ? t("La caméra n’est pas accessible (permission refusée?). Entre le code à la main, c’est les chiffres sous les barres.", "The camera is not available (permission denied?). Type the code instead: the digits under the bars.") : t("La lecture par caméra n’est pas offerte sur cet appareil. Entre le code à la main, c’est les chiffres sous les barres.", "Camera scanning is not available on this device. Type the code instead: the digits under the bars.")}</p>
    )}
    <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); look(typed); }}>
      <label className="field flex-1"><span className="meta">{t("Code-barres", "Barcode")}</span><input className="input tnum" inputMode="numeric" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="0 65684 00530 7" /></label>
      <button type="submit" className="pill" disabled={!cleanBarcode(typed) || state === "looking"}>{t("Chercher", "Look up")}</button>
    </form>
    {state === "looking" && <p className="text-sm text-smoke">{t("Recherche du produit…", "Looking up the product…")}</p>}
    {state === "error" && <p className="text-sm text-smoke">{t("Impossible de joindre Open Food Facts (hors ligne?). Réessaie, ou entre les valeurs à la main.", "Could not reach Open Food Facts (offline?). Try again, or enter the numbers by hand.")}</p>}
    {state === "limited" && <p className="text-sm text-smoke">{t("Trop de recherches d’un coup : attends une minute.", "Too many lookups at once: wait a minute.")}</p>}
    <button type="button" className="pill justify-self-start" onClick={onBack}>{t("Retour", "Back")}</button>
  </>);
}
