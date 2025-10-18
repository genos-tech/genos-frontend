import { useEffect, useState } from "react";

import { STORES } from "../../db/conf";
import { NoteService } from "../../db/services/note.service";
import { createEmptyChatNote } from "../../features/notes/chat-notes/services/createEmptyChatNote";
import { loadChatNoteMeta } from "../../features/notes/chat-notes/services/loadChatNoteMeta";
import { loadChatNotesByChatId } from "../../features/notes/chat-notes/services/loadChatNotesByChatId";
import { createEmptyMyNote } from "../../features/notes/my-notes/services/createEmptyMyNote";
import { loadMyNoteMeta } from "../../features/notes/my-notes/services/loadMyNoteMeta";
import { addNote } from "../../features/notes/shared/services/addNote";
import { loadSpecificNote } from "../../features/notes/shared/services/loadSpecificNote";
import { createEmptyTaskNote } from "../../features/notes/task-notes/services/createEmptyTaskNote";
import { loadTaskNoteMeta } from "../../features/notes/task-notes/services/loadTaskNoteMeta";
import { UserProps } from "../../types/admin";
import {
    ChatNoteMetaProps,
    ChatNoteMetaTreeNode,
    ChatNoteProps,
    MyNoteMetaProps,
    MyNoteMetaTreeNode,
    MyNoteProps,
    TaskNoteMetaProps,
    TaskNoteMetaTreeNode,
    TaskNoteProps,
} from "../../types/notes";
import { buildChatNoteTree, buildMyNoteTree, buildTaskNoteTree } from "../../utils/note";
import { initCurrentChatNoteChain, updataChatNoteChain } from "./chatNote";
import { initCurrentMyNoteChain, updataMyNoteChain } from "./myNote";
import {
    updateTabFromChatNoteUpdate,
    updateTabFromMyNoteUpdate,
    updateTabFromTaskNoteUpdate,
} from "./tab";
import { updataTaskNoteChain } from "./taskNote";

export interface NoteManagementState {
    // Note type and tabs
    currentNoteType: number;
    setCurrentNoteType: (type: number) => void;
    tabItems: any[];
    setTabItems: (items: any[]) => void;
    tmpTabItems: any[];
    setTmpTabItems: (items: any[]) => void;
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

    // Visibility states
    isTaskNoteVisible: boolean;
    setIsTaskNoteVisible: (visible: boolean) => void;
    isTaskVisibleInNote: boolean;
    setIsTaskVisibleInNote: (visible: boolean) => void;

    // Note metadata trees
    myNoteMetaTree: MyNoteMetaTreeNode[];
    setMyNoteMetaTree: (tree: MyNoteMetaTreeNode[]) => void;
    taskNoteMetaTree: TaskNoteMetaTreeNode[];
    setTaskNoteMetaTree: (tree: TaskNoteMetaTreeNode[]) => void;
    chatNoteMetaTree: ChatNoteMetaTreeNode[];
    setChatNoteMetaTree: (tree: ChatNoteMetaTreeNode[]) => void;
    allNoteIdChains: Record<string, number[]>;
    setAllNoteIdChains: (chains: Record<string, number[]>) => void;

    // Note creation functions
    handleCreateNewChatNote: (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;

    handleCreateNewChatNoteIfNotExist: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;

    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number,
        title?: string
    ) => Promise<void>;

    handleCreateNewMyNote: (parentNoteId: number | null) => Promise<void>;

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
    const [tmpTabItems, setTmpTabItems] = useState<any[]>([]);
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);

    // Chat notes
    const [currentChatNote, setCurrentChatNote] = useState<ChatNoteProps | null>(null);
    const [chatNoteMeta, setChatNoteMeta] = useState<ChatNoteMetaProps[]>([]);
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

    // Visibility states
    const [isTaskNoteVisible, setIsTaskNoteVisible] = useState(false);
    const [isTaskVisibleInNote, setIsTaskVisibleInNote] = useState(false);

    // Note metadata trees
    const [myNoteMetaTree, setMyNoteMetaTree] = useState<MyNoteMetaTreeNode[]>(
        buildMyNoteTree(myNoteMeta)
    );
    const [taskNoteMetaTree, setTaskNoteMetaTree] = useState<TaskNoteMetaTreeNode[]>(
        buildTaskNoteTree(taskNoteMeta)
    );
    const [chatNoteMetaTree, setChatNoteMetaTree] = useState<ChatNoteMetaTreeNode[]>(
        buildChatNoteTree(chatNoteMeta)
    );
    const [allNoteIdChains, setAllNoteIdChains] = useState<Record<string, number[]>>({});

    // Chat Note related
    const handleCreateNewChatNote = async (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => {
        if (!accessToken) return;

        try {
            const title = `${parentNoteId ? "Child" : "New"} Note (${
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

                setChatNoteMeta((prev) => [
                    {
                        noteType: chatNote.noteType,
                        noteId: chatNote.noteId,
                        parentNoteId: chatNote.parentNoteId,
                        chatType: chatNote.chatType,
                        chatId: chatNote.chatId,
                        isThread: chatNote.isThread,
                        threadId: chatNote.threadId,
                        title: chatNote.title,
                        tsUpdated: chatNote.tsUpdated,
                    },
                    ...prev,
                ]);
            }
        } catch (error) {
            console.error("Error creating chat note:", error);
        }
    };

    const handleCreateNewChatNoteIfNotExist = async (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
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
            } else {
                await handleCreateNewChatNote(null, chatType, chatId, isThread, threadId);
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

    useEffect(() => {
        setChatNoteMetaTree(buildChatNoteTree(chatNoteMeta));
    }, [chatNoteMeta]);

    initCurrentChatNoteChain({
        chatNoteMeta: chatNoteMeta,
        currentChatNoteChain: currentChatNoteChain,
        setCurrentChatNoteChain: setCurrentChatNoteChain,
    });

    updateTabFromChatNoteUpdate({
        myself: myself,
        currentChatNote: currentChatNote,
        setSelectedTabIndex: setSelectedTabIndex,
        tabItems: tabItems,
        setTabItems: setTabItems,
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
            const noteTitle = `${parentNoteId ? "Child" : "New"} Note (${
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

                setTaskNoteMeta((prev) => [
                    {
                        noteType: taskNote.noteType,
                        noteId: taskNote.noteId,
                        parentNoteId: taskNote.parentNoteId,
                        projectId: taskNote.projectId,
                        taskId: taskNote.taskId,
                        title: taskNote.title,
                        tsUpdated: taskNote.tsUpdated,
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

    useEffect(() => {
        setTaskNoteMetaTree(buildTaskNoteTree(taskNoteMeta));
    }, [taskNoteMeta]);

    updateTabFromTaskNoteUpdate({
        myself: myself,
        currentTaskNote: currentTaskNote,
        setSelectedTabIndex: setSelectedTabIndex,
        tabItems: tabItems,
        setTabItems: setTabItems,
    });

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
    const handleCreateNewMyNote = async (parentNoteId: number | null) => {
        if (!accessToken) return;

        try {
            const noteTitle = `${parentNoteId ? "Child" : "New"} Note (${
                newlyCreatedMyNotes.length + 1
            })`;
            const newNote = await createEmptyMyNote(myself, parentNoteId, noteTitle, accessToken);

            if (newNote) {
                const myNote: MyNoteProps = { noteType: 1, ...newNote };
                setNewlyCreatedMyNotes([...newlyCreatedMyNotes, newNote]);
                setCurrentMyNote(newNote);
                addNote(1, newNote);

                setMyNoteMeta((prev) => [
                    {
                        noteType: newNote.noteType,
                        noteId: newNote.noteId,
                        parentNoteId: newNote.parentNoteId,
                        title: newNote.title,
                        tsUpdated: newNote.tsUpdated,
                    },
                    ...prev,
                ]);
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

    useEffect(() => {
        setMyNoteMetaTree(buildMyNoteTree(myNoteMeta));
    }, [myNoteMeta]);

    initCurrentMyNoteChain({
        myNoteMeta: myNoteMeta,
        currentMyNoteChain: currentMyNoteChain,
        setCurrentMyNoteChain: setCurrentMyNoteChain,
    });

    updateTabFromMyNoteUpdate({
        myself: myself,
        currentMyNote: currentMyNote,
        setSelectedTabIndex: setSelectedTabIndex,
        tabItems: tabItems,
        setTabItems: setTabItems,
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

    // Initialize note states
    const initializeNoteStates = () => {
        // Reset all note states to initial values
        setCurrentChatNote(null);
        setChatNoteMeta([]);
        setCurrentTaskNote(null);
        setTaskNoteMeta([]);
        setCurrentMyNote(null);
        setMyNoteMeta([]);
        setTabItems([]);
        setTmpTabItems([]);
        setSelectedTabIndex(0);
        setIsTaskNoteVisible(false);
        setIsTaskVisibleInNote(false);
        setCurrentChatNoteChain(undefined);
        setCurrentMyNoteChain(undefined);
        setCurrentTaskNoteChain(undefined);
        setMyNoteMetaTree([]);
        setTaskNoteMetaTree([]);
        setChatNoteMetaTree([]);
        setNewlyCreatedMyNotes([]);
        setNewlyCreatedTaskNotes([]);
        setNewlyCreatedChatNotes([]);
        setAllNoteIdChains({});
    };

    // Reset note states (for service switching)
    const resetNoteStates = () => {
        setIsTaskNoteVisible(false);
        setIsTaskVisibleInNote(false);
        setCurrentChatNote(null);
        setCurrentTaskNote(null);
        setCurrentMyNote(null);
    };

    // Note loading function
    const loadNote = async (noteType: number, noteId: number, nextTabIndex: number) => {
        if (!accessToken) return;

        const targetTabIndex: number = Math.max(
            nextTabIndex !== -1
                ? nextTabIndex
                : tabItems.findIndex(
                      (note) => note.noteType === noteType && note.noteId === noteId
                  ),
            0
        );

        try {
            if (noteType === 1) {
                const note = await noteService.getPersonalNote(noteId);
                if (note) {
                    // Convert Note type to MyNoteProps by adding missing fields
                    const myNote: MyNoteProps = {
                        noteType: 1,
                        teamId: myself.teamId,
                        ownerId: myself.userId,
                        roleId: myself.role ? parseInt(myself.role) || 0 : 0,
                        noteId: note.noteId,
                        parentNoteId: null, // Will be updated if needed
                        title: note.title,
                        body: [], // Will be loaded separately if needed
                        tsCreated: new Date(note.createdAt).toISOString(),
                        tsUpdated: new Date(note.updatedAt).toISOString(),
                    };
                    setCurrentMyNote(myNote);
                    setSelectedTabIndex(targetTabIndex);
                } else {
                    const note: MyNoteProps = await loadSpecificNote(
                        myself,
                        1,
                        noteId,
                        accessToken
                    );
                    if (!note.error && note.noteType === 1) {
                        addNote(1, note);
                        setCurrentMyNote(note);
                        setSelectedTabIndex(targetTabIndex);
                    }
                }
                setCurrentNoteType(1);
            } else if (noteType === 2) {
                const note = await noteService.getTaskNote(noteId);
                if (note) {
                    // Convert Note type to TaskNoteProps by adding missing fields
                    const taskNote: TaskNoteProps = {
                        noteType: 2,
                        teamId: myself.teamId,
                        ownerId: myself.userId,
                        roleId: myself.role ? parseInt(myself.role) || 0 : 0,
                        noteId: note.noteId,
                        parentNoteId: null, // Will be updated if needed
                        projectId: 0, // Will be updated if needed
                        taskId: note.relatedId || 0,
                        title: note.title,
                        body: [], // Will be loaded separately if needed
                        tsCreated: new Date(note.createdAt).toISOString(),
                        tsUpdated: new Date(note.updatedAt).toISOString(),
                    };
                    setCurrentTaskNote(taskNote);
                    setSelectedTabIndex(targetTabIndex);
                } else {
                    const note: TaskNoteProps = await loadSpecificNote(
                        myself,
                        2,
                        noteId,
                        accessToken
                    );
                    if (!note.error && note.noteType === 2) {
                        addNote(2, note);
                        setCurrentTaskNote(note);
                        setSelectedTabIndex(targetTabIndex);
                    }
                }
                setCurrentNoteType(2);
            } else if (noteType === 3) {
                const note = await noteService.getChatNote(noteId);
                if (note) {
                    // Convert Note type to ChatNoteProps by adding missing fields
                    const chatNote: ChatNoteProps = {
                        noteType: 3,
                        teamId: myself.teamId,
                        ownerId: myself.userId,
                        roleId: myself.role ? parseInt(myself.role) || 0 : 0,
                        noteId: note.noteId,
                        parentNoteId: null, // Will be updated if needed
                        chatType: 0, // Will be updated if needed
                        chatId: note.relatedId || 0,
                        isThread: false, // Will be updated if needed
                        threadId: 0, // Will be updated if needed
                        title: note.title,
                        body: [], // Will be loaded separately if needed
                        tsCreated: new Date(note.createdAt).toISOString(),
                        tsUpdated: new Date(note.updatedAt).toISOString(),
                    };
                    setCurrentChatNote(chatNote);
                    setSelectedTabIndex(targetTabIndex);
                } else {
                    const note: ChatNoteProps = await loadSpecificNote(
                        myself,
                        3,
                        noteId,
                        accessToken
                    );
                    if (note && !note.error && note.noteType === 3) {
                        addNote(3, note);
                        setCurrentChatNote(note);
                        setSelectedTabIndex(targetTabIndex);
                    }
                }
                setCurrentNoteType(3);
            }
        } catch (error) {
            console.error("Error loading note:", error);
        }
    };

    const popInitialNote = async () => {
        const noteType: string | null = localStorage.getItem("lastOpenNoteType");
        const myNoteId: string | null = localStorage.getItem("lastOpenMyNoteId");
        const taskNoteId: string | null = localStorage.getItem("lastOpenTaskNoteId");
        const chatNoteId: string | null = localStorage.getItem("lastOpenChatNoteId");
        if (noteType && myNoteId) {
            if (Number(noteType) === 1 && myNoteId) {
                await loadNote(1, Number(myNoteId), -1);
            } else if (Number(noteType) === 2 && taskNoteId) {
                await loadNote(2, Number(taskNoteId), -1);
            } else if (Number(noteType) === 3 && chatNoteId) {
                await loadNote(3, Number(chatNoteId), -1);
            }
        }
    };

    // Persist current note type to localStorage
    useEffect(() => {
        localStorage.setItem("currentNoteType", currentNoteType.toString());
    }, [currentNoteType]);

    return {
        // Note type and tabs
        currentNoteType,
        setCurrentNoteType,
        tabItems,
        setTabItems,
        tmpTabItems,
        setTmpTabItems,
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

        // Visibility states
        isTaskNoteVisible,
        setIsTaskNoteVisible,
        isTaskVisibleInNote,
        setIsTaskVisibleInNote,

        // Note metadata trees
        myNoteMetaTree,
        setMyNoteMetaTree,
        taskNoteMetaTree,
        setTaskNoteMetaTree,
        chatNoteMetaTree,
        setChatNoteMetaTree,
        allNoteIdChains,
        setAllNoteIdChains,

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
