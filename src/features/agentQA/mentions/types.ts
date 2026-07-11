// Structured @/# mention types for the agent input surfaces (Spotlight,
// ThreadAsk, NoteAsk).
//
// The user picks entities from a dropdown; the input keeps the plain
// `@Name` / `#Title` token in the query text (human-readable in session
// history), while the picked `AgentMentionRef` carries the resolved ids.
// At send time the surviving refs (tokens the user didn't edit away) are
// converted to the backend wire shape and posted alongside the query —
// see `toWireMentions` and `AgentMentionPayload` in services/agentApi.

import type { AgentMentionPayload } from "../../../services/agentApi";

export type AgentMentionRef =
    | { kind: "user"; userId: string; label: string }
    | { kind: "task"; taskId: number; label: string }
    // 1 = Personal, 2 = Task, 3 = Chat — the same integer codes
    // `NoteContext` uses (the "Shared" UI bucket is normalised to 1).
    | { kind: "note"; noteType: 1 | 2 | 3; noteId: number; label: string }
    | { kind: "chat"; chatType: number; chatId: string; label: string };

// One dropdown row. `trigger` decides which menu ("@" members vs "#"
// entities) the candidate belongs to; `key` is a stable identity used
// for dedupe and React list keys; `subtitle` is an optional secondary
// line (e.g. a task's display id) — locale-free by design.
export interface AgentMentionCandidate {
    ref: AgentMentionRef;
    trigger: "@" | "#";
    key: string;
    subtitle?: string;
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
        }
    });
