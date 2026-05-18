/**
 * Minimal string formatter used by `useTranslation()` call sites that need to
 * insert dynamic values into a static template.
 *
 * Supports two forms, both compatible with the ICU MessageFormat subset:
 *
 * 1. Named placeholders:   "Welcome, {name}!"             → fmt(t, { name })
 * 2. One/other plurals:    "{count, plural, one {# task} other {# tasks}}"
 *
 * The plural form is intentionally limited to `one`/`other` (English / Japanese
 * works fine, and we keep the bodies in valid ICU syntax so a future swap to
 * `@formatjs/intl-messageformat` is a drop-in upgrade — no message rewrite).
 *
 * Unknown variables resolve to an empty string rather than throwing, matching
 * how missing keys behave (graceful degradation over hard crash).
 */
export const fmt = (template: string, vars: Record<string, string | number>): string => {
    const plural = template.match(/^\{(\w+),\s*plural,\s*one\s*\{(.+?)\}\s*other\s*\{(.+?)\}\}$/);
    if (plural) {
        const [, key, one, other] = plural;
        const n = Number(vars[key] ?? 0);
        const branch = n === 1 ? one : other;
        return branch.replace(/#/g, String(n));
    }
    return template.replace(/\{(\w+)\}/g, (_, k: string) =>
        vars[k] === undefined ? "" : String(vars[k])
    );
};
