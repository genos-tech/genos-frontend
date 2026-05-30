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
// Post-v3 cutover, only the two read-status mutation paths remain.
// Everything else (chat list / messages / threads / flags / pins) lives
// in `channelService` and persists via the v3 IDB hydrate/snapshot
// pipeline.

export type ChatRequests = {
    markAllChatActivityAsRead: {
        req: {
            accessToken: string;
            myself: UserProps;
            chatType: number;
            chatId: number;
            activityMessages: ActivityMessageProps[];
        };
        res: ActivityMessageProps[] | { error: string };
    };
};

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

export type TasksRequests = {
    addTask: { req: { task: TaskTableProps }; res: void };
    loadProjectTasks: {
        req: { myself: UserProps; accessToken: string; projectId: number };
        res: void;
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
};

// ---- activity channel -----------------------------------------------------

export type ActivityRequests = {
    addActivityMessage: { req: { activityMessage: ActivityMessageProps }; res: void };
    loadActivityHistory: {
        req: { myself: UserProps; accessToken: string };
        res: void;
    };
    popActivityMessages: {
        req: { myself: UserProps };
        res: ActivityMessageProps[];
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
    popSpecificUser: { req: { userId: number }; res: UserProps | null };
    popTeamMembers: { req: { myself: UserProps }; res: UserProps[] };
    popTeamUsers: {
        req: { myself: UserProps };
        res: Record<string, UserProps> | { error: string };
    };
};
