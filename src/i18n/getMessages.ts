import { en } from "./locales/en";
import { ja } from "./locales/ja";
import { deepMerge, Locale, Messages } from "./types";

const STORAGE_KEY = "weikiy-locale";

const readStoredLocale = (): Locale => {
    if (typeof window === "undefined") return "en";
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "ja" ? v : "en";
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
    if (resolved === "ja") return deepMerge(en, ja);
    return en;
};
