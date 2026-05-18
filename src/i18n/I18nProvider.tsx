import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { en } from "./locales/en";
import { ja } from "./locales/ja";
import { deepMerge, Locale, Messages } from "./types";

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
 */

const STORAGE_KEY = "weikiy-locale";

const readInitialLocale = (): Locale => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ja") return stored;
    if (typeof navigator !== "undefined" && navigator.language.startsWith("ja")) return "ja";
    return "en";
};

interface I18nContextValue {
    t: Messages;
    locale: Locale;
    setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
    const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

    const t = useMemo<Messages>(
        () => (locale === "en" ? en : deepMerge(en, ja)),
        [locale]
    );

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, l);
        }
    }, []);

    // Reflect the locale on <html lang> so screen readers and any assistive
    // tech that keys off lang attribute pick it up. Cheap, no-cost win.
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.lang = locale;
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
