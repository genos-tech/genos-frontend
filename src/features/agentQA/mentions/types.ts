// Structured @/# mention types for the agent input surfaces (Spotlight,
// ThreadAsk, NoteAsk).
//
// The user picks entities from a dropdown — or just types the full
// `@Name` / `#Title` token, which auto-resolves on exact label match
// (see useAgentMentionDraft). The input keeps the plain token in the
// query text (human-readable in session history), while the
// `AgentMentionRef` carries the resolved ids. At send time the resolved
// refs (tokens present in the final text) are converted to the backend
// wire shape and posted alongside the query — see `toWireMentions` and
// `AgentMentionPayload` in services/agentApi.

import type { AgentMentionPayload } from "../../../services/agentApi";

export type AgentMentionRef =
    | { kind: "user"; userId: string; label: string }
    // A milestone is a task under the hood (same `task_id`, same wire
    // shape — see `toWireMentions`), so it stays `kind: "task"` and
    // resolves server-side exactly as a task does. `isMilestone` is a
    // DISPLAY-ONLY flag: it flips the dropdown row's icon and label to
    // read "Milestone" instead of "Task", and is deliberately absent
    // from `mentionKey` / the wire payload so nothing downstream forks.
    | { kind: "task"; taskId: number; label: string; isMilestone?: boolean }
    // 1 = Personal, 2 = Task, 3 = Chat — the same integer codes
    // `NoteContext` uses (the "Shared" UI bucket is normalised to 1).
    | { kind: "note"; noteType: 1 | 2 | 3; noteId: number; label: string }
    | { kind: "chat"; chatType: number; chatId: string; label: string }
    | { kind: "project"; projectId: number; label: string }
    // Mention group — expands to its member list server-side.
    | { kind: "group"; groupId: number; label: string }
    | { kind: "todo"; itemId: number; label: string };

// One dropdown row. `trigger` decides which menu ("@" members vs "#"
// entities) the candidate belongs to; `key` is a stable identity used
// for dedupe and React list keys; `subtitle` is an optional secondary
// line (e.g. a task's display id) — locale-free by design.
// `avatarImgPath` is the mentioned user's profile-image path (media-
// server-relative or absolute); the `@` row renders their real photo
// from it instead of a generic icon. Display-only, so — like `subtitle`
// — it never reaches `mentionKey` or the wire payload, and only user
// candidates carry it (groups/entities render a colored icon disc).
export interface AgentMentionCandidate {
    ref: AgentMentionRef;
    trigger: "@" | "#";
    key: string;
    subtitle?: string;
    avatarImgPath?: string;
}

export const mentionKey = (ref: AgentMentionRef): string => {
    switch (ref.kind) {
        case "user":
            return `user:${ref.userId}`;
        case "task":
            return `task:${ref.taskId}`;
        case "note":
            return `note:${ref.noteType}:${ref.noteId}`;
        case "chat":
            return `chat:${ref.chatType}:${ref.chatId}`;
        case "project":
            return `project:${ref.projectId}`;
        case "group":
            return `group:${ref.groupId}`;
        case "todo":
            return `todo:${ref.itemId}`;
    }
};

// Camel-case refs → the snake_case /agent/ask/ `mentions` wire shape.
export const toWireMentions = (refs: AgentMentionRef[]): AgentMentionPayload[] =>
    refs.map((ref) => {
        switch (ref.kind) {
            case "user":
                return { type: "user", user_id: ref.userId, label: ref.label };
            case "task":
                return { type: "task", task_id: ref.taskId, label: ref.label };
            case "note":
                return {
                    type: "note",
                    note_type: ref.noteType,
                    note_id: ref.noteId,
                    label: ref.label,
                };
            case "chat":
                return {
                    type: "chat",
                    chat_type: ref.chatType,
                    chat_id: ref.chatId,
                    label: ref.label,
                };
            case "project":
                return { type: "project", project_id: ref.projectId, label: ref.label };
            case "group":
                return { type: "group", group_id: ref.groupId, label: ref.label };
            case "todo":
                return { type: "todo", item_id: ref.itemId, label: ref.label };
        }
    });
