import { useCallback, useEffect, useMemo, useState } from "react";

import { NoteService } from "../../db/services/note.service";
import { DatabaseUtils } from "../../db/utils/database";
import { createEmptyChatNote } from "../../features/notes/chat-notes/services/createEmptyChatNote";
import { loadChatNoteMeta } from "../../features/notes/chat-notes/services/loadChatNoteMeta";
import { loadChatNotesByChatId } from "../../features/notes/chat-notes/services/loadChatNotesByChatId";
import { addNote } from "../../features/notes/common/services/addNote";
import { deleteNoteRole } from "../../features/notes/common/services/deleteNoteRole";
import { loadNoteRoles } from "../../features/notes/common/services/loadNoteRoles";
import { loadNoteVersions } from "../../features/notes/common/services/loadNoteVersions";
import { loadSharedNotesMeta } from "../../features/notes/common/services/loadSharedNotesMeta";
import { loadSpecificNote } from "../../features/notes/common/services/loadSpecificNote";
import { restoreNoteVersion as restoreNoteVersionApi } from "../../features/notes/common/services/restoreNoteVersion";
import { updateNoteRole } from "../../features/notes/common/services/updateNoteRole";
import {
    addNoteFavorite,
    FavoriteNotesMetaResponse,
    loadFavoriteNotesMeta,
    removeNoteFavorite,
} from "../../features/notes/favorite-notes/services";
import { createEmptyMyNote } from "../../features/notes/my-notes/services/createEmptyMyNote";
import { createMyNoteFolder as createMyNoteFolderApi } from "../../features/notes/my-notes/services/createMyNoteFolder";
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
import { loadTaskNoteMeta } from "../../features/notes/task-notes/services/loadTaskNoteMeta";
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
    NoteRoleMember,
    NoteVersionMeta,
    SharedNoteMetaProps,
    SharedNoteMetaTreeNode,
    TaskNoteMetaProps,
    TaskNoteMetaTreeNode,
    TaskNoteProps,
} from "../../types/notes";
import {
    buildChatNoteTree,
    buildMyNoteFolderForest,
    buildMyNoteTree,
    buildSharedNoteTree,
    buildTaskNoteTree,
    collectDescendantFolderIds,
    collectFolderAncestorIds,
} from "../../utils/note";
import { initCurrentChatNoteChain, updataChatNoteChain } from "./chatNote";
import { initCurrentMyNoteChain, updataMyNoteChain } from "./myNote";
import { updataTaskNoteChain } from "./taskNote";
import { ChatPanelNoteApi, useChatPanelNote } from "./useChatPanelNote";
import { getCachedNote, upsertNoteCache } from "./useNoteData";
import { NoteTabsApi, noteToTab, useNoteTabs } from "./useNoteTabs";

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
        chatName?: string
    ) => Promise<ChatNoteProps | null>;

    handleCreateNewChatNoteIfNotExist: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number,
        chatName?: string
    ) => Promise<void>;

    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number,
        title?: string
    ) => Promise<void>;

    handleCreateNewMyNote: (
        parentNoteId: number | null,
        folderId?: number | null
    ) => Promise<void>;

    // Note loading function
    loadNote: (noteType: number, noteId: number, nextTabIndex: number) => Promise<void>;

    // Initialize note states
    initializeNoteStates: () => void;
    resetNoteStates: () => void;
    popInitialNote: () => Promise<void>;
}

export const useNoteManagement = (
    myself: UserProps,
    accessToken: string | null
): NoteManagementState => {
    // Initialize NoteService
    const noteService = new NoteService();
    // Note type and tabs
    const [currentNoteType, setCurrentNoteType] = useState<number>(
        Number(localStorage.getItem("currentNoteType") || "1")
    );
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
        chatName?: string
    ): Promise<ChatNoteProps | null> => {
        if (!accessToken) return null;

        try {
            const title = `${parentNoteId ? "Child" : "New"} Chat Note (${
                newlyCreatedChatNotes.length + 1
            })`;
            const newNote = await createEmptyChatNote(
                myself,
                parentNoteId,
                chatType,
                chatId,
                isThread,
                threadId,
                title,
                accessToken
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
        title?: string
    ) => {
        if (!accessToken) return;

        try {
            const noteTitle = `${parentNoteId ? "Child" : "New"} Task Note (${
                newlyCreatedTaskNotes.length + 1
            })`;
            const newNote = await createEmptyTaskNote(
                myself,
                parentNoteId,
                projectId,
                taskId,
                noteTitle,
                accessToken
            );

            if (newNote) {
                const taskNote: TaskNoteProps = { noteType: 2, ...newNote };
                setNewlyCreatedTaskNotes([...newlyCreatedTaskNotes, newNote]);
                setCurrentTaskNote(taskNote);
                addNote(2, taskNote);
                upsertNoteCache(taskNote);
                tabsApi.openTab(noteToTab(taskNote, myself.teamId));
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
            }
        } catch (error) {
            console.error("Error creating task note:", error);
        }
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
        folderId: number | null = null
    ) => {
        if (!accessToken) return;

        try {
            const noteTitle = `${parentNoteId ? "Child" : "New"} My Note (${
                newlyCreatedMyNotes.length + 1
            })`;
            const newNote = await createEmptyMyNote(
                myself,
                parentNoteId,
                noteTitle,
                accessToken,
                folderId
            );

            if (newNote) {
                const myNote: MyNoteProps = { noteType: 1, ...newNote };
                setNewlyCreatedMyNotes([...newlyCreatedMyNotes, newNote]);
                setCurrentMyNote(newNote);
                addNote(1, newNote);
                upsertNoteCache(myNote);
                tabsApi.openTab(noteToTab(myNote, myself.teamId));
                recordNoteOpen(myNote.noteId, 1);

                setMyNoteMeta((prev) => [
                    {
                        noteType: newNote.noteType,
                        noteId: newNote.noteId,
                        parentNoteId: newNote.parentNoteId,
                        // Server-confirmed placement, falling back to the
                        // requested folder for older backends that don't
                        // echo folderId.
                        folderId: newNote.folderId ?? folderId ?? null,
                        title: newNote.title,
                        tsUpdated: newNote.tsUpdated,
                    },
                    ...prev,
                ]);
                if (folderId != null) expandFolder(folderId);
            }
        } catch (error) {
            console.error("Error creating my note:", error);
        }
    };

    const getMyNoteMeta = async () => {
        const loadedNotes: MyNoteMetaProps[] = await loadMyNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setMyNoteMeta(loadedNotes);
        }
    };

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
        setMyNoteMeta((prev) =>
            prev.map((n) =>
                n.noteId === noteId ? { ...n, folderId: folderId, parentNoteId: null } : n
            )
        );
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

    const isNoteFavorited = (noteId: number, noteType: number): boolean => {
        return favoriteNoteIds.has(`${noteType}-${noteId}`);
    };

    const toggleFavorite = async (noteId: number, noteType: number): Promise<boolean> => {
        if (!accessToken) return false;

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
        // showing stale content. Shared notes (noteType=4) live on the
        // personal note table on the backend, so we transparently alias.
        const backendNoteType = noteType === 4 ? 1 : noteType;
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
            currentMyNoteChain?.forEach((n) => addKey(`1-${n.noteId}`));
            currentTaskNoteChain?.forEach((n) => addKey(`2-${n.noteId}`));
            currentChatNoteChain?.forEach((n) => addKey(`3-${n.noteId}`));
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
            for (const tabKey in allNoteIdChains) {
                const dash = tabKey.indexOf("-");
                if (dash <= 0) continue;
                const typePrefix = tabKey.slice(0, dash);
                const ids = allNoteIdChains[tabKey];
                if (!ids) continue;
                for (const id of ids) addKey(`${typePrefix}-${id}`);
            }
            return changed ? next : prev;
        });
    }, [
        currentMyNoteChain,
        currentTaskNoteChain,
        currentChatNoteChain,
        allNoteIdChains,
        myNoteFolders,
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
            // Shared personal notes live in note_type=1 on the backend; the
            // separate noteType=4 only exists to drive the sidebar bucket
            // and the route, so we transparently alias to the personal
            // note load path here.
            if (noteType === 4) {
                noteType = 1;
            }
            if (noteType === 1) {
                const cached = await noteService.getPersonalNote(noteId);
                if (cached) {
                    const myNote: MyNoteProps = { ...cached, noteType: 1 };
                    upsertNoteCache(myNote);
                    tabsApi.openTab(noteToTab(myNote, myself.teamId));
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
                    tabsApi.openTab(noteToTab(fetched, myself.teamId));
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

        // Shared notes (type 4) ride on the same tab kind ("my") as
        // owned personal notes, so we disambiguate via the
        // shared-meta list: if the active personal note is in that
        // list, the bucket is "Shared Notes" (4); otherwise it's
        // "My Notes" (1). Used in both the cached-sync and async
        // branches so the sidebar highlight, the noteType=4
        // routing-write effect, and `NoteTreeRenderer.isSelected`
        // all see a consistent value.
        const personalBucketType = () =>
            sharedNoteMeta.some((n) => n.noteId === active.noteId) ? 4 : 1;

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

    // Refresh note role members whenever the active note changes so the
    // header's avatar strip and Share button see fresh data.
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
    }, [tabsApi.activeTabId]);

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
