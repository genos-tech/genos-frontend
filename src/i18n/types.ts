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
