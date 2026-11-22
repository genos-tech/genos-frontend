/**
 * Which projects and group chats are archived, as the client knows it (MIP-1693).
 *
 * The API leaves the archived flag off a project or chat row. The client learns it by asking
 * for `include_archived=true` and taking what the default list does not return. Every sidebar,
 * banner and write control reads this one store, so an archive or restore made here shows at
 * once, before the next list refresh.
 *
 * A plain module store (not React state) so the chat service, the project hook and the
 * components can all reach it without threading props through the tree.
 */
import { useSyncExternalStore } from "react";

import type { ProjectProps } from "../../types/tasks";

export type ArchiveSnapshot = {
    /** The archived projects, as the list returned them (their names are what the section shows). */
    readonly archivedProjects: readonly ProjectProps[];
    /** The ids of the archived group chats. A project's chat is covered by its project. */
    readonly archivedChannelIds: ReadonlySet<string>;
};

const EMPTY: ArchiveSnapshot = {
    archivedProjects: [],
    archivedChannelIds: new Set<string>(),
};

let snapshot: ArchiveSnapshot = EMPTY;
const listeners = new Set<() => void>();

const publish = (next: ArchiveSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
};

const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
    if (a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
};

const sameProjects = (a: readonly ProjectProps[], b: readonly ProjectProps[]): boolean =>
    a.length === b.length && a.every((p, i) => p.projectId === b[i].projectId);

export const getArchiveSnapshot = (): ArchiveSnapshot => snapshot;

export const subscribeArchive = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** Replaces the archived projects after a list refresh. Identical input keeps the snapshot. */
export const setArchivedProjects = (projects: readonly ProjectProps[]): void => {
    if (sameProjects(snapshot.archivedProjects, projects)) return;
    publish({ ...snapshot, archivedProjects: [...projects] });
};

/** Replaces the archived group chat ids after a list refresh. Identical input keeps the snapshot. */
export const setArchivedChannelIds = (ids: Iterable<string>): void => {
    const next = new Set(ids);
    if (sameIds(snapshot.archivedChannelIds, next)) return;
    publish({ ...snapshot, archivedChannelIds: next });
};

/** Archive or restore one project locally, straight after the server accepted it. */
export const markProjectArchived = (project: ProjectProps, archived: boolean): void => {
    const rest = snapshot.archivedProjects.filter((p) => p.projectId !== project.projectId);
    publish({ ...snapshot, archivedProjects: archived ? [...rest, project] : rest });
};

/** Archive or restore one group chat locally, straight after the server accepted it. */
export const markChannelArchived = (channelId: string, archived: boolean): void => {
    const next = new Set(snapshot.archivedChannelIds);
    if (archived) next.add(channelId);
    else next.delete(channelId);
    if (sameIds(snapshot.archivedChannelIds, next)) return;
    publish({ ...snapshot, archivedChannelIds: next });
};

export const isProjectArchived = (projectId: number | null | undefined): boolean =>
    projectId != null && snapshot.archivedProjects.some((p) => p.projectId === projectId);

/**
 * A project by id: the active list first, then the archived ones (an archived project is in
 * no active list, but a reload, Back or a link still has to open it, MIP-1920).
 */
export const findProject = (
    activeProjects: readonly ProjectProps[],
    projectId: number
): ProjectProps | undefined =>
    activeProjects.find((p) => p.projectId === projectId) ??
    snapshot.archivedProjects.find((p) => p.projectId === projectId);

/** A group chat is archived when it is listed as archived or when its project is, in `state`. */
export const isChatArchivedIn = (
    state: ArchiveSnapshot,
    chat: { chatId: string; projectId?: number | null }
): boolean =>
    state.archivedChannelIds.has(chat.chatId) ||
    (chat.projectId != null && state.archivedProjects.some((p) => p.projectId === chat.projectId));

/** A group chat is archived when it is listed as archived or when its project is. */
export const isChatArchived = (chat: { chatId: string; projectId?: number | null }): boolean =>
    isChatArchivedIn(snapshot, chat);

/**
 * The chats a pane lists. Archived ones are left out unless the pane shows them, in which case
 * they come after the live ones (the caller keeps that order: the input order decides).
 */
export const visibleChats = <T extends { chatId: string; projectId?: number | null }>(
    chats: readonly T[],
    showArchived: boolean
): T[] => {
    if (showArchived) return [...chats];
    return chats.filter((chat) => !isChatArchived(chat));
};

/** The archive key of a chat row: its id and its project (a project chat follows the project). */
export const chatArchiveKey = (chat: {
    chatId: string;
    project?: { projectId?: number | null } | null;
}): { chatId: string; projectId: number | null } => ({
    chatId: chat.chatId,
    projectId: chat.project?.projectId ?? null,
});

/** React binding: whether this chat (or its project) is archived, re-rendering on change. */
export const useIsChatArchived = (
    chat: { chatId: string; project?: { projectId?: number | null } | null } | null | undefined
): boolean => {
    useArchiveState();
    return chat != null && isChatArchived(chatArchiveKey(chat));
};

/** React binding: whether this project is archived, re-rendering when that changes. */
export const useIsProjectArchived = (projectId: number | null | undefined): boolean => {
    const state = useArchiveState();
    return projectId != null && state.archivedProjects.some((p) => p.projectId === projectId);
};

/**
 * Whether a note's comments are closed because its project or chat is archived (MIP-1693, Ken
 * 2026-11-22: sharing stays allowed, comments do not). `host` is the note's comment host: a task note
 * carries a `projectId`, a chat note a `chatId`. A chat note's chat is matched by its id as text.
 */
export const isNoteCommentingArchived = (
    state: ArchiveSnapshot,
    host: { projectId?: number | null; chatId?: number | string | null }
): boolean =>
    (host.projectId != null &&
        state.archivedProjects.some((p) => p.projectId === host.projectId)) ||
    (host.chatId != null && state.archivedChannelIds.has(String(host.chatId)));

/** React binding: re-renders the caller whenever the archive state changes. */
export const useArchiveState = (): ArchiveSnapshot =>
    useSyncExternalStore(subscribeArchive, getArchiveSnapshot, getArchiveSnapshot);

/** Test helper: back to nothing archived. */
export const resetArchiveStateForTests = (): void => {
    publish(EMPTY);
};
