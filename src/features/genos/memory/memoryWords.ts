import { fmt } from "../../../i18n";
import type { Messages } from "../../../i18n/types";
import type { Suggestion, Why } from "./memoryApi";

type Control = Messages["settings"]["genosMemory"]["control"];

/**
 * A reason in the member's language, from the server's structured `why` (counts per signal, days
 * busy, trend, people). The server's own English sentence (`reasons`) is not used here: the
 * caller falls back to it only when this returns nothing.
 *
 * Every phrase is "label: number" or a plain phrase, never a counted noun, so no language needs
 * a plural form.
 */
export const whyPhrases = (why: Why, w: Control["why"]): string[] => {
    const out: string[] = [];
    const counts = [
        ["others", w.others],
        ["mine", w.mine],
        ["chat", w.chat],
        ["notes", w.notes],
        ["prs", w.prs],
    ] as const;
    for (const [key, template] of counts) {
        const count = why.counts[key] ?? 0;
        if (count > 0) out.push(fmt(template, { count }));
    }
    if (why.days > 0) out.push(fmt(w.days, { days: why.days }));
    if (why.trend === "rising") out.push(w.rising);
    if (why.trend === "cooling") out.push(w.cooling);
    if (why.people > 0) out.push(fmt(w.people, { count: why.people }));
    return out;
};

/** The suggestion's question in the member's language; the server's English only for a kind
 *  this page has no words for. `priority` is the localized priority name. */
export const suggestionText = (s: Suggestion, priority: string, n: Control["noticed"]): string => {
    if (s.kind === "raise_priority") return fmt(n.raise, { priority });
    if (s.kind === "review_priority") return fmt(n.review, { priority });
    return s.text;
};

/** A calendar day (`2026-11-05`) is the same day everywhere; a timestamp is shown in local time. */
export const formatDay = (value: string | null, locale: string): string => {
    if (value === null) return "";
    const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    try {
        return new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            ...(dayOnly ? { timeZone: "UTC" } : {}),
        }).format(new Date(value));
    } catch {
        return value;
    }
};
