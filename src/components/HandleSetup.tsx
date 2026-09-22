"use client";

import { useState } from "react";
import { handleProblem, setHandle } from "@/lib/social/feed";
import { Press } from "./motion";

/* ─────────────────────────────────────────────────────────────
   A handle is chosen, never inherited.

   Onboarding asks for a name so the app can say "morning, David".
   That is not consent to print it under a map of where somebody
   runs, so the feed asks separately and will not post until it
   has an answer.
   ───────────────────────────────────────────────────────────── */

export function HandleSetup({ onDone }: { onDone: (handle: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clean = value.trim().toLowerCase();
  const problem = clean ? handleProblem(clean) : null;

  async function save() {
    setBusy(true);
    setError(null);
    const r = await setHandle(clean);
    setBusy(false);
    if (r.ok) onDone(r.value); else setError(r.reason);
  }

  return (
    <div className="card p-5 grid gap-3">
      <div className="grid gap-1">
        <span className="eyebrow">Pick a handle</span>
        <p className="text-sm text-smoke max-w-[48ch]">This is the only name the feed shows. Your real name stays where you typed it.</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-lg text-smoke" aria-hidden="true">@</span>
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && clean && !problem && !busy) save(); }}
          placeholder="your_handle"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Handle"
          aria-invalid={!!problem}
          maxLength={20}
        />
      </div>

      {(problem || error) && <p className="text-xs text-danger">{problem ?? error}</p>}

      <Press className="justify-self-start">
        <button type="button" className="pill pill--volt pill--sm" disabled={!clean || !!problem || busy} onClick={save}>
          {busy ? "Saving…" : "Use this handle"}
        </button>
      </Press>
    </div>
  );
}
