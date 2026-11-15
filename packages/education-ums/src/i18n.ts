import i18n from './shims/i18next';
import { initReactI18next } from './shims/react-i18next';
import LanguageDetector from './shims/i18next';
import HttpBackend from './shims/i18next';

i18n
  .use(HttpBackend) // Load translations from /public/locales
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    fallbackLng: 'en',
    debug: false,
    
    // Whitelist supported languages
    supportedLngs: ['en', 'en-US', 'en-GB', 'sw', 'es', 'fr', 'ar'],
    
    interpolation: {
      // React handles XSS escaping in JSX expressions, so i18next double-escaping
      // is unnecessary and would render HTML entities literally. Keep false.
      escapeValue: false,
    },
    
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },

    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
    }
  });

export default i18n;









