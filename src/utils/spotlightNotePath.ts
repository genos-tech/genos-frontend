import type { SpotlightResult } from "../features/spotlight/types";

/** The route that opens a folder result in the notes sidebar (MIP-841),
 *  or null when the result has no folder id. */
export const spotlightFolderPath = (r: SpotlightResult): string | null =>
    r.entity_type === "note_folder" && r.folder_id
        ? `/workspace/notes/folder/${r.folder_id}`
        : null;

// The full-page route for a note result (a search hit or an agent's note
// chip), or the notes home when the result lacks the coordinates to
// deep-link.
//
// `noteScopes` says which space a personal note lives in: My, Shared and
// Team notes are one backend type, so the meta lists are the only signal
// (see `personalNoteScopes`).
export const spotlightNotePath = (
    r: SpotlightResult,
    noteScopes: ReadonlyMap<number, "shared" | "team">
): string => {
    if (r.note_type === "personal") {
        const space = noteScopes.get(Number(r.note_id)) ?? "my";
        return `/workspace/notes/${space}/${r.note_id}`;
    }
    if (r.note_type === "task") {
        // Need project_id + task_id to deep-link. project_id has been on
        // the chunk for a while; task_id is newer. For older chunks the
        // task_id only exists inside `related_entity_ids` as "task:N" —
        // parse it from there so old data works without a reindex.
        const projectId: string | null = r.project_id;
        let taskId: string | null = r.task_id;
        if (!taskId) {
            for (const rel of r.related_entity_ids || []) {
                if (rel.startsWith("task:")) {
                    taskId = rel.slice("task:".length) || null;
                    break;
                }
            }
        }
        if (projectId && taskId) {
            return `/workspace/notes/task/project/${projectId}/task/${taskId}/note/${r.note_id}`;
        }
    }
    if (r.note_type === "chat") {
        // New chunks carry chat_type / chat_id / thread_id as top-level
        // fields; older chunks only have them inside `related_entity_ids`
        // as strings like "dm:5" or "pm:1:thread:3".
        let chatType: typeof r.chat_type = r.chat_type;
        let chatId: string | null = r.chat_id;
        let threadId: string | null = r.thread_id;
        if (!chatType || !chatId || !threadId) {
            for (const rel of r.related_entity_ids || []) {
                const parts = rel.split(":");
                const t = parts[0];
                if (t === "dm" || t === "gm" || t === "pm" || t === "mdm") {
                    if (!chatType) chatType = t;
                    if (!chatId) chatId = parts[1] ?? null;
                    if (!threadId && parts[2] === "thread") {
                        threadId = parts[3] ?? null;
                    }
                    break;
                }
            }
        }
        if (chatType && chatId) {
            // A note on the chat itself (not one of its threads) has no
            // thread id; the route spells that `thread/0`.
            return `/workspace/notes/chat/${chatType}/${chatId}/thread/${threadId || 0}/note/${r.note_id}`;
        }
    }
    return "/workspace/notes";
};
