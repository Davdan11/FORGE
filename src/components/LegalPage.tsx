"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { APP_NAME, LEGAL } from "@/lib/brand";
import { useT } from "@/lib/i18n";

/** A plain, readable legal document: no hero, no motion, nothing between the
 *  reader and the words. Reachable without a profile, from onboarding. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const t = useT();
  return (
    <main className="min-h-dvh px-5 pt-[calc(var(--safe-top)+20px)] pb-16 max-w-[720px] mx-auto">
      <button type="button" onClick={() => (history.length > 1 ? router.back() : router.push("/"))} className="chip mb-6">← {t("Retour", "Back")}</button>
      {LEGAL.draft && (
        <p className="card p-4 mb-6 text-sm border-[#f2c14e] bg-[rgba(242,193,78,.12)]">
          <strong>{t("Brouillon.", "Draft.")}</strong> {t("Ce document n’a pas encore été relu par un avocat et certains détails restent à compléter. Il décrit comment l’app fonctionne aujourd’hui.", "This document has not yet been reviewed by a lawyer and some details are still to be filled in. It describes how the app works today.")}
        </p>
      )}
      <h1 className="display text-4xl leading-[0.95] mb-2">{title}</h1>
      <p className="text-sm text-smoke mb-8">{APP_NAME} · {t("En vigueur le", "Effective")} {LEGAL.effective}</p>
      <div className="legal grid gap-6 text-[15px] leading-relaxed">{children}</div>
      <p className="text-sm text-smoke mt-10">
        <Link href="/legal/privacy" className="underline">{t("Politique de confidentialité", "Privacy Policy")}</Link> · <Link href="/legal/terms" className="underline">{t("Conditions d’utilisation", "Terms of Use")}</Link> · {LEGAL.email}
      </p>
    </main>
  );
}

export function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="font-semibold text-lg">{title}</h2>
      {children}
    </section>
  );
}
