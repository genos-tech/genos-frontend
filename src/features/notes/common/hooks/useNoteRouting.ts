import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

// Note type constants
const NOTE_TYPE_MAP: Record<string, number> = {
    my: 1,
    task: 2,
    chat: 3,
};

const NOTE_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "my",
    2: "task",
    3: "chat",
};

// Chat type constants matching the existing codebase
const CHAT_TYPE_MAP: Record<string, number> = {
    dm: 1,
    gm: 2,
    pm: 3,
};

const CHAT_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
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

    // Parse the current URL to extract note routing info
    const parseCurrentRoute = useCallback((): NoteRouteInfo => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        // Expected formats:
        // - My notes: /home/notes/my/:noteId
        // - Task notes: /home/notes/task/project/:projectId/task/:taskId/note/:noteId
        // - Chat notes: /home/notes/chat/:chatType/:chatId/thread/:threadId/note/:noteId

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

        if (noteTypeStr === "my") {
            // My notes: /home/notes/my/:noteId
            if (pathParts[notesIndex + 2]) {
                result.noteId = Number(pathParts[notesIndex + 2]);
            }
        } else if (noteTypeStr === "task") {
            // Task notes: /home/notes/task/project/:projectId/task/:taskId/note/:noteId
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
            // Chat notes: /home/notes/chat/:chatType/:chatId/thread/:threadId/note/:noteId
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
        navigate("/home/notes");
    }, [navigate]);

    // Navigate to a specific note type
    const navigateToNoteType = useCallback(
        (noteType: number) => {
            const typePath = NOTE_TYPE_REVERSE_MAP[noteType];
            if (typePath) {
                navigate(`/home/notes/${typePath}`);
            }
        },
        [navigate]
    );

    // Navigate to a my note
    const navigateToMyNote = useCallback(
        (noteId: number) => {
            navigate(`/home/notes/my/${noteId}`);
        },
        [navigate]
    );

    // Navigate to a task note
    const navigateToTaskNote = useCallback(
        (projectId: number, taskId: number, noteId: number) => {
            navigate(`/home/notes/task/project/${projectId}/task/${taskId}/note/${noteId}`);
        },
        [navigate]
    );

    // Navigate to a chat note
    const navigateToChatNote = useCallback(
        (chatType: number, chatId: number, threadId: number, noteId: number) => {
            const chatTypePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (chatTypePath) {
                navigate(
                    `/home/notes/chat/${chatTypePath}/${chatId}/thread/${threadId}/note/${noteId}`
                );
            }
        },
        [navigate]
    );

    // Sync URL with note state on initial load or URL change
    useEffect(() => {
        const routeInfo = parseCurrentRoute();

        // If no note type in URL, don't do anything (user can browse)
        if (!routeInfo.noteType) {
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
            // Determine internal note type (1 = my, 2 = task, 3 = chat for loadNote)
            let internalNoteType: number;
            if (routeInfo.noteType === "my") {
                internalNoteType = 1;
            } else if (routeInfo.noteType === "task") {
                internalNoteType = 2;
            } else if (routeInfo.noteType === "chat") {
                internalNoteType = 3;
            } else {
                return;
            }

            // Check if we need to load the note
            const currentNote =
                internalNoteType === 1
                    ? useNM.currentMyNote
                    : internalNoteType === 2
                      ? useNM.currentTaskNote
                      : useNM.currentChatNote;

            if (!currentNote || currentNote.noteId !== routeInfo.noteId) {
                isNavigatingFromUrl.current = true;

                useNM.loadNote(internalNoteType, routeInfo.noteId, -1).finally(() => {
                    setTimeout(() => {
                        isNavigatingFromUrl.current = false;
                    }, 100);
                });
            }
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
            newPath = `/home/notes/my/${useNM.currentMyNote.noteId}`;
        } else if (useNM.currentNoteType === 2 && useNM.currentTaskNote) {
            // Task note
            const { projectId, taskId, noteId } = useNM.currentTaskNote;
            newPath = `/home/notes/task/project/${projectId}/task/${taskId}/note/${noteId}`;
        } else if (useNM.currentNoteType === 3 && useNM.currentChatNote) {
            // Chat note
            const { chatType, chatId, threadId, noteId } = useNM.currentChatNote;
            const chatTypePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (chatTypePath) {
                newPath = `/home/notes/chat/${chatTypePath}/${chatId}/thread/${threadId}/note/${noteId}`;
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
