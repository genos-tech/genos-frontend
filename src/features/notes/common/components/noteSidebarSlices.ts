import { useMemo } from "react";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { SliceOf, SliceSpec, useManagerSlice } from "../../../../hooks/common/useManagerSlice";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

/**
 * The stable handles the notes sidebar reads from the managers (MIP-2379), the way
 * `useSidebarSlices` does it for the task sidebar (MIP-971). See `useManagerSlice` for what a
 * slice is and for the two kinds of member.
 *
 * Why: `useNM` is a new object on every `AppBody` render and a note switch is several renders, so
 * a sidebar that takes the whole manager re-renders its whole tree each time. A slice is a new
 * object only when a value it carries changes.
 *
 * Two slices, on purpose:
 *  - `SHELL_NM`: what the sidebar itself reads. It carries the open note, so it changes on a
 *    switch, and the sidebar re-renders then (it must: the section highlight moves).
 *  - `ROW_NM`: what the rows, folder trees, stars and modals read. It carries NO current-note
 *    value, so a switch does not make every row see a new `useNM`.
 *
 * Functions called while rendering (`isNodeExpanded`, `isFolderExpanded`, `isNoteFavorited`,
 * `isFolderFavorited`) are `useCallback`s in the manager and ride as values: a latest-ref wrapper
 * reads the last COMMIT, which is stale during a render.
 */

const SHELL_NM = {
    values: [
        "taskNoteMeta",
        "chatNoteMeta",
        "myNoteMeta",
        "teamNoteMeta",
        "sharedNoteMeta",
        "myNoteFolders",
        "myNoteFolderForest",
        "teamNoteFolders",
        "teamNoteFolderForest",
        "myNoteMetaTree",
        "taskNoteMetaTree",
        "chatNoteMetaTree",
        "sharedNoteMetaTree",
        "teamNoteMetaTree",
        "favoriteNotes",
        "recentNotes",
        "currentNoteType",
        "currentMyNote",
        "currentTaskNote",
        "currentChatNote",
        "currentMyNoteChain",
        "currentTaskNoteChain",
        "currentChatNoteChain",
        "setCurrentNoteType",
    ],
    latest: [
        "getFavoriteNotesMeta",
        "getRecentNotesMeta",
        "getSharedNoteMeta",
        "getTeamNoteFolders",
        "getTeamNoteMeta",
        "getMyNoteFolders",
        "getMyNoteMeta",
        "getTaskNoteMeta",
        "getChatNoteMeta",
        "handleCreateNewMyNote",
        "handleCreateNewTaskNote",
        "handleCreateNewChatNote",
        "loadNote",
        "moveTaskNoteToTask",
        "moveChatNoteToChat",
        "moveMyNoteToFolder",
        "createMyNoteFolder",
        "renameMyNoteFolder",
        "moveMyNoteFolder",
        "deleteMyNoteFolder",
        "deleteMyNoteById",
        "deleteTaskNoteById",
        "deleteChatNoteById",
        "forceDeleteNoteById",
        "createTeamNoteFolder",
        "renameTeamNoteFolder",
        "moveTeamNoteFolder",
        "deleteTeamNoteFolder",
    ],
} as const satisfies SliceSpec<NoteManagementState>;
export type NoteSidebarShellNM = SliceOf<NoteManagementState, typeof SHELL_NM>;

const ROW_NM = {
    values: [
        "isNodeExpanded",
        "toggleNodeExpanded",
        "isFolderExpanded",
        "toggleFolderExpanded",
        "highlightedFolderId",
        "setCurrentNoteType",
        "isNoteFavorited",
        "isFolderFavorited",
    ],
    latest: [
        "loadNote",
        "toggleFavorite",
        "toggleFolderFavorite",
        "revealFolder",
        "handleCreateNewMyNote",
        "handleCreateNewTaskNote",
        "handleCreateNewChatNote",
    ],
} as const satisfies SliceSpec<NoteManagementState>;
export type NoteSidebarRowNM = SliceOf<NoteManagementState, typeof ROW_NM>;

// Only what the sidebar reads: the project avatar's chat, the team's guest flag, the member
// profiles behind a DM avatar.
const SIDEBAR_CM = {
    values: ["allChats"],
    latest: [],
} as const satisfies SliceSpec<ChatManagementState>;
export type NoteSidebarCM = SliceOf<ChatManagementState, typeof SIDEBAR_CM>;

const SIDEBAR_TEM = {
    values: ["currentTeam", "teamMemberProfiles"],
    latest: [],
} as const satisfies SliceSpec<TeamManagementState>;
export type NoteSidebarTEM = SliceOf<TeamManagementState, typeof SIDEBAR_TEM>;

/** The specs, for the tests that check every member of every slice against a real manager. */
export const NOTE_SIDEBAR_SLICE_SPECS = {
    shellNM: SHELL_NM,
    rowNM: ROW_NM,
    cm: SIDEBAR_CM,
    tem: SIDEBAR_TEM,
} as const;

export type NoteSidebarSlices = {
    shellNM: NoteSidebarShellNM;
    rowNM: NoteSidebarRowNM;
    cm: NoteSidebarCM;
    tem: NoteSidebarTEM;
};

export const useNoteSidebarSlices = ({
    useNM,
    useCM,
    useTEM,
}: {
    useNM: NoteManagementState;
    useCM: ChatManagementState;
    useTEM: TeamManagementState;
}): NoteSidebarSlices => {
    const shellNM = useManagerSlice(useNM, SHELL_NM);
    const rowNM = useManagerSlice(useNM, ROW_NM);
    const cm = useManagerSlice(useCM, SIDEBAR_CM);
    const tem = useManagerSlice(useTEM, SIDEBAR_TEM);
    return useMemo(() => ({ shellNM, rowNM, cm, tem }), [shellNM, rowNM, cm, tem]);
};
