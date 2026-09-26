import { useCallback, useState } from "react";

import { persistLocale, resolveInitialLocale } from "../i18n/localeSource";

/**
 * The two languages the marketing pages are written in — a deliberate subset
 * of the app's seven `Locale`s, since only these have hand-written LP copy.
 */
export type Lang = "ja" | "en";

/**
 * Imported from `../i18n/localeSource` rather than the `../i18n` barrel
 * because the barrel's `I18nProvider` is a React context these pages never
 * mount — they hold their own `copy` tables. Only the resolution *rule* is
 * shared. (This is not a bundle-size win: the marketing chunks already
 * import the chunk that catalog lives in.)
 */
const appLocale = (): string => {
    try {
        return resolveInitialLocale();
    } catch {
        // `resolveInitialLocale` reads localStorage, which throws outright in
        // some privacy modes. A marketing page must not blank over that.
        return "en";
    }
};

/**
 * Which language to open a marketing page in.
 *
 * Previously hardcoded `"en"`, so a Japanese visitor landed on English copy
 * and had to find the toggle — on the pages whose entire job is a first
 * impression, and for the market the Japanese copy was written for.
 *
 * Deliberately derived from the app's own resolver instead of reading
 * `navigator.language` here, so the LP honours the same precedence as
 * everything else (a stored choice, then `?lang=`, then the browser). That
 * also makes `/home?lang=ja` a shareable Japanese landing page for free.
 *
 * Locales with no LP copy (`fr`, `zh`, …) narrow to English. That narrowing
 * is why `appHref` below is careful about when it emits a param.
 */
const initialLang = (): Lang => (appLocale() === "ja" ? "ja" : "en");

/**
 * Language state for a marketing page, plus the app links that carry it.
 *
 * The toggle used to be a dead end: every CTA is `<a href={APP_URL}>`, so a
 * visitor who switched to 日本語 and clicked through got an app — and a seeded
 * demo workspace — in whatever language the app re-derived on its own. The
 * click now travels by two routes, deliberately, because neither covers every
 * deployment on its own:
 *
 *  - `persistLocale` writes it to storage, which is what decides the language
 *    when the LP and the app share an origin (they do when `/home` is a route
 *    in this same SPA). A stored choice outranks `?lang=` in
 *    `resolveInitialLocale`, and should — using the toggle is a preference;
 *  - `?lang=` puts it in the URL, which is what carries it when `APP_URL`
 *    points at a different host than the page the visitor is on, and which
 *    also makes the link shareable.
 *
 * `touched` is the subtle half. The param is only appended once the visitor
 * has actually used the toggle, because `Lang` is narrower than `Locale`: a
 * French browser resolves to `en` *as a fallback* here, and emitting
 * `?lang=en` would persist English over the French the app would otherwise
 * have chosen — a regression for exactly the multilingual visitors this
 * feature is meant to serve. An untouched toggle states no preference, so it
 * stays out of the URL and the app's own resolution keeps running.
 */
export const useLpLang = (): {
    lang: Lang;
    setLang: (next: Lang) => void;
    appHref: (base: string) => string;
} => {
    const [lang, setLangState] = useState<Lang>(initialLang);
    const [touched, setTouched] = useState(false);

    const setLang = useCallback((next: Lang) => {
        setLangState(next);
        setTouched(true);
        try {
            // `Lang` is a subset of `Locale`, so this needs no validation.
            persistLocale(next);
        } catch {
            // Storage unavailable. The `?lang=` on every CTA still carries
            // the choice into the app, so the handoff degrades rather than
            // breaking — it just won't outlive the tab.
        }
    }, []);

    const appHref = useCallback(
        (base: string) => {
            if (!touched) return base;
            return `${base}${base.includes("?") ? "&" : "?"}lang=${lang}`;
        },
        [touched, lang]
    );

    return { lang, setLang, appHref };
};
