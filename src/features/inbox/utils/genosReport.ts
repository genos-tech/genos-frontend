/**
 * The Genos report (inbox `item_type` 10): what a member's own schedule produced.
 *
 * Written by genos-api `schedule_delivery.py` as `item_body = {title, text, sections:
 * [{heading, items: [{text, link?}]}]}`, where `text` is the one-line summary. The server
 * rebuilds the report from a job's output before storing it, but this reads it again as
 * untrusted: a row can predate a rule, and a client that trusts the server's cleaning is a
 * client with one line of defence. Everything is read as plain text, never markdown or
 * HTML, and a link survives only if it is an app path or an https URL.
 */

/** `item_type` of a schedule's report. Mirrors `ITEM_TYPE_GENOS_REPORT` in genos-api. */
export const GENOS_REPORT_ITEM_TYPE = 10;

export type GenosReportItem = { text: string; link: string | null };
export type GenosReportSection = { heading: string; items: GenosReportItem[] };
export type GenosReport = { title: string; summary: string; sections: GenosReportSection[] };

// The server's own caps. Applied again here so an oversized or hand-written row cannot
// make the card unbounded.
const MAX_SECTIONS = 12;
const MAX_ITEMS = 30;
const MAX_TEXT = 240;
const MAX_HEADING = 120;
const MAX_LINK = 500;

const APP_PREFIX = "/workspace/";

const asText = (value: unknown, limit: number): string =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";

/** The link when it is an app path (`/workspace/...`, no `..`) or an https URL with a host
 *  and no user-info; otherwise null. A relative path is opened through the app's own
 *  navigation, so one that could leave `/workspace/` is refused. */
export const safeReportLink = (value: unknown): string | null => {
    if (typeof value !== "string" || value === "" || value.length > MAX_LINK) return null;
    // eslint-disable-next-line no-control-regex
    if (/[\s\u0000-\u001f\u007f\\]/.test(value)) return null;
    if (value.startsWith(APP_PREFIX)) {
        const path = value.split(/[?#]/, 1)[0];
        return path.split("/").includes("..") ? null : value;
    }
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
            return null;
        }
        return value;
    } catch {
        return null;
    }
};

export const isInternalReportLink = (link: string): boolean => link.startsWith(APP_PREFIX);

/** The report in an inbox item's body, or null when the body is not a report at all. */
export const parseGenosReport = (itemBody: unknown): GenosReport | null => {
    if (itemBody === null || typeof itemBody !== "object" || Array.isArray(itemBody)) return null;
    const body = itemBody as Record<string, unknown>;
    const rawSections = Array.isArray(body.sections) ? body.sections.slice(0, MAX_SECTIONS) : [];
    const sections: GenosReportSection[] = [];
    for (const raw of rawSections) {
        if (raw === null || typeof raw !== "object") continue;
        const section = raw as Record<string, unknown>;
        const rawItems = Array.isArray(section.items) ? section.items.slice(0, MAX_ITEMS) : [];
        const items: GenosReportItem[] = [];
        for (const entry of rawItems) {
            if (entry === null || typeof entry !== "object") continue;
            const item = entry as Record<string, unknown>;
            const text = asText(item.text, MAX_TEXT);
            if (text) items.push({ text, link: safeReportLink(item.link) });
        }
        if (items.length > 0) {
            sections.push({ heading: asText(section.heading, MAX_HEADING), items });
        }
    }
    return {
        title: asText(body.title, 200),
        summary: asText(body.text, 280),
        sections,
    };
};
