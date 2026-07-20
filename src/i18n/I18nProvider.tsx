import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { getLoadedMessages, loadLocale } from "./localeLoaders";
import { en } from "./locales/en";
import { persistLocale, resolveInitialLocale } from "./localeSource";
import { Locale, Messages, RTL_LOCALES } from "./types";

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
 * standalone `getMessages()` helper.
 *
 * Non-English dictionaries are `DeepPartial<Messages>` — missing keys
 * deep-merge-fall-back to the English value so translators can ship
 * incrementally without breaking the build. They are also lazy-loaded
 * (`localeLoaders.ts`); main.tsx awaits the initial one before mounting, so
 * the first render already has the right catalog and no user sees English
 * flash past.
 */

interface I18nContextValue {
    t: Messages;
    locale: Locale;
    setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
    const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);
    // Seeded from the cache, which main.tsx's boot gate has already filled
    // for the initial locale. The effect below covers the paths the gate
    // can't: a provider mounted under a locale that was never booted (the
    // marketing pages mount their own provider), or a failed initial load.
    const [t, setT] = useState<Messages>(() => getLoadedMessages(locale));

    useEffect(() => {
        let alive = true;
        void loadLocale(locale).then((messages) => {
            if (alive) setT(messages);
        });
        return () => {
            alive = false;
        };
    }, [locale]);

    // Load BEFORE committing the switch so `locale` and `t` flip together.
    // Setting the locale first would render the new language's direction and
    // <html lang> against the old language's strings for a frame or two.
    // Already-loaded locales resolve from cache in a microtask, so switching
    // back to a previously used language stays instant.
    const setLocale = useCallback((l: Locale) => {
        void loadLocale(l).then((messages) => {
            setT(messages);
            setLocaleState(l);
            persistLocale(l);
        });
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
