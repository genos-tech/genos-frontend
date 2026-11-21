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

/**
 * The app's current locale for code that is not a React component. `applyDocumentLocale`
 * writes it onto `<html lang>` at boot and on every language switch; a page that has not
 * set it yet (tests, first paint) falls back to the stored or browser choice.
 */
export const currentAppLocale = (): Locale => {
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
