import { PartialBlock } from "@blocknote/core";

export type MyNoteMetaProps = {
    noteType: number;
    noteId: number;
    parentNoteId: number | null;
    // Sidebar folder membership (PersonalNoteFolder). Only meaningful
    // on root notes — children follow their root. Optional for
    // backwards-compatibility with older API responses.
    folderId?: number | null;
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
    folderId?: number | null;
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

// User-created sidebar folder for personal notes. A pure organization
// layer — folders never appear in tabs/search/recents/favorites and
// are never shared. Nested via `parentFolderId`.
export type MyNoteFolderProps = {
    folderId: number;
    parentFolderId: number | null;
    name: string;
    tsCreated?: string;
    tsUpdated?: string;
};

export type MyNoteFolderTreeNode = MyNoteFolderProps & {
    childFolders: MyNoteFolderTreeNode[];
    // Root-level notes filed in this folder (each carries its own
    // child-note subtree via `children`).
    notes: MyNoteMetaTreeNode[];
};

// Result of merging the folder list with the note tree for the My
// Notes sidebar section: nested folders plus the notes not in any
// folder.
export type MyNoteFolderForest = {
    rootFolders: MyNoteFolderTreeNode[];
    rootNotes: MyNoteMetaTreeNode[];
};

// ---------------------------------------------------------------------
// Team Notes — the shared "general" space.
//
// Notes here are personal notes (noteType 1); the FOLDER carries the
// ACL, which is why a team folder extends MyNoteFolderProps rather than
// being its own thing. `visibility` is the folder's OWN setting and is
// null when it inherits; `effectiveVisibility` is what it actually
// behaves as once resolved up the chain.
// ---------------------------------------------------------------------
export type NoteFolderVisibility = "public" | "private";

export type NoteFolderTagProps = {
    tagId: number;
    name: string;
    // Chip background + foreground. Stored as a PAIR (not derived) so a
    // folder tag renders identically to a project label — the palette
    // hand-picks a readable text colour per swatch.
    color: string | null;
    textColor: string | null;
};

export type TeamNoteFolderProps = MyNoteFolderProps & {
    visibility: NoteFolderVisibility | null;
    effectiveVisibility: NoteFolderVisibility | null;
    myRoleId: number;
    ownerId: string;
    ownerName: string | null;
    memberCount: number;
    tags: NoteFolderTagProps[];
};

export type TeamNoteFolderTreeNode = TeamNoteFolderProps & {
    childFolders: TeamNoteFolderTreeNode[];
    notes: MyNoteMetaTreeNode[];
};

export type TeamNoteFolderForest = {
    rootFolders: TeamNoteFolderTreeNode[];
    // Notes whose folder isn't readable shouldn't reach the client at
    // all, so this stays empty in practice — it exists so the team
    // forest can reuse `buildMyNoteFolderForest` unchanged.
    rootNotes: MyNoteMetaTreeNode[];
};

// A note in the team space. Same extension SharedNoteMetaProps makes,
// since both surface notes owned by someone else.
export type TeamNoteMetaProps = MyNoteMetaProps & {
    ownerId: string;
    ownerName: string | null;
    roleId: number;
};

// One row of a team folder's roster. `viaGroupType`/`viaGroupId` record
// that the grant came from expanding a group rather than an individual
// pick, so the UI can show "invited via @eng-team" and offer a re-sync.
export type TeamNoteFolderMemberProps = {
    userId: string;
    userName: string;
    avatarUrl: string | null;
    roleId: number;
    viaGroupType: "mention_group" | "project" | "gm" | null;
    viaGroupId: string | null;
    tsCreated: string;
};

// A group that can be expanded into folder members in one click.
export type NoteFolderInviteGroup = {
    type: "mention_group" | "project" | "gm";
    id: string;
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
