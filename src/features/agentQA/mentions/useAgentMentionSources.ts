// Data plumbing for the agent-input mention dropdown: adapts the
// app-root datasets to `AgentMentionCandidate` lists.
//
//   `@` members  — AvatarContext's `teamMemberProfiles` (ThreadAsk /
//                  NoteAsk modals mount inside the provider), or the
//                  `membersOverride` prop for surfaces mounted outside
//                  it (SpotlightOverlay receives `useTEM.teamMembers`
//                  from the App root).
//   `#` entities — `useHashMentionData()`: the tasks / notes / projects
//                  that back the BlockNote `#` menu, plus ALL chat
//                  types (`allChats`, not the editors' GM-only `chats`
//                  list — agent asks are private to the requester, so
//                  the DM-title leak rationale doesn't apply here).

import { useMemo } from "react";

import { useOptionalAvatarContext } from "../../../components/ui/avatars/AvatarContext";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import type { UserProps } from "../../../types/admin";
import type { AllChatProps } from "../../../types/chat";
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

// MDM (chatType 4) chats carry no server-side `chatName`; their display
// name is the comma-separated member names — same convention as the
// chat sidebar (`resolveChatDisplayName`). DM / GM / PM chatNames are
// server-resolved.
const chatDisplayName = (c: AllChatProps): string => {
    if (c.chatType === 4 && !c.chatName) {
        return c.mdmMembers?.map((m) => m.userName).join(", ") || "";
    }
    return c.chatName || "";
};

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
        // All chat types (DM / GM / PM / MDM) — see the module comment.
        for (const c of hash.allChats) {
            const label = chatDisplayName(c);
            if (!label || !c.chatId) continue;
            out.push(
                candidate({ kind: "chat", chatType: c.chatType, chatId: c.chatId, label }, "#")
            );
        }
        for (const p of hash.projects) {
            if (!p.projectName || !Number.isFinite(p.projectId)) continue;
            out.push(
                candidate(
                    { kind: "project", projectId: p.projectId, label: p.projectName },
                    "#",
                    p.projectCode ?? undefined
                )
            );
        }
        return out;
    }, [hash.tasks, hash.notes, hash.allChats, hash.projects]);

    return useMemo(() => ({ members, entities }), [members, entities]);
};
