import { PartialBlock } from "@blocknote/core";

export type MyNoteMetaProps = {
    noteType: number;
    noteId: number;
    parentNoteId: number | null;
    title: string;
    tsUpdated: string;
    error?: string;
};

export type MyNoteProps = {
    noteType: number;
    teamId: string;
    ownerId: string;
    roleId: number;
    noteId: number;
    parentNoteId: number | null;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: MyNoteProps[];
};

export type MyNoteMetaTreeNode = MyNoteMetaProps & {
    children: MyNoteMetaTreeNode[];
};

export type TaskNoteMetaProps = {
    noteType: number;
    noteId: number;
    parentNoteId: number | null;
    projectId: number;
    taskId: number;
    projectName?: string;
    taskTitle?: string;
    // Human-readable id of the note's task ("GEN-42"). Used as the
    // sidebar task-folder label; falls back via `formatTaskDisplayId`
    // to "#<taskId>" when absent.
    displayId?: string | null;
    // Task-hierarchy hints used by the sidebar to nest notes under
    // Project → Milestone → Task → Subtask. Optional for backwards-
    // compatibility with older API responses; missing fields fall the
    // note back to a "loose task at project level".
    parentTaskId?: number | null;
    parentTaskTitle?: string | null;
    // Parent task's human-readable id, for the L3-subtask-collapse
    // case where the sidebar groups the note under the parent task's
    // folder.
    parentTaskDisplayId?: string | null;
    parentTaskIsMilestone?: boolean | null;
    isMilestone?: boolean;
    milestoneId?: number | null;
    milestoneTitle?: string | null;
    title: string;
    tsUpdated: string;
    error?: string;
};

export type TaskNoteProps = {
    noteType: number;
    teamId: string;
    ownerId: string;
    roleId: number;
    noteId: number;
    parentNoteId: number | null;
    projectId: number;
    taskId: number;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: TaskNoteProps[];
};

export type TaskNoteMetaTreeNode = TaskNoteMetaProps & {
    children: TaskNoteMetaTreeNode[];
};

export type ChatNoteMetaProps = {
    noteType: number;
    noteId: number;
    parentNoteId: number | null;
    chatType: number;
    chatTypeName?: string;
    chatName?: string;
    chatId: number;
    isThread: boolean;
    threadId: number;
    title: string;
    tsUpdated: string;
    error?: string;
};

export type ChatNoteProps = {
    noteType: number;
    teamId: string;
    ownerId: string;
    roleId: number;
    noteId: number;
    parentNoteId: number | null;
    chatType: number;
    chatId: number;
    isThread: boolean;
    threadId: number;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: ChatNoteProps[];
};

export type ChatNoteMetaTreeNode = ChatNoteMetaProps & {
    children: ChatNoteMetaTreeNode[];
};

// Role members on a note (owner / editor / viewer)
export type NoteRoleMember = {
    userId: string;
    userName: string;
    avatarUrl: string | null;
    roleId: number;
    tsCreated: string;
};

// Personal notes shared with me by another user
export type SharedNoteMetaProps = MyNoteMetaProps & {
    ownerId: string;
    ownerName: string;
    roleId: number;
};

export type SharedNoteMetaTreeNode = SharedNoteMetaProps & {
    children: SharedNoteMetaTreeNode[];
};

// Version history
export type NoteVersionEditor = {
    userId: string;
    userName: string;
    avatarUrl: string | null;
};

export type NoteVersionMeta = {
    versionNo: number;
    editor: NoteVersionEditor | null;
    title: string;
    restoredFromVersionNo: number | null;
    tsCreatedAt: string;
    tsUpdatedAt: string;
};

export type NoteVersionDetail = NoteVersionMeta & {
    body: PartialBlock[] | any[];
};
