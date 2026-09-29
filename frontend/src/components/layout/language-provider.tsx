"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations, type Language, type TranslationKey } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    try {
      const savedLanguage = window.localStorage.getItem("nexa-language");
      if (savedLanguage === "en" || savedLanguage === "id") {
        setLanguage(savedLanguage);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSetLanguage = (newLang: Language) => {
    setLanguage(newLang);
    try {
      window.localStorage.setItem("nexa-language", newLang);
      document.documentElement.lang = newLang === "id" ? "id" : "en";
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = language === "id" ? "id" : "en";
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage: handleSetLanguage,
    t: (key: TranslationKey, values: Record<string, string | number> = {}) => {
      const template = translations[language]?.[key] ?? translations.en[key] ?? key;
      return Object.entries(values).reduce(
        (text, [name, replacement]) => text.replace(`{${name}}`, String(replacement)),
        String(template),
      );
    },
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
