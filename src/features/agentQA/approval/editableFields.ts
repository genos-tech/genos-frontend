// Edit before approve: WHAT a person may change on an approval card, and the
// cheap checks that go with it.
//
// The backend decides what is editable. A pending approval carries `editable`,
// the argument paths this call lets the person change, and /decide/ accepts an
// edit at no other path (genos-api `agent/approval_edits.py`, PR #570). This
// file is the client's half of that contract: for each tool and path it knows
// the KIND of editor to show and the same rules the server applies, so the
// card can refuse an obvious mistake before a round trip.
//
// The server stays the authority. Nothing here is a security check, a path
// this table does not know is simply not offered as an editor, and a value
// that passes here can still be refused (a reminder in the past, a tag that
// does not exist). Keep the table in step with `EDITABLE_FIELDS` there; a tool
// missing here just keeps its read-only card.
//
// No React in this file, so the rules are testable on their own.

import { effortLevels, priorities, statuses, taskMetaLabel } from "../../tasks/utils/taskMeta";

export type FieldKind = "text" | "body" | "enum" | "date" | "remindAt" | "tags";

export type EnumKind = "priority" | "effort" | "status";

/** The keys of `agentApproval.edit.fields`: what each field is called. */
export type FieldLabelKey =
    | "title"
    | "description"
    | "addToEnd"
    | "addToStart"
    | "comment"
    | "content"
    | "notes"
    | "priority"
    | "effort"
    | "status"
    | "due"
    | "start"
    | "day"
    | "reminder"
    | "tags";

export interface FieldSpec {
    kind: FieldKind;
    label: FieldLabelKey;
    // text / body: a value that is blank once trimmed is refused. Only where
    // the tool refuses it too (a title, a comment, a passage to add).
    required?: boolean;
    // text: the most characters after trimming (the column length).
    maxLength?: number;
    // date / remindAt: `''` is accepted: the tool reads it as "none" / "clear".
    allowEmpty?: boolean;
    // enum: which list of the task meta constants to offer.
    enumKind?: EnumKind;
}

// The server caps a body at `AGENT_MAX_BODY_BYTES` (UTF-8): 256 KB by default.
export const MAX_BODY_BYTES = 262_144;

const TASK_TITLE = 255;
const NOTE_TITLE = 255;
const TODO_TITLE = 512;

const title = (maxLength: number): FieldSpec => ({
    kind: "text",
    label: "title",
    required: true,
    maxLength,
});
const body = (label: FieldLabelKey, required = false): FieldSpec => ({
    kind: "body",
    label,
    required,
});
const choice = (label: FieldLabelKey, enumKind: EnumKind): FieldSpec => ({
    kind: "enum",
    label,
    enumKind,
});
const day = (label: FieldLabelKey, allowEmpty: boolean): FieldSpec => ({
    kind: "date",
    label,
    allowEmpty,
});

const PRIORITY = choice("priority", "priority");
const EFFORT = choice("effort", "effort");
const STATUS = choice("status", "status");

/**
 * tool -> path template -> field. A template is a top-level argument
 * (`title`) or a field of every row of a bulk tool (`updates[*].priority`);
 * the paths on the wire name one row (`updates[3].priority`).
 */
export const EDITABLE_FIELDS: Record<string, Record<string, FieldSpec>> = {
    create_task: {
        title: title(TASK_TITLE),
        content_text: body("description"),
        priority: PRIORITY,
        effort_level: EFFORT,
        due_date: day("due", true),
        start_date: day("start", true),
    },
    update_task: {
        title: title(TASK_TITLE),
        content_text: body("description"),
        body_append: body("addToEnd", true),
        body_prepend: body("addToStart", true),
        status: STATUS,
        priority: PRIORITY,
        effort_level: EFFORT,
        due_date: day("due", true),
        start_date: day("start", true),
        tags: { kind: "tags", label: "tags" },
    },
    update_tasks_bulk: {
        "updates[*].status": STATUS,
        "updates[*].priority": PRIORITY,
        "updates[*].effort_level": EFFORT,
        "updates[*].due_date": day("due", true),
        "updates[*].start_date": day("start", true),
    },
    add_comment: { body_text: body("comment", true) },
    update_comment: { body_text: body("comment", true) },
    create_note: { title: title(NOTE_TITLE), content_text: body("content") },
    update_note: { title: title(NOTE_TITLE), content_text: body("content") },
    // A to-do's day cannot be emptied (create: it would mean "today", update:
    // "do not move"). Its reminder can be emptied on create (no reminder) and
    // not on update (it would mean "leave the reminder alone").
    create_todo_item: {
        title: title(TODO_TITLE),
        notes_text: body("notes"),
        target_date: day("day", false),
        remind_at: { kind: "remindAt", label: "reminder", allowEmpty: true },
    },
    update_todo_item: {
        title: title(TODO_TITLE),
        notes_text: body("notes"),
        target_date: day("day", false),
        remind_at: { kind: "remindAt", label: "reminder" },
    },
};

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export interface ParsedPath {
    name: string;
    /** Zero-based row of a bulk tool; absent for a top-level argument. */
    row?: number;
    /** The field of that row. */
    field?: string;
}

// The server's own grammar: `name`, or `name[row].field`; one row index, no
// deeper, no leading zeros.
const PATH = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(0|[1-9][0-9]{0,3})\]\.([A-Za-z_][A-Za-z0-9_]*))?$/;

export const parsePath = (path: string): ParsedPath | null => {
    const m = PATH.exec(path);
    if (!m) return null;
    return m[2] === undefined ? { name: m[1] } : { name: m[1], row: Number(m[2]), field: m[3] };
};

const templateOf = (p: ParsedPath): string =>
    p.row === undefined ? p.name : `${p.name}[*].${p.field}`;

/** The field spec for `path` on `tool`, or null when this client has no editor for it. */
export const specFor = (tool: string, path: string): FieldSpec | null => {
    const parsed = parsePath(path);
    if (!parsed) return null;
    return EDITABLE_FIELDS[tool]?.[templateOf(parsed)] ?? null;
};

export interface EditableField {
    path: string;
    spec: FieldSpec;
    row?: number;
    /** The argument name (flat) or the row's field (bulk). */
    field: string;
}

/**
 * The fields to show editors for: the paths the server listed, in the order
 * it listed them, minus any this client has no editor for. A path is used
 * verbatim as the key of the patch, never rebuilt.
 */
export const editableFieldsOf = (
    tool: string,
    editable: readonly string[] | undefined
): EditableField[] => {
    const out: EditableField[] = [];
    const seen = new Set<string>();
    for (const path of editable ?? []) {
        if (seen.has(path)) continue;
        const spec = specFor(tool, path);
        const parsed = parsePath(path);
        if (!spec || !parsed) continue;
        seen.add(path);
        out.push({
            path,
            spec,
            ...(parsed.row !== undefined ? { row: parsed.row } : {}),
            field: parsed.field ?? parsed.name,
        });
    }
    return out;
};

/** The value the call carries at `path` (what the card shows), or undefined. */
export const valueAt = (args: Record<string, unknown>, path: string): unknown => {
    const parsed = parsePath(path);
    if (!parsed) return undefined;
    if (parsed.row === undefined) return args[parsed.name];
    const rows = args[parsed.name];
    if (!Array.isArray(rows)) return undefined;
    const row = rows[parsed.row];
    return row && typeof row === "object"
        ? (row as Record<string, unknown>)[parsed.field as string]
        : undefined;
};

/**
 * `args` without the top-level editable arguments. In edit mode those values
 * are shown as inputs, so the preview is left with the part the person is not
 * changing (the header, the destination, the milestone move ...) and nothing
 * is said twice. Bulk row paths are not touched: the bulk tool has its own
 * editor.
 */
export const withoutEditable = (
    args: Record<string, unknown>,
    fields: readonly EditableField[]
): Record<string, unknown> => {
    const out = { ...args };
    for (const f of fields) if (f.row === undefined) delete out[f.field];
    return out;
};

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

/** What an editor holds: text, or the tag names. */
export type Draft = string | string[];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPACT_DATE = /^(\d{4})(\d{2})(\d{2})$/;
const LOCAL_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const LOCAL_INPUT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
// "09:00 that day": the hour the server gives a bare date (DEFAULT_REMINDER_HOUR).
const DEFAULT_REMINDER = "09:00";

const realDate = (iso: string): boolean => {
    const m = ISO_DATE.exec(iso);
    if (!m) return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
};

const toDateInput = (original: unknown): string => {
    if (typeof original !== "string") return "";
    if (ISO_DATE.test(original)) return original;
    const compact = COMPACT_DATE.exec(original);
    return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : "";
};

const inZone = (instant: Date, zone: string): string | null => {
    try {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: zone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).formatToParts(instant);
        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
        return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
    } catch {
        return null;
    }
};

/**
 * A reminder as a `datetime-local` input holds it (`2026-11-06T09:00`), the
 * person's own time. The proposal comes in three spellings, all read by the
 * server in the user's zone: a local date-time, a bare date (09:00 that day),
 * or a full ISO instant that carries its own offset. An instant is shown in
 * the zone the card names (`time_zone`), since the browser's zone may differ.
 */
export const toRemindInput = (original: unknown, timeZone?: string): string => {
    if (typeof original !== "string" || !original.trim()) return "";
    const text = original.trim();
    if (ISO_DATE.test(text)) return `${text}T${DEFAULT_REMINDER}`;
    const local = LOCAL_TIME.exec(text);
    if (local) return `${local[1]}T${local[2]}:${local[3]}`;
    const instant = new Date(text);
    if (Number.isNaN(instant.getTime())) return "";
    const shown = timeZone ? inZone(instant, timeZone) : null;
    // No usable zone: the clock as it was written, which is the proposal's own.
    return shown ?? text.slice(0, 16).replace(" ", "T");
};

/** The editor's starting value for what the call carries at this path. */
export const initialDraft = (spec: FieldSpec, original: unknown, timeZone?: string): Draft => {
    switch (spec.kind) {
        case "tags":
            return Array.isArray(original) ? original.map(String) : [];
        case "date":
            return toDateInput(original);
        case "remindAt":
            return toRemindInput(original, timeZone);
        default:
            return typeof original === "string"
                ? original
                : original === null || original === undefined
                  ? ""
                  : String(original);
    }
};

export const sameDraft = (a: Draft, b: Draft): boolean =>
    Array.isArray(a) && Array.isArray(b)
        ? a.length === b.length && a.every((v, i) => v === b[i])
        : a === b;

// ---------------------------------------------------------------------------
// Cheap checks
// ---------------------------------------------------------------------------

export type FieldProblem =
    | "required"
    | "tooLong"
    | "bodyTooLong"
    | "badDate"
    | "dateRequired"
    | "badReminder"
    | "reminderRequired";

/** Characters as Python counts them (code points), not UTF-16 units. */
const characters = (s: string): number => [...s].length;

const utf8Bytes = (s: string): number => {
    // Three bytes a UTF-16 unit is the most UTF-8 ever needs: no need to encode
    // anything that cannot be near the cap.
    if (s.length * 3 <= MAX_BODY_BYTES) return s.length * 3;
    return new TextEncoder().encode(s).length;
};

/**
 * Why `draft` would be refused for `spec`, or null. The same rules as the
 * server's, for a person's mistakes only: the server has the last word.
 * `unreadable` is a date input holding half a date (a browser reports its
 * value as `''`, which on a clearable field would read as "clear it").
 */
export const checkDraft = (
    spec: FieldSpec,
    draft: Draft,
    unreadable = false
): FieldProblem | null => {
    if (typeof draft !== "string") return null;
    switch (spec.kind) {
        case "text":
            if (spec.required && !draft.trim()) return "required";
            if (spec.maxLength !== undefined && characters(draft.trim()) > spec.maxLength)
                return "tooLong";
            return null;
        case "body":
            if (spec.required && !draft.trim()) return "required";
            if (utf8Bytes(draft) > MAX_BODY_BYTES) return "bodyTooLong";
            return null;
        case "date":
            if (unreadable) return "badDate";
            if (draft === "") return spec.allowEmpty ? null : "dateRequired";
            return realDate(draft) ? null : "badDate";
        case "remindAt": {
            if (unreadable) return "badReminder";
            if (draft === "") return spec.allowEmpty ? null : "reminderRequired";
            const m = LOCAL_INPUT.exec(draft);
            if (!m || !realDate(m[1]) || Number(m[2]) > 23 || Number(m[3]) > 59)
                return "badReminder";
            return null;
        }
        default:
            return null;
    }
};

// ---------------------------------------------------------------------------
// Enum options
// ---------------------------------------------------------------------------

/** The values an enum editor offers (the API's own words), "Deleted" never. */
export const enumOptions = (kind: EnumKind): string[] => {
    const names: Array<string | null | undefined> =
        kind === "priority"
            ? priorities.map((p) => p.priority)
            : kind === "effort"
              ? effortLevels.map((e) => e.level)
              : statuses.map((s) => s.status);
    return names.filter((n): n is string => Boolean(n) && n !== "Deleted");
};

// ---------------------------------------------------------------------------
// What the card says is true NOW
// ---------------------------------------------------------------------------

/**
 * The present value of a field, when the pending event carries a snapshot of
 * it: `current.<field>` on a single call, `updates[i].current.<field>` on a
 * bulk row (null = unset). Computed when the run paused, and never refreshed:
 * once the person edits a field it says nothing true about the edit, so the
 * editors show it only while the field is untouched.
 */
export const currentValue = (
    args: Record<string, unknown>,
    field: string,
    row?: number
): { known: boolean; value: unknown } => {
    const holder =
        row === undefined
            ? args.current
            : Array.isArray(args.updates)
              ? (args.updates[row] as { current?: unknown } | undefined)?.current
              : undefined;
    // The to-do tool names its snapshot `reminder_at`; the argument is `remind_at`.
    const key = field === "remind_at" ? "reminder_at" : field;
    if (!holder || typeof holder !== "object" || !(key in holder)) {
        return { known: false, value: undefined };
    }
    return { known: true, value: (holder as Record<string, unknown>)[key] };
};

// ---------------------------------------------------------------------------
// Saying a value
// ---------------------------------------------------------------------------

export interface ShowWords {
    // "none": what an empty value reads as.
    cleared: string;
    // "No tags (this clears them)".
    noTags: string;
    // `t.tasks.filters`: the task meta words (Open, High, Moderate ...).
    meta: Parameters<typeof taskMetaLabel>[1];
}

/**
 * A proposed, edited or present value as a person reads it: a choice in the
 * app's own words, a reminder as `2026-11-06 09:00`, tags as a list, and
 * `cleared` for the empty value (which is the tools' "clear it").
 */
export const showValue = (
    spec: FieldSpec,
    v: unknown,
    words: ShowWords,
    timeZone?: string
): string => {
    if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : words.noTags;
    if (v === null || v === undefined || v === "") return words.cleared;
    const text = String(v);
    switch (spec.kind) {
        case "enum":
            return taskMetaLabel(text, words.meta);
        case "remindAt":
            // `2026-11-06T09:00:00+09:00` -> `2026-11-06 09:00`
            return (toRemindInput(text, timeZone) || text.slice(0, 16)).replace("T", " ");
        default:
            return text;
    }
};

/**
 * A long text as one short line: whitespace collapsed, cut at `max` characters.
 * For the hints beside an editor and the strip's list of what ran: a note body
 * can be 256 KB, and the whole of it must not be printed as a caption.
 */
export const clipText = (text: string, max = 140): string => {
    const flat = text.replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};
