/**
 * "Your AI app did X" notices (MIP-1432).
 *
 * The API stores FACTS in the activity's `meta` (verb, kind, count, status,
 * items) and never a sentence, so each member reads the row in their own
 * language. This file parses those facts and words them.
 */

import type { AiAppNotice, AiAppNoticeItem } from "../../../types/chat";

/** The switch a notice answers to, by what it is about (mirrors `mcp_notice.category_for_kind`). */
export const aiAppCategory = (kind: string): "ai_app_tasks" | "ai_app_notes" | "ai_app_todos" =>
    kind === "note" ? "ai_app_notes" : kind === "todo" ? "ai_app_todos" : "ai_app_tasks";

/** Activity `surface_type` of an AI-app notice (mirrors SURFACE_AI_APP in genos-api). */
export const AI_APP_SURFACE = 10;

export interface AiAppStrings {
    withApp: string;
    createdTask: string;
    createdTasks: string;
    createdMilestone: string;
    createdMilestoneWithTasks: string;
    createdNote: string;
    createdTodo: string;
    statusTask: string;
    statusTasks: string;
    statusTasksMixed: string;
    statusMilestone: string;
    commented: string;
    deletedComment: string;
    deletedNote: string;
    deletedMilestone: string;
    deletedTodo: string;
    fallback: string;
    moreItems: string;
}

const fill = (template: string, values: Record<string, string | number>): string =>
    template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? String(values[key]) : m));

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/** Read the producer's `meta` defensively: a malformed row must still render. */
export function parseAiAppNotice(meta: Record<string, unknown>): AiAppNotice {
    const items: AiAppNoticeItem[] = Array.isArray(meta.items)
        ? (meta.items as unknown[])
              .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
              .map((i) => ({
                  kind: str(i.kind),
                  id: typeof i.id === "number" || typeof i.id === "string" ? i.id : null,
                  displayId: str(i.displayId) ?? null,
                  title: str(i.title) ?? null,
                  url: str(i.url) ?? null,
                  projectId: typeof i.projectId === "number" ? i.projectId : null,
                  taskId: typeof i.taskId === "number" ? i.taskId : null,
              }))
        : [];
    const count = typeof meta.count === "number" && meta.count > 0 ? meta.count : 1;
    return {
        app: str(meta.app) ?? "AI",
        verb: str(meta.verb) ?? "",
        kind: str(meta.kind) ?? "",
        count,
        status: str(meta.status),
        taskCount: typeof meta.taskCount === "number" ? meta.taskCount : undefined,
        url: str(meta.url) ?? "",
        items,
    };
}

/** "QR-12 Fix login" — the id when there is one, then the title. */
export function aiAppItemName(item: AiAppNoticeItem | undefined): string {
    if (!item) return "";
    return [item.displayId, item.title].filter(Boolean).join(" ");
}

/** The notice as a sentence without the app: "created task QR-12 Fix login". */
export function aiAppSentence(notice: AiAppNotice, s: AiAppStrings): string {
    const name = aiAppItemName(notice.items[0]);
    const many = notice.count > 1;
    const status = notice.status ?? "";
    switch (notice.verb) {
        case "created":
            switch (notice.kind) {
                case "task":
                    return many
                        ? fill(s.createdTasks, { count: notice.count })
                        : fill(s.createdTask, { name });
                case "milestone":
                    return notice.taskCount
                        ? fill(s.createdMilestoneWithTasks, {
                              name,
                              taskCount: notice.taskCount,
                          })
                        : fill(s.createdMilestone, { name });
                case "note":
                    return fill(s.createdNote, { name });
                case "todo":
                    return fill(s.createdTodo, { name });
            }
            break;
        case "status":
            if (notice.kind === "milestone") return fill(s.statusMilestone, { name, status });
            if (notice.kind === "task") {
                if (many) {
                    return status
                        ? fill(s.statusTasks, { count: notice.count, status })
                        : fill(s.statusTasksMixed, { count: notice.count });
                }
                if (status) return fill(s.statusTask, { name, status });
            }
            break;
        case "commented":
            return fill(s.commented, { name: notice.items[0]?.displayId || name });
        case "deleted":
            switch (notice.kind) {
                case "comment":
                    return fill(s.deletedComment, { name: notice.items[0]?.displayId || name });
                case "note":
                    return fill(s.deletedNote, { name });
                case "milestone":
                    return fill(s.deletedMilestone, { name });
                case "todo":
                    return fill(s.deletedTodo, { name });
            }
            break;
    }
    return s.fallback;
}

/** "Claude Code created task QR-12 Fix login" — the whole line. */
export function aiAppHeadline(notice: AiAppNotice, s: AiAppStrings): string {
    return fill(s.withApp, { app: notice.app, sentence: aiAppSentence(notice, s) });
}
