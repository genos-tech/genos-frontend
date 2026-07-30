import { en } from "./locales/en";

/**
 * Messages — the canonical, deep-readonly shape of every user-visible string
 * keyed by feature → section → key. Inferred from the English dictionary so
 * adding a new key in `en/*.ts` immediately flows into TypeScript autocompletion
 * everywhere `useTranslation()` is consumed.
 *
 * Non-English locales are typed as `Partial<Messages>` (any depth) so a
 * translator can fill in keys incrementally without a build error; missing keys
 * deep-merge-fall-back to English at runtime.
 */
export type Messages = typeof en;

export type Locale = "en" | "ja" | "es" | "fr" | "zh" | "ar" | "hi";

/**
 * Locales rendered right-to-left. Currently only Arabic; Hebrew/Farsi/Urdu
 * would join this set when added.
 */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar"]);

/** Value for `<html dir>` under a given locale. */
export type Direction = "ltr" | "rtl";

/**
 * The document direction a locale renders in.
 *
 * Deliberately a shared function rather than each caller reaching for
 * `RTL_LOCALES` itself: `<html lang>`/`<html dir>` are now written from TWO
 * places — `main.tsx` before React mounts, and `I18nProvider` whenever the
 * user switches language — and the two disagreeing is a silent bug (the
 * document would keep a stale direction for the rest of the session).
 */
export const localeDirection = (locale: Locale): Direction =>
    RTL_LOCALES.has(locale) ? "rtl" : "ltr";

/**
 * Write the locale onto the document element.
 *
 * `lang` is what screen readers use to pick pronunciation — with the wrong
 * value, every non-English user hears their content read in an English
 * voice — and what `:lang()` selectors and browser translation prompts key
 * off. `dir` drives text direction, `text-align: start`, the flex inline
 * axis, and logical-property CSS.
 */
export const applyDocumentLocale = (locale: Locale): void => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    const dir = localeDirection(locale);
    document.documentElement.dir = dir;
    if (currentDirection !== dir) {
        currentDirection = dir;
        directionListeners.forEach((fn) => fn(dir));
    }
};

/**
 * Direction as a subscribable value, not just a DOM attribute.
 *
 * `ColorThemeProvider` needs it, and that provider sits ABOVE `I18nProvider`
 * in the tree (it renders `CssVarsProvider`, which everything below depends
 * on), so it cannot call `useTranslation()`. Reading
 * `document.documentElement.dir` would work but wouldn't re-render on a
 * language switch.
 *
 * This module is already the single place that writes the attribute, so it
 * is the natural place to announce the change too.
 */
let currentDirection: Direction = "ltr";
const directionListeners = new Set<(dir: Direction) => void>();

/** The direction as last written by `applyDocumentLocale`. */
export const getDocumentDirection = (): Direction => currentDirection;

/** Subscribe to direction changes; returns an unsubscribe. */
export const subscribeDocumentDirection = (fn: (dir: Direction) => void): (() => void) => {
    directionListeners.add(fn);
    return () => {
        directionListeners.delete(fn);
    };
};

export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] extends string ? string : T[K];
};

/**
 * Recursively merge `overrides` onto `base`. Used to layer a partial non-English
 * dictionary on top of the complete English dictionary so missing keys fall
 * back to English without throwing. Returns a new object; inputs are not
 * mutated. Arrays are replaced wholesale rather than merged.
 */
export const deepMerge = <T extends Record<string, unknown>>(
    base: T,
    overrides: DeepPartial<T> | undefined | null
): T => {
    if (!overrides) return base;
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(overrides)) {
        const baseVal = (base as Record<string, unknown>)[key];
        const overrideVal = (overrides as Record<string, unknown>)[key];
        if (
            baseVal &&
            typeof baseVal === "object" &&
            !Array.isArray(baseVal) &&
            overrideVal &&
            typeof overrideVal === "object" &&
            !Array.isArray(overrideVal)
        ) {
            out[key] = deepMerge(
                baseVal as Record<string, unknown>,
                overrideVal as DeepPartial<Record<string, unknown>>
            );
        } else if (overrideVal !== undefined) {
            out[key] = overrideVal;
        }
    }
    return out as T;
};
