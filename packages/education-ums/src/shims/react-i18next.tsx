import { useState, useEffect, useCallback } from "react";
import i18n from "./i18next";

export const initReactI18next = {
  type: "3rdParty" as const,
  init: () => {},
};

export function useTranslation() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    i18n.on("languageChanged", onChange);
    return () => i18n.off("languageChanged", onChange);
  }, []);

  const t = useCallback(
    (key: string, defaultValueOrOptions?: string | Record<string, unknown>) =>
      i18n.t(key, defaultValueOrOptions),
    []
  );

  return { t, i18n, ready: true };
}

