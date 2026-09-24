// The app's two languages. Strings live next to the code that shows them, as a pair: t("Bonjour", "Hello").
// The choice is stored on the device ("auto" follows the phone's language); French is the default when the
// phone's language is unknown, and on the server render, so the first paint matches most riders.
import { useSyncExternalStore } from "react";

export type Lang = "fr" | "en";
export type LangChoice = Lang | "auto";

const KEY = "forge.lang";
const EVENT = "forge:lang";

export function langChoice(): LangChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "fr" || v === "en") return v;
  } catch {}
  return "auto";
}

/** The language to show now. Outside a browser (tests, scripts) it is English, the language of the source. */
export function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  const c = langChoice();
  if (c !== "auto") return c;
  const nav = (navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase();
  return nav.startsWith("en") ? "en" : "fr";
}

export function setLang(choice: LangChoice) {
  try {
    if (choice === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {}
  document.documentElement.lang = getLang();
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** The current language, re-rendering when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore<Lang>(subscribe, getLang, () => "fr");
}

/** For components: const t = useT(); t("Bonjour", "Hello"). */
export function useT() {
  const lang = useLang();
  return (fr: string, en: string) => (lang === "fr" ? fr : en);
}

/** For plain functions (lib code run in the browser): tr("Bonjour", "Hello"). */
export function tr(fr: string, en: string): string {
  if (keepBoth) return fr === en ? fr : OPEN + fr + MID + en + CLOSE;
  return getLang() === "fr" ? fr : en;
}

// Text that is saved (the coach's notes on a session, a block review, an adjustment) keeps both languages, so it
// reads right after the language is switched. While `bilingual()` runs, tr() returns both halves wrapped in
// private-use marks; loc() picks one when the text is shown. Nested pairs (a label inside a sentence) resolve
// from the inside out. Text saved before this, or without pairs, passes through loc() unchanged.
const OPEN = "", MID = "", CLOSE = "";
const PAIR = /([^]*)([^]*)/g;
let keepBoth = false;

/** Run a synchronous generator whose text will be saved; its tr() text keeps both languages. Browser only (tests read English). */
export function bilingual<T>(make: () => T, force = false): T {
  if (keepBoth || (typeof window === "undefined" && !force)) return make();
  keepBoth = true;
  try { return make(); } finally { keepBoth = false; }
}

/** Saved text in the language shown now (or the one asked for). */
export function loc(text: string, lang?: Lang): string;
export function loc(text: string | undefined, lang?: Lang): string | undefined;
export function loc(text: string | undefined, lang: Lang = getLang()): string | undefined {
  if (!text || !text.includes(OPEN)) return text;
  let s = text, prev;
  do { prev = s; s = s.replace(PAIR, (_, fr: string, en: string) => (lang === "fr" ? fr : en)); } while (s !== prev);
  return s.replace(/[-]/g, "");
}

/** The locale for dates and numbers. */
export function locale(): string {
  return getLang() === "fr" ? "fr-CA" : "en-US";
}
