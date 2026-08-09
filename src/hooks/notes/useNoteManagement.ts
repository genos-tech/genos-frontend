import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NoteService } from "../../db/services/note.service";
import { DatabaseUtils } from "../../db/utils/database";
import { createEmptyChatNote } from "../../features/notes/chat-notes/services/createEmptyChatNote";
import { deleteChatNote } from "../../features/notes/chat-notes/services/deleteChatNote";
import { loadChatNoteMeta } from "../../features/notes/chat-notes/services/loadChatNoteMeta";
import { loadChatNotesByChatId } from "../../features/notes/chat-notes/services/loadChatNotesByChatId";
import { moveChatNote as moveChatNoteApi } from "../../features/notes/chat-notes/services/moveChatNote";
import { addNote } from "../../features/notes/common/services/addNote";
// NOTE: `applyNoteBodyToYjs` is imported DYNAMICALLY at its single call
// site below, not here. Its module statically pulls @blocknote/core,
// @blocknote/core/yjs, @hocuspocus/provider and yjs — i.e. the whole
// ~724 kB gzip vendor-editor chunk — and this hook is reachable from
// App.tsx through useServiceInitialization, so a static import puts
// that chunk in the entry's critical path for every page load,
// including signin. See vite.config.ts' manualChunks comments.
import { deleteNoteRole } from "../../features/notes/common/services/deleteNoteRole";
import { loadNoteRoles } from "../../features/notes/common/services/loadNoteRoles";
import { loadNoteVersions } from "../../features/notes/common/services/loadNoteVersions";
import { loadSharedNotesMeta } from "../../features/notes/common/services/loadSharedNotesMeta";
import { loadSpecificNote } from "../../features/notes/common/services/loadSpecificNote";
import { restoreNoteVersion as restoreNoteVersionApi } from "../../features/notes/common/services/restoreNoteVersion";
import { updateNoteRole } from "../../features/notes/common/services/updateNoteRole";
import {
    bucketFromNoteType,
    noteTypeFromBucket,
    toBackendNoteType,
} from "../../features/notes/common/utils/noteTypeAlias";
import {
    addNoteFavorite,
    FavoriteNotesMetaResponse,
    loadFavoriteNotesMeta,
    removeNoteFavorite,
} from "../../features/notes/favorite-notes/services";
import { createEmptyMyNote } from "../../features/notes/my-notes/services/createEmptyMyNote";
import { createMyNoteFolder as createMyNoteFolderApi } from "../../features/notes/my-notes/services/createMyNoteFolder";
import { deleteMyNote } from "../../features/notes/my-notes/services/deleteMyNote";
import { deleteMyNoteFolder as deleteMyNoteFolderApi } from "../../features/notes/my-notes/services/deleteMyNoteFolder";
import { loadMyNoteFolders } from "../../features/notes/my-notes/services/loadMyNoteFolders";
import { loadMyNoteMeta } from "../../features/notes/my-notes/services/loadMyNoteMeta";
import { moveMyNoteToFolder as moveMyNoteToFolderApi } from "../../features/notes/my-notes/services/moveMyNoteToFolder";
import { updateMyNoteFolder as updateMyNoteFolderApi } from "../../features/notes/my-notes/services/updateMyNoteFolder";
import {
    loadRecentNotesMeta,
    RecentNotesMetaResponse,
    recordNoteOpen as recordNoteOpenApi,
} from "../../features/notes/recent-notes/services";
import { createEmptyTaskNote } from "../../features/notes/task-notes/services/createEmptyTaskNote";
import { deleteTaskNote } from "../../features/notes/task-notes/services/deleteTaskNote";
import { loadTaskNoteMeta } from "../../features/notes/task-notes/services/loadTaskNoteMeta";
import { moveTaskNote as moveTaskNoteApi } from "../../features/notes/task-notes/services/moveTaskNote";
import {
    CreateTeamFolderInput,
    createTeamNoteFolder as createTeamNoteFolderApi,
} from "../../features/notes/team-notes/services/createTeamNoteFolder";
import {
    DeleteTeamFolderResult,
    deleteTeamNoteFolder as deleteTeamNoteFolderApi,
} from "../../features/notes/team-notes/services/deleteTeamNoteFolder";
import { loadTeamNoteFolders } from "../../features/notes/team-notes/services/loadTeamNoteFolders";
import { loadTeamNotesMeta } from "../../features/notes/team-notes/services/loadTeamNotesMeta";
import { updateTeamNoteFolder as updateTeamNoteFolderApi } from "../../features/notes/team-notes/services/updateTeamNoteFolder";
import { onTaskTouched } from "../../features/tasks/services/taskEvents";
import { fmt, getMessages } from "../../i18n";
import { UserProps } from "../../types/admin";
import {
    ChatNoteMetaProps,
    ChatNoteMetaTreeNode,
    ChatNoteProps,
    MyNoteFolderForest,
    MyNoteFolderProps,
    MyNoteMetaProps,
    MyNoteMetaTreeNode,
    MyNoteProps,
    NoteFolderVisibility,
    NoteRoleMember,
    NoteVersionMeta,
    SharedNoteMetaProps,
    SharedNoteMetaTreeNode,
    TaskNoteMetaProps,
    TaskNoteMetaTreeNode,
    TaskNoteProps,
    TeamNoteFolderForest,
    TeamNoteFolderProps,
    TeamNoteMetaProps,
} from "../../types/notes";
import {
    buildChatNoteTree,
    buildMyNoteFolderForest,
    buildMyNoteTree,
    buildSharedNoteTree,
    buildTaskNoteTree,
    collectDescendantFolderIds,
    collectFolderAncestorIds,
    collectNoteDescendantIds,
} from "../../utils/note";
import { initCurrentChatNoteChain, updataChatNoteChain } from "./chatNote";
import { initCurrentMyNoteChain, updataMyNoteChain } from "./myNote";
import { updataTaskNoteChain } from "./taskNote";
import { ChatPanelNoteApi, useChatPanelNote } from "./useChatPanelNote";
import { getCachedNote, upsertNoteCache } from "./useNoteData";
import { NoteBucket, NoteTabsApi, noteToTab, useNoteTabs } from "./useNoteTabs";

/** Optional overrides for the create-note handlers. Used by markdown
 *  import: `title` replaces the auto-numbered "New … Note (n)" name and
 *  `body` seeds the note with parsed blocks instead of the empty
 *  placeholder paragraph. */
export interface NoteCreateOverrides {
    title?: string;
    body?: unknown[];
    /** Skip opening a notes-page tab for the created note. Used by the
     *  modal-hosted task preview's "New Note" button, which shows the
     *  note by re-targeting the hosting UrlLinkModal instead — a page
     *  tab opened underneath the dialog would just be surprise state
     *  the next time the user visits the notes page. Cache/sidebar
     *  bookkeeping still runs. */
    skipOpenTab?: boolean;
}

export interface NoteManagementState {
    // New tab strip API (synchronous; replaces the legacy
    // tabItems/selectedTabIndex/loadNote dance).
    tabsApi: NoteTabsApi;
    // Isolated chat-page note panel state (used by ChatNotePanel and
    // ThreadChatPaneHeader; never touches notes-home tabs).
    chatPanelApi: ChatPanelNoteApi;

    // Note type and tabs
    currentNoteType: number;
    setCurrentNoteType: (type: number) => void;
    tabItems: any[];
    setTabItems: (items: any[]) => void;
    selectedTabIndex: number;
    setSelectedTabIndex: (index: number) => void;

    // Chat notes
    currentChatNote: ChatNoteProps | null;
    setCurrentChatNote: (note: ChatNoteProps | null) => void;
    chatNoteMeta: ChatNoteMetaProps[];
    setChatNoteMeta: (meta: ChatNoteMetaProps[]) => void;
    currentChatNoteChain: ChatNoteMetaTreeNode[] | undefined;
    setCurrentChatNoteChain: (chain: ChatNoteMetaTreeNode[]) => void;
    getChatNoteMeta: () => Promise<void>;

    // Task notes
    currentTaskNote: TaskNoteProps | null;
    setCurrentTaskNote: (note: TaskNoteProps | null) => void;
    taskNoteMeta: TaskNoteMetaProps[];
    setTaskNoteMeta: (meta: TaskNoteMetaProps[]) => void;
    currentTaskNoteChain: TaskNoteMetaTreeNode[] | undefined;
    setCurrentTaskNoteChain: (chain: TaskNoteMetaTreeNode[]) => void;
    getTaskNoteMeta: () => Promise<void>;

    // My notes
    currentMyNote: MyNoteProps | null;
    setCurrentMyNote: (note: MyNoteProps | null) => void;
    myNoteMeta: MyNoteMetaProps[];
    setMyNoteMeta: (meta: MyNoteMetaProps[]) => void;
    // Title/timestamp sync for a personal-backed note, applied to
    // whichever of the My / Shared / Team lists holds it.
    patchPersonalNoteMeta: (noteId: number, title: string, tsUpdated: string) => void;
    currentMyNoteChain: MyNoteMetaTreeNode[] | undefined;
    setCurrentMyNoteChain: (chain: MyNoteMetaTreeNode[]) => void;
    getMyNoteMeta: () => Promise<void>;

    // My-note sidebar folders (user-created organization layer).
    // Folders never appear in tabs/search/recents — they only shape
    // the My Notes sidebar section.
    myNoteFolders: MyNoteFolderProps[];
    myNoteFolderForest: MyNoteFolderForest;
    getMyNoteFolders: () => Promise<void>;
    createMyNoteFolder: (name: string, parentFolderId: number | null) => Promise<void>;
    renameMyNoteFolder: (folderId: number, name: string) => Promise<void>;
    // Returns false when the move was rejected (e.g. into own descendant).
    moveMyNoteFolder: (folderId: number, newParentFolderId: number | null) => Promise<boolean>;
    deleteMyNoteFolder: (folderId: number) => Promise<void>;
    moveMyNoteToFolder: (noteId: number, folderId: number | null) => Promise<void>;
    isFolderExpanded: (folderId: number) => boolean;
    toggleFolderExpanded: (folderId: number) => void;
    expandFolder: (folderId: number) => void;

    // Sidebar DnD re-anchors: move a task/chat note (and its descendant
    // subtree, cascaded server-side) to a different task / channel.
    moveTaskNoteToTask: (noteId: number, projectId: number, taskId: number) => Promise<void>;
    moveChatNoteToChat: (
        noteId: number,
        chatType: number,
        channelId: string | number
    ) => Promise<void>;

    // Sidebar note deletion — delete any note by id (not just the open
    // one), so the sidebar "⋯" row menu can delete without opening the
    // note first. Resolves to false when blocked because the note still
    // has child notes (same guard as the note-header delete flow).
    deleteMyNoteById: (noteId: number) => Promise<boolean>;
    deleteTaskNoteById: (noteId: number) => Promise<boolean>;
    deleteChatNoteById: (noteId: number) => Promise<boolean>;

    // Favorite notes
    favoriteNotes: FavoriteNotesMetaResponse | null;
    setFavoriteNotes: (notes: FavoriteNotesMetaResponse | null) => void;
    favoriteNoteIds: Set<string>;
    getFavoriteNotesMeta: () => Promise<void>;
    toggleFavorite: (noteId: number, noteType: number) => Promise<boolean>;
    isNoteFavorited: (noteId: number, noteType: number) => boolean;

    // Recent notes
    recentNotes: RecentNotesMetaResponse | null;
    setRecentNotes: (notes: RecentNotesMetaResponse | null) => void;
    getRecentNotesMeta: () => Promise<void>;
    recordNoteOpen: (noteId: number, noteType: number) => Promise<void>;

    // Note role management (sharing)
    currentNoteMembers: NoteRoleMember[];
    setCurrentNoteMembers: (members: NoteRoleMember[]) => void;
    loadNoteMembers: (noteType: number, noteId: number) => Promise<void>;
    grantNoteRole: (
        noteType: number,
        noteId: number,
        targetUserId: string,
        roleId: number
    ) => Promise<void>;
    revokeNoteRole: (noteType: number, noteId: number, targetUserId: string) => Promise<void>;

    // Note version history
    currentNoteVersions: NoteVersionMeta[];
    setCurrentNoteVersions: (versions: NoteVersionMeta[]) => void;
    loadNoteVersionsFor: (noteType: number, noteId: number) => Promise<void>;
    // Optimistic head update after the local user saves. If the head is
    // by `myself` and within the coalesce window, bumps its tsUpdatedAt;
    // otherwise prepends a synthetic head so the chip flips to "just now
    // by me" without waiting for the next full refresh.
    bumpNoteVersionsHead: (noteType: number, noteId: number) => void;
    restoreNoteVersion: (noteType: number, noteId: number, versionNo: number) => Promise<boolean>;
    // Bumped by `restoreNoteVersion` to force `useNoteEditorCore`'s
    // identity-based resync branch to fire even though the note's
    // noteType/noteId didn't change. Consumers pass this through as the
    // `resyncSignal` prop on the editor hook.
    noteResyncNonce: number;

    // Shared-with-me personal notes (drives the noteType=4 sidebar bucket)
    // Team Notes — the shared "general" space. Notes here are personal
    // notes (noteType 1) whose FOLDER carries the ACL, so they open
    // through the same tabs/editor path as My Notes; only the sidebar
    // bucket differs.
    teamNoteFolders: TeamNoteFolderProps[];
    teamNoteFolderForest: TeamNoteFolderForest;
    teamNoteMeta: TeamNoteMetaProps[];
    teamNoteMetaTree: MyNoteMetaTreeNode[];
    getTeamNoteFolders: () => Promise<void>;
    getTeamNoteMeta: () => Promise<void>;
    createTeamNoteFolder: (input: CreateTeamFolderInput) => Promise<TeamNoteFolderProps | null>;
    renameTeamNoteFolder: (folderId: number, name: string) => Promise<void>;
    setTeamNoteFolderVisibility: (
        folderId: number,
        visibility: NoteFolderVisibility | null
    ) => Promise<void>;
    moveTeamNoteFolder: (folderId: number, newParentFolderId: number | null) => Promise<boolean>;
    deleteTeamNoteFolder: (folderId: number) => Promise<DeleteTeamFolderResult>;

    sharedNoteMeta: SharedNoteMetaProps[];
    setSharedNoteMeta: (meta: SharedNoteMetaProps[]) => void;
    sharedNoteMetaTree: SharedNoteMetaTreeNode[];
    getSharedNoteMeta: () => Promise<void>;

    // Visibility states
    isTaskNoteVisible: boolean;
    setIsTaskNoteVisible: (visible: boolean) => void;
    isTaskVisibleInNote: boolean;
    setIsTaskVisibleInNote: (visible: boolean) => void;

    // Note metadata trees (derived from the meta arrays — no setters)
    myNoteMetaTree: MyNoteMetaTreeNode[];
    taskNoteMetaTree: TaskNoteMetaTreeNode[];
    chatNoteMetaTree: ChatNoteMetaTreeNode[];
    allNoteIdChains: Record<string, number[]>;
    setAllNoteIdChains: (chains: Record<string, number[]>) => void;

    // Note tree expand/collapse state, lifted out of NoteTreeRenderer so we
    // don't pay one useState + useEffect per rendered node. Chain-driven
    // auto-expand is additive — once opened (auto or manual) a node stays
    // open until the user explicitly collapses it.
    expandNode: (noteType: number, noteId: number) => void;
    isNodeExpanded: (noteType: number, noteId: number) => boolean;
    toggleNodeExpanded: (noteType: number, noteId: number) => void;

    // Note creation functions. `handleCreateNewChatNote` returns the
    // freshly created note so the chat-page panel (which mirrors a
    // separate `chatPanelApi.note` instead of `useNM.currentChatNote`)
    // can pipe it into `chatPanelApi.setNote(...)` — otherwise creating
    // a child note from the chat-page header doesn't repoint the panel
    // at the new note.
    handleCreateNewChatNote: (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number,
        chatName?: string,
        opts?: NoteCreateOverrides
    ) => Promise<ChatNoteProps | null>;

    handleCreateNewChatNoteIfNotExist: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number,
        chatName?: string
    ) => Promise<void>;

    // Resolves to the created note (mirrors handleCreateNewChatNote) so
    // callers that show it themselves — the modal-hosted task preview —
    // can build its URL; null when creation failed or was skipped.
    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number,
        title?: string,
        opts?: NoteCreateOverrides
    ) => Promise<TaskNoteProps | null>;

    handleCreateNewMyNote: (
        parentNoteId: number | null,
        folderId?: number | null,
        opts?: NoteCreateOverrides
    ) => Promise<void>;

    // Note loading function
    loadNote: (noteType: number, noteId: number, nextTabIndex: number) => Promise<void>;

    // Initialize note states
    initializeNoteStates: () => void;
    resetNoteStates: () => void;
    popInitialNote: () => Promise<void>;
}

// Cheap structural equality for the meta/folder arrays a background
// refresh re-fetches. They're small, flat, and serialized in a stable
// server-side order, so JSON comparison is both correct and far cheaper
// than the re-render it avoids.
const sameJson = (a: unknown, b: unknown): boolean => {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
};

export const useNoteManagement = (
    myself: UserProps,
    accessToken: string | null
): NoteManagementState => {
    // Initialize NoteService
    const noteService = new NoteService();
    // Note type and tabs
    const [currentNoteType, setCurrentNoteType] = useState<number>(() => {
        const stored = Number(localStorage.getItem("currentNoteType") || "1");
        // 0 was the Home dashboard, which no longer exists. Anyone whose
        // last session ended there has it persisted, and would otherwise
        // boot into a section that renders nothing.
        return stored === 0 ? 1 : stored;
    });
    const [tabItems, setTabItems] = useState<any[]>([]);
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);

    // New tab API — synchronous tab operations + persistence-driven
    // rehydrate. This is the source of truth going forward; the legacy
    // `tabItems`/`selectedTabIndex` above are kept temporarily for
    // unmigrated consumers and will be removed in a follow-up cleanup.
    const tabsApi = useNoteTabs({ myself, accessToken });

    // Chat notes
    const [currentChatNote, setCurrentChatNote] = useState<ChatNoteProps | null>(null);
    const [chatNoteMeta, setChatNoteMeta] = useState<ChatNoteMetaProps[]>([]);

    // Isolated chat-panel state. Decoupled from the notes-home tab strip
    // so opening/saving a chat note from a thread chat header never
    // touches `tabsApi.tabs` (root cause of the "snap-back" / "click does
    // nothing" bugs in the legacy architecture).
    const chatPanelApi = useChatPanelNote({
        myself,
        accessToken,
        onMetaRefreshed: (meta) => setChatNoteMeta(meta),
    });
    const [currentChatNoteChain, setCurrentChatNoteChain] = useState<
        ChatNoteMetaTreeNode[] | undefined
    >(undefined);
    const [newlyCreatedChatNotes, setNewlyCreatedChatNotes] = useState<ChatNoteProps[]>([]);

    // Task notes
    const [currentTaskNote, setCurrentTaskNote] = useState<TaskNoteProps | null>(null);
    const [taskNoteMeta, setTaskNoteMeta] = useState<TaskNoteMetaProps[]>([]);
    const [currentTaskNoteChain, setCurrentTaskNoteChain] = useState<
        TaskNoteMetaTreeNode[] | undefined
    >(undefined);
    const [newlyCreatedTaskNotes, setNewlyCreatedTaskNotes] = useState<TaskNoteProps[]>([]);

    // My notes
    const [currentMyNote, setCurrentMyNote] = useState<MyNoteProps | null>(null);
    const [myNoteMeta, setMyNoteMeta] = useState<MyNoteMetaProps[]>([]);
    const [currentMyNoteChain, setCurrentMyNoteChain] = useState<MyNoteMetaTreeNode[] | undefined>(
        undefined
    );
    const [newlyCreatedMyNotes, setNewlyCreatedMyNotes] = useState<MyNoteProps[]>([]);

    // My-note sidebar folders. Empty against an older backend (the
    // loader resolves to []), which degrades the sidebar to the flat
    // folder-less tree.
    const [myNoteFolders, setMyNoteFolders] = useState<MyNoteFolderProps[]>([]);

    // Favorite notes
    const [favoriteNotes, setFavoriteNotes] = useState<FavoriteNotesMetaResponse | null>(null);
    const [favoriteNoteIds, setFavoriteNoteIds] = useState<Set<string>>(new Set());

    // Recent notes
    const [recentNotes, setRecentNotes] = useState<RecentNotesMetaResponse | null>(null);

    // Role members on the currently-opened note
    const [currentNoteMembers, setCurrentNoteMembers] = useState<NoteRoleMember[]>([]);

    // Version history of the currently-opened note. Latest version sits
    // at index 0 (matches the backend's ordering).
    const [currentNoteVersions, setCurrentNoteVersions] = useState<NoteVersionMeta[]>([]);

    // Monotonic counter that forces `useNoteEditorCore` to re-seed local
    // `title`/`body` from `currentNote` even when the note identity hasn't
    // changed — used after a restore, where noteType/noteId stay the same
    // but the body is rewritten under us.
    const [noteResyncNonce, setNoteResyncNonce] = useState<number>(0);

    // Shared-with-me personal notes (drives the noteType=4 sidebar bucket)
    const [teamNoteFolders, setTeamNoteFolders] = useState<TeamNoteFolderProps[]>([]);
    const [teamNoteMeta, setTeamNoteMeta] = useState<TeamNoteMetaProps[]>([]);
    const [sharedNoteMeta, setSharedNoteMeta] = useState<SharedNoteMetaProps[]>([]);

    // Visibility states
    const [isTaskNoteVisible, setIsTaskNoteVisible] = useState(false);
    const [isTaskVisibleInNote, setIsTaskVisibleInNote] = useState(false);

    // Note metadata trees — derived from the meta arrays. Previously stored in
    // their own `useState` and re-built by a `useEffect` keyed on the meta
    // dep, which cost an extra commit per meta update (render → effect →
    // setState → re-render). The `useMemo` form computes the tree in the
    // same render, with the same identity stability since meta is mutated
    // via fresh-array setters (`[...prev, item]` / `loadXxxMeta` returns).
    const myNoteMetaTree = useMemo<MyNoteMetaTreeNode[]>(
        () => buildMyNoteTree(myNoteMeta),
        [myNoteMeta]
    );
    // Folder forest for the My Notes sidebar section: nested folders
    // with their filed root notes, plus the unfiled root notes.
    const myNoteFolderForest = useMemo<MyNoteFolderForest>(
        () => buildMyNoteFolderForest(myNoteFolders, myNoteMetaTree),
        [myNoteFolders, myNoteMetaTree]
    );
    const taskNoteMetaTree = useMemo<TaskNoteMetaTreeNode[]>(
        () => buildTaskNoteTree(taskNoteMeta),
        [taskNoteMeta]
    );
    const chatNoteMetaTree = useMemo<ChatNoteMetaTreeNode[]>(
        () => buildChatNoteTree(chatNoteMeta),
        [chatNoteMeta]
    );
    // Team notes reuse the personal builders wholesale: a team note IS a
    // personal note, and `buildMyNoteFolderForest` already surfaces a
    // folder whose parent is missing from the input at the root — which
    // is exactly what a subfolder shared with you but whose parent isn't
    // needs.
    const teamNoteMetaTree = useMemo<MyNoteMetaTreeNode[]>(
        () => buildMyNoteTree(teamNoteMeta),
        [teamNoteMeta]
    );

    const teamNoteFolderForest = useMemo<TeamNoteFolderForest>(
        () =>
            buildMyNoteFolderForest(
                teamNoteFolders,
                teamNoteMetaTree
            ) as unknown as TeamNoteFolderForest,
        [teamNoteFolders, teamNoteMetaTree]
    );

    const sharedNoteMetaTree = useMemo<SharedNoteMetaTreeNode[]>(
        () => buildSharedNoteTree(sharedNoteMeta),
        [sharedNoteMeta]
    );
    const [allNoteIdChains, setAllNoteIdChains] = useState<Record<string, number[]>>({});

    // Lifted note-tree open/closed state. Set of `${noteType}-${noteId}` keys
    // for currently-expanded nodes. Replaces per-row `useState(open)` +
    // `useEffect` in NoteTreeRenderer, which were running once per visible
    // tree node (typically hundreds at heavy scale).
    const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

    const isNodeExpanded = useCallback(
        (noteType: number, noteId: number) => expandedNodeIds.has(`${noteType}-${noteId}`),
        [expandedNodeIds]
    );

    const toggleNodeExpanded = useCallback((noteType: number, noteId: number) => {
        const key = `${noteType}-${noteId}`;
        setExpandedNodeIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const expandNode = useCallback((noteType: number, noteId: number) => {
        const key = `${noteType}-${noteId}`;
        setExpandedNodeIds((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

    // Folder expansion shares `expandedNodeIds` under a `folder-` key
    // namespace — folder ids can't collide with the `${noteType}-` note
    // keys, and the sticky auto-expand effect below can add folder keys
    // the same way it adds note keys.
    const isFolderExpanded = useCallback(
        (folderId: number) => expandedNodeIds.has(`folder-${folderId}`),
        [expandedNodeIds]
    );

    const toggleFolderExpanded = useCallback((folderId: number) => {
        const key = `folder-${folderId}`;
        setExpandedNodeIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const expandFolder = useCallback((folderId: number) => {
        const key = `folder-${folderId}`;
        setExpandedNodeIds((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

    const chatTypeLabels: Record<number, string> = {
        1: "DM",
        2: "GM",
        3: "PM",
        4: "DM",
    };

    // Chat Note related
    const handleCreateNewChatNote = async (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number,
        chatName?: string,
        opts?: NoteCreateOverrides
    ): Promise<ChatNoteProps | null> => {
        if (!accessToken) return null;

        try {
            const templates = getMessages().notes.create.templates;
            const title =
                opts?.title ??
                fmt(parentNoteId ? templates.childChatNote : templates.newChatNote, {
                    count: newlyCreatedChatNotes.length + 1,
                });
            const newNote = await createEmptyChatNote(
                myself,
                parentNoteId,
                chatType,
                chatId,
                isThread,
                threadId,
                title,
                accessToken,
                opts?.body
            );

            if (newNote) {
                const chatNote: ChatNoteProps = { noteType: 3, ...newNote };
                setNewlyCreatedChatNotes([...newlyCreatedChatNotes, chatNote]);
                setCurrentChatNote(chatNote);
                addNote(3, chatNote);
                upsertNoteCache(chatNote);
                tabsApi.openTab(noteToTab(chatNote, myself.teamId));
                recordNoteOpen(chatNote.noteId, 3);

                const freshMeta: ChatNoteMetaProps[] = await loadChatNoteMeta(myself, accessToken);
                if (freshMeta.length > 0) {
                    setChatNoteMeta(freshMeta);
                }
                return chatNote;
            }
            return null;
        } catch (error) {
            console.error("Error creating chat note:", error);
            return null;
        }
    };

    const handleCreateNewChatNoteIfNotExist = async (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number,
        chatName?: string
    ) => {
        if (!accessToken) return;

        try {
            const chatNotes: ChatNoteProps[] = await loadChatNotesByChatId(
                myself,
                chatType,
                chatId,
                isThread,
                threadId,
                accessToken
            );

            if (chatNotes.length > 0) {
                const newNote = chatNotes[0];
                setCurrentChatNote(newNote);
                addNote(3, newNote);
                upsertNoteCache(newNote);
                tabsApi.openTab(noteToTab(newNote, myself.teamId));
                recordNoteOpen(newNote.noteId, 3);

                const freshMeta: ChatNoteMetaProps[] = await loadChatNoteMeta(myself, accessToken);
                if (freshMeta.length > 0) {
                    setChatNoteMeta(freshMeta);
                }
            } else {
                await handleCreateNewChatNote(
                    null,
                    chatType,
                    chatId,
                    isThread,
                    threadId,
                    chatName
                );
            }
        } catch (error) {
            console.error("Error loading or creating chat note:", error);
        }
    };

    const getChatNoteMeta = async () => {
        const loadedNotes: ChatNoteMetaProps[] = await loadChatNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setChatNoteMeta(loadedNotes);
        }
    };

    initCurrentChatNoteChain({
        chatNoteMeta: chatNoteMeta,
        currentChatNoteChain: currentChatNoteChain,
        setCurrentChatNoteChain: setCurrentChatNoteChain,
    });

    updataChatNoteChain({
        currentChatNote: currentChatNote,
        chatNoteMetaTree: chatNoteMetaTree,
        currentChatNoteChain: currentChatNoteChain,
        setCurrentChatNoteChain: setCurrentChatNoteChain,
        allNoteIdChains: allNoteIdChains,
        setAllNoteIdChains: setAllNoteIdChains,
        tabItems: tabItems,
        selectedTabIndex: selectedTabIndex,
    });

    // Task Note related
    const handleCreateNewTaskNote = async (
        parentNoteId: number | null,
        projectId: number,
        taskId: number,
        title?: string,
        opts?: NoteCreateOverrides
    ): Promise<TaskNoteProps | null> => {
        if (!accessToken) return null;

        try {
            const templates = getMessages().notes.create.templates;
            const noteTitle =
                opts?.title ??
                fmt(parentNoteId ? templates.childTaskNote : templates.newTaskNote, {
                    count: newlyCreatedTaskNotes.length + 1,
                });
            const newNote = await createEmptyTaskNote(
                myself,
                parentNoteId,
                projectId,
                taskId,
                noteTitle,
                accessToken,
                opts?.body
            );

            if (newNote) {
                const taskNote: TaskNoteProps = { noteType: 2, ...newNote };
                setNewlyCreatedTaskNotes([...newlyCreatedTaskNotes, newNote]);
                setCurrentTaskNote(taskNote);
                addNote(2, taskNote);
                upsertNoteCache(taskNote);
                if (!opts?.skipOpenTab) {
                    tabsApi.openTab(noteToTab(taskNote, myself.teamId));
                }
                recordNoteOpen(taskNote.noteId, 2);

                // Carry the new Project → Milestone → Task → Subtask
                // hierarchy fields from the create response (now populated
                // by the backend) so the sidebar's `groupTaskNotes` can
                // slot the note into its correct folder immediately —
                // including the human-readable `taskTitle` / `projectName`
                // labels (without these the sidebar falls back to
                // "Task #<id>" / "Project <id>" until the next meta refetch).
                // `title` (the caller-supplied task title) is the last-
                // resort fallback used by the in-task "New Note" button.
                const newNoteAny = newNote as any;
                setTaskNoteMeta((prev) => [
                    {
                        noteType: taskNote.noteType,
                        noteId: taskNote.noteId,
                        parentNoteId: taskNote.parentNoteId,
                        projectId: taskNote.projectId,
                        taskId: taskNote.taskId,
                        projectName: newNoteAny.projectName,
                        taskTitle: newNoteAny.taskTitle ?? title,
                        // Carry the human-readable id so the sidebar's
                        // task-folder label renders "<code>-<n>"
                        // immediately. Falls back via
                        // `formatTaskDisplayId` to "#<taskId>" when the
                        // create response didn't populate it.
                        displayId: newNoteAny.displayId,
                        title: taskNote.title,
                        tsUpdated: taskNote.tsUpdated,
                        parentTaskId: newNoteAny.parentTaskId,
                        parentTaskTitle: newNoteAny.parentTaskTitle,
                        parentTaskDisplayId: newNoteAny.parentTaskDisplayId,
                        parentTaskIsMilestone: newNoteAny.parentTaskIsMilestone,
                        isMilestone: newNoteAny.isMilestone,
                        milestoneId: newNoteAny.milestoneId,
                        milestoneTitle: newNoteAny.milestoneTitle,
                    },
                    ...prev,
                ]);
                return taskNote;
            }
        } catch (error) {
            console.error("Error creating task note:", error);
        }
        return null;
    };

    const getTaskNoteMeta = async () => {
        const loadedNotes: TaskNoteMetaProps[] = await loadTaskNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setTaskNoteMeta(loadedNotes);
        }
    };

    updataTaskNoteChain({
        currentTaskNote: currentTaskNote,
        taskNoteMetaTree: taskNoteMetaTree,
        currentTaskNoteChain: currentTaskNoteChain,
        setCurrentTaskNoteChain: setCurrentTaskNoteChain,
        allNoteIdChains: allNoteIdChains,
        setAllNoteIdChains: setAllNoteIdChains,
        tabItems: tabItems,
        selectedTabIndex: selectedTabIndex,
    });

    // My Note related
    const handleCreateNewMyNote = async (
        parentNoteId: number | null,
        folderId: number | null = null,
        opts?: NoteCreateOverrides
    ) => {
        if (!accessToken) return;

        // Which sidebar space the note belongs to. A folder id alone
        // can't tell us — a My Notes folder id and a Team Notes folder
        // id are drawn from the same sequence — so ask the loaded team
        // folder list. Without this the note lands in My Notes state
        // locally even though the server filed it in the team space,
        // and it only appears in the right section after a reload.
        const isTeam = folderId != null && teamNoteFolders.some((f) => f.folderId === folderId);
        const bucket: NoteBucket = isTeam ? "team" : "my";

        try {
            const templates = getMessages().notes.create.templates;
            const defaultTitleTemplate = isTeam
                ? parentNoteId
                    ? templates.childTeamNote
                    : templates.newTeamNote
                : parentNoteId
                  ? templates.childMyNote
                  : templates.newMyNote;
            const noteTitle =
                opts?.title ??
                fmt(defaultTitleTemplate, {
                    count: newlyCreatedMyNotes.length + 1,
                });
            const newNote = await createEmptyMyNote(
                myself,
                parentNoteId,
                noteTitle,
                accessToken,
                folderId,
                opts?.body
            );

            if (newNote) {
                const myNote: MyNoteProps = { noteType: 1, ...newNote };
                setNewlyCreatedMyNotes([...newlyCreatedMyNotes, newNote]);
                setCurrentMyNote(newNote);
                addNote(1, newNote);
                upsertNoteCache(myNote);
                tabsApi.openTab(noteToTab(myNote, myself.teamId, bucket));
                recordNoteOpen(myNote.noteId, 1);

                const metaRow = {
                    noteType: newNote.noteType,
                    noteId: newNote.noteId,
                    parentNoteId: newNote.parentNoteId,
                    // Server-confirmed placement, falling back to the
                    // requested folder for older backends that don't
                    // echo folderId.
                    folderId: newNote.folderId ?? folderId ?? null,
                    title: newNote.title,
                    tsUpdated: newNote.tsUpdated,
                };

                // Route the optimistic row to the section the note
                // actually belongs to. `/note/personal/meta/` excludes
                // team-folder notes server-side, so putting a team note
                // in `myNoteMeta` made it appear under My Notes until
                // the next reload — and never under Team Notes.
                if (isTeam) {
                    setTeamNoteMeta((prev) => [
                        { ...metaRow, ownerId: myself.userId, ownerName: null, roleId: 1 },
                        ...prev,
                    ]);
                    setCurrentNoteType(8);
                } else {
                    setMyNoteMeta((prev) => [metaRow, ...prev]);
                }
                if (folderId != null) expandFolder(folderId);
            }
        } catch (error) {
            console.error("Error creating my note:", error);
        }
    };

    // Patch a personal-backed note's title/timestamp wherever it lives.
    //
    // My, Shared and Team notes all render through `MyNoteEditorPanel`,
    // but each sidebar section reads its OWN meta list. The panel used to
    // patch `myNoteMeta` alone, so a rename in the Team (or Shared)
    // section updated the tab strip and never the sidebar row — the note
    // simply kept its old title until a reload.
    //
    // Patching by noteId across all three lists keeps that from having to
    // be rediscovered every time a new personal-backed bucket appears:
    // the row is updated in whichever list actually holds it, and the
    // others are left untouched.
    const patchPersonalNoteMeta = (noteId: number, title: string, tsUpdated: string) => {
        const patch = <T extends { noteId: number; title: string; tsUpdated: string }>(
            rows: T[]
        ): T[] => {
            let hit = false;
            const next = rows.map((r) => {
                if (r.noteId !== noteId) return r;
                hit = true;
                return { ...r, title, tsUpdated };
            });
            // Preserve identity when this list doesn't hold the note, so
            // the other sections' memoized trees don't rebuild.
            return hit ? next : rows;
        };
        setMyNoteMeta(patch);
        setSharedNoteMeta(patch);
        setTeamNoteMeta(patch);
    };

    // Same "whichever list holds it" treatment for the other two
    // mutations a personal-backed note undergoes. Each preserves array
    // identity when the note isn't in that list, so unrelated sections
    // don't rebuild their memoized trees.
    const removePersonalNoteMeta = (noteIds: Set<number>) => {
        const drop = <T extends { noteId: number }>(rows: T[]): T[] =>
            rows.some((r) => noteIds.has(r.noteId))
                ? rows.filter((r) => !noteIds.has(r.noteId))
                : rows;
        setMyNoteMeta(drop);
        setSharedNoteMeta(drop);
        setTeamNoteMeta(drop);
    };

    const setPersonalNoteFolderMeta = (noteId: number, folderId: number | null) => {
        const move = <T extends { noteId: number }>(rows: T[]): T[] =>
            rows.some((r) => r.noteId === noteId)
                ? rows.map((r) =>
                      r.noteId === noteId ? { ...r, folderId, parentNoteId: null } : r
                  )
                : rows;
        setMyNoteMeta(move);
        setSharedNoteMeta(move);
        setTeamNoteMeta(move);
    };

    // A note blocks deletion when it still has children, wherever it
    // lives — checking `myNoteMeta` alone let a team parent be deleted
    // and orphan its children.
    const personalNoteHasChildren = (noteId: number): boolean =>
        myNoteMeta.some((n) => n.parentNoteId === noteId) ||
        sharedNoteMeta.some((n) => n.parentNoteId === noteId) ||
        teamNoteMeta.some((n) => n.parentNoteId === noteId);

    const getMyNoteMeta = async () => {
        const loadedNotes: MyNoteMetaProps[] = await loadMyNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setMyNoteMeta(loadedNotes);
        }
    };

    // External invalidator: the Spotlight / thread / note agent's
    // create_note & update_note tools mutate notes outside this hook, so
    // the sidebar meta wouldn't reflect an agent-written note until a
    // manual reload. Those tools dispatch a `noteChanged` window event
    // (mirrors the `todoChanged` pattern in useTodoGroups); we refetch the
    // personal + task meta on it — the `myNoteMetaTree` /
    // `taskNoteMetaTree` memos then flow the new note into the sidebar.
    // Refs keep the listener subscribed once while always calling the
    // latest fetchers (which are re-created each render).
    //
    // When the event's detail carries the backend's note ref with a BODY
    // change (an approved agent update_note), the sidebar refetch isn't
    // enough: the REST row changed but the note's collaborative Yjs doc
    // did not, and the editors seed from REST only while the Yjs doc is
    // empty — an ever-collaborated note would silently revert the agent's
    // edit on next open. So we also refetch the fresh body (cache-
    // bypassing, same as the version-restore flow), write it through the
    // caches, and push it into the Yjs doc via a short headless collab
    // session. If that push fails (collab down) and the note is the one
    // currently open, fall back to the restore flow's resync nonce so the
    // open editor writes the fresh body into Yjs itself on reconnect.
    const applyAgentNoteUpdate = async (ref: {
        note_id: number;
        note_type: "personal" | "task";
    }) => {
        if (!accessToken) return;
        const typeCode = ref.note_type === "task" ? 2 : 1;
        const fetched = await loadSpecificNote(myself, typeCode, ref.note_id, accessToken);
        if (!fetched || fetched.error) return;
        addNote(typeCode, fetched);
        upsertNoteCache(fetched);
        const isCurrent =
            typeCode === 1
                ? currentMyNote?.noteId === ref.note_id
                : currentTaskNote?.noteId === ref.note_id;
        if (isCurrent) {
            if (typeCode === 1) setCurrentMyNote(fetched as MyNoteProps);
            else setCurrentTaskNote(fetched as TaskNoteProps);
        }
        // Loaded on demand — this is a rare, already-async path (an
        // approved agent note write), so paying a chunk fetch here is
        // free next to keeping the editor stack out of every page load.
        const { applyNoteBodyToYjs, noteDocumentName } = await import(
            "../../features/notes/common/services/applyNoteBodyToYjs"
        );
        const status = await applyNoteBodyToYjs({
            documentName: noteDocumentName(ref.note_type, ref.note_id),
            blocks: fetched.body ?? [],
            accessToken,
        });
        if (status !== "applied") {
            if (isCurrent) {
                setNoteResyncNonce((n) => n + 1);
            } else {
                console.warn(
                    "noteChanged: Yjs apply failed for closed note; REST body saved, " +
                        "collab doc will lag until the next successful apply/open.",
                    ref
                );
            }
        }
    };
    const getMyNoteMetaRef = useRef(getMyNoteMeta);
    getMyNoteMetaRef.current = getMyNoteMeta;
    const getTaskNoteMetaRef = useRef(getTaskNoteMeta);
    getTaskNoteMetaRef.current = getTaskNoteMeta;
    const applyAgentNoteUpdateRef = useRef(applyAgentNoteUpdate);
    applyAgentNoteUpdateRef.current = applyAgentNoteUpdate;

    // Keep the task-note sidebar's FOLDERS honest after a task's relations
    // change.
    //
    // The sidebar groups task notes by Project → Milestone → Task, and those
    // ancestry fields (`milestoneId` / `milestoneTitle` / `parentTaskId`)
    // are SERVER fields on the note meta — not joined client-side from
    // `allTasks`. So re-parenting a task (new milestone, new parent, moved
    // sprint) left its note filed under the old folder until a page reload,
    // because nothing re-fetched the meta.
    //
    // Subscribing to the shared task-touched bus covers every surface that
    // saves through `useSendUpdatedTask` — preview, modal, inline table
    // edits — rather than patching one call site. The `taskNoteMeta` guard
    // keeps this rare: only a task that actually HAS a note can move a
    // folder, so an ordinary task edit costs one in-memory scan and no
    // request.
    const taskNoteMetaRef = useRef(taskNoteMeta);
    taskNoteMetaRef.current = taskNoteMeta;
    useEffect(() => {
        return onTaskTouched(({ taskId, kind }) => {
            if (kind !== "update") return;
            const hasNote = taskNoteMetaRef.current.some(
                (n) => Number(n.taskId) === Number(taskId)
            );
            if (!hasNote) return;
            void getTaskNoteMetaRef.current();
        });
    }, []);
    useEffect(() => {
        const handler = (e: Event) => {
            void getMyNoteMetaRef.current();
            void getTaskNoteMetaRef.current();
            const ref = (e as CustomEvent).detail as
                | { note_id?: number; note_type?: string; changed_fields?: string[] }
                | undefined;
            if (
                ref?.note_id &&
                (ref.note_type === "personal" || ref.note_type === "task") &&
                Array.isArray(ref.changed_fields) &&
                ref.changed_fields.includes("body")
            ) {
                void applyAgentNoteUpdateRef.current({
                    note_id: ref.note_id,
                    note_type: ref.note_type,
                });
            }
        };
        window.addEventListener("noteChanged", handler);
        return () => window.removeEventListener("noteChanged", handler);
    }, []);

    // ------------------------------------------------------------------
    // My-note sidebar folders
    // ------------------------------------------------------------------

    const getMyNoteFolders = async () => {
        const loaded = await loadMyNoteFolders(myself, accessToken);
        setMyNoteFolders(loaded);
    };

    const createMyNoteFolderAction = async (name: string, parentFolderId: number | null) => {
        if (!accessToken) return;
        const created = await createMyNoteFolderApi(myself, name, parentFolderId, accessToken);
        if (created) {
            setMyNoteFolders((prev) => [...prev, created]);
            // Reveal the new folder immediately.
            if (parentFolderId != null) expandFolder(parentFolderId);
            expandFolder(created.folderId);
        }
    };

    const renameMyNoteFolder = async (folderId: number, name: string) => {
        if (!accessToken) return;
        // Optimistic rename; refetch restores server truth on failure.
        setMyNoteFolders((prev) =>
            prev.map((f) => (f.folderId === folderId ? { ...f, name } : f))
        );
        const updated = await updateMyNoteFolderApi(myself, folderId, { name }, accessToken);
        if (!updated) {
            await getMyNoteFolders();
        }
    };

    const moveMyNoteFolder = async (
        folderId: number,
        newParentFolderId: number | null
    ): Promise<boolean> => {
        if (!accessToken) return false;
        // Client-side cycle pre-check (the picker already disables the
        // subtree; the backend re-validates authoritatively).
        if (newParentFolderId != null) {
            const descendants = collectDescendantFolderIds(myNoteFolders, folderId);
            if (descendants.has(newParentFolderId)) return false;
        }
        setMyNoteFolders((prev) =>
            prev.map((f) =>
                f.folderId === folderId ? { ...f, parentFolderId: newParentFolderId } : f
            )
        );
        const updated = await updateMyNoteFolderApi(
            myself,
            folderId,
            { parentFolderId: newParentFolderId },
            accessToken
        );
        if (!updated) {
            await getMyNoteFolders();
            return false;
        }
        if (newParentFolderId != null) expandFolder(newParentFolderId);
        return true;
    };

    const deleteMyNoteFolderAction = async (folderId: number) => {
        if (!accessToken) return;
        // DESTRUCTIVE (product spec): the backend hard-deletes the whole
        // subtree — descendant folders, notes filed in them, and those
        // notes' child-note chains. Mirror that locally: compute the
        // doomed set, drop it from state, close its tabs, purge local
        // storage. Nothing is re-parented.
        const folderIds = collectDescendantFolderIds(myNoteFolders, folderId);
        const noteIds = new Set<number>(
            myNoteMeta
                .filter((n) => n.folderId != null && folderIds.has(n.folderId))
                .map((n) => n.noteId)
        );
        // Child-note chains hang off parent_note_id with folderId null —
        // BFS them into the doomed set.
        let frontier = new Set<number>(noteIds);
        while (frontier.size > 0) {
            const next = new Set<number>();
            for (const n of myNoteMeta) {
                if (
                    n.parentNoteId != null &&
                    frontier.has(n.parentNoteId) &&
                    !noteIds.has(n.noteId)
                ) {
                    noteIds.add(n.noteId);
                    next.add(n.noteId);
                }
            }
            frontier = next;
        }

        const purgeLocal = async (ids: Iterable<number>) => {
            for (const id of ids) {
                const tab = tabsApi.tabs.find((t) => t.kind === "my" && t.noteId === id);
                if (tab) tabsApi.closeTab(tab.id);
                try {
                    await noteService.deletePersonalNote(id);
                    await DatabaseUtils.deleteYjsDatabase(`my-note:${id}`);
                } catch {
                    // Local cache cleanup is best-effort.
                }
            }
        };

        setMyNoteFolders((prev) => prev.filter((f) => !folderIds.has(f.folderId)));
        setMyNoteMeta((prev) => prev.filter((n) => !noteIds.has(n.noteId)));
        if (currentMyNote && noteIds.has(currentMyNote.noteId)) {
            setCurrentMyNote(null);
        }
        await purgeLocal(noteIds);

        const result = await deleteMyNoteFolderApi(myself, folderId, accessToken);
        if (!result) {
            // Server refused/failed — restore truth.
            await Promise.all([getMyNoteFolders(), getMyNoteMeta()]);
            return;
        }
        // Server may have destroyed rows this client's meta didn't know
        // about (stale list) — sweep any extras too.
        const extras = result.deletedNoteIds.filter((id) => !noteIds.has(id));
        if (extras.length > 0) {
            setMyNoteMeta((prev) => prev.filter((n) => !extras.includes(n.noteId)));
            await purgeLocal(extras);
        }
    };

    const moveMyNoteToFolderAction = async (noteId: number, folderId: number | null) => {
        if (!accessToken) return;
        // Optimistic meta patch. The backend re-roots the note (folders
        // own ROOT notes), so parentNoteId flips to null too.
        setPersonalNoteFolderMeta(noteId, folderId);
        // Cache write-through — keeps every consumer of the open note
        // (and the next autosave snapshot) on post-move truth. Autosave
        // no longer sends parent_note_id at all, so this is
        // belt-and-suspenders rather than load-bearing.
        if (currentMyNote && currentMyNote.noteId === noteId) {
            setCurrentMyNote({ ...currentMyNote, parentNoteId: null, folderId: folderId });
        }
        const cached = getCachedNote("my", noteId);
        if (cached) {
            upsertNoteCache({
                ...(cached as MyNoteProps),
                parentNoteId: null,
                folderId: folderId,
            });
        }
        try {
            const idbNote = await noteService.getPersonalNote(noteId);
            if (idbNote) {
                await noteService.savePersonalNote({
                    ...idbNote,
                    parentNoteId: null,
                    folderId: folderId,
                });
            }
        } catch {
            // IDB failure is non-fatal — server + in-memory cache are
            // already consistent.
        }
        const moved = await moveMyNoteToFolderApi(myself, noteId, folderId, accessToken);
        if (!moved) {
            await getMyNoteMeta();
            return;
        }
        if (folderId != null) expandFolder(folderId);
    };

    // ------------------------------------------------------------------
    // Sidebar DnD re-anchors (task/chat notes)
    // ------------------------------------------------------------------

    const moveTaskNoteToTask = async (noteId: number, projectId: number, taskId: number) => {
        if (!accessToken) return;
        // The backend cascades the re-anchor to the whole
        // parent_note_id subtree — mirror that optimistically so the
        // sidebar re-groups the entire chain at once.
        const affected = collectNoteDescendantIds(taskNoteMeta, noteId);
        setTaskNoteMeta((prev) =>
            prev.map((n) => (affected.has(n.noteId) ? { ...n, projectId, taskId } : n))
        );
        if (currentTaskNote && affected.has(currentTaskNote.noteId)) {
            setCurrentTaskNote({ ...currentTaskNote, projectId, taskId });
        }
        const cached = getCachedNote("task", noteId);
        if (cached) {
            upsertNoteCache({ ...(cached as TaskNoteProps), projectId, taskId });
        }
        try {
            const idbNote = await noteService.getTaskNote(noteId);
            if (idbNote) {
                await noteService.saveTaskNote({ ...idbNote, projectId, taskId });
            }
        } catch {
            // IDB failure is non-fatal.
        }
        const moved = await moveTaskNoteApi(myself, noteId, taskId, accessToken);
        if (!moved) {
            await getTaskNoteMeta();
            return;
        }
        // Merge the response's enriched hierarchy labels into every
        // affected row — they all anchor to the same target task now,
        // so one label set applies to the whole chain. Saves a full
        // meta refetch.
        setTaskNoteMeta((prev) =>
            prev.map((n) =>
                affected.has(n.noteId)
                    ? {
                          ...n,
                          projectId,
                          taskId,
                          projectName: moved.projectName,
                          taskTitle: moved.taskTitle,
                          displayId: moved.displayId,
                          parentTaskId: moved.parentTaskId,
                          parentTaskTitle: moved.parentTaskTitle,
                          parentTaskDisplayId: moved.parentTaskDisplayId,
                          parentTaskIsMilestone: moved.parentTaskIsMilestone,
                          isMilestone: moved.isMilestone,
                          milestoneId: moved.milestoneId,
                          milestoneTitle: moved.milestoneTitle,
                      }
                    : n
            )
        );
    };

    const moveChatNoteToChat = async (
        noteId: number,
        chatType: number,
        channelId: string | number
    ) => {
        if (!accessToken) return;
        const affected = collectNoteDescendantIds(chatNoteMeta, noteId);
        // PUNCH LIST (v3 chatId migration): ChatNoteMetaProps declares
        // chatId:number / threadId:number, but post-flip chatId carries
        // the channel UUID string and a moved note's threadId is null
        // (thread anchoring is cleared — the old thread root lives in
        // the old channel). Cast at the patch site like the existing
        // stringify-at-comparison call sites do.
        setChatNoteMeta((prev) =>
            prev.map((n) =>
                affected.has(n.noteId)
                    ? {
                          ...n,
                          chatType,
                          chatId: channelId as unknown as number,
                          isThread: false,
                          threadId: null as unknown as number,
                          // Clear the stale label so groupChatNotes
                          // re-resolves the name from allChats.
                          chatName: undefined,
                      }
                    : n
            )
        );
        if (currentChatNote && affected.has(currentChatNote.noteId)) {
            setCurrentChatNote({
                ...currentChatNote,
                chatType,
                chatId: channelId as unknown as number,
                isThread: false,
                threadId: null as unknown as number,
            });
        }
        const cached = getCachedNote("chat", noteId);
        if (cached) {
            upsertNoteCache({
                ...(cached as ChatNoteProps),
                chatType,
                chatId: channelId as unknown as number,
                isThread: false,
                threadId: null as unknown as number,
            });
        }
        try {
            const idbNote = await noteService.getChatNote(noteId);
            if (idbNote) {
                await noteService.saveChatNote({
                    ...idbNote,
                    chatType,
                    chatId: channelId as unknown as number,
                    isThread: false,
                    threadId: null as unknown as number,
                });
            }
        } catch {
            // IDB failure is non-fatal.
        }
        const moved = await moveChatNoteApi(myself, noteId, chatType, channelId, accessToken);
        if (!moved) {
            await getChatNoteMeta();
        }
    };

    // ------------------------------------------------------------------
    // Delete a note by id from the sidebar "⋯" row menu (no need to open
    // it first). Each mirrors its ModalDelete*Note cleanup exactly —
    // guard → backend → tab close → IDB → Yjs → meta filter → clear the
    // open-note slot if it was the one deleted. The child-note guard
    // matches the header flow (a parent note can't be deleted until its
    // children are gone); we resolve false so the caller keeps the modal
    // open with the "child note(s) exist" message.
    // ------------------------------------------------------------------
    const deleteMyNoteById = async (noteId: number): Promise<boolean> => {
        if (!accessToken) return false;
        if (personalNoteHasChildren(noteId)) return false;
        await deleteMyNote(myself, noteId, accessToken);
        const tab = tabsApi.tabs.find((t) => t.kind === "my" && t.noteId === noteId);
        if (tab) tabsApi.closeTab(tab.id);
        try {
            await noteService.deletePersonalNote(noteId);
            await DatabaseUtils.deleteYjsDatabase(`my-note:${noteId}`);
        } catch {
            // Local cache cleanup is best-effort.
        }
        removePersonalNoteMeta(new Set([noteId]));
        // Don't null `currentMyNote` here: `closeTab` above already settled
        // the active tab (to a neighbour, or none), and the active-tab sync
        // effect drives `currentMyNote` off THAT. An extra null-write races
        // the effect and, when a neighbour tab remains, wins without a
        // re-sync (the effect is keyed only on `activeTabId`, which didn't
        // change) — leaving the note pane blank over a valid tab. The
        // note-header delete path (ModalDeleteMyNote → handleCloseTab) never
        // nulls it and works correctly; mirror that.
        return true;
    };

    const deleteTaskNoteById = async (noteId: number): Promise<boolean> => {
        if (!accessToken) return false;
        if (taskNoteMeta.some((n) => n.parentNoteId === noteId)) return false;
        await deleteTaskNote(myself, noteId, accessToken);
        const tab = tabsApi.tabs.find((t) => t.kind === "task" && t.noteId === noteId);
        if (tab) tabsApi.closeTab(tab.id);
        try {
            await noteService.deleteTaskNote(noteId);
            await DatabaseUtils.deleteYjsDatabase(`task-note:${noteId}`);
        } catch {
            // Local cache cleanup is best-effort.
        }
        setTaskNoteMeta((prev) => prev.filter((n) => n.noteId !== noteId));
        // See deleteMyNoteById: `closeTab` + the active-tab sync effect own
        // `currentTaskNote`; a stray null-write here blanks the pane over a
        // surviving neighbour tab.
        return true;
    };

    const deleteChatNoteById = async (noteId: number): Promise<boolean> => {
        if (!accessToken) return false;
        if (chatNoteMeta.some((n) => n.parentNoteId === noteId)) return false;
        await deleteChatNote(myself, noteId, accessToken);
        const tab = tabsApi.tabs.find((t) => t.kind === "chat" && t.noteId === noteId);
        if (tab) tabsApi.closeTab(tab.id);
        try {
            await noteService.deleteChatNote(noteId);
            await DatabaseUtils.deleteYjsDatabase(`chat-note:${noteId}`);
        } catch {
            // Local cache cleanup is best-effort.
        }
        setChatNoteMeta((prev) => prev.filter((n) => n.noteId !== noteId));
        // See deleteMyNoteById: `closeTab` + the active-tab sync effect own
        // `currentChatNote`; a stray null-write here blanks the pane over a
        // surviving neighbour tab.
        return true;
    };

    // Favorite notes functions
    const getFavoriteNotesMeta = async () => {
        const loadedFavorites = await loadFavoriteNotesMeta(myself, accessToken);
        if (loadedFavorites) {
            setFavoriteNotes(loadedFavorites);
            // Build a set of favorited note IDs for quick lookup
            const ids = new Set<string>();
            loadedFavorites.personalNotes.forEach((note) => ids.add(`1-${note.noteId}`));
            loadedFavorites.taskNotes.forEach((note) => ids.add(`2-${note.noteId}`));
            loadedFavorites.chatNotes.forEach((note) => ids.add(`3-${note.noteId}`));
            setFavoriteNoteIds(ids);
        }
    };

    // Favorites are keyed by the BACKEND note type. The sidebar hands us
    // a bucket code, so 4 (shared) and 8 (team) must be normalized first
    // — otherwise a team note's star writes an unknown `note_type: 8`
    // the server rejects, and the local key never matches the one the
    // favorites list is built from.
    const isNoteFavorited = (noteId: number, noteType: number): boolean => {
        return favoriteNoteIds.has(`${toBackendNoteType(noteType)}-${noteId}`);
    };

    const toggleFavorite = async (noteId: number, bucketNoteType: number): Promise<boolean> => {
        if (!accessToken) return false;

        const noteType = toBackendNoteType(bucketNoteType);
        const isFavorited = isNoteFavorited(noteId, noteType);

        try {
            if (isFavorited) {
                const result = await removeNoteFavorite(myself, noteId, noteType, accessToken);
                if (result && !result.isFavorited) {
                    // Remove from local state
                    setFavoriteNoteIds((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(`${noteType}-${noteId}`);
                        return newSet;
                    });
                    // Remove from favoriteNotes
                    if (favoriteNotes) {
                        if (noteType === 1) {
                            setFavoriteNotes({
                                ...favoriteNotes,
                                personalNotes: favoriteNotes.personalNotes.filter(
                                    (n) => n.noteId !== noteId
                                ),
                            });
                        } else if (noteType === 2) {
                            setFavoriteNotes({
                                ...favoriteNotes,
                                taskNotes: favoriteNotes.taskNotes.filter(
                                    (n) => n.noteId !== noteId
                                ),
                            });
                        } else if (noteType === 3) {
                            setFavoriteNotes({
                                ...favoriteNotes,
                                chatNotes: favoriteNotes.chatNotes.filter(
                                    (n) => n.noteId !== noteId
                                ),
                            });
                        }
                    }
                    return false;
                }
            } else {
                const result = await addNoteFavorite(myself, noteId, noteType, accessToken);
                if (result && result.isFavorited) {
                    // Add to local state
                    setFavoriteNoteIds((prev) => {
                        const newSet = new Set(prev);
                        newSet.add(`${noteType}-${noteId}`);
                        return newSet;
                    });
                    // Refresh favorites to get full metadata
                    await getFavoriteNotesMeta();
                    return true;
                }
            }
        } catch (error) {
            console.error("Error toggling favorite:", error);
        }

        return isFavorited;
    };

    // Note role management (sharing) functions
    const loadNoteMembers = async (noteType: number, noteId: number) => {
        if (!accessToken) {
            setCurrentNoteMembers([]);
            return;
        }
        const members = await loadNoteRoles(myself, noteType, noteId, accessToken);
        setCurrentNoteMembers(members);
    };

    const grantNoteRole = async (
        noteType: number,
        noteId: number,
        targetUserId: string,
        roleId: number
    ) => {
        if (!accessToken) return;
        await updateNoteRole(myself, noteType, noteId, targetUserId, roleId, accessToken);
        await loadNoteMembers(noteType, noteId);
    };

    const revokeNoteRole = async (noteType: number, noteId: number, targetUserId: string) => {
        if (!accessToken) return;
        const ok = await deleteNoteRole(myself, noteType, noteId, targetUserId, accessToken);
        if (ok) {
            await loadNoteMembers(noteType, noteId);
        }
    };

    // Note version history
    const VERSION_COALESCE_MS = 5 * 60 * 1000; // mirror the backend window

    const loadNoteVersionsFor = async (noteType: number, noteId: number) => {
        if (!accessToken) {
            setCurrentNoteVersions([]);
            return;
        }
        const versions = await loadNoteVersions(myself, noteType, noteId, accessToken);
        setCurrentNoteVersions(versions);
    };

    // Optimistic head bump after a local save. Same coalesce rules as
    // the backend so the chip flips to "by me · just now" without
    // waiting for a fresh GET.
    const bumpNoteVersionsHead = (_noteType: number, _noteId: number) => {
        setCurrentNoteVersions((prev) => {
            const nowIso = new Date().toISOString();
            const head = prev[0];
            const isMine = head?.editor && String(head.editor.userId) === String(myself.userId);
            const withinWindow =
                head &&
                Date.now() - new Date(head.tsUpdatedAt).getTime() < VERSION_COALESCE_MS &&
                head.restoredFromVersionNo == null;
            if (head && isMine && withinWindow) {
                return [{ ...head, tsUpdatedAt: nowIso }, ...prev.slice(1)];
            }
            const synthetic: NoteVersionMeta = {
                versionNo: (head?.versionNo ?? 0) + 1,
                editor: {
                    userId: String(myself.userId),
                    userName: myself.userName,
                    avatarUrl: myself.avatarImgPath || null,
                },
                title: head?.title ?? "",
                restoredFromVersionNo: null,
                tsCreatedAt: nowIso,
                tsUpdatedAt: nowIso,
            };
            return [synthetic, ...prev];
        });
    };

    const restoreNoteVersion = async (
        noteType: number,
        noteId: number,
        versionNo: number
    ): Promise<boolean> => {
        if (!accessToken) return false;
        const res = await restoreNoteVersionApi(myself, noteType, noteId, versionNo, accessToken);
        if (!res) return false;

        // Bypass both caches (IDB and the in-memory `useNoteData` map) and
        // fetch directly from the backend. The IDB row + the in-memory
        // cache row still hold the pre-restore body, so `loadNote`'s
        // cache-first path would short-circuit and leave the editor
        // showing stale content. Shared (4) and team (8) notes live on
        // the personal note table on the backend, so we alias.
        const backendNoteType = toBackendNoteType(noteType);
        const fetched = await loadSpecificNote(myself, backendNoteType, noteId, accessToken);
        if (fetched && !fetched.error) {
            // Write through every cache layer so the next tab open / data
            // hook sees the restored body, not the pre-restore one.
            addNote(backendNoteType, fetched);
            upsertNoteCache(fetched);
            if (backendNoteType === 1) {
                setCurrentMyNote(fetched as MyNoteProps);
            } else if (backendNoteType === 2) {
                setCurrentTaskNote(fetched as TaskNoteProps);
            } else if (backendNoteType === 3) {
                setCurrentChatNote(fetched as ChatNoteProps);
                // Chat-page panel keeps an isolated copy; refresh it too
                // when the active note matches so the panel reflects the
                // restored body without a tab-switch round-trip.
                const panelNote = chatPanelApi.note;
                if (panelNote && panelNote.noteId === noteId) {
                    chatPanelApi.setNote(fetched as ChatNoteProps);
                }
            }

            // Only bump the resync nonce when we have fresh body data to
            // push into Yjs. Bumping on a fetch failure would replay the
            // stale pre-restore `currentNote.body` into the collab doc
            // and desync the client from the master row.
            setNoteResyncNonce((n) => n + 1);
        }

        // Refresh the version list so the new restore marker shows up.
        await loadNoteVersionsFor(noteType, noteId);
        return true;
    };

    // ------------------------------------------------------------------
    // Team Notes — the shared "general" space
    // ------------------------------------------------------------------

    // Both loaders are now on a poll, so they keep the PREVIOUS array
    // when nothing changed. Without that, every tick hands back a fresh
    // array identity, which invalidates the `useMemo` trees built on it
    // and re-renders the whole sidebar on a timer for no reason.
    const getTeamNoteFolders = async () => {
        const loaded = await loadTeamNoteFolders(myself, accessToken);
        setTeamNoteFolders((prev) => (sameJson(prev, loaded) ? prev : loaded));
    };

    const getTeamNoteMeta = async () => {
        const loaded = await loadTeamNotesMeta(myself, accessToken);
        setTeamNoteMeta((prev) => (sameJson(prev, loaded) ? prev : loaded));
    };

    const createTeamNoteFolderAction = async (
        input: CreateTeamFolderInput
    ): Promise<TeamNoteFolderProps | null> => {
        if (!accessToken) return null;
        const created = await createTeamNoteFolderApi(myself, input, accessToken);
        if (!created) return null;
        setTeamNoteFolders((prev) => [...prev, created]);
        if (input.parentFolderId != null) expandFolder(input.parentFolderId);
        expandFolder(created.folderId);
        return created;
    };

    const renameTeamNoteFolder = async (folderId: number, name: string) => {
        if (!accessToken) return;
        setTeamNoteFolders((prev) =>
            prev.map((f) => (f.folderId === folderId ? { ...f, name } : f))
        );
        const updated = await updateTeamNoteFolderApi(myself, folderId, { name }, accessToken);
        if (!updated) await getTeamNoteFolders();
    };

    const setTeamNoteFolderVisibility = async (
        folderId: number,
        visibility: NoteFolderVisibility | null
    ) => {
        if (!accessToken) return;
        const updated = await updateTeamNoteFolderApi(
            myself,
            folderId,
            { visibility },
            accessToken
        );
        // Always refetch: changing one folder's visibility re-resolves
        // `effectiveVisibility` (and possibly reachability) for its whole
        // subtree, which a local patch can't compute.
        await getTeamNoteFolders();
        if (!updated) await getTeamNoteMeta();
    };

    const moveTeamNoteFolder = async (
        folderId: number,
        newParentFolderId: number | null
    ): Promise<boolean> => {
        if (!accessToken) return false;
        if (newParentFolderId != null) {
            const descendants = collectDescendantFolderIds(teamNoteFolders, folderId);
            if (newParentFolderId === folderId || descendants.has(newParentFolderId)) {
                return false;
            }
        }
        const updated = await updateTeamNoteFolderApi(
            myself,
            folderId,
            { parentFolderId: newParentFolderId },
            accessToken
        );
        // Re-parenting changes inherited access down the subtree.
        await getTeamNoteFolders();
        return Boolean(updated);
    };

    const deleteTeamNoteFolderAction = async (
        folderId: number
    ): Promise<DeleteTeamFolderResult> => {
        if (!accessToken) return { ok: false, blocked: false };
        const result = await deleteTeamNoteFolderApi(myself, folderId, accessToken);
        if (result.ok) {
            // Close tabs for every destroyed note and drop its local
            // caches, mirroring the My Notes folder delete. Team notes
            // are personal notes, so they live under the "my" tab kind
            // and the `my-note:` Yjs room.
            for (const noteId of result.deletedNoteIds) {
                const tab = tabsApi.tabs.find((t) => t.kind === "my" && t.noteId === noteId);
                if (tab) tabsApi.closeTab(tab.id);
                try {
                    await noteService.deletePersonalNote(noteId);
                    await DatabaseUtils.deleteYjsDatabase(`my-note:${noteId}`);
                } catch {
                    // Local cache teardown is best-effort — the server
                    // has already deleted the note.
                }
            }
            const deletedFolders = new Set(result.deletedFolderIds);
            const deletedNotes = new Set(result.deletedNoteIds);
            setTeamNoteFolders((prev) => prev.filter((f) => !deletedFolders.has(f.folderId)));
            setTeamNoteMeta((prev) => prev.filter((n) => !deletedNotes.has(n.noteId)));
        }
        return result;
    };

    // Heal tab buckets once the meta lists can disambiguate them.
    //
    // A tab opened from an activity click, a push URL or a history row
    // is created with bucket "my" — those surfaces only know backend
    // note types, and the team/shared meta may not have loaded yet when
    // the tab is born. Without this, such a tab keeps the My Notes
    // header and highlights the wrong sidebar section for its whole
    // life, surviving even a reload (the bucket is persisted).
    // `updateTabBucket` no-ops when already correct, so this converges
    // instead of looping.
    useEffect(() => {
        for (const tab of tabsApi.tabs) {
            if (tab.kind !== "my" || (tab.bucket ?? "my") !== "my") continue;
            if (teamNoteMeta.some((n) => n.noteId === tab.noteId)) {
                tabsApi.updateTabBucket(tab.noteId, "team");
            } else if (sharedNoteMeta.some((n) => n.noteId === tab.noteId)) {
                tabsApi.updateTabBucket(tab.noteId, "shared");
            }
        }
    }, [tabsApi.tabs, teamNoteMeta, sharedNoteMeta, tabsApi]);

    // Shared-with-me personal notes
    const getSharedNoteMeta = async () => {
        const loaded = await loadSharedNotesMeta(myself, accessToken);
        setSharedNoteMeta(loaded);
    };

    // Recent notes functions
    const getRecentNotesMeta = async () => {
        const loadedRecents = await loadRecentNotesMeta(myself, accessToken);
        if (loadedRecents) {
            setRecentNotes(loadedRecents);
        }
    };

    // Record that the current user just opened a note. Optimistically
    // promote any locally-known matching meta row to the top of its
    // array with a fresh `tsOpenedAt` so the sidebar / home cards
    // reorder immediately, then POST to the backend. If the row isn't
    // already in local state (newly-created note, or a note that had
    // dropped out of the cap), refetch the full meta so the new entry
    // appears with full title/parent/etc.
    const recordNoteOpen = async (noteId: number, noteType: number) => {
        if (!accessToken) return;

        const nowIso = new Date().toISOString();
        let alreadyKnown = false;
        if (recentNotes) {
            if (noteType === 1) {
                alreadyKnown = recentNotes.personalNotes.some((n) => n.noteId === noteId);
            } else if (noteType === 2) {
                alreadyKnown = recentNotes.taskNotes.some((n) => n.noteId === noteId);
            } else if (noteType === 3) {
                alreadyKnown = recentNotes.chatNotes.some((n) => n.noteId === noteId);
            }
        }

        if (alreadyKnown && recentNotes) {
            const promote = <T extends { noteId: number; tsOpenedAt: string }>(arr: T[]): T[] => {
                const idx = arr.findIndex((n) => n.noteId === noteId);
                if (idx === -1) return arr;
                const updated = { ...arr[idx], tsOpenedAt: nowIso };
                return [updated, ...arr.slice(0, idx), ...arr.slice(idx + 1)];
            };
            if (noteType === 1) {
                setRecentNotes({
                    ...recentNotes,
                    personalNotes: promote(recentNotes.personalNotes),
                });
            } else if (noteType === 2) {
                setRecentNotes({
                    ...recentNotes,
                    taskNotes: promote(recentNotes.taskNotes),
                });
            } else if (noteType === 3) {
                setRecentNotes({
                    ...recentNotes,
                    chatNotes: promote(recentNotes.chatNotes),
                });
            }
        }

        try {
            const result = await recordNoteOpenApi(myself, noteId, noteType, accessToken);
            if (result && !alreadyKnown) {
                await getRecentNotesMeta();
            }
        } catch (error) {
            console.error("Error recording note open:", error);
        }
    };

    initCurrentMyNoteChain({
        myNoteMeta: myNoteMeta,
        currentMyNoteChain: currentMyNoteChain,
        setCurrentMyNoteChain: setCurrentMyNoteChain,
    });

    updataMyNoteChain({
        currentMyNote: currentMyNote,
        myNoteMetaTree: myNoteMetaTree,
        currentMyNoteChain: currentMyNoteChain,
        setCurrentMyNoteChain: setCurrentMyNoteChain,
        allNoteIdChains: allNoteIdChains,
        setAllNoteIdChains: setAllNoteIdChains,
        tabItems: tabItems,
        selectedTabIndex: selectedTabIndex,
    });

    // Sticky auto-expand: whenever a chain extends (selecting a deeper note,
    // opening a new tab, etc.), make sure every ancestor is in the expanded
    // set. Never removes — matches the legacy "only auto-expand, don't
    // auto-collapse" rule the per-renderer useEffect enforced.
    //
    // ANCESTORS ONLY. A chain runs root → … → the open note, so its last
    // element is the note itself; expanding that would unfold the open
    // note's own child notes, which is not what "reveal the note I just
    // opened" means. The user still opens them from the row's chevron.
    useEffect(() => {
        setExpandedNodeIds((prev) => {
            let changed = false;
            const next = new Set(prev);
            const addKey = (key: string) => {
                if (!next.has(key)) {
                    next.add(key);
                    changed = true;
                }
            };
            const ancestors = <T>(chain: T[] | undefined): T[] => chain?.slice(0, -1) ?? [];
            ancestors(currentMyNoteChain).forEach((n) => addKey(`1-${n.noteId}`));
            ancestors(currentTaskNoteChain).forEach((n) => addKey(`2-${n.noteId}`));
            ancestors(currentChatNoteChain).forEach((n) => addKey(`3-${n.noteId}`));
            // Deep-link reveal for foldered notes: the note-ancestor
            // chain alone can't open the CONTAINING sidebar folders, so
            // a note deep inside collapsed folders would stay hidden.
            // The chain's first element is the root note, which carries
            // folderId — expand its whole folder-ancestor chain.
            const chainRoot = currentMyNoteChain?.[0];
            if (chainRoot) {
                collectFolderAncestorIds(myNoteFolders, chainRoot.folderId ?? null).forEach(
                    (fid) => addKey(`folder-${fid}`)
                );
            }

            // Team notes get none of the above for free. They aren't in
            // `myNoteMeta`, so `currentMyNoteChain` is empty for them and
            // neither the note-ancestor keys nor the folder reveal above
            // ever fire — which is why opening one from a tab left the
            // Team Notes tree collapsed and nothing highlighted.
            //
            // Resolve the note's own row instead: expand its containing
            // TEAM folder chain, and key its note ancestors on bucket 8,
            // which is the noteType the team rows render with.
            const activeTab = tabsApi.activeTab;
            if (activeTab?.kind === "my" && activeTab.bucket === "team") {
                const row = teamNoteMeta.find((n) => n.noteId === activeTab.noteId);
                if (row) {
                    // Walk up the note-parent chain so a sub-note reveals
                    // its parents, then the folder chain of the root.
                    let cursor: TeamNoteMetaProps | undefined = row;
                    const seen = new Set<number>();
                    while (cursor && !seen.has(cursor.noteId)) {
                        seen.add(cursor.noteId);
                        const parentId: number | null = cursor.parentNoteId;
                        if (parentId == null) break;
                        addKey(`8-${parentId}`);
                        cursor = teamNoteMeta.find((n) => n.noteId === parentId);
                    }
                    collectFolderAncestorIds(
                        teamNoteFolders,
                        cursor?.folderId ?? row.folderId ?? null
                    ).forEach((fid) => addKey(`folder-${fid}`));
                }
            }
            for (const tabKey in allNoteIdChains) {
                const dash = tabKey.indexOf("-");
                if (dash <= 0) continue;
                const typePrefix = tabKey.slice(0, dash);
                const ids = allNoteIdChains[tabKey];
                if (!ids) continue;
                // Same ancestors-only rule: the last id is the tab's own
                // note.
                for (const id of ids.slice(0, -1)) addKey(`${typePrefix}-${id}`);
            }
            return changed ? next : prev;
        });
    }, [
        currentMyNoteChain,
        currentTaskNoteChain,
        currentChatNoteChain,
        allNoteIdChains,
        myNoteFolders,
        // Team reveal depends on the active tab plus both team lists —
        // the folder list often arrives AFTER the tab opens, so this has
        // to re-run when it lands or the reveal is silently skipped.
        tabsApi.activeTab,
        teamNoteMeta,
        teamNoteFolders,
    ]);

    // Initialize note states
    const initializeNoteStates = () => {
        // Reset all note states to initial values
        setCurrentChatNote(null);
        setChatNoteMeta([]);
        setCurrentTaskNote(null);
        setTaskNoteMeta([]);
        setCurrentMyNote(null);
        setMyNoteMeta([]);
        setMyNoteFolders([]);
        setTabItems([]);
        setSelectedTabIndex(0);
        setIsTaskNoteVisible(false);
        setIsTaskVisibleInNote(false);
        setCurrentChatNoteChain(undefined);
        setCurrentMyNoteChain(undefined);
        setCurrentTaskNoteChain(undefined);
        // metaTree state is derived from the meta arrays via useMemo —
        // clearing meta above is sufficient; no separate tree reset needed.
        setNewlyCreatedMyNotes([]);
        setNewlyCreatedTaskNotes([]);
        setNewlyCreatedChatNotes([]);
        setAllNoteIdChains({});
        setRecentNotes(null);
    };

    // Reset note states (for service switching)
    const resetNoteStates = () => {
        setIsTaskNoteVisible(false);
        setIsTaskVisibleInNote(false);
        setCurrentChatNote(null);
        setCurrentTaskNote(null);
        setCurrentMyNote(null);
    };

    // Note loading entry point. Now synchronous in spirit: it opens (or
    // focuses) the tab immediately via `tabsApi.openTab`, and the
    // active-tab effect below fetches the body and populates
    // `currentXxxNote` for legacy consumers. The optional fetch here is
    // only needed when we don't yet know enough about the note to build a
    // tab (no project/task/chat ids), e.g. when called from URL routing.
    const loadNote = async (noteType: number, noteId: number, _nextTabIndex: number) => {
        if (!accessToken) return;
        try {
            // Shared (4) and team (8) notes live in note_type=1 on the
            // backend; those codes exist only to drive the sidebar bucket
            // and the route, so alias to the personal load path here.
            // Capture which SECTION the click came from before the type
            // is normalized — the tab has to carry the bucket from here.
            //
            // A caller saying "my" is a DEFAULT, not knowledge: activity
            // clicks, push URLs and history rows all say 1 because the
            // backend only has three types. Verify it against the loaded
            // meta lists, or a team note opened from any of those paths
            // lands under the My Notes header with no sidebar row. An
            // explicit "shared"/"team" from the sidebar is trusted as-is.
            let bucket = bucketFromNoteType(noteType);
            if (bucket === "my") {
                if (teamNoteMeta.some((n) => n.noteId === noteId)) bucket = "team";
                else if (sharedNoteMeta.some((n) => n.noteId === noteId)) bucket = "shared";
            }
            noteType = toBackendNoteType(noteType);
            if (noteType === 1) {
                const cached = await noteService.getPersonalNote(noteId);
                if (cached) {
                    const myNote: MyNoteProps = { ...cached, noteType: 1 };
                    upsertNoteCache(myNote);
                    tabsApi.openTab(noteToTab(myNote, myself.teamId, bucket));
                    return;
                }
                const fetched: MyNoteProps = await loadSpecificNote(
                    myself,
                    1,
                    noteId,
                    accessToken
                );
                if (fetched && !fetched.error && fetched.noteType === 1) {
                    addNote(1, fetched);
                    upsertNoteCache(fetched);
                    tabsApi.openTab(noteToTab(fetched, myself.teamId, bucket));
                }
                return;
            }
            if (noteType === 2) {
                const cached = await noteService.getTaskNote(noteId);
                if (cached) {
                    const taskNote: TaskNoteProps = { ...cached, noteType: 2 };
                    upsertNoteCache(taskNote);
                    tabsApi.openTab(noteToTab(taskNote, myself.teamId));
                    return;
                }
                const fetched: TaskNoteProps = await loadSpecificNote(
                    myself,
                    2,
                    noteId,
                    accessToken
                );
                if (fetched && !fetched.error && fetched.noteType === 2) {
                    addNote(2, fetched);
                    upsertNoteCache(fetched);
                    tabsApi.openTab(noteToTab(fetched, myself.teamId));
                }
                return;
            }
            const cached = await noteService.getChatNote(noteId);
            if (cached) {
                const chatNote: ChatNoteProps = { ...cached, noteType: 3 };
                upsertNoteCache(chatNote);
                tabsApi.openTab(noteToTab(chatNote, myself.teamId));
                return;
            }
            const fetched: ChatNoteProps = await loadSpecificNote(myself, 3, noteId, accessToken);
            if (fetched && !fetched.error && fetched.noteType === 3) {
                addNote(3, fetched);
                upsertNoteCache(fetched);
                tabsApi.openTab(noteToTab(fetched, myself.teamId));
            }
        } catch (error) {
            console.error("Error loading note:", error);
        }
    };

    // No-op kept for backwards compatibility with `useServiceInitialization`.
    // Tab persistence and rehydration are now driven by `useNoteTabs`.
    const popInitialNote = async () => {
        // tabsApi.rehydrate() runs automatically on team change; no-op here.
        return;
    };

    // Persist current note type to localStorage
    useEffect(() => {
        localStorage.setItem("currentNoteType", currentNoteType.toString());
    }, [currentNoteType]);

    // Sync the legacy `current{My,Task,Chat}Note` fields from the active
    // tab. This keeps unmigrated consumers working while tab switching
    // remains synchronous (the only async path is the data fetch below,
    // scoped to the active tab via React's render lifecycle).
    //
    // To avoid a one-render "blackout" when crossing note types, we
    // first try the in-memory cache synchronously and set the new
    // current* note in the same render the active tab flips. Only if
    // the cache misses do we clear the previous current* values and
    // fall back to the async IDB / backend path.
    useEffect(() => {
        const active = tabsApi.activeTab;
        if (!active) {
            setCurrentMyNote(null);
            setCurrentTaskNote(null);
            setCurrentChatNote(null);
            return;
        }

        // Shared (4) and team (8) notes ride the same tab kind ("my") as
        // owned personal notes, so the bucket has to come off the TAB —
        // it's the only thing that knows which section the note was
        // opened from. This drives the sidebar highlight, the
        // routing-write effect, and `NoteTreeRenderer.isSelected`, so
        // getting it wrong highlights the wrong section entirely.
        //
        // The shared-meta probe stays as a fallback for tabs persisted
        // before buckets existed, which rehydrate without one.
        const personalBucketType = () => {
            if (active.kind === "my" && active.bucket) {
                return noteTypeFromBucket(active.bucket);
            }
            return sharedNoteMeta.some((n) => n.noteId === active.noteId) ? 4 : 1;
        };

        // Synchronous cache hit: write the new current* note, drop the
        // other kinds, and let the renderer pick it up in this render.
        // This is the common case — every `openTab` / `update` path
        // already calls `upsertNoteCache`.
        const cachedSync = getCachedNote(active.kind, active.noteId);
        if (cachedSync) {
            if (active.kind === "my") {
                setCurrentMyNote(cachedSync as MyNoteProps);
                setCurrentTaskNote(null);
                setCurrentChatNote(null);
                setCurrentNoteType(personalBucketType());
            } else if (active.kind === "task") {
                setCurrentTaskNote(cachedSync as TaskNoteProps);
                setCurrentMyNote(null);
                setCurrentChatNote(null);
                setCurrentNoteType(2);
            } else {
                setCurrentChatNote(cachedSync as ChatNoteProps);
                setCurrentMyNote(null);
                setCurrentTaskNote(null);
                setCurrentNoteType(3);
            }
            recordNoteOpen(
                active.noteId,
                active.kind === "my" ? 1 : active.kind === "task" ? 2 : 3
            );
            return;
        }

        // Cache miss: drop other-kind stale notes before the async
        // fetch, so the renderer doesn't momentarily show the previous
        // tab's content. The same-kind value is left alone — if it's
        // for the same noteId, the renderer's keying skips a remount;
        // otherwise it's about to be overwritten.
        if (active.kind !== "my") setCurrentMyNote(null);
        if (active.kind !== "task") setCurrentTaskNote(null);
        if (active.kind !== "chat") setCurrentChatNote(null);

        let cancelled = false;
        const fetchAndSet = async () => {
            try {
                if (active.kind === "my") {
                    const cached = await noteService.getPersonalNote(active.noteId);
                    if (cancelled) return;
                    if (cached) {
                        const myNote: MyNoteProps = { ...cached, noteType: 1 };
                        upsertNoteCache(myNote);
                        setCurrentMyNote(myNote);
                        setCurrentNoteType(personalBucketType());
                        recordNoteOpen(active.noteId, 1);
                        return;
                    }
                    if (!accessToken) return;
                    const fetched: MyNoteProps = await loadSpecificNote(
                        myself,
                        1,
                        active.noteId,
                        accessToken
                    );
                    if (cancelled) return;
                    if (fetched && !fetched.error && fetched.noteType === 1) {
                        addNote(1, fetched);
                        upsertNoteCache(fetched);
                        setCurrentMyNote(fetched);
                        setCurrentNoteType(personalBucketType());
                        recordNoteOpen(active.noteId, 1);
                    }
                    return;
                }
                if (active.kind === "task") {
                    const cached = await noteService.getTaskNote(active.noteId);
                    if (cancelled) return;
                    if (cached) {
                        const taskNote: TaskNoteProps = { ...cached, noteType: 2 };
                        upsertNoteCache(taskNote);
                        setCurrentTaskNote(taskNote);
                        setCurrentNoteType(2);
                        recordNoteOpen(active.noteId, 2);
                        return;
                    }
                    if (!accessToken) return;
                    const fetched: TaskNoteProps = await loadSpecificNote(
                        myself,
                        2,
                        active.noteId,
                        accessToken
                    );
                    if (cancelled) return;
                    if (fetched && !fetched.error && fetched.noteType === 2) {
                        addNote(2, fetched);
                        upsertNoteCache(fetched);
                        setCurrentTaskNote(fetched);
                        setCurrentNoteType(2);
                        recordNoteOpen(active.noteId, 2);
                    }
                    return;
                }
                const cached = await noteService.getChatNote(active.noteId);
                if (cancelled) return;
                if (cached) {
                    const chatNote: ChatNoteProps = { ...cached, noteType: 3 };
                    upsertNoteCache(chatNote);
                    setCurrentChatNote(chatNote);
                    setCurrentNoteType(3);
                    recordNoteOpen(active.noteId, 3);
                    return;
                }
                if (!accessToken) return;
                const fetched: ChatNoteProps = await loadSpecificNote(
                    myself,
                    3,
                    active.noteId,
                    accessToken
                );
                if (cancelled) return;
                if (fetched && !fetched.error && fetched.noteType === 3) {
                    addNote(3, fetched);
                    upsertNoteCache(fetched);
                    setCurrentChatNote(fetched);
                    setCurrentNoteType(3);
                    recordNoteOpen(active.noteId, 3);
                }
            } catch (error) {
                console.error("Error syncing active tab note:", error);
            }
        };
        fetchAndSet();
        return () => {
            cancelled = true;
        };
        // `myself`/`accessToken`/`recordNoteOpen` deliberately omitted to
        // avoid re-running on token refresh or memo churn — the effect
        // re-runs every time the active tab id changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabsApi.activeTabId]);

    // Refresh note role members + versions whenever the active note
    // changes so the header's avatar strip / Share button and the ⋮
    // "View versions" item see fresh data.
    //
    // Depends on the RESOLVED note id, not just `activeTabId`: on a page
    // refresh the restored `activeTabId` is set a tick before `tabs`
    // populate, so `activeTab` (a `tabs.find(...)`) is momentarily null.
    // Keying on `activeTabId` alone, this effect ran once against that
    // null, cleared members/versions, and never re-fired (the id never
    // changed once the tab resolved) — so version history stayed empty
    // until the user switched tabs and back. `activeTab?.noteId` flips
    // from undefined to the real id when the tab resolves, re-running us.
    useEffect(() => {
        const active = tabsApi.activeTab;
        if (!active) {
            setCurrentNoteMembers([]);
            return;
        }
        const nt = active.kind === "my" ? 1 : active.kind === "task" ? 2 : 3;
        loadNoteMembers(nt, active.noteId);
        loadNoteVersionsFor(nt, active.noteId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabsApi.activeTabId, tabsApi.activeTab?.noteId]);

    // Keep the legacy `tabItems`/`selectedTabIndex` mirrors in sync with
    // the new tabsApi state so any unmigrated consumer reads a coherent
    // value. Direct setters are no longer the source of truth — they're
    // overwritten by this effect on every tabsApi change.
    useEffect(() => {
        const items = tabsApi.tabs.map((t) => {
            if (t.kind === "my") {
                return { noteType: 1, noteId: t.noteId, title: t.title } as any;
            }
            if (t.kind === "task") {
                return {
                    noteType: 2,
                    noteId: t.noteId,
                    projectId: t.projectId,
                    taskId: t.taskId,
                    title: t.title,
                } as any;
            }
            return {
                noteType: 3,
                noteId: t.noteId,
                chatType: t.chatType,
                chatId: t.chatId,
                isThread: t.isThread,
                threadId: t.threadId,
                title: t.title,
            } as any;
        });
        setTabItems(items);
        const idx = tabsApi.activeTabId
            ? tabsApi.tabs.findIndex((t) => t.id === tabsApi.activeTabId)
            : -1;
        setSelectedTabIndex(idx === -1 ? 0 : idx);
    }, [tabsApi.tabs, tabsApi.activeTabId]);

    return {
        // New tab-strip + chat-panel APIs (synchronous, race-free).
        tabsApi,
        chatPanelApi,

        // Note type and tabs
        currentNoteType,
        setCurrentNoteType,
        tabItems,
        setTabItems,
        selectedTabIndex,
        setSelectedTabIndex,

        // Chat notes
        currentChatNote,
        setCurrentChatNote,
        chatNoteMeta,
        setChatNoteMeta,
        currentChatNoteChain,
        setCurrentChatNoteChain,
        getChatNoteMeta,

        // Task notes
        currentTaskNote,
        setCurrentTaskNote,
        taskNoteMeta,
        setTaskNoteMeta,
        currentTaskNoteChain,
        setCurrentTaskNoteChain,
        getTaskNoteMeta,

        // My notes
        currentMyNote,
        setCurrentMyNote,
        myNoteMeta,
        setMyNoteMeta,
        currentMyNoteChain,
        setCurrentMyNoteChain,
        getMyNoteMeta,
        myNoteFolders,
        myNoteFolderForest,
        getMyNoteFolders,
        createMyNoteFolder: createMyNoteFolderAction,
        renameMyNoteFolder,
        moveMyNoteFolder,
        deleteMyNoteFolder: deleteMyNoteFolderAction,
        moveMyNoteToFolder: moveMyNoteToFolderAction,
        isFolderExpanded,
        toggleFolderExpanded,
        expandFolder,
        moveTaskNoteToTask,
        moveChatNoteToChat,
        deleteMyNoteById,
        deleteTaskNoteById,
        deleteChatNoteById,

        // Favorite notes
        favoriteNotes,
        setFavoriteNotes,
        favoriteNoteIds,
        getFavoriteNotesMeta,
        toggleFavorite,
        isNoteFavorited,

        // Recent notes
        recentNotes,
        setRecentNotes,
        getRecentNotesMeta,
        recordNoteOpen,

        // Note role management (sharing)
        currentNoteMembers,
        setCurrentNoteMembers,
        loadNoteMembers,
        grantNoteRole,
        revokeNoteRole,

        // Note version history
        currentNoteVersions,
        setCurrentNoteVersions,
        loadNoteVersionsFor,
        bumpNoteVersionsHead,
        restoreNoteVersion,
        noteResyncNonce,

        // Shared-with-me personal notes
        patchPersonalNoteMeta,

        teamNoteFolders,
        teamNoteFolderForest,
        teamNoteMeta,
        teamNoteMetaTree,
        getTeamNoteFolders,
        getTeamNoteMeta,
        createTeamNoteFolder: createTeamNoteFolderAction,
        renameTeamNoteFolder,
        setTeamNoteFolderVisibility,
        moveTeamNoteFolder,
        deleteTeamNoteFolder: deleteTeamNoteFolderAction,

        sharedNoteMeta,
        setSharedNoteMeta,
        sharedNoteMetaTree,
        getSharedNoteMeta,

        // Visibility states
        isTaskNoteVisible,
        setIsTaskNoteVisible,
        isTaskVisibleInNote,
        setIsTaskVisibleInNote,

        // Note metadata trees (derived; no setters)
        myNoteMetaTree,
        taskNoteMetaTree,
        chatNoteMetaTree,
        allNoteIdChains,
        setAllNoteIdChains,

        // Lifted note-tree expand state
        expandNode,
        isNodeExpanded,
        toggleNodeExpanded,

        // Note creation functions
        handleCreateNewChatNote,
        handleCreateNewChatNoteIfNotExist,
        handleCreateNewTaskNote,
        handleCreateNewMyNote,

        // Note loading function
        loadNote,

        // Initialize and reset functions
        initializeNoteStates,
        resetNoteStates,
        popInitialNote,
    };
};
