import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { ar } from "./locales/ar";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { hi } from "./locales/hi";
import { ja } from "./locales/ja";
import { zh } from "./locales/zh";
import { deepMerge, DeepPartial, Locale, Messages, RTL_LOCALES } from "./types";

/**
 * Centralized i18n layer. Mirrors the manual `ja` / `en` `Copy` pattern that
 * already exists in `src/lp/LandingPage.tsx`, but lifts it app-wide as a typed
 * context.
 *
 * Consumers call `useTranslation()` and access strings via nested-object
 * notation (`t.tasks.modal.deleteTitle`) — full TypeScript autocompletion,
 * refactor-safe, dead-code-detectable. Path-string lookups are intentionally
 * NOT supported; they would defeat the type system.
 *
 * For non-React contexts (service errors, websocket handlers) use the
 * standalone `getMessages()` helper which reads localStorage directly.
 *
 * Non-English dictionaries are `DeepPartial<Messages>` — missing keys
 * deep-merge-fall-back to the English value so translators can ship
 * incrementally without breaking the build.
 */

const STORAGE_KEY = "genos-locale";

const NON_EN_DICTIONARIES: Record<Exclude<Locale, "en">, DeepPartial<Messages>> = {
    ja,
    es,
    fr,
    zh,
    ar,
    hi,
};

const isLocale = (v: string | null): v is Locale =>
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

const readInitialLocale = (): Locale => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
    return navigatorLocale();
};

interface I18nContextValue {
    t: Messages;
    locale: Locale;
    setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
    const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

    const t = useMemo<Messages>(() => {
        if (locale === "en") return en;
        return deepMerge(en, NON_EN_DICTIONARIES[locale]);
    }, [locale]);

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, l);
        }
    }, []);

    // Reflect the locale on <html lang> + <html dir> so screen readers,
    // logical-property CSS (margin-inline-start etc.), and any assistive
    // tech keying off these attributes pick up the change. Arabic flips
    // the document to RTL; everything else stays LTR.
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.lang = locale;
            document.documentElement.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
        }
    }, [locale]);

    return (
        <I18nContext.Provider value={{ t, locale, setLocale }}>{children}</I18nContext.Provider>
    );
};

export const useTranslation = (): I18nContextValue => {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        // Provider not mounted (e.g. consumed before App tree, or in a stripped
        // test render). Return a stable English stub so callers don't crash.
        return { t: en, locale: "en", setLocale: () => {} };
    }
    return ctx;
};
