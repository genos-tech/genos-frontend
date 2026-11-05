// The text of one source chip: "Task PRJ-12: title", "Team note: title",
// "Direct message thread: title", in the viewer's language.
//
// Plain TypeScript (no JSX) so the pure rule can be imported anywhere and
// tested without rendering.

import { fmt } from "../../i18n";
import { badgeFor, entitySubtitle } from "../spotlight/SpotlightResultItem";
import type { SpotlightResult } from "../spotlight/types";
import type { AgentTurnLabels } from "./agentTurnLabels";

type ChipVocabulary = Pick<AgentTurnLabels, "chip" | "entitySubtitle">;

function titleSnippet(title: string | null, maxLen = 32): string {
    if (!title) return "";
    const t = title.trim();
    return t.length > maxLen ? t.slice(0, maxLen) + "…" : t;
}

/** The text of one chip. `noteScopes` lets a cited note read as "Team note"
 *  rather than "My note" (see `entitySubtitle`). */
export function sourceChipLabel(
    s: SpotlightResult,
    ts: ChipVocabulary,
    noteScopes?: ReadonlyMap<number, "shared" | "team">
): string {
    const title = titleSnippet(s.title);
    const sep = title ? `: ${title}` : "";

    // Reuse the same vocabulary the result rows use so the agent's
    // source citations don't drift from the search-result subtitles.
    // `entitySubtitle` returns e.g. "Direct message" / "Task" / "Chat
    // note"; `badgeFor` returns "thread" / "comment" / null when the
    // matched chunk was a thread reply / task comment. The full-string
    // templates in `ts.chip.*` keep composed labels translatable rather
    // than concatenating translated pieces.
    const subtitle = entitySubtitle(s, ts, noteScopes);
    const badge = badgeFor(s);

    if (s.entity_type === "task" && s.task_id) {
        const template = badge === "comment" ? ts.chip.taskComment : ts.chip.taskPlain;
        // Prefer human-readable PRJ-123. Falls back to the raw numeric
        // task_id only for legacy rows or tasks without a project.
        const id = s.task_display_id || s.task_id;
        return fmt(template, { subtitle, id, sep });
    }
    if (s.entity_type === "milestone") {
        const template = badge === "comment" ? ts.chip.milestoneComment : ts.chip.milestone;
        return fmt(template, { subtitle, sep });
    }
    if (s.entity_type === "chat" && s.chat_id) {
        const template = badge === "thread" ? ts.chip.chatThread : ts.chip.chatPlain;
        return fmt(template, { subtitle, sep });
    }
    if (s.entity_type === "note" && s.note_id) {
        const template = badge === "thread" ? ts.chip.noteThread : ts.chip.notePlain;
        return fmt(template, { subtitle, sep });
    }
    if (s.entity_type === "project" && s.project_id) {
        return fmt(ts.chip.projectPlain, { subtitle, sep });
    }
    if (s.entity_type === "todo") {
        // Parse the date out of entity_id (`todo:YYYY-MM-DD:item:<id>` or
        // `todo:YYYY-MM-DD`) for a short subtitle.
        const datePart = s.entity_id.match(/^todo:(\d{4}-\d{2}-\d{2})/)?.[1];
        const todoSubtitle = datePart
            ? fmt(ts.entitySubtitle.todoWithDate, { date: datePart })
            : ts.entitySubtitle.todo;
        return fmt(ts.chip.todo, { subtitle: todoSubtitle, sep });
    }
    // Fallback to raw entity_id if specific ids are absent.
    return title ? `${s.entity_id}: ${title}` : s.entity_id;
}
