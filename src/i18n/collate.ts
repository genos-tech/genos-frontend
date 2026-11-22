import { isLocale, resolveInitialLocale } from "./localeSource";
import type { Locale } from "./types";

// Name sorting follows the app's language, not the browser's (MIP-1812).
//
// `a.localeCompare(b)` and `a.localeCompare(b, undefined, ...)` order by the BROWSER's
// language, so a Japanese app on an English browser sorted kana and kanji by English
// rules (and the reverse). One cached `Intl.Collator` per locale and sensitivity, and one
// comparator everything uses. The locale codes are valid `Intl` tags.
//
// Not numeric: the sites this replaced did not sort "item 10" after "item 2" either, and
// the order users see in `en` must not change. `sensitivity: "variant"` is the old bare
// `localeCompare`; `"base"` (case and accents ignored) is the old `{ sensitivity: "base" }`.
export type CollateSensitivity = "variant" | "base";

const COLLATORS = new Map<string, Intl.Collator>();

export const getCollator = (
    locale: Locale,
    sensitivity: CollateSensitivity = "variant"
): Intl.Collator => {
    const key = `${locale}|${sensitivity}`;
    let collator = COLLATORS.get(key);
    if (!collator) {
        collator = new Intl.Collator(locale, { sensitivity });
        COLLATORS.set(key, collator);
    }
    return collator;
};

// The app's locale as `I18nProvider` last rendered it. Written DURING render (MIP-1899), like the
// plural locale: `<html lang>` is only written in an effect, after the render a language switch
// triggers, so a sort computed in that render would still use the old language.
let renderedLocale: Locale | null = null;

export const setAppLocale = (locale: Locale): void => {
    renderedLocale = locale;
};

/**
 * The app's current locale for code that is not a React component. `I18nProvider` publishes it
 * during render (`setAppLocale`); before that (tests, first paint) it is `<html lang>` (written
 * by `applyDocumentLocale` at boot), then the stored or browser choice.
 */
export const currentAppLocale = (): Locale => {
    if (renderedLocale) return renderedLocale;
    if (typeof document !== "undefined") {
        const lang = document.documentElement.lang;
        if (isLocale(lang)) return lang;
    }
    return resolveInitialLocale();
};

/**
 * Compare two names in the app's language. Pass `locale` from `useTranslation()` when the
 * caller is a component (and list it in the memo's dependencies so a language switch
 * re-sorts); pure helpers may leave it out and read the document's current locale.
 */
export const compareText = (
    a: string,
    b: string,
    options: { locale?: Locale; sensitivity?: CollateSensitivity } = {}
): number => getCollator(options.locale ?? currentAppLocale(), options.sensitivity).compare(a, b);
