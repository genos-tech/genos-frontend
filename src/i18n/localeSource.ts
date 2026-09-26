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

export const persistLocale = (locale: Locale): void => {
    if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
};

/**
 * A `?lang=` handed over from a marketing page, promoted to the stored
 * choice so later reads don't depend on the URL.
 *
 * The landing pages open the app with `target="_blank"`, so no in-memory
 * state survives the hop — the visitor's 日本語/EN click has to travel in the
 * URL. Treating it as an *explicit* choice (writing it to storage) is
 * deliberate: someone who clicked a language toggle has stated a preference
 * at least as firmly as their browser's `Accept-Language`.
 *
 * Promoting is what makes the handoff actually stick, because the param is
 * short-lived in two ways. `resolveInitialLocale` is called well after boot
 * (`getMessages()` reaches it on service-layer error paths), and — verified
 * in a browser — landing on `/` redirects to `/signin` via
 * `window.location.assign`, which drops the query string entirely. Reading
 * the param without persisting it would therefore lose `/?lang=ja` before
 * the sign-in page ever rendered.
 */
const langParamLocale = (): Locale | null => {
    let requested: string | null = null;
    try {
        requested = new URLSearchParams(window.location.search).get("lang");
    } catch {
        // A malformed query string must never keep the app from booting.
        return null;
    }
    if (!isLocale(requested)) return null;
    try {
        persistLocale(requested);
    } catch {
        // Storage can be unavailable (private mode, blocked site data).
        // The handoff still applies to THIS page load; it just won't
        // outlive it — which is the same deal every other preference gets
        // in that browser.
    }
    return requested;
};

/** The locale the app should start in: an explicit stored choice wins, then
 *  a `?lang=` handoff, then the browser's language, otherwise English. */
export const resolveInitialLocale = (): Locale => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
    // Below the stored check, so a `?lang=` link can never override a
    // choice the visitor has already made inside the app.
    return langParamLocale() ?? navigatorLocale();
};
