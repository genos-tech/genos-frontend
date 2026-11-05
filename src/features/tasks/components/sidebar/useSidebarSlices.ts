import { useMemo } from "react";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { SliceOf, SliceSpec, useManagerSlice } from "../../../../hooks/common/useManagerSlice";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";

/**
 * What each part of the task sidebar reads from the managers, as typed slices
 * (MIP-971). See `useManagerSlice` for why and for the two kinds of member.
 *
 * One slice per COMPONENT, not one per manager: `currentPreviewTaskId` changes
 * on every task click and only the Recents highlight and the tag/recents
 * effects read it, so the project and milestone tree must not be handed it.
 * A single `useTM` slice carrying it would re-render the whole tree on every
 * click, which is the thing this exists to stop.
 *
 * Which functions are `latest` (the manager recreates them on every render) and
 * which are `values` (already stable) was read from the hooks:
 *   - `useTaskManagement`: `setTableMilestoneFilter`, `setCurrentPreviewKind`,
 *     `setIsTaskPreviewVisible`, `setIsCreatingTask` are `useState` setters;
 *     `closeTaskPreview`, `setIsTaskTableVisible`, `setIsTaskDashboardVisible`,
 *     `setIsSprintBoardVisible`, `setCurrentPreviewTaskId`,
 *     `setCurrentPreviewMilestoneId` are plain functions recreated each render.
 *   - `useProjectManagement`: `setCurrentProject`, `setOpenCreateProject` are
 *     `useState` setters; `openProject` is a plain function that closes over
 *     the project list.
 *   - `useSprintMilestoneManagement`: the folder functions are `useCallback`s on
 *     `[accessToken]`. They stay `values`: `MilestonesListItem` lists
 *     `loadFoldersForProject` as an effect dependency, and it must re-run when
 *     the token changes, as it did before.
 */

// ------------------------------------------------------------------ TaskSidebar
// What `TaskSidebar` itself reads: the Home button, the tag fetch, and the
// recents reload. `currentPreviewTaskId` is the key of the recents reload.

const SHELL_TM = {
    values: ["currentPreviewTaskId", "tagsRevision", "isTaskDashboardVisible"],
    latest: ["setIsTaskDashboardVisible", "setIsTaskTableVisible", "setIsSprintBoardVisible"],
} as const satisfies SliceSpec<TaskManagementState>;
export type SidebarShellTM = SliceOf<TaskManagementState, typeof SHELL_TM>;

const SHELL_PM = {
    values: ["currentProject", "setCurrentProject"],
    latest: [],
} as const satisfies SliceSpec<ProjectManagementState>;
export type SidebarShellPM = SliceOf<ProjectManagementState, typeof SHELL_PM>;

// ------------------------------------------------------------------- SearchBox

const SEARCH_TM = {
    values: ["currentPreviewTaskId", "setIsTaskPreviewVisible"],
    latest: ["setCurrentPreviewTaskId"],
} as const satisfies SliceSpec<TaskManagementState>;
export type SidebarSearchTM = SliceOf<TaskManagementState, typeof SEARCH_TM>;

// ------------------------------------------------ Table / Board view buttons

const TABLE_VIEW_TM = {
    values: ["isTaskTableVisible"],
    latest: ["setIsTaskDashboardVisible", "setIsSprintBoardVisible", "setIsTaskTableVisible"],
} as const satisfies SliceSpec<TaskManagementState>;
export type SidebarTableViewTM = SliceOf<TaskManagementState, typeof TABLE_VIEW_TM>;

const BOARD_VIEW_TM = {
    values: ["isSprintBoardVisible"],
    latest: ["setIsTaskDashboardVisible", "setIsTaskTableVisible", "setIsSprintBoardVisible"],
} as const satisfies SliceSpec<TaskManagementState>;
export type SidebarBoardViewTM = SliceOf<TaskManagementState, typeof BOARD_VIEW_TM>;

// --------------------------------------------------------------------- Recents

const RECENTS_TM = {
    values: ["currentPreviewTaskId", "setIsTaskPreviewVisible"],
    latest: ["setCurrentPreviewTaskId"],
} as const satisfies SliceSpec<TaskManagementState>;
export type SidebarRecentsTM = SliceOf<TaskManagementState, typeof RECENTS_TM>;

const RECENTS_PM = {
    values: ["setCurrentProject"],
    latest: [],
} as const satisfies SliceSpec<ProjectManagementState>;
export type SidebarRecentsPM = SliceOf<ProjectManagementState, typeof RECENTS_PM>;

// ------------------------------------------- Projects and Milestones (the tree)
// Everything `ProjectsListItem`, `MilestonesListItem`, `JoinProjectListItem` and
// `NewProjectListItem` read. No task id, no tag revision, no view flag.

const TREE_TM = {
    values: [
        "tableMilestoneFilterId",
        "currentPreviewKind",
        "currentPreviewMilestoneId",
        "setTableMilestoneFilter",
        "setCurrentPreviewKind",
        "setIsTaskPreviewVisible",
        "setIsCreatingTask",
    ],
    latest: [
        "closeTaskPreview",
        "setCurrentPreviewMilestoneId",
        "setIsTaskTableVisible",
        "setIsTaskDashboardVisible",
    ],
} as const satisfies SliceSpec<TaskManagementState>;
export type SidebarTreeTM = SliceOf<TaskManagementState, typeof TREE_TM>;

const TREE_PM = {
    values: ["teamProjects", "currentProject", "setOpenCreateProject"],
    latest: ["openProject"],
} as const satisfies SliceSpec<ProjectManagementState>;
export type SidebarTreePM = SliceOf<ProjectManagementState, typeof TREE_PM>;

const TREE_SM = {
    values: [
        "projectSprints",
        "projectMilestones",
        "projectFolders",
        "tsLastMilestonesLoaded",
        "loadFoldersForProject",
        "createFolder",
        "renameFolder",
        "removeFolder",
        "moveMilestoneToFolder",
    ],
    latest: [],
} as const satisfies SliceSpec<SprintMilestoneManagementState>;
export type SidebarTreeSM = SliceOf<SprintMilestoneManagementState, typeof TREE_SM>;

const TREE_TEM = {
    values: ["currentTeam", "teamMemberProfiles"],
    latest: [],
} as const satisfies SliceSpec<TeamManagementState>;
export type SidebarTreeTEM = SliceOf<TeamManagementState, typeof TREE_TEM>;

// Only the project row's avatar (the project's PM chat image).
const TREE_CM = {
    values: ["allChats"],
    latest: [],
} as const satisfies SliceSpec<ChatManagementState>;
export type SidebarTreeCM = SliceOf<ChatManagementState, typeof TREE_CM>;

/** The specs, for the tests that check every member of every slice. */
export const SIDEBAR_SLICE_SPECS = {
    shellTM: SHELL_TM,
    shellPM: SHELL_PM,
    searchTM: SEARCH_TM,
    tableViewTM: TABLE_VIEW_TM,
    boardViewTM: BOARD_VIEW_TM,
    recentsTM: RECENTS_TM,
    recentsPM: RECENTS_PM,
    treeTM: TREE_TM,
    treePM: TREE_PM,
    treeSM: TREE_SM,
    treeTEM: TREE_TEM,
    treeCM: TREE_CM,
} as const;

export type SidebarSlices = {
    shell: { tm: SidebarShellTM; pm: SidebarShellPM };
    search: { tm: SidebarSearchTM };
    tableView: { tm: SidebarTableViewTM };
    boardView: { tm: SidebarBoardViewTM };
    recents: { tm: SidebarRecentsTM; pm: SidebarRecentsPM };
    tree: {
        tm: SidebarTreeTM;
        pm: SidebarTreePM;
        sm: SidebarTreeSM;
        tem: SidebarTreeTEM;
        cm: SidebarTreeCM;
    };
};

type SidebarManagers = {
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
};

/**
 * Every slice the task sidebar needs, built from the full managers. The result
 * changes only when a value some slice carries changes.
 */
export const useSidebarSlices = ({
    usePM,
    useTM,
    useSM,
    useTEM,
    useCM,
}: SidebarManagers): SidebarSlices => {
    const shellTM = useManagerSlice(useTM, SHELL_TM);
    const shellPM = useManagerSlice(usePM, SHELL_PM);
    const searchTM = useManagerSlice(useTM, SEARCH_TM);
    const tableViewTM = useManagerSlice(useTM, TABLE_VIEW_TM);
    const boardViewTM = useManagerSlice(useTM, BOARD_VIEW_TM);
    const recentsTM = useManagerSlice(useTM, RECENTS_TM);
    const recentsPM = useManagerSlice(usePM, RECENTS_PM);
    const treeTM = useManagerSlice(useTM, TREE_TM);
    const treePM = useManagerSlice(usePM, TREE_PM);
    const treeSM = useManagerSlice(useSM, TREE_SM);
    const treeTEM = useManagerSlice(useTEM, TREE_TEM);
    const treeCM = useManagerSlice(useCM, TREE_CM);

    return useMemo(
        () => ({
            shell: { tm: shellTM, pm: shellPM },
            search: { tm: searchTM },
            tableView: { tm: tableViewTM },
            boardView: { tm: boardViewTM },
            recents: { tm: recentsTM, pm: recentsPM },
            tree: { tm: treeTM, pm: treePM, sm: treeSM, tem: treeTEM, cm: treeCM },
        }),
        [
            shellTM,
            shellPM,
            searchTM,
            tableViewTM,
            boardViewTM,
            recentsTM,
            recentsPM,
            treeTM,
            treePM,
            treeSM,
            treeTEM,
            treeCM,
        ]
    );
};
