import { fmt } from "../../../../i18n";

/**
 * A filter of the bar: the field and what is chosen, never cut to "Stat..." (the
 * bar scrolls sideways instead of clipping). Only a filter that is narrowing the list carries
 * the accent (MIP-1123; the design page's `FilterChip` is the reference).
 *
 * The field name comes from the locale's "Status: {value}" template, so it stays
 * translated and the value stays the caller's.
 */
export const splitFilterLabel = (template: string, value: string) => {
    const MARK = "\u0000";
    const [before = "", after = ""] = fmt(template, { value: MARK }).split(MARK);
    return {
        field: before.replace(/[:\uFF1A]\s*$/, "").trim(),
        value,
        suffix: after.trim(),
    };
};
