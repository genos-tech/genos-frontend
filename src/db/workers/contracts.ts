// Typed request/reply contracts for the worker pool.
//
// Every channel exposes a record of `requestType → { req, res }` shapes.
// The corresponding worker module imports the same record and registers
// handlers against it, so the main thread and worker stay in sync.
//
// Contracts are split by category so each worker only carries the code it
// needs (smaller bundle, faster startup).

import type { UserProps } from "../../types/admin";
import type {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
} from "../../types/chat";
import type { InboxItemProps } from "../../types/common";
import type { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";
import type { TaskTableProps } from "../../types/tasks";

type AnyNote = MyNoteProps | TaskNoteProps | ChatNoteProps;

type HistoryLoadReq = { myself: UserProps; accessToken: string };
type HistoryLoadRes = "done";

// ---- chat channel ---------------------------------------------------------

export type ChatRequests = {
    addChat: { req: { chat: AllChatProps; chatType: number }; res: "done" };
    addMessage: { req: { message: MessageProps; chatType: number }; res: "done" };
    addThreadMessage: {
        req: { threadMessage: ThreadMessageProps; chatType: number };
        res: "done";
    };
    addFlaggedMessage: { req: { message: FlaggedMessageProps }; res: "done" };
    popFlaggedMessages: { req: Record<string, never>; res: FlaggedMessageProps[] };
    checkKnownChat: { req: { chatId: number; chatType: number }; res: boolean };
    loadDMHistory: { req: HistoryLoadReq; res: HistoryLoadRes };
    loadGMHistory: { req: HistoryLoadReq; res: HistoryLoadRes };
    loadMDMHistory: { req: HistoryLoadReq; res: HistoryLoadRes };
    loadPMHistory: { req: HistoryLoadReq; res: HistoryLoadRes };
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
    popAllChats: { req: Record<string, never>; res: AllChatProps[] };
    popLatestChat: { req: { chatType: number }; res: ChatProps | null };
    popSpecificChat: {
        req: { chatId: number; chatType: number };
        res: AllChatProps | null;
    };
    popSpecificMessages: {
        req: { chatId: number; chatType: number };
        res: MessageProps[];
    };
    popSpecificThreadMessages: {
        req: { chatId: number; threadId: number; chatType: number };
        res: ThreadMessageProps[];
    };
    updateReadStatus: {
        req: {
            accessToken: string;
            myself: UserProps;
            chatType: number;
            chatId: number;
            isThread: boolean;
            threadId: number;
            lastReadMessageId: number;
        };
        res: "done";
    };
};

// ---- notes channel --------------------------------------------------------

export type NotesRequests = {
    addNote: { req: { note: AnyNote; noteType: number }; res: "done" };
    checkNoteExists: { req: { noteId: number; noteType: number }; res: boolean };
    loadAllNotes: {
        req: { myself: UserProps; accessToken: string };
        res: "done";
    };
};

// ---- tasks channel --------------------------------------------------------

export type TasksRequests = {
    addTask: { req: { task: TaskTableProps }; res: "done" };
    loadProjectTasks: {
        req: { myself: UserProps; accessToken: string; projectId: number };
        res: "done";
    };
    loadTeamTasks: {
        req: { myself: UserProps; accessToken: string };
        res: "done";
    };
    popSpecificProjectTasks: {
        req: { projectId: number; targetStatuses: string[] };
        res: TaskTableProps[];
    };
};

// ---- inbox channel --------------------------------------------------------

export type InboxRequests = {
    addInboxItem: { req: { inboxItem: InboxItemProps }; res: "done" };
    loadInbox: { req: { myself: UserProps; accessToken: string }; res: "done" };
    popInboxItems: { req: Record<string, never>; res: InboxItemProps[] };
};

// ---- activity channel -----------------------------------------------------

export type ActivityRequests = {
    addActivityMessage: { req: { activityMessage: ActivityMessageProps }; res: "done" };
    loadActivityHistory: {
        req: { myself: UserProps; accessToken: string };
        res: "done";
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
    addUser: { req: { user: UserProps }; res: "done" };
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
