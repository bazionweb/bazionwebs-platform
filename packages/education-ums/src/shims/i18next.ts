const DEFAULT_TRANSLATIONS: Record<string, string> = {
  dashboard: "Dashboard",
  student_portal: "Student Portal",
  faculty_portal: "Faculty Portal",
  finance: "Finance",
  settings: "Settings",
  logout: "Logout",
  notifications: "Notifications",
  search_placeholder: "Search anything...",
  welcome: "Welcome back, {{name}}",
};

let currentDict: Record<string, string> = { ...DEFAULT_TRANSLATIONS };
let currentLanguage = "en";
const listeners = new Set<() => void>();

function formatValue(template: string, opts?: Record<string, unknown>): string {
  if (!opts) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(opts[k] ?? ""));
}

const i18n = {
  language: currentLanguage,
  use(_plugin: unknown) {
    return i18n;
  },
  async init(config?: any) {
    currentLanguage = config?.fallbackLng ?? "en";
    i18n.language = currentLanguage;
    if (typeof window !== "undefined" && typeof fetch === "function") {
      try {
        const path = (config?.backend?.loadPath ?? "/locales/{{lng}}/translation.json").replace(
          "{{lng}}",
          currentLanguage
        );
        const res = await fetch(path);
        if (res.ok) {
          const json = (await res.json()) as Record<string, string>;
          currentDict = { ...DEFAULT_TRANSLATIONS, ...json };
          listeners.forEach((l) => l());
        }
      } catch {
        // Ignore network/SSR locale fetch failure and use built-in English defaults.
      }
    }
    return i18n;
  },
  t(key: string, defaultValueOrOptions?: string | Record<string, unknown>): string {
    const opts = typeof defaultValueOrOptions === "object" ? defaultValueOrOptions : undefined;
    const raw =
      currentDict[key] ??
      (typeof defaultValueOrOptions === "string"
        ? defaultValueOrOptions
        : typeof opts?.defaultValue === "string"
          ? opts.defaultValue
          : key.replace(/[_.-]/g, " "));
    return formatValue(raw, opts);
  },
  async changeLanguage(lng: string) {
    currentLanguage = lng || "en";
    i18n.language = currentLanguage;
    if (typeof window !== "undefined" && typeof fetch === "function") {
      try {
        const res = await fetch(`/locales/${encodeURIComponent(currentLanguage)}/translation.json`);
        if (res.ok) {
          const json = (await res.json()) as Record<string, string>;
          currentDict = { ...DEFAULT_TRANSLATIONS, ...json };
        }
      } catch {
        // Keep current translations.
      }
    }
    listeners.forEach((l) => l());
    return i18n.t;
  },
  on(event: string, listener: () => void) {
    if (event === "languageChanged") listeners.add(listener);
  },
  off(event: string, listener: () => void) {
    if (event === "languageChanged") listeners.delete(listener);
  },
};

export const LanguageDetector = {};
export const HttpBackend = {};
export default i18n;

