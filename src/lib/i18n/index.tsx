import React, { createContext, useContext, useEffect, useState } from "react";
import en from "./en.json";
import pt from "./pt.json";

type Locale = "en" | "pt";
type Messages = Record<string, string>;

const catalogs: Record<Locale, Messages> = { en, pt };

const STORAGE_KEY = "airlock:locale";

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === "en" || saved === "pt") return saved;
  } catch {}
  return "en";
}

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: (key: string) => string }>({
  locale: "en",
  setLocale: () => {},
  t: (k) => k,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key: string) => {
    const msg = catalogs[locale][key];
    if (msg) return msg;
    const fallback = catalogs.en[key];
    if (fallback) {
      if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) console.warn(`Missing PT key: ${key}, falling back to EN`);
      return fallback;
    }
    return key;
  };

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useT() {
  return useContext(LocaleContext).t;
}

export function useLocale() {
  return useContext(LocaleContext);
}
