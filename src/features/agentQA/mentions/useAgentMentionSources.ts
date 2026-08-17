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
import { useHashMentionData, type HashNoteEntry } from "../../../context/HashMentionDataContext";
import { useMentionGroupsContext } from "../../../context/MentionGroupsContext";
import type { MentionGroup } from "../../../services/mentionGroupsApi";
import type { UserProps } from "../../../types/admin";
import type { AllChatProps, TodoGroupProps } from "../../../types/chat";
import { chatTypeCodeToSlug, entityRefToHref } from "../../../utils/entityHref";
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
    subtitle?: string,
    href?: string
): AgentMentionCandidate => ({ ref, trigger, key: mentionKey(ref), subtitle, href });

// Deep-link for a note candidate, keyed off the sidebar kind the entry
// came from. The `AgentMentionRef` collapses my/shared/team into
// noteType 1 and drops the task/chat coordinates (the agent resolves a
// note by id alone), so the href has to be built HERE, where the source
// entry still has them. Returns undefined when a required coordinate is
// missing, which just leaves the chip unclickable.
//
// `chatId` / `threadId` are stringified rather than range-checked: they
// are declared `number` on ChatNoteMetaProps but carry v3 UUID strings at
// runtime, so any numeric validation would silently reject every current
// chat note.
const noteHref = (n: HashNoteEntry): string | undefined => {
    switch (n.kind) {
        case "my":
            return entityRefToHref({
                entityType: "note",
                noteKind: "my",
                noteId: String(n.noteId),
            });
        case "shared":
            return entityRefToHref({
                entityType: "note",
                noteKind: "shared",
                noteId: String(n.noteId),
            });
        case "team":
            return entityRefToHref({
                entityType: "note",
                noteKind: "team",
                noteId: String(n.noteId),
            });
        case "task":
            if (n.projectId == null || n.taskId == null) return undefined;
            return entityRefToHref({
                entityType: "note",
                noteKind: "task",
                projectId: String(n.projectId),
                taskId: String(n.taskId),
                noteId: String(n.noteId),
            });
        case "chat":
            if (!n.chatType || !n.chatId) return undefined;
            return entityRefToHref({
                entityType: "note",
                noteKind: "chat",
                chatType: chatTypeCodeToSlug(n.chatType),
                chatId: String(n.chatId),
                // "0" is the builder's own sentinel for a note on the
                // parent chat rather than a thread within it.
                threadId: n.isThread ? String(n.threadId ?? "") : "0",
                noteId: String(n.noteId),
            });
    }
};

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
    /**
     * Also offer `teamTasks` — every active task in the team — merged with
     * the open project's rows, the way the BlockNote "#" menu does.
     *
     * Off by default because the agent surfaces have always been
     * open-project-scoped, and because the list is fetched lazily: a
     * surface opting in should call `useHashMentionData().refresh()` when
     * a "#" trigger opens, or it will only see whatever another surface
     * already pulled. Surfaces that live outside the tasks area (the
     * to-do pane, which sits in chat) need this — with no project open,
     * `tasks` is empty and "#" would offer no tasks at all.
     */
    includeTeamTasks?: boolean;
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
    const includeTeamTasks = args?.includeTeamTasks ?? false;
    // Only to flag your own `@` row with a "YOU" chip, as the BlockNote
    // menu does. Null outside HashMentionDataProvider, which just means
    // no row is flagged.
    const myselfId = hash.myself?.userId;

    const members = useMemo(() => {
        const profiles: UserProps[] =
            membersOverride ?? (avatarCtx ? Object.values(avatarCtx.teamMemberProfiles) : []);
        const seen = new Set<string>();
        const out: AgentMentionCandidate[] = [];
        for (const u of profiles) {
            if (!u?.userId || !u.userName) continue;
            if (seen.has(u.userId)) continue;
            seen.add(u.userId);
            // Carry the profile-image path plus the row detail the
            // BlockNote `@` menu shows (email subtitle, "YOU" chip on
            // yourself, right-aligned custom status) — all display-only,
            // none of it reaches the wire. The Avatar falls back to the
            // name's initial when `avatarImgPath` is empty.
            out.push({
                ...candidate({ kind: "user", userId: u.userId, label: u.userName }, "@"),
                avatarImgPath: u.avatarImgPath,
                email: u.userEmail,
                customStatus: u.customStatus,
                isSelf: Boolean(myselfId) && u.userId === myselfId,
            });
        }
        // Mention groups share the `@` pool. Outside MentionGroupsProvider
        // the context shim serves an empty list, so surfaces mounted above
        // it (Spotlight) pass `groupsOverride` instead.
        const groups: MentionGroup[] = groupsOverride ?? groupsCtx.mentionGroups;
        for (const g of groups) {
            if (!g.groupName || !Number.isFinite(g.groupId)) continue;
            out.push({
                ...candidate({ kind: "group", groupId: g.groupId, label: g.groupName }, "@"),
                memberCount: g.memberCount,
                description: g.description,
            });
        }
        return out;
    }, [membersOverride, avatarCtx, groupsOverride, groupsCtx.mentionGroups, myselfId]);

    const entities = useMemo(() => {
        const out: AgentMentionCandidate[] = [];
        // Project names by id, so a task row can name its project the way
        // the BlockNote `#` row does. Read from the project list where
        // possible (one lookup, always current) and from the search row
        // otherwise — the same preference `HashMentionMenuItems` applies.
        // Across projects it's the only thing separating two same-named
        // tasks.
        const projectNameById = new Map<number, string>(
            hash.projects
                .filter((p) => Number.isFinite(p.projectId))
                .map((p) => [Number(p.projectId), p.projectName || ""])
        );
        // Open-project rows FIRST so they win the dedupe below — same
        // task, but that copy is the fresher of the two (an optimistic
        // create lands there before any refetch). Both sources are
        // normalized to one row shape so the loop stays single-path —
        // including `status`, which the two disagree on (the open
        // project's table rows carry a bare label, the team search a
        // `TaskStatusProps` object).
        const taskRows = [
            ...hash.tasks.map((t) => ({
                taskId: Number(t.id),
                projectId: t.projectId,
                title: t.title,
                displayId: t.displayId,
                isMilestone: t.isMilestone,
                projectName: "",
                status: t.status || "",
            })),
            ...(includeTeamTasks
                ? hash.teamTasks.map((t) => ({
                      taskId: Number(t.taskId),
                      projectId: t.projectId,
                      title: t.title,
                      displayId: t.displayId,
                      isMilestone: t.isMilestone,
                      projectName: t.projectName || "",
                      status: t.status?.status || "",
                  }))
                : []),
        ];
        // Two sources can carry the same task, and `mentionKey` is
        // `task:<id>` — an un-deduped merge would put duplicate rows (and
        // duplicate React keys) in the dropdown.
        const seenTaskIds = new Set<number>();
        for (const t of taskRows) {
            if (!t.title || !Number.isFinite(t.taskId)) continue;
            if (seenTaskIds.has(t.taskId)) continue;
            seenTaskIds.add(t.taskId);
            // A task deep-link — and a task hover card — is project-scoped;
            // a row with no project can't be linked or previewed, only
            // mentioned. One condition drives both, so a chip that offers a
            // card can always fill it. `== null` rather than falsy: guard
            // the absent case without also rejecting a real id.
            const projectId =
                t.projectId == null || !Number.isFinite(t.projectId) ? undefined : t.projectId;
            out.push({
                ...candidate(
                    // `isMilestone` is display-only (see AgentMentionRef) —
                    // the row reads "Milestone" but still resolves as a task.
                    {
                        kind: "task",
                        taskId: t.taskId,
                        label: t.title,
                        isMilestone: Boolean(t.isMilestone),
                    },
                    "#",
                    t.displayId ?? undefined,
                    projectId == null
                        ? undefined
                        : entityRefToHref({
                              entityType: "task",
                              projectId: String(projectId),
                              taskId: String(t.taskId),
                          })
                ),
                projectId,
                projectName:
                    (projectId == null ? "" : projectNameById.get(projectId)) || t.projectName,
                status: t.status,
            });
        }
        for (const n of hash.notes) {
            const noteType = NOTE_KIND_TO_TYPE[n.kind];
            if (!n.title || !noteType) continue;
            out.push(
                candidate(
                    { kind: "note", noteType, noteId: n.noteId, label: n.title },
                    "#",
                    undefined,
                    noteHref(n)
                )
            );
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
                candidate(
                    { kind: "chat", chatType: c.chatType, chatId: c.chatId, label },
                    "#",
                    undefined,
                    entityRefToHref({
                        entityType: "chat",
                        chatType: chatTypeCodeToSlug(c.chatType),
                        chatId: String(c.chatId),
                    })
                )
            );
        }
        for (const p of hash.projects) {
            if (!p.projectName || !Number.isFinite(p.projectId)) continue;
            out.push(
                candidate(
                    { kind: "project", projectId: p.projectId, label: p.projectName },
                    "#",
                    p.projectCode ?? undefined,
                    entityRefToHref({ entityType: "project", projectId: String(p.projectId) })
                )
            );
        }
        // No href: a to-do item has no route or preview modal of its own —
        // it lives in the pane it was created in.
        for (const t of todoCandidateItems(hash.todoGroups)) {
            out.push(candidate({ kind: "todo", itemId: t.itemId, label: t.title }, "#"));
        }
        return out;
    }, [
        hash.tasks,
        hash.teamTasks,
        hash.notes,
        hash.allChats,
        hash.projects,
        hash.todoGroups,
        includeTeamTasks,
    ]);

    return useMemo(() => ({ members, entities }), [members, entities]);
};
