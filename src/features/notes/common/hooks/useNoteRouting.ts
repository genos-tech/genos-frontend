import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

// Note type constants
const NOTE_TYPE_MAP: Record<string, number> = {
    my: 1,
    task: 2,
    chat: 3,
    shared: 4,
};

const NOTE_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "my",
    2: "task",
    3: "chat",
    4: "shared",
};

// Chat type constants matching the existing codebase
const CHAT_TYPE_MAP: Record<string, number> = {
    dm: 1,
    gm: 2,
    pm: 3,
    mdm: 4,
};

const CHAT_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    4: "mdm",
};

type UseNoteRoutingProps = {
    useNM: NoteManagementState;
};

type NoteRouteInfo = {
    noteType: string | undefined;
    noteId: number | undefined;
    // For task notes
    projectId: number | undefined;
    taskId: number | undefined;
    // For chat notes
    chatType: string | undefined;
    chatId: number | undefined;
    threadId: number | undefined;
};

export const useNoteRouting = ({ useNM }: UseNoteRoutingProps) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Ref to track if we're currently navigating from URL (to avoid circular updates)
    const isNavigatingFromUrl = useRef(false);
    // Ref to track the last URL we navigated to
    const lastNavigatedPath = useRef("");
    // Once `useNoteTabs.rehydrate()` finishes the first time, the tab
    // strip is the source of truth and the URL-load effect must not
    // re-open the same tab on the next pathname tick. This ref flips
    // to `true` after we've handled the first URL parse so that
    // subsequent same-pathname re-renders never double-open a tab.
    const hasHandledInitialUrl = useRef(false);

    // Parse the current URL to extract note routing info
    const parseCurrentRoute = useCallback((): NoteRouteInfo => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        // Expected formats:
        // - My notes: /workspace/notes/my/:noteId
        // - Task notes: /workspace/notes/task/project/:projectId/task/:taskId/note/:noteId
        // - Chat notes: /workspace/notes/chat/:chatType/:chatId/thread/:threadId/note/:noteId

        const result: NoteRouteInfo = {
            noteType: undefined,
            noteId: undefined,
            projectId: undefined,
            taskId: undefined,
            chatType: undefined,
            chatId: undefined,
            threadId: undefined,
        };

        const notesIndex = pathParts.indexOf("notes");
        if (notesIndex === -1) return result;

        // Get note type (my, task, chat)
        const noteTypeStr = pathParts[notesIndex + 1];
        if (noteTypeStr && NOTE_TYPE_MAP[noteTypeStr] !== undefined) {
            result.noteType = noteTypeStr;
        }

        if (noteTypeStr === "my" || noteTypeStr === "shared") {
            // My notes:     /workspace/notes/my/:noteId
            // Shared notes: /workspace/notes/shared/:noteId
            if (pathParts[notesIndex + 2]) {
                result.noteId = Number(pathParts[notesIndex + 2]);
            }
        } else if (noteTypeStr === "task") {
            // Task notes: /workspace/notes/task/project/:projectId/task/:taskId/note/:noteId
            const projectIndex = pathParts.indexOf("project");
            if (projectIndex !== -1 && pathParts[projectIndex + 1]) {
                result.projectId = Number(pathParts[projectIndex + 1]);
            }
            const taskIndex = pathParts.indexOf("task", projectIndex);
            if (taskIndex !== -1 && pathParts[taskIndex + 1]) {
                result.taskId = Number(pathParts[taskIndex + 1]);
            }
            const noteIndex = pathParts.indexOf("note");
            if (noteIndex !== -1 && pathParts[noteIndex + 1]) {
                result.noteId = Number(pathParts[noteIndex + 1]);
            }
        } else if (noteTypeStr === "chat") {
            // Chat notes: /workspace/notes/chat/:chatType/:chatId/thread/:threadId/note/:noteId
            if (pathParts[notesIndex + 2]) {
                result.chatType = pathParts[notesIndex + 2];
            }
            if (pathParts[notesIndex + 3]) {
                result.chatId = Number(pathParts[notesIndex + 3]);
            }
            const threadIndex = pathParts.indexOf("thread");
            if (threadIndex !== -1 && pathParts[threadIndex + 1]) {
                result.threadId = Number(pathParts[threadIndex + 1]);
            }
            const noteIndex = pathParts.indexOf("note");
            if (noteIndex !== -1 && pathParts[noteIndex + 1]) {
                result.noteId = Number(pathParts[noteIndex + 1]);
            }
        }

        return result;
    }, [location.pathname]);

    // Navigate to notes home
    const navigateToNotes = useCallback(() => {
        navigate("/workspace/notes");
    }, [navigate]);

    // Navigate to a specific note type
    const navigateToNoteType = useCallback(
        (noteType: number) => {
            const typePath = NOTE_TYPE_REVERSE_MAP[noteType];
            if (typePath) {
                navigate(`/workspace/notes/${typePath}`);
            }
        },
        [navigate]
    );

    // Navigate to a my note
    const navigateToMyNote = useCallback(
        (noteId: number) => {
            navigate(`/workspace/notes/my/${noteId}`);
        },
        [navigate]
    );

    // Navigate to a task note
    const navigateToTaskNote = useCallback(
        (projectId: number, taskId: number, noteId: number) => {
            navigate(`/workspace/notes/task/project/${projectId}/task/${taskId}/note/${noteId}`);
        },
        [navigate]
    );

    // Navigate to a chat note
    const navigateToChatNote = useCallback(
        (chatType: number, chatId: number, threadId: number, noteId: number) => {
            const chatTypePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (chatTypePath) {
                navigate(
                    `/workspace/notes/chat/${chatTypePath}/${chatId}/thread/${threadId}/note/${noteId}`
                );
            }
        },
        [navigate]
    );

    // Sync URL with note state on initial load or URL change.
    // After the first run we let `tabsApi.rehydrate()` (which restores
    // the previously-open tabs from localStorage) be the source of
    // truth — we only re-open a tab from the URL if the active tab
    // doesn't already match. This avoids the double-open race where
    // both `rehydrate()` and this effect fire on first mount.
    useEffect(() => {
        const routeInfo = parseCurrentRoute();

        // If no note type in URL, don't do anything (user can browse)
        if (!routeInfo.noteType) {
            hasHandledInitialUrl.current = true;
            return;
        }

        const noteTypeNum = NOTE_TYPE_MAP[routeInfo.noteType];

        // Update current note type from URL if needed
        if (noteTypeNum !== undefined && useNM.currentNoteType !== noteTypeNum) {
            isNavigatingFromUrl.current = true;
            useNM.setCurrentNoteType(noteTypeNum);
        }

        // Load specific note if noteId is in URL
        if (routeInfo.noteId) {
            // Determine internal note type (1 = my, 2 = task, 3 = chat, 4 = shared)
            let internalNoteType: number;
            if (routeInfo.noteType === "my") {
                internalNoteType = 1;
            } else if (routeInfo.noteType === "task") {
                internalNoteType = 2;
            } else if (routeInfo.noteType === "chat") {
                internalNoteType = 3;
            } else if (routeInfo.noteType === "shared") {
                internalNoteType = 4;
            } else {
                hasHandledInitialUrl.current = true;
                return;
            }

            // If the active tab already matches the URL, the rehydrate
            // (or a previous open) has us covered — just mark handled
            // and bail. Shared notes (type 4) reuse the "my" tab kind
            // since the backend serves them from the same endpoint.
            const active = useNM.tabsApi.activeTab;
            const alreadyOpen =
                active &&
                active.noteId === routeInfo.noteId &&
                ((internalNoteType === 1 && active.kind === "my") ||
                    (internalNoteType === 4 && active.kind === "my") ||
                    (internalNoteType === 2 && active.kind === "task") ||
                    (internalNoteType === 3 && active.kind === "chat"));

            if (alreadyOpen) {
                hasHandledInitialUrl.current = true;
                return;
            }

            isNavigatingFromUrl.current = true;
            useNM.loadNote(internalNoteType, routeInfo.noteId, -1).finally(() => {
                setTimeout(() => {
                    isNavigatingFromUrl.current = false;
                    hasHandledInitialUrl.current = true;
                }, 100);
            });
        } else {
            hasHandledInitialUrl.current = true;
        }
    }, [location.pathname]);

    // Update URL when current note changes
    useEffect(() => {
        // Skip if we're currently navigating from URL
        if (isNavigatingFromUrl.current) {
            setTimeout(() => {
                isNavigatingFromUrl.current = false;
            }, 100);
            return;
        }

        let newPath: string | null = null;

        // Check which note is currently open
        if (useNM.currentNoteType === 1 && useNM.currentMyNote) {
            // My note
            newPath = `/workspace/notes/my/${useNM.currentMyNote.noteId}`;
        } else if (useNM.currentNoteType === 4 && useNM.currentMyNote) {
            // Shared note (backed by the same personal note slot)
            newPath = `/workspace/notes/shared/${useNM.currentMyNote.noteId}`;
        } else if (useNM.currentNoteType === 2 && useNM.currentTaskNote) {
            // Task note
            const { projectId, taskId, noteId } = useNM.currentTaskNote;
            newPath = `/workspace/notes/task/project/${projectId}/task/${taskId}/note/${noteId}`;
        } else if (useNM.currentNoteType === 3 && useNM.currentChatNote) {
            // Chat note
            const { chatType, chatId, threadId, noteId } = useNM.currentChatNote;
            const chatTypePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (chatTypePath) {
                newPath = `/workspace/notes/chat/${chatTypePath}/${chatId}/thread/${threadId}/note/${noteId}`;
            }
        }

        if (newPath && newPath !== location.pathname && newPath !== lastNavigatedPath.current) {
            lastNavigatedPath.current = newPath;
            navigate(newPath, { replace: true });
        }
    }, [
        useNM.currentNoteType,
        useNM.currentMyNote?.noteId,
        useNM.currentTaskNote?.noteId,
        useNM.currentChatNote?.noteId,
    ]);

    return {
        parseCurrentRoute,
        navigateToNotes,
        navigateToNoteType,
        navigateToMyNote,
        navigateToTaskNote,
        navigateToChatNote,
        NOTE_TYPE_MAP,
        NOTE_TYPE_REVERSE_MAP,
        CHAT_TYPE_MAP,
        CHAT_TYPE_REVERSE_MAP,
    };
};
