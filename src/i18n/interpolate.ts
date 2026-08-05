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
 * The plural form is intentionally limited to `one`/`other` (English / Japanese
 * works fine, and we keep the bodies in valid ICU syntax so a future swap to
 * `@formatjs/intl-messageformat` is a drop-in upgrade — no message rewrite).
 *
 * Unknown variables resolve to an empty string rather than throwing, matching
 * how missing keys behave (graceful degradation over hard crash).
 */

// Bodies are `[^{}]*` — no nesting — which is what keeps this honest: a
// message that needs more than one/other has outgrown this formatter and
// should move to a real MessageFormat rather than be coaxed through here.
const PLURAL = /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\}/g;

export const fmt = (template: string, vars: Record<string, string | number>): string => {
    const withPlurals = template.replace(PLURAL, (_, key: string, one: string, other: string) => {
        const n = Number(vars[key] ?? 0);
        return (n === 1 ? one : other).replace(/#/g, String(n));
    });
    return withPlurals.replace(/\{(\w+)\}/g, (_, k: string) =>
        vars[k] === undefined ? "" : String(vars[k])
    );
};
