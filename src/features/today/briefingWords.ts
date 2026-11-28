import { fmt } from "../../i18n";
import type { en } from "../../i18n/locales/en";
import type { BriefingChange, BriefingReasonCode, BriefingTask } from "./briefingToday";

/**
 * The Today view's sentences, built from locale keys (MIP-1936).
 *
 * The API sends every sentence twice: the English one it builds for the connected AI app
 * (`latest.summary`, `reasons`) and the same facts as data (`latest.data`, `reasonCodes`). The
 * page says the data in the viewer's language; the English sentence is only the fallback for a
 * code this build does not know (a newer server), never the normal case.
 */
export type TodayCopy = (typeof en)["tasks"]["dashboard"]["today"];

const FIELD_KEYS = [
    "title",
    "status",
    "priority",
    "effort",
    "assignee",
    "reporter",
    "due_date",
    "start_date",
    "milestone",
    "sprint",
] as const;

const fieldWord = (a: TodayCopy, field: string): string =>
    (FIELD_KEYS as readonly string[]).includes(field)
        ? a.change.fields[field as (typeof FIELD_KEYS)[number]]
        : field;

/** "Ben commented", "Ben changed status: Open → Review"; `null` for a code it cannot say. */
const changeSentence = (c: BriefingChange, a: TodayCopy): string | null => {
    const data = c.latest.data;
    if (!data) return null;
    // The server names an unknown person "someone" and automation "system" in English.
    const named = c.latest.by;
    const by =
        !named || named === "someone"
            ? a.change.someone
            : named === "system"
              ? a.change.system
              : named;
    const t = a.change;
    switch (data.code) {
        case "comment":
            return fmt(t.comment, { by });
        case "reply":
            return fmt(t.reply, { by });
        case "assigned_to_you":
            return fmt(t.assignedToYou, { by });
        case "assignee_changed":
            return fmt(t.assigneeChanged, { by });
        case "created":
            return fmt(t.created, { by });
        case "description_edited":
            return fmt(t.descriptionEdited, { by });
        case "pr_linked":
            return data.title
                ? fmt(t.prLinkedTitle, { by, title: data.title })
                : fmt(t.prLinked, { by });
        case "pr_commented":
            return fmt(t.prCommented, { by });
        case "pr_unlinked":
            return fmt(t.prUnlinked, { by });
        case "custom_field_changed":
            return data.name
                ? fmt(t.customField, { by, name: data.name })
                : fmt(t.customFieldGeneric, { by });
        case "field_changed":
            return fmt(t.fieldChanged, {
                by,
                field: fieldWord(a, String(data.field ?? "")),
                old: data.old || "—",
                new: data.new || "—",
            });
        case "field_edited":
            return fmt(t.fieldEdited, {
                by,
                field: fieldWord(a, String(data.field ?? "")),
            });
        case "note_edited":
            return fmt(t.noteEdited, { by });
        case "note_restored":
            return fmt(t.noteRestored, { by });
        default:
            return null;
    }
};

/** The "what changed" line of one item: who did what, and a short quote when there is one. */
export const changeLine = (c: BriefingChange, a: TodayCopy): string => {
    const { by, summary, text } = c.latest;
    const line = changeSentence(c, a) ?? [by, summary].filter(Boolean).join(" ");
    return text ? fmt(a.change.withText, { line, text }) : line;
};

const reasonSentence = (code: BriefingReasonCode, a: TodayCopy, locale: string): string | null => {
    const r = a.reason;
    switch (code.code) {
        case "overdue": {
            const days = Number(code.days);
            return days === 1 ? a.overdueByOne : fmt(a.overdueBy, { n: days });
        }
        case "due_today":
            return a.dueToday;
        case "due_tomorrow":
            return r.dueTomorrow;
        case "blocked":
            return r.blocked;
        case "priority":
            return fmt(r.priority, { priority: String(code.priority ?? "") });
        case "people":
            return fmt(r.people, { n: Number(code.count) });
        case "activity": {
            const parts: string[] = [];
            if (Number(code.comments)) {
                parts.push(fmt(r.comments, { n: Number(code.comments) }));
            }
            if (Number(code.changes)) {
                parts.push(fmt(r.changes, { n: Number(code.changes) }));
            }
            const when = new Date(String(code.since)).toLocaleString(locale, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
            return fmt(r.activity, { parts: parts.join(r.join), time: when });
        }
        case "importance": {
            const parts = (["others", "mine", "chat", "notes", "prs"] as const)
                .filter((k) => Number(code[k]) > 0)
                .map((k) => fmt(r.kinds[k], { n: Number(code[k]) }));
            const days = fmt(r.onDays, { n: Number(code.days) });
            const trend =
                code.trend === "rising" ? r.rising : code.trend === "cooling" ? r.cooling : "";
            return [parts.join(r.join), days, trend].filter(Boolean).join(r.sep);
        }
        default:
            return null;
    }
};

/**
 * "Look at these first": one reason per signal that fired, joined by " · ". Falls back to the
 * server's English sentences only when the answer has no codes (an older server).
 */
export const reasonLine = (task: BriefingTask, a: TodayCopy, locale: string): string => {
    const codes = task.reasonCodes ?? [];
    const english = task.reasons ?? [];
    if (codes.length === 0) return english.join(" · ");
    return codes
        .map((code, i) => reasonSentence(code, a, locale) ?? english[i] ?? "")
        .filter(Boolean)
        .join(" · ");
};
