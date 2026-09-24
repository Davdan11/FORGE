"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getProfile } from "@/lib/db";
import { recipeCount, searchRecipes } from "@/lib/nutrition/recipes";
import { dietsOf } from "@/lib/nutrition/engine";
import { useT, useLang, locale } from "@/lib/i18n";
import { Screen, TopBar, Photo, Seg, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, Press } from "@/components/motion";
import type { MealSlot } from "@/lib/types";

/** Diet keys as a French reader sees them. */
const DIET_FR: Record<string, string> = { vegetarian: "végé", vegan: "végane", pescatarian: "pescétarien", gluten_free: "sans gluten", lactose_free: "sans lactose" };

export default function BrowsePage() { return <Suspense fallback={<ScreenSkeleton />}><Browse /></Suspense>; }

function Browse() {
  const params = useSearchParams();
  const profile = useLiveQuery(() => getProfile(), []);
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<MealSlot | "">((params.get("slot") as MealSlot) ?? "");
  const [quick, setQuick] = useState(false);
  const [hp, setHp] = useState(false);
  const [maxKcal, setMaxKcal] = useState<number>(0);
  const [page, setPage] = useState(1);
  const date = params.get("date");
  const t = useT();
  const lang = useLang();
  const diets = useMemo(() => (profile ? dietsOf(profile) : []), [profile]);
  const res = useMemo(() => searchRecipes({ q, slot: slot || undefined, diets, quick, minProtein: hp ? 30 : undefined, maxKcal: maxKcal || undefined, limit: 24 * page }), [q, slot, diets, quick, hp, maxKcal, page]);
  if (!profile) return <ScreenSkeleton />;

  return (
    <Page>
      <Screen>
        <TopBar back="/food" title={<>{recipeCount().toLocaleString(locale())} <em>{t("recettes.", "recipes.")}</em></>} right={<span className="chip chip--live tnum">{res.total.toLocaleString(locale())} {t(res.total > 1 ? "résultats" : "résultat", "match")}</span>} />
        <p className="text-xs text-smoke mb-4">{lang === "fr"
          ? `Chaque recette affiche kcal, protéines, glucides, sucre, lipides et fibres par portion, des mesures exactes et les étapes de cuisson.${diets.length ? ` Filtré selon ta diète : ${diets.map((d) => DIET_FR[d] ?? d).join(", ")}.` : ""}`
          : `Every recipe carries kcal, protein, carbs, sugar, fat and fiber per portion, exact measures and cook steps.${diets.length ? ` Filtered to your diet: ${diets.join(", ").replace(/_/g, "-")}.` : ""}`}</p>
        <input className="input mb-3" placeholder={t("Chercher (en anglais) : salmon, tofu curry, oats…", "Search: salmon, tofu curry, oats…")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <div className="grid gap-2 mb-4">
          <Seg scroll value={slot} onChange={(v) => { setSlot(v); setPage(1); }} options={[{ v: "", label: t("Tout", "All") }, { v: "breakfast", label: t("Déjeuner", "Breakfast") }, { v: "lunch", label: t("Dîner", "Lunch") }, { v: "dinner", label: t("Souper", "Dinner") }, { v: "snack", label: t("Collation", "Snack") }, { v: "pre", label: t("Avant", "Pre") }, { v: "post", label: t("Après", "Post") }]} />
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={`chip ${quick ? "chip--volt" : ""}`} aria-pressed={quick} onClick={() => { setQuick(!quick); setPage(1); }}>≤ 15 min</button>
            <button type="button" className={`chip ${hp ? "chip--volt" : ""}`} aria-pressed={hp} onClick={() => { setHp(!hp); setPage(1); }}>{t("30 g+ de protéines", "30 g+ protein")}</button>
            {[400, 600, 800].map((k) => <button key={k} type="button" className={`chip ${maxKcal === k ? "chip--volt" : ""}`} aria-pressed={maxKcal === k} onClick={() => { setMaxKcal(maxKcal === k ? 0 : k); setPage(1); }}>≤ {k} kcal</button>)}
          </div>
        </div>
        <Stagger className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4" delay={0.02}>
          {res.items.map((m) => (
            <Item key={m.id}>
              <Press>
                <Link href={`/food/meal?id=${encodeURIComponent(m.id)}${date ? `&date=${date}` : ""}`} className="card--photo block aspect-[4/5]">
                  <Photo src={m.image} veil color className="absolute inset-0" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-3 grid gap-1">
                    <span className="flex gap-1 flex-wrap"><span className="chip chip--volt tnum">{m.kcal} kcal</span><span className="chip chip--live backdrop-blur-md tnum">{m.protein} P</span>{m.tags.includes("low_sugar") && <span className="chip chip--live backdrop-blur-md">{t("faible en sucre", "low sugar")}</span>}</span>
                    <span className="font-semibold leading-tight text-sm line-clamp-3">{m.name}</span>
                    <span className="text-[11px] text-smoke">{m.cuisine} · {m.minutes} min</span>
                  </div>
                </Link>
              </Press>
            </Item>
          ))}
        </Stagger>
        {res.total > res.items.length && <button type="button" className="pill pill--block mt-4" onClick={() => setPage(page + 1)}>{t("Voir plus", "Show more")} · {(res.total - res.items.length).toLocaleString(locale())} {t(res.total - res.items.length > 1 ? "restantes" : "restante", "left")}</button>}
        {res.items.length === 0 && <p className="py-8 text-center text-sm text-smoke">{t("Aucune recette ne correspond. Enlève un filtre.", "No recipe matches. Loosen a filter.")}</p>}
      </Screen>
    </Page>
  );
}
