import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { TRANSLATIONS } from "./translations";

export type Lang = "en" | "hi" | "mr";

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "mr", label: "मराठी" },
  { value: "hi", label: "हिन्दी" },
];

const STORAGE_KEY = "jalsetu_lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Look up a translation for `key` (the English UI string). Falls back to
   * the key itself when a translation is missing, so untranslated strings
   * still render in English instead of breaking. */
  t: (key: string) => string;
  /** Like `t`, but substitutes `{name}`-style placeholders after lookup. */
  tf: (key: string, vars: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "hi" || saved === "mr") return saved;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to default.
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const value = useMemo<LanguageContextValue>(() => {
    const setLang = (next: Lang) => {
      setLangState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore write failures — language just won't persist this session
      }
    };
    const t = (key: string): string => TRANSLATIONS[lang]?.[key] ?? key;
    const tf = (key: string, vars: Record<string, string | number>): string => {
      let out = t(key);
      for (const [name, val] of Object.entries(vars)) {
        out = out.split(`{${name}}`).join(String(val));
      }
      return out;
    };
    return { lang, setLang, t, tf };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
