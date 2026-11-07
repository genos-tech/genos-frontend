/**
 * The CSS Emotion generated for an element, as text.
 *
 * jsdom's `getComputedStyle` drops `var(--g-…)` values and ignores `@media`
 * rules, so a test that wants to know "does this dialog carry a gradient"
 * reads the rules that match the element's own classes instead.
 */
export const cssOf = (el: Element): string => {
    // Emotion classes are `<cache key>-<hash>`: `css-…`, or `…-rtl-…` for the RTL cache.
    const classes = [...el.classList].filter((c) => !/^(Mui|Joy|base)/.test(c));
    const out: string[] = [];
    const visit = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
            const selector = (rule as CSSStyleRule).selectorText;
            if (selector && classes.some((c) => selector.includes(`.${c}`))) {
                out.push(rule.cssText);
            }
            const nested = (rule as CSSGroupingRule).cssRules;
            if (nested) visit(nested);
        }
    };
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            visit(sheet.cssRules);
        } catch {
            // A cross-origin sheet; none in tests.
        }
    }
    return out.join("\n");
};
