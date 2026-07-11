// Data plumbing for the agent-input mention dropdown: adapts the
// app-root datasets to `AgentMentionCandidate` lists.
//
//   `@` members  — AvatarContext's `teamMemberProfiles` (ThreadAsk /
//                  NoteAsk modals mount inside the provider), or the
//                  `membersOverride` prop for surfaces mounted outside
//                  it (SpotlightOverlay receives `useTEM.teamMembers`
//                  from the App root).
//   `#` entities — `useHashMentionData()`: the same tasks / notes / GM
//                  chats that back the BlockNote `#` menu, so both
//                  pickers stay in coverage lock-step.

import { useMemo } from "react";

import { useOptionalAvatarContext } from "../../../components/ui/avatars/AvatarContext";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import type { UserProps } from "../../../types/admin";
import { mentionKey, type AgentMentionCandidate, type AgentMentionRef } from "./types";

// HashNoteEntry kind → NoteContext integer code. "shared" is the UI
// bucket for other people's personal notes — normalised to 1 the same
// way `noteAsk` normalises noteType 4.
const NOTE_KIND_TO_TYPE: Record<string, 1 | 2 | 3> = {
    my: 1,
    shared: 1,
    task: 2,
    chat: 3,
};

const candidate = (
    ref: AgentMentionRef,
    trigger: "@" | "#",
    subtitle?: string
): AgentMentionCandidate => ({ ref, trigger, key: mentionKey(ref), subtitle });

export interface UseAgentMentionSourcesArgs {
    membersOverride?: UserProps[];
}

export interface AgentMentionSources {
    members: AgentMentionCandidate[];
    entities: AgentMentionCandidate[];
}

export const useAgentMentionSources = (args?: UseAgentMentionSourcesArgs): AgentMentionSources => {
    const hash = useHashMentionData();
    const avatarCtx = useOptionalAvatarContext();
    const membersOverride = args?.membersOverride;

    const members = useMemo(() => {
        const profiles: UserProps[] =
            membersOverride ?? (avatarCtx ? Object.values(avatarCtx.teamMemberProfiles) : []);
        const seen = new Set<string>();
        const out: AgentMentionCandidate[] = [];
        for (const u of profiles) {
            if (!u?.userId || !u.userName) continue;
            if (seen.has(u.userId)) continue;
            seen.add(u.userId);
            out.push(candidate({ kind: "user", userId: u.userId, label: u.userName }, "@"));
        }
        return out;
    }, [membersOverride, avatarCtx]);

    const entities = useMemo(() => {
        const out: AgentMentionCandidate[] = [];
        for (const t of hash.tasks) {
            const taskId = Number(t.id);
            if (!t.title || !Number.isFinite(taskId)) continue;
            out.push(
                candidate({ kind: "task", taskId, label: t.title }, "#", t.displayId ?? undefined)
            );
        }
        for (const n of hash.notes) {
            const noteType = NOTE_KIND_TO_TYPE[n.kind];
            if (!n.title || !noteType) continue;
            out.push(candidate({ kind: "note", noteType, noteId: n.noteId, label: n.title }, "#"));
        }
        // `hash.chats` is already GM-only (filtered by the provider).
        for (const c of hash.chats) {
            if (!c.chatName || !c.chatId) continue;
            out.push(
                candidate(
                    { kind: "chat", chatType: c.chatType, chatId: c.chatId, label: c.chatName },
                    "#"
                )
            );
        }
        return out;
    }, [hash.tasks, hash.notes, hash.chats]);

    return useMemo(() => ({ members, entities }), [members, entities]);
};
