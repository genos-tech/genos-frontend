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
    // A chat message the member pointed "Ask Genos" at (MIP-1058, AGENT_PARITY_TOOLS). `messageId` is
    // the v3 `Message.id` (a UUID: `messageIdWithChatId` of a main-channel message,
    // `messageIdWithChatIdAndThreadId` of a thread reply), NEVER the per-channel sequence `messageId`.
    // Made only by "Ask Genos about this message" (`askGenosRefForMessage`), never picked from the `#`
    // menu. The server reads the message itself, with the asker's own chat access; `label` is display
    // only (the draft token and nothing else).
    | { kind: "message"; messageId: string; label: string }
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
    | { kind: "todo"; itemId: number; label: string }
    // A Genos skill run with `/name` (MIP-2042, `GENOS_SKILLS`). Not a mention: it rides the same list
    // so a retry and a history row keep it, but `toWireMentions` leaves it out and `toWireSkill` makes
    // the ask's `skill` field. `skillId` is the picker's exact choice; "" = a typed name, which the
    // server resolves (mine > team > installed). `label` is the slug, the token after the `/`.
    // `version` is set only on a turn restored from history (MIP-2189): the version that ran, which a
    // retry asks for again (0 = the owner's draft).
    | { kind: "skill"; skillId: string; label: string; version?: number }
    // A Google Calendar event (MIP-1059, AGENT_PARITY_TOOLS). Only ever made by "Ask Genos about this
    // event" (`askGenosRefForCalendarEvent`), never picked from the `#` menu: the app does not index
    // events. The three ids are the event's whole identity (ids are unique per calendar, not
    // globally, and the account decides which Google credential reads it).
    | {
          kind: "calendar_event";
          accountId: string;
          calendarId: string;
          eventId: string;
          label: string;
      };

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
    trigger: "@" | "#" | "/";
    key: string;
    subtitle?: string;
    avatarImgPath?: string;
    // Internal deep-link for surfaces that render a picked mention as a
    // CLICKABLE chip (the todo-title rows), built by
    // `useAgentMentionSources` via `entityRefToHref`. It has to be
    // resolved there rather than from the `AgentMentionRef` alone,
    // because a link needs coordinates the ref deliberately doesn't
    // carry — a task's `projectId`, a note's kind plus its project/task
    // or chat/thread ids. Absent for kinds with nowhere to go (`user`,
    // `group`, `todo`) and for rows whose coordinates are missing.
    // Display-only, like `subtitle`: never reaches `mentionKey` or the
    // wire payload, and the agent surfaces simply ignore it.
    href?: string;

    // ── Row-detail fields ────────────────────────────────────────────
    // Everything below exists so the Joy-input dropdown can render the
    // SAME row as the BlockNote `@`/`#` menus, which build their rows
    // straight from the source datasets (`UserProps`, `MentionGroup`,
    // the task tables) and so have this detail on hand. A candidate is
    // the only thing the dropdown sees, so the detail has to ride along.
    //
    // All of it is display-only in exactly the sense `subtitle` and
    // `href` are: populated in `useAgentMentionSources`, never part of
    // `mentionKey`, never sent on the wire. `toWireMentions` reads the
    // `ref` alone, so nothing here can change how a mention resolves.

    /** `@user`: email — the BlockNote `@` row's subtitle line. */
    email?: string;
    /** `@user`: their custom status, shown right-aligned and italic. */
    customStatus?: string;
    /** `@user`: true for the signed-in user, who gets a "YOU" chip. */
    isSelf?: boolean;
    /** `@group`: member count, shown as the trailing green chip. */
    memberCount?: number;
    /** `@group`: the group's description, used as its subtitle line. */
    description?: string;
    /**
     * `#task`: the owning project's id and name, and the task's status
     * label ("Open" / "WIP" / …). The subtitle reads "Task · ID · Project"
     * when the name is known, and `status` paints the trailing
     * `StatusLabel` — both matching the BlockNote `#` row.
     *
     * `projectId` additionally supplies the coordinate a task hover card
     * needs (`TaskMentionHoverCard` is project-scoped), which is why the
     * to-do title chips can offer one. It is deliberately NOT on the
     * `task` ref: the ref is the wire identity, and the agent resolves a
     * task by id alone. Absent when the source row carried no project —
     * the same condition that leaves `href` absent.
     */
    projectId?: number;
    projectName?: string;
    status?: string;
    /** `/skill`: who it comes from (the picker's group) and, for a teammate's, their name. Display-only. */
    skillGroup?: "mine" | "team" | "installed" | "official";
    skillOwner?: string;
    /** `/skill`: the skill's title, searched beside its name and shown on the row. */
    skillTitle?: string;
}

export const mentionKey = (ref: AgentMentionRef): string => {
    switch (ref.kind) {
        case "message":
            return `message:${ref.messageId}`;
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
        case "skill":
            return `skill:${ref.skillId || ref.label}`;
        case "calendar_event":
            // JSON, because a calendar id and an event id can hold `:` (a group calendar's id, a recurring
            // instance's): joined with `:` two different pairs could give one key.
            return `calendar_event:${JSON.stringify([ref.accountId, ref.calendarId, ref.eventId])}`;
    }
};

// Camel-case refs → the snake_case /agent/ask/ `mentions` wire shape.
export const toWireMentions = (refs: AgentMentionRef[]): AgentMentionPayload[] =>
    refs.flatMap((ref): AgentMentionPayload[] => {
        // A skill is not a mention: it is the ask's `skill` field (`toWireSkill`).
        if (ref.kind === "skill") return [];
        return [toWireMention(ref)];
    });

const toWireMention = (ref: Exclude<AgentMentionRef, { kind: "skill" }>): AgentMentionPayload => {
    switch (ref.kind) {
        case "message":
            return { type: "message", message_id: ref.messageId, label: ref.label };
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
        case "calendar_event":
            return {
                type: "calendar_event",
                account_id: ref.accountId,
                calendar_id: ref.calendarId,
                event_id: ref.eventId,
                label: ref.label,
            };
    }
};

/** The ask's `skill` field from the refs, or undefined when none is a skill: `{ id }` for the picker's
 *  exact choice, `{ name }` for a typed `/name` the server resolves. Only the first one counts. */
export const toWireSkill = (
    refs: readonly AgentMentionRef[] | undefined
): { id: string; version_no?: number } | { name: string } | undefined => {
    const ref = refs?.find((r) => r.kind === "skill");
    if (!ref || ref.kind !== "skill") return undefined;
    if (!ref.skillId) return { name: ref.label };
    // A retry from history asks for the version that ran; the server falls back if it is gone.
    return ref.version && ref.version > 0
        ? { id: ref.skillId, version_no: ref.version }
        : { id: ref.skillId };
};
