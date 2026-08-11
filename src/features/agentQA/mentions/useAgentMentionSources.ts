// Data plumbing for the agent-input mention dropdown: adapts the
// app-root datasets to `AgentMentionCandidate` lists.
//
//   `@` members  — AvatarContext's `teamMemberProfiles` (ThreadAsk /
//                  NoteAsk modals mount inside the provider), or the
//                  `membersOverride` prop for surfaces mounted outside
//                  it (SpotlightOverlay receives `useTEM.teamMembers`
//                  from the App root). Mention groups join the same
//                  pool via MentionGroupsContext / `groupsOverride`.
//   `#` entities — `useHashMentionData()`: the tasks / notes / projects
//                  that back the BlockNote `#` menu, plus the DM / GM /
//                  MDM chats from `allChats` (not the editors' GM-only
//                  `chats` list — agent asks are private to the
//                  requester, so the DM-title leak rationale doesn't
//                  apply here). PM chats are filtered out: each mirrors a
//                  Project one-to-one, so the Project candidate stands in
//                  for it (a PM row would just duplicate the project).

import { useMemo } from "react";

import { useOptionalAvatarContext } from "../../../components/ui/avatars/AvatarContext";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import { useMentionGroupsContext } from "../../../context/MentionGroupsContext";
import type { MentionGroup } from "../../../services/mentionGroupsApi";
import type { UserProps } from "../../../types/admin";
import type { AllChatProps, TodoGroupProps } from "../../../types/chat";
import { mentionKey, type AgentMentionCandidate, type AgentMentionRef } from "./types";

// HashNoteEntry kind → NoteContext integer code. "shared" is the UI
// bucket for other people's personal notes — normalised to 1 the same
// way `noteAsk` normalises noteType 4.
const NOTE_KIND_TO_TYPE: Record<string, 1 | 2 | 3> = {
    my: 1,
    shared: 1,
    // Team Notes are personal notes with a folder-carried ACL, so the
    // agent reaches them through the same note_type 1 context.
    team: 1,
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
    groupsOverride?: MentionGroup[];
}

// Completed todos older than this stop being offered — a done chore
// from months ago is noise, but "did I finish X?" about something
// recent is a real question. Open todos are always offered.
const COMPLETED_TODO_WINDOW_DAYS = 14;

export const todoCandidateItems = (
    todoGroups: TodoGroupProps[],
    now: Date = new Date()
): Array<{ itemId: number; title: string }> => {
    const cutoffDate = new Date(now.getTime() - COMPLETED_TODO_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    // localDate is YYYY-MM-DD, so string comparison is date comparison.
    const cutoff = cutoffDate.toISOString().slice(0, 10);
    const out: Array<{ itemId: number; title: string }> = [];
    for (const g of todoGroups) {
        for (const item of g.items ?? []) {
            if (!item.title) continue;
            if (item.isCompleted && g.localDate < cutoff) continue;
            out.push({ itemId: item.itemId, title: item.title });
        }
    }
    return out;
};

export interface AgentMentionSources {
    members: AgentMentionCandidate[];
    entities: AgentMentionCandidate[];
}

export const useAgentMentionSources = (args?: UseAgentMentionSourcesArgs): AgentMentionSources => {
    const hash = useHashMentionData();
    const avatarCtx = useOptionalAvatarContext();
    const groupsCtx = useMentionGroupsContext();
    const membersOverride = args?.membersOverride;
    const groupsOverride = args?.groupsOverride;

    const members = useMemo(() => {
        const profiles: UserProps[] =
            membersOverride ?? (avatarCtx ? Object.values(avatarCtx.teamMemberProfiles) : []);
        const seen = new Set<string>();
        const out: AgentMentionCandidate[] = [];
        for (const u of profiles) {
            if (!u?.userId || !u.userName) continue;
            if (seen.has(u.userId)) continue;
            seen.add(u.userId);
            // Carry the profile-image path so the dropdown row shows the
            // user's real photo (display-only — never reaches the wire;
            // the Avatar falls back to the name's initial when it's empty).
            out.push({
                ...candidate({ kind: "user", userId: u.userId, label: u.userName }, "@"),
                avatarImgPath: u.avatarImgPath,
            });
        }
        // Mention groups share the `@` pool. Outside MentionGroupsProvider
        // the context shim serves an empty list, so surfaces mounted above
        // it (Spotlight) pass `groupsOverride` instead.
        const groups: MentionGroup[] = groupsOverride ?? groupsCtx.mentionGroups;
        for (const g of groups) {
            if (!g.groupName || !Number.isFinite(g.groupId)) continue;
            out.push(candidate({ kind: "group", groupId: g.groupId, label: g.groupName }, "@"));
        }
        return out;
    }, [membersOverride, avatarCtx, groupsOverride, groupsCtx.mentionGroups]);

    const entities = useMemo(() => {
        const out: AgentMentionCandidate[] = [];
        for (const t of hash.tasks) {
            const taskId = Number(t.id);
            if (!t.title || !Number.isFinite(taskId)) continue;
            out.push(
                candidate(
                    // `isMilestone` is display-only (see AgentMentionRef) —
                    // the row reads "Milestone" but still resolves as a task.
                    { kind: "task", taskId, label: t.title, isMilestone: Boolean(t.isMilestone) },
                    "#",
                    t.displayId ?? undefined
                )
            );
        }
        for (const n of hash.notes) {
            const noteType = NOTE_KIND_TO_TYPE[n.kind];
            if (!n.title || !noteType) continue;
            out.push(candidate({ kind: "note", noteType, noteId: n.noteId, label: n.title }, "#"));
        }
        // Chat types DM / GM / MDM (see the module comment). PM chats
        // (chatType 3) are deliberately EXCLUDED: every PM chat mirrors a
        // Project one-to-one, so offering both produced two identical rows
        // for the same thing. Users want to mention the Project, so the PM
        // row is dropped and only the project candidate below remains.
        for (const c of hash.allChats) {
            if (c.chatType === 3) continue;
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
        for (const t of todoCandidateItems(hash.todoGroups)) {
            out.push(candidate({ kind: "todo", itemId: t.itemId, label: t.title }, "#"));
        }
        return out;
    }, [hash.tasks, hash.notes, hash.allChats, hash.projects, hash.todoGroups]);

    return useMemo(() => ({ members, entities }), [members, entities]);
};
