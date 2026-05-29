"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CHANGE_EVENT,
  normalizeLanguage,
  type Language,
} from "@/lib/language";

const readDocumentLanguage = () => {
  if (typeof document === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  return normalizeLanguage(document.documentElement.lang.slice(0, 2));
};

export function useDocumentLanguage(initialLanguage?: Language) {
  const [language, setLanguage] = useState<Language>(
    initialLanguage ?? readDocumentLanguage(),
  );

  useEffect(() => {
    const updateLanguage = () => setLanguage(readDocumentLanguage());

    updateLanguage();
    window.addEventListener(LANGUAGE_CHANGE_EVENT, updateLanguage);
    document.addEventListener("visibilitychange", updateLanguage);

    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, updateLanguage);
      document.removeEventListener("visibilitychange", updateLanguage);
    };
  }, []);

  return language;
}

