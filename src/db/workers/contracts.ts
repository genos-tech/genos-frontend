// Typed request/reply contracts for the worker pool.
//
// Every channel exposes a record of `requestType → { req, res }` shapes.
// The corresponding worker module imports the same record and registers
// handlers against it, so the main thread and worker stay in sync.
//
// Contracts are split by category so each worker only carries the code it
// needs (smaller bundle, faster startup).

import type { UserProps } from "../../types/admin";
import type { ActivityMessageProps } from "../../types/chat";
import type { InboxItemProps } from "../../types/common";
import type { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";
import type { TaskTableProps } from "../../types/tasks";

type AnyNote = MyNoteProps | TaskNoteProps | ChatNoteProps;

// ---- chat channel ---------------------------------------------------------
//
// Retired after the v3 cutover. The last handler (markAllChatActivityAsRead)
// is inlined in `useMarkAllChatActivityRead`; everything else lives in
// `channelService`. No `ChatRequests` / `chatChannel` remain.

// ---- notes channel --------------------------------------------------------

export type NotesRequests = {
    addNote: { req: { note: AnyNote; noteType: number }; res: void };
    checkNoteExists: { req: { noteId: number; noteType: number }; res: boolean };
    loadAllNotes: {
        req: { myself: UserProps; accessToken: string };
        res: void;
    };
};

// ---- tasks channel --------------------------------------------------------

/** What a project load tells the caller: the statuses the store now holds for the project
 *  (null = all) and the server's per-status counts over the whole project (null when the
 *  answer carried none: an all-status load, or an API without the parameter). */
export type LoadedProjectTasks = {
    statuses: string[] | null;
    statusCounts: Record<string, number> | null;
};

export type TasksRequests = {
    addTask: { req: { task: TaskTableProps }; res: void };
    loadProjectTasks: {
        req: {
            myself: UserProps;
            accessToken: string;
            projectId: number;
            /** The statuses the caller needs held (MIP-2000); null = all of them. The store
             *  keeps what it already holds when that is wider (see `StatusScope`). */
            statuses: string[] | null;
        };
        res: LoadedProjectTasks;
    };
    /** Which statuses the stored rows of a project hold, from its watermark's record (MIP-2000):
     *  `known` is false when the project has no watermark (never loaded here). */
    readProjectTaskScope: {
        req: { projectId: number };
        res: { known: boolean; statuses: string[] | null };
    };
    loadTeamTasks: {
        req: { myself: UserProps; accessToken: string };
        res: void;
    };
    popSpecificProjectTasks: {
        req: { projectId: number; targetStatuses: string[] };
        res: TaskTableProps[];
    };
};

// ---- inbox channel --------------------------------------------------------

export type InboxRequests = {
    addInboxItem: { req: { inboxItem: InboxItemProps }; res: void };
    loadInbox: { req: { myself: UserProps; accessToken: string }; res: void };
    popInboxItems: { req: Record<string, never>; res: InboxItemProps[] };
    /** After the member switches an AI source on or off from an Inbox card (MIP-1227): the
     *  stored rows of that source carry the new state, so a reload does not draw "Turn this
     *  off" for something already off. Turning a source off changes no row on the server, so
     *  the incremental sync would never bring the new state back. */
    patchInboxAiSource: {
        req: { kind: "digest" | "schedule"; scheduleId?: string; enabled: boolean };
        res: void;
    };
    /** After the member has looked at an item long enough to count as read (MIP-1292): flip
     *  `isRead` on the stored rows and nothing else. Reads each row before writing, so it never
     *  writes back a stale copy of anything else on it. */
    markInboxItemsRead: { req: { itemIds: number[] }; res: void };
    /** The reverse, after the member marks a card unread (MIP-1627): the same single-column
     *  patch, so it too never writes back a stale copy of anything else on the row. */
    markInboxItemsUnread: { req: { itemIds: number[] }; res: void };
};

// ---- activity channel -----------------------------------------------------

export type ActivityRequests = {
    addActivityMessage: { req: { activityMessage: ActivityMessageProps }; res: void };
    loadActivityHistory: {
        // `forceFull` forces a full reload instead of the default
        // incremental delta — the wake refresh sets it so a cross-device
        // `is_read` flip (which the `ts_created_at`-keyed delta can't see)
        // gets re-fetched. Optional; defaults to incremental.
        req: { myself: UserProps; accessToken: string; forceFull?: boolean };
        res: void;
    };
    popActivityMessages: {
        req: { myself: UserProps };
        res: ActivityMessageProps[];
    };
    /** Forget the activity rows of notes that no longer exist (MIP-1457). `res` = rows removed. */
    deleteNoteActivities: {
        req: { noteType: 1 | 2 | 3; noteIds: number[] };
        res: number;
    };
    updateActivityReadStatus: {
        req: {
            accessToken: string;
            myself: UserProps;
            activityId: string;
            isRead: boolean;
            activityMessages: ActivityMessageProps[];
        };
        res: ActivityMessageProps[] | { error: string };
    };
};

// ---- users channel --------------------------------------------------------

export type UsersRequests = {
    addUser: { req: { user: UserProps }; res: void };
    loadTeamMembers: {
        req: { myself: UserProps; accessToken: string };
        res: UserProps[];
    };
    // The ids the roster listed as deleted accounts (MIP-1820), as kept in IDB.
    popDeletedUserIds: { req: Record<string, never>; res: string[] };
    popSpecificUser: { req: { userId: number }; res: UserProps | null };
    popTeamMembers: { req: { myself: UserProps }; res: UserProps[] };
    popTeamUsers: {
        req: { myself: UserProps };
        res: Record<string, UserProps> | { error: string };
    };
};
