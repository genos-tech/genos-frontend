import { Locale } from "./types";

// Where the app's locale comes from, in one place.
//
// This used to be duplicated: I18nProvider resolved stored-then-navigator,
// getMessages() resolved stored-only. They disagreed for a user who had
// never picked a locale but whose browser is set to, say, Japanese — the
// UI rendered Japanese while service-layer error strings came back
// English. Sharing one resolver removes that split.

export const LOCALE_STORAGE_KEY = "genos-locale";

export const isLocale = (v: string | null): v is Locale =>
    v === "en" || v === "ja" || v === "es" || v === "fr" || v === "zh" || v === "ar" || v === "hi";

const navigatorLocale = (): Locale => {
    if (typeof navigator === "undefined") return "en";
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith("ja")) return "ja";
    if (lang.startsWith("es")) return "es";
    if (lang.startsWith("fr")) return "fr";
    if (lang.startsWith("zh")) return "zh";
    if (lang.startsWith("ar")) return "ar";
    if (lang.startsWith("hi")) return "hi";
    return "en";
};

/** The locale the app should start in: an explicit stored choice wins,
 *  otherwise the browser's language, otherwise English. */
export const resolveInitialLocale = (): Locale => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
    return navigatorLocale();
};

export const persistLocale = (locale: Locale): void => {
    if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
};
