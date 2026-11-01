import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { isPersonalNoteBucket } from "../utils/noteTypeAlias";

// Note type constants
const NOTE_TYPE_MAP: Record<string, number> = {
    my: 1,
    task: 2,
    chat: 3,
    shared: 4,
    team: 8,
};

const NOTE_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "my",
    2: "task",
    3: "chat",
    4: "shared",
    8: "team",
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
    // False while the Notes Home is kept mounted but hidden (keep-alive).
    // Suppresses this hook's navigations so a backgrounded Notes Home can't
    // hijack the URL from the active service. See the `navigate` wrapper.
    isActiveRoute: boolean;
};

export type NoteRouteInfo = {
    noteType: string | undefined;
    noteId: number | undefined;
    // For task notes
    projectId: number | undefined;
    taskId: number | undefined;
    // For chat notes
    chatType: string | undefined;
    chatId: number | undefined;
    threadId: number | undefined;
    // `/workspace/notes/folder/:folderId` opens a folder in the sidebar
    // rather than a note (MIP-841).
    folderId: number | undefined;
};

// Expected formats:
// - Folders:      /workspace/notes/folder/:folderId
// - My notes:     /workspace/notes/my/:noteId
// - Shared notes: /workspace/notes/shared/:noteId
// - Team notes:   /workspace/notes/team/:noteId
// - Task notes:   /workspace/notes/task/project/:projectId/task/:taskId/note/:noteId
// - Chat notes:   /workspace/notes/chat/:chatType/:chatId/thread/:threadId/note/:noteId
export const parseNoteRoute = (pathname: string): NoteRouteInfo => {
    const pathParts = pathname.split("/").filter(Boolean);

    const result: NoteRouteInfo = {
        noteType: undefined,
        noteId: undefined,
        projectId: undefined,
        taskId: undefined,
        chatType: undefined,
        chatId: undefined,
        threadId: undefined,
        folderId: undefined,
    };

    const notesIndex = pathParts.indexOf("notes");
    if (notesIndex === -1) return result;

    if (pathParts[notesIndex + 1] === "folder") {
        const id = Number(pathParts[notesIndex + 2]);
        if (Number.isInteger(id) && id > 0) result.folderId = id;
        return result;
    }

    const noteTypeStr = pathParts[notesIndex + 1];
    if (noteTypeStr && NOTE_TYPE_MAP[noteTypeStr] !== undefined) {
        result.noteType = noteTypeStr;
    }

    if (noteTypeStr === "my" || noteTypeStr === "shared" || noteTypeStr === "team") {
        if (pathParts[notesIndex + 2]) {
            result.noteId = Number(pathParts[notesIndex + 2]);
        }
    } else if (noteTypeStr === "task") {
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
};

type OpenNoteState = Pick<
    NoteManagementState,
    "currentNoteType" | "currentMyNote" | "currentTaskNote" | "currentChatNote"
>;

// The URL for whatever note is open, or null when none is (or the open
// note has no URL shape). My (1), Shared (4) and Team (8) are all the
// same personal-note slot; the sidebar bucket picks the segment.
export const notePathForOpenNote = (state: OpenNoteState): string | null => {
    const { currentNoteType, currentMyNote, currentTaskNote, currentChatNote } = state;
    if (currentNoteType === 1 && currentMyNote) {
        return `/workspace/notes/my/${currentMyNote.noteId}`;
    }
    if (currentNoteType === 4 && currentMyNote) {
        return `/workspace/notes/shared/${currentMyNote.noteId}`;
    }
    if (currentNoteType === 8 && currentMyNote) {
        return `/workspace/notes/team/${currentMyNote.noteId}`;
    }
    if (currentNoteType === 2 && currentTaskNote) {
        const { projectId, taskId, noteId } = currentTaskNote;
        return `/workspace/notes/task/project/${projectId}/task/${taskId}/note/${noteId}`;
    }
    if (currentNoteType === 3 && currentChatNote) {
        const { chatType, chatId, threadId, noteId } = currentChatNote;
        const chatTypePath = CHAT_TYPE_REVERSE_MAP[chatType];
        if (chatTypePath) {
            return `/workspace/notes/chat/${chatTypePath}/${chatId}/thread/${threadId}/note/${noteId}`;
        }
    }
    return null;
};

export const useNoteRouting = ({ useNM, isActiveRoute }: UseNoteRoutingProps) => {
    const rawNavigate = useNavigate();
    // Keep-alive gate — suppress navigations while this Home is hidden so it
    // can't hijack the active service's URL. Transparent pass-through when
    // active (behaviour unchanged). See useChatRouting for the full rationale.
    const navigate = useCallback(
        (...args: unknown[]) => {
            if (!isActiveRoute) return;
            return (rawNavigate as (...a: unknown[]) => void)(...args);
        },
        [isActiveRoute, rawNavigate]
    ) as unknown as typeof rawNavigate;
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
    const parseCurrentRoute = useCallback(
        (): NoteRouteInfo => parseNoteRoute(location.pathname),
        [location.pathname]
    );

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

        // Keep the state→URL effect's dedup ref aligned with the real URL
        // so re-opening a previously-visited note after a browser
        // Back/Forward isn't silently skipped (see the matching note in
        // useTaskRouting).
        lastNavigatedPath.current = location.pathname;

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
            // Internal note type: 1 = my, 2 = task, 3 = chat, 4 = shared, 8 = team.
            const internalNoteType = noteTypeNum;
            if (internalNoteType === undefined) {
                hasHandledInitialUrl.current = true;
                return;
            }

            // If the active tab already matches the URL, the rehydrate
            // (or a previous open) has us covered — just mark handled
            // and bail. Shared (4) and team (8) notes reuse the "my" tab
            // kind since the backend serves them from the same endpoint.
            const active = useNM.tabsApi.activeTab;
            const alreadyOpen =
                active &&
                active.noteId === routeInfo.noteId &&
                ((isPersonalNoteBucket(internalNoteType) && active.kind === "my") ||
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

    // `/workspace/notes/folder/:id` (a Spotlight folder result, or a link
    // to one): open that folder's space, unfold its ancestors and flash it.
    // The folder lists load after the route does, so wait for the folder to
    // appear in one of them; once per URL, or the periodic list refresh
    // would scroll the sidebar back every minute. A folder in neither list
    // (not yours to see) is simply not revealed.
    const revealedFolderId = useRef<number | null>(null);
    const folderIdInUrl = parseNoteRoute(location.pathname).folderId;
    useEffect(() => {
        if (!isActiveRoute) return;
        if (folderIdInUrl === undefined) {
            revealedFolderId.current = null;
            return;
        }
        if (revealedFolderId.current === folderIdInUrl) return;
        const inTeam = useNM.teamNoteFolders.some((f) => f.folderId === folderIdInUrl);
        const inMy = useNM.myNoteFolders.some((f) => f.folderId === folderIdInUrl);
        if (!inTeam && !inMy) return;
        revealedFolderId.current = folderIdInUrl;
        // Revealing switches the sidebar space, which the effect below
        // would answer by rewriting the URL to whatever note is open: the
        // folder URL would not survive. Same guard the URL→note effect
        // uses, set only when the type will actually change (the guard
        // is cleared by that effect running).
        if (useNM.currentNoteType !== (inTeam ? 8 : 1)) isNavigatingFromUrl.current = true;
        useNM.revealFolder(folderIdInUrl, inTeam ? "team" : "my");
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reveal once per URL
    }, [folderIdInUrl, useNM.teamNoteFolders, useNM.myNoteFolders, isActiveRoute]);

    // Update URL when current note changes
    useEffect(() => {
        // Skip if we're currently navigating from URL
        if (isNavigatingFromUrl.current) {
            setTimeout(() => {
                isNavigatingFromUrl.current = false;
            }, 100);
            return;
        }

        const newPath = notePathForOpenNote(useNM);

        if (newPath && newPath !== location.pathname && newPath !== lastNavigatedPath.current) {
            lastNavigatedPath.current = newPath;
            // Push (not replace) so each opened note is its own history
            // entry — browser Back/Forward steps between notes.
            navigate(newPath);
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
