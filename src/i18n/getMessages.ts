import { ar } from "./locales/ar";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { hi } from "./locales/hi";
import { ja } from "./locales/ja";
import { zh } from "./locales/zh";
import { deepMerge, Locale, Messages } from "./types";

const STORAGE_KEY = "genos-locale";

const readStoredLocale = (): Locale => {
    if (typeof window === "undefined") return "en";
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (
        v === "en" ||
        v === "ja" ||
        v === "es" ||
        v === "fr" ||
        v === "zh" ||
        v === "ar" ||
        v === "hi"
    ) {
        return v;
    }
    return "en";
};

/**
 * Non-React accessor for the current locale's message catalog. Use this in
 * service-layer code where `useTranslation()` is unavailable — `agentApi.ts`,
 * websocket handlers, notification routers, anywhere outside React render.
 *
 * Reads localStorage on each call. That's fine for error-message use cases
 * (called rarely, on failure paths) and keeps this helper free of React
 * coupling so it can be invoked from anywhere — including module-level code.
 */
export const getMessages = (locale?: Locale): Messages => {
    const resolved = locale ?? readStoredLocale();
    switch (resolved) {
        case "ja":
            return deepMerge(en, ja);
        case "es":
            return deepMerge(en, es);
        case "fr":
            return deepMerge(en, fr);
        case "zh":
            return deepMerge(en, zh);
        case "ar":
            return deepMerge(en, ar);
        case "hi":
            return deepMerge(en, hi);
        default:
            return en;
    }
};
