import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { setAppLocale } from "./collate";
import { I18nContext } from "./i18nContext";
import { setPluralLocale } from "./interpolate";
import { getLoadedMessages, loadLocale } from "./localeLoaders";
import { persistLocale, resolveInitialLocale } from "./localeSource";
import { applyDocumentLocale, Locale, Messages } from "./types";

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
    //
    // `main.tsx` does the same thing once BEFORE React mounts (the static
    // `index.html` ships `lang="en"`), so both call the same helper — if
    // they ever disagreed the document would keep whichever ran last.
    useEffect(() => {
        applyDocumentLocale(locale);
    }, [locale]);

    // Memoized: a fresh `{ t, locale, setLocale }` on every render re-rendered
    // every consumer whenever this provider's parent did, and the top of each
    // screen reads it (MIP-958).
    // `fmt` reads plural rules from this (MIP-1806). Written during render so a child
    // formats with the locale it was rendered under; the write is idempotent.
    setPluralLocale(locale);
    setAppLocale(locale);

    const value = useMemo(() => ({ t, locale, setLocale }), [t, locale, setLocale]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
