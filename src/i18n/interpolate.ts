/**
 * Minimal string formatter used by `useTranslation()` call sites that need to
 * insert dynamic values into a static template.
 *
 * Supports two forms, both compatible with the ICU MessageFormat subset:
 *
 * 1. Named placeholders:   "Welcome, {name}!"             → fmt(t, { name })
 * 2. One/other plurals:    "{count, plural, one {# task} other {# tasks}}"
 *
 * A plural may sit ANYWHERE in the sentence, and there may be more than one:
 * "{count} {count, plural, one {member} other {members}} selected" works. That
 * used to be the whole bug — the pattern was anchored to the entire template,
 * so an embedded plural matched nothing, fell through to the placeholder pass,
 * and every `{one}` / `{other}` body inside it read as an unknown variable and
 * resolved to "". Three member-count lines shipped reading
 * "3 {count, plural, one {} other {}} selected" in all seven locales.
 *
 * A plural with only `one`/`other` keeps the original rule (`n === 1` is "one") in
 * EVERY locale, so en/ja/zh/es/fr/hi output is byte-identical to before. A plural that
 * names any other CLDR category (`zero`, `two`, `few`, `many`) is resolved with
 * `Intl.PluralRules` for the active locale (MIP-1806: Arabic says "دقيقتين" for 2,
 * "دقائق" for 3 to 10 and the singular noun for 11 to 99). The bodies stay valid ICU
 * syntax, so a later swap to `@formatjs/intl-messageformat` is still a drop-in.
 *
 * The active locale is module state, written by `I18nProvider` (`setPluralLocale`),
 * because `fmt` is called from ~hundreds of places that do not hold the locale; a
 * caller that does can pass it as the third argument.
 *
 * Unknown variables resolve to an empty string rather than throwing, matching
 * how missing keys behave (graceful degradation over hard crash).
 */

// A plural is `{key, plural, cat {body} cat {body} ...}`. Bodies are `[^{}]*` (no
// nesting), which keeps this honest: a message that needs more has outgrown this
// formatter and should move to a real MessageFormat.
const PLURAL = /\{(\w+),\s*plural,\s*((?:\w+\s*\{[^{}]*\}\s*)+)\}/g;
const BRANCH = /(\w+)\s*\{([^{}]*)\}/g;

let pluralLocale = "en";

/** The locale `fmt` uses for plurals that name more than one/other. */
export const setPluralLocale = (locale: string): void => {
    pluralLocale = locale;
};

const selectors = new Map<string, Intl.PluralRules>();
const categoryOf = (locale: string, n: number): string => {
    let rules = selectors.get(locale);
    if (!rules) {
        try {
            rules = new Intl.PluralRules(locale);
        } catch {
            rules = new Intl.PluralRules("en");
        }
        selectors.set(locale, rules);
    }
    return rules.select(n);
};

export const fmt = (
    template: string,
    vars: Record<string, string | number>,
    locale: string = pluralLocale
): string => {
    const withPlurals = template.replace(PLURAL, (_, key: string, branches: string) => {
        const n = Number(vars[key] ?? 0);
        const bodies: Record<string, string> = {};
        for (const m of branches.matchAll(BRANCH)) bodies[m[1]] = m[2];
        const simple = Object.keys(bodies).every((c) => c === "one" || c === "other");
        const category = simple ? (n === 1 ? "one" : "other") : categoryOf(locale, n);
        return (bodies[category] ?? bodies.other ?? "").replace(/#/g, String(n));
    });
    return withPlurals.replace(/\{(\w+)\}/g, (_, k: string) =>
        vars[k] === undefined ? "" : String(vars[k])
    );
};
