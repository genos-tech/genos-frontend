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

/**
 * Like `cssOf`, but a rule inside an `@media` block keeps its condition, so a test can tell
 * a rule that is always on from one that only applies on a touch screen:
 * `@media (pointer: coarse) { .css-… { min-width: 44px } }`.
 */
export const cssWithMediaOf = (el: Element): string => {
    const classes = [...el.classList].filter((c) => !/^(Mui|Joy|base)/.test(c));
    const out: string[] = [];
    const visit = (rules: CSSRuleList, media: string) => {
        for (const rule of Array.from(rules)) {
            const selector = (rule as CSSStyleRule).selectorText;
            if (selector && classes.some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(selector))) {
                out.push(media ? `@media ${media} { ${rule.cssText} }` : rule.cssText);
            }
            const nested = (rule as CSSGroupingRule).cssRules;
            if (nested) {
                const condition = (rule as CSSMediaRule).conditionText;
                visit(nested, condition ? `${media} ${condition}`.trim() : media);
            }
        }
    };
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            visit(sheet.cssRules, "");
        } catch {
            // A cross-origin sheet; none in tests.
        }
    }
    return out.join("\n");
};
