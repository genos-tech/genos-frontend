import { fmt } from "../../i18n";
import type { BadgeKey, EntitySubtitleLabels, SpotlightMessages } from "./SpotlightResultItem";
import type { SpotlightResult } from "./types";

// Friendly label shown next to the icon for context (e.g. "DM",
// "Group chat", "Personal note"). Exported so the agent's source-chip
// renderer (`sourceChipLabel`, in the answer turn) reuses the same wording
// — keeps the two surfaces from drifting. Accepts the translation
// dictionary so the labels stay locale-aware without turning this pure
// helper into a hook.
//
// `noteScopes` answers a question the search index cannot: My, Shared
// and Team notes are one backend type, indexed identically, so a hit on
// a team note arrives claiming `note_type: "personal"` and reads as "My
// note" without it. See `personalNoteScopes`.
export const entitySubtitle = (
    r: SpotlightResult,
    ts: { entitySubtitle: EntitySubtitleLabels },
    noteScopes?: ReadonlyMap<number, "shared" | "team">
): string => {
    if (r.entity_type === "chat") {
        switch (r.chat_type) {
            case "dm":
                return ts.entitySubtitle.dm;
            case "gm":
                return ts.entitySubtitle.gm;
            case "mdm":
                return ts.entitySubtitle.mdm;
            case "pm":
                return ts.entitySubtitle.pm;
            default:
                return ts.entitySubtitle.chatFallback;
        }
    }
    if (r.entity_type === "note_folder") {
        return r.folder_scope === "team"
            ? ts.entitySubtitle.noteFolderTeam
            : ts.entitySubtitle.noteFolderPersonal;
    }
    if (r.entity_type === "task") return ts.entitySubtitle.task;
    if (r.entity_type === "milestone") return ts.entitySubtitle.milestone;
    if (r.entity_type === "project") return ts.entitySubtitle.project;
    if (r.entity_type === "calendar_event") return ts.entitySubtitle.calendarEvent;
    if (r.entity_type === "spotlight_answer") return ts.entitySubtitle.previousAnswer;
    if (r.entity_type === "todo") {
        // Pull the local_date out of `entity_id` for a date-flavored
        // subtitle ("Todo · 2026-05-28"). Falls back to plain "Todo".
        const m = r.entity_id.match(/^todo:(\d{4}-\d{2}-\d{2})/);
        return m ? fmt(ts.entitySubtitle.todoWithDate, { date: m[1] }) : ts.entitySubtitle.todo;
    }
    if (r.entity_type === "note") {
        switch (r.note_type) {
            case "personal": {
                const scope = r.note_id == null ? undefined : noteScopes?.get(Number(r.note_id));
                if (scope === "team") return ts.entitySubtitle.noteTeam;
                if (scope === "shared") return ts.entitySubtitle.noteShared;
                return ts.entitySubtitle.notePersonal;
            }
            case "task":
                return ts.entitySubtitle.noteTask;
            case "chat":
                return ts.entitySubtitle.noteChat;
            default:
                return ts.entitySubtitle.noteFallback;
        }
    }
    return "";
};

/** A note's container path as one label: "Design › Specs". */
export const contextPathLabel = (r: SpotlightResult): string =>
    (r.entity_type === "note" || r.entity_type === "note_folder") && r.context_path?.length
        ? r.context_path.join(" › ")
        : "";

// The row's subtitle: a task or milestone also shows its id ("Task ·
// MIP-739"), the handle people search and `#`-mention it by (MIP-739); a
// note shows where it lives ("Team · Design › Specs", MIP-839), which is
// what tells two same-titled notes apart.
// Row-only — the source chips reuse `entitySubtitle` as a prefix.
export const rowSubtitle = (
    r: SpotlightResult,
    ts: SpotlightMessages,
    noteScopes?: ReadonlyMap<number, "shared" | "team">
): string => {
    const subtitle = entitySubtitle(r, ts, noteScopes);
    const isTask = r.entity_type === "task" || r.entity_type === "milestone";
    if (isTask && r.task_display_id) return `${subtitle} · ${r.task_display_id}`;
    const where = contextPathLabel(r);
    return where ? `${subtitle} · ${where}` : subtitle;
};

export const badgeFor = (r: SpotlightResult): BadgeKey | null => {
    if (r.entity_type === "chat" && r.thread_id) return "thread";
    // A milestone's comments hang off its backing task, so they are
    // indexed as task comments; the backend relabels that row to the
    // milestone (`milestone_mirrors.py`) and keeps its chunk types.
    if (
        (r.entity_type === "task" || r.entity_type === "milestone") &&
        // Optional-chained: a cited source restored from an older session or
        // snapshot may predate the field, and the Ask modals' chips now come
        // through here too: one such source must not take the whole modal down.
        r.matched_chunk_types?.[0] === "task_comment"
    ) {
        return "comment";
    }
    if (r.entity_type === "note" && r.note_type === "chat" && r.thread_id) {
        return "thread";
    }
    return null;
};

// Resolves a badge key to its localized display label.
export const badgeLabel = (key: BadgeKey, ts: SpotlightMessages): string => {
    return key === "thread" ? ts.badges.thread : ts.badges.comment;
};
