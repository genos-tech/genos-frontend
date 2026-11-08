/**
 * The typed Genos report (inbox `item_type` 10, body `version: 2`, MIP-1208).
 *
 * genos-api stores `{version: 2, title, text, stats?, sections: [{heading, key?, emoji?,
 * items: [{text, link?, kind?, project?, display_id?, title?, status?, priority?, due_date?,
 * overdue_days?, detail?}]}]}`. See genos-docs `operations/SCHEDULER.md`, "The body a card
 * reads". The server whitelists every field, but a stored row can predate a rule and a client
 * that trusts the server's cleaning has one line of defence, so each field is checked again
 * here: a value that fails its check is dropped (the line keeps its `text`), never repaired.
 *
 * Plain text only: nothing here is markdown or HTML, and a link goes through `safeReportLink`.
 * Section order and item order are the server's final word and are not changed here.
 *
 * `parseGenosReport` (the version-less path) is untouched: a body without `version` renders
 * exactly as before.
 */

import { safeReportLink } from "./genosReport";

export const REPORT_KINDS = [
    "task",
    "todo",
    "event",
    "note",
    "chat",
    "request",
    "mention",
    "milestone",
    "project",
    "more",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/** The statuses the server may send (`Deleted` is never one). */
export const REPORT_STATUSES = ["Open", "WIP", "Blocked", "Pending", "Closed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_PRIORITIES = ["Minimal", "Low", "Normal", "High", "Critical"] as const;
export type ReportPriority = (typeof REPORT_PRIORITIES)[number];

export type ReportProject = { id: number; name: string; code: string };

export type ReportItemV2 = {
    text: string;
    link: string | null;
    /** null: the line has no (or an unknown) kind and is drawn as plain text. */
    kind: ReportKind | null;
    project: ReportProject | null;
    displayId: string;
    title: string;
    /** A status the app knows, drawn with its common label. */
    status: ReportStatus | null;
    /** A status string the app does not know: shown as plain text, never styled. */
    statusOther: string;
    priority: ReportPriority | null;
    /** `YYYY-MM-DD`, a real day. */
    dueDate: string | null;
    overdueDays: number | null;
    detail: string;
};

export type ReportStat = { key: string; count: number; emoji: string };

export type ReportSectionV2 = {
    heading: string;
    key: string | null;
    emoji: string;
    items: ReportItemV2[];
};

export type GenosReportV2 = {
    title: string;
    summary: string;
    stats: ReportStat[];
    sections: ReportSectionV2[];
};

// The server's own caps, applied again so a hand-written row cannot make the card unbounded.
const MAX_SECTIONS = 12;
const MAX_ITEMS = 31; // 30 lines and the closing "and N more" line
const MAX_STATS = 8;
const MAX_TEXT = 240;
const MAX_HEADING = 120;
const MAX_PROJECT_NAME = 100;
const MAX_PROJECT_CODE = 6;
const MAX_DISPLAY_ID = 24;
const MAX_COUNT = 99999;
const MAX_OVERDUE_DAYS = 36500;

const KEY_PATTERN = /^[a-z][a-z_]{0,31}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** What the server stamps for each key (`schedule_jobs.EMOJI`). Used when a body's own emoji
 *  is missing or fails the check below; a key not in this table gets no emoji. */
export const REPORT_EMOJI: Readonly<Record<string, string>> = {
    start_with: "🎯",
    overdue: "🔥",
    due_today: "📅",
    todos_today: "✅",
    todos_earlier: "🕘",
    calendar: "🗓️",
    waiting_on_you: "🙋",
    changed: "🔔",
    waiting_on_others: "⏳",
    gone_quiet: "💤",
    tasks: "🛠️",
    notes: "📝",
    todos_done: "☑️",
    messages: "💬",
    looked_at: "👀",
    still_open: "🔓",
    closed: "🎉",
    todos_left: "📌",
    where_it_stands: "📊",
    ready: "🚀",
    blocked: "🚧",
    comments: "💭",
    items: "📋",
};

const own = (o: object, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);

// Cut by code point, not UTF-16 unit, so a cap never splits an emoji or a CJK character in two.
const asText = (value: unknown, limit: number): string =>
    typeof value === "string"
        ? Array.from(value.replace(/\s+/g, " ").trim()).slice(0, limit).join("")
        : "";

const asInt = (value: unknown, min: number, max: number): number | null =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
        ? value
        : null;

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null =>
    typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : null;

/** An emoji and nothing else: pictographs, joiners and variation selectors, a few of them.
 *  A server-supplied "emoji" that is really a word or markup fails this and is replaced by
 *  the table's emoji for the key. */
const EMOJI_PATTERN = /^(?:\p{Extended_Pictographic}|‍|️){1,10}$/u;

const emojiFor = (key: string | null, supplied: unknown): string => {
    if (typeof supplied === "string" && EMOJI_PATTERN.test(supplied)) return supplied;
    return key !== null && own(REPORT_EMOJI, key) ? REPORT_EMOJI[key] : "";
};

const asKey = (value: unknown): string | null =>
    typeof value === "string" && KEY_PATTERN.test(value) ? value : null;

const asDate = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const m = DATE_PATTERN.exec(value);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const probe = new Date(Date.UTC(y, mo - 1, d));
    // A real calendar day: `2026-02-31` rolls over to March and is refused.
    return probe.getUTCFullYear() === y &&
        probe.getUTCMonth() === mo - 1 &&
        probe.getUTCDate() === d
        ? value
        : null;
};

const asProject = (value: unknown): ReportProject | null => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const id = asInt(raw.id, 1, Number.MAX_SAFE_INTEGER);
    const name = asText(raw.name, MAX_PROJECT_NAME);
    if (id === null || name === "") return null;
    return { id, name, code: asText(raw.code, MAX_PROJECT_CODE) };
};

const parseItem = (entry: unknown): ReportItemV2 | null => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return null;
    const raw = entry as Record<string, unknown>;
    const kind = oneOf(REPORT_KINDS, raw.kind);
    const isTask = kind === "task";
    const displayId = isTask ? asText(raw.display_id, MAX_DISPLAY_ID) : "";
    const title = isTask ? asText(raw.title, MAX_TEXT) : "";
    // The line as an older reader shows it; when it is missing a task still has its id and title.
    const text = asText(raw.text, MAX_TEXT) || [displayId, title].filter(Boolean).join(" · ");
    if (text === "") return null;
    const status = isTask ? oneOf(REPORT_STATUSES, raw.status) : null;
    return {
        text,
        link: safeReportLink(raw.link),
        kind,
        project: isTask ? asProject(raw.project) : null,
        displayId,
        title,
        status,
        statusOther: isTask && status === null ? asText(raw.status, MAX_DISPLAY_ID) : "",
        priority: isTask ? oneOf(REPORT_PRIORITIES, raw.priority) : null,
        dueDate: isTask ? asDate(raw.due_date) : null,
        overdueDays: isTask ? asInt(raw.overdue_days, 1, MAX_OVERDUE_DAYS) : null,
        detail: isTask ? asText(raw.detail, MAX_TEXT) : "",
    };
};

const parseStats = (value: unknown): ReportStat[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const stats: ReportStat[] = [];
    for (const entry of value) {
        if (stats.length >= MAX_STATS) break;
        if (entry === null || typeof entry !== "object") continue;
        const raw = entry as Record<string, unknown>;
        const key = asKey(raw.key);
        const count = asInt(raw.count, 1, MAX_COUNT);
        // Each key once, and a 0 is never sent.
        if (key === null || count === null || seen.has(key)) continue;
        seen.add(key);
        stats.push({ key, count, emoji: emojiFor(key, raw.emoji) });
    }
    return stats;
};

/** Whether a body is a typed report the rich card reads: `version` exactly 2. A later version
 *  may change the shape, and reading it as 2 could draw "all clear" for a report that is not,
 *  so it falls back to the plain card, which every version keeps working through `text`. */
export const isReportV2 = (itemBody: unknown): boolean => {
    if (itemBody === null || typeof itemBody !== "object" || Array.isArray(itemBody)) return false;
    const version = (itemBody as Record<string, unknown>).version;
    return version === 2;
};

/** The typed report in an inbox item's body, or null when the body is not a version-2 report. */
export const parseGenosReportV2 = (itemBody: unknown): GenosReportV2 | null => {
    if (!isReportV2(itemBody)) return null;
    const body = itemBody as Record<string, unknown>;
    const rawSections = Array.isArray(body.sections) ? body.sections.slice(0, MAX_SECTIONS) : [];
    const sections: ReportSectionV2[] = [];
    for (const raw of rawSections) {
        if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
        const section = raw as Record<string, unknown>;
        const rawItems = Array.isArray(section.items) ? section.items.slice(0, MAX_ITEMS) : [];
        const items: ReportItemV2[] = [];
        for (const entry of rawItems) {
            const item = parseItem(entry);
            if (item) items.push(item);
        }
        if (items.length === 0) continue;
        const key = asKey(section.key);
        sections.push({
            heading: asText(section.heading, MAX_HEADING),
            key,
            emoji: emojiFor(key, section.emoji),
            items,
        });
    }
    return {
        title: asText(body.title, 200),
        summary: asText(body.text, 280),
        stats: parseStats(body.stats),
        sections,
    };
};
