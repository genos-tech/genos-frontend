/**
 * The three places that switch project hand the switch to `usePM.openProject`
 * (MIP-969, step 2): the sidebar's project row, a milestone of ANOTHER project
 * in the sidebar, and the dashboard's project picker.
 *
 * Each used to `await usePM.loadProjectsAndTasks(id)` (the whole project list
 * first, then the project's tasks, then set the project) and then set the
 * project by hand. Now the click sets the project in its own render and asks
 * for the rows only, and none of them asks for the project list.
 *
 * The click no longer empties the table by hand: the table swaps to the new
 * project's remembered rows (or to none) in the same render as the project
 * change, whichever way the project changed (`useTaskManagement`).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { TaskDashboard } from "../features/tasks/components/dashboard/TaskDashboard";
import { MilestonesListItem } from "../features/tasks/components/sidebar/projects_subs/MilestonesListItem";
import { ProjectsListItem } from "../features/tasks/components/sidebar/ProjectsListItem";
import { popSpecificProjectTasks } from "../features/tasks/services/popSpecificProjectTasks";
import type { Milestone } from "../features/tasks/sprint-milestone/types";
import { UserProps } from "../types/admin";
import { ProjectProps } from "../types/tasks";

vi.mock("../features/tasks/services/popSpecificProjectTasks", () => ({
    popSpecificProjectTasks: vi.fn(async () => []),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../features/tasks/services/loadTeamTasks", () => ({
    loadTeamTasks: vi.fn().mockResolvedValue([]),
}));

const myself = {
    userId: "me",
    userName: "Me",
    teamId: "team1",
    teamName: "Team",
    userEmail: "me@test.com",
} as unknown as UserProps;

const A: ProjectProps = {
    projectId: 1,
    projectName: "Alpha",
    projectTags: [],
    isPrivate: false,
    isJoined: true,
    systemUserId: "sys-1",
};
const B: ProjectProps = {
    projectId: 2,
    projectName: "Beta",
    projectTags: [{ tagName: "t" } as never],
    projectLabels: [{ labelId: 7, name: "Lbl", color: "#123", textColor: "#fff" }],
    isPrivate: true,
    isJoined: true,
    systemUserId: "sys-2",
    isExternal: true,
    hostTeamId: "team9",
    hostTeamName: "Partner Co",
};

/** Records the order in which the click's calls happen. */
const makeStubs = () => {
    const calls: string[] = [];
    const rec =
        (name: string) =>
        (...args: unknown[]) => {
            calls.push(name);
            return args;
        };
    const usePM = {
        currentProject: A,
        teamProjects: [A, B],
        openProject: vi.fn(rec("openProject")),
        loadProjectsAndTasks: vi.fn(async () => {}),
        setCurrentProject: vi.fn(rec("setCurrentProject")),
    };
    const useTM = {
        allTasks: [],
        closeTaskPreview: vi.fn(rec("closeTaskPreview")),
        setTableMilestoneFilter: vi.fn(rec("setTableMilestoneFilter")),
        setIsTaskDashboardVisible: vi.fn(rec("setIsTaskDashboardVisible")),
        setIsTaskTableVisible: vi.fn(rec("setIsTaskTableVisible")),
        setAllTasks: vi.fn(rec("setAllTasks")),
        setCurrentPreviewKind: vi.fn(rec("setCurrentPreviewKind")),
        setCurrentPreviewMilestoneId: vi.fn(rec("setCurrentPreviewMilestoneId")),
        setIsTaskPreviewVisible: vi.fn(rec("setIsTaskPreviewVisible")),
        fetchProjectTasks: vi.fn(),
        currentPreviewKind: "task",
        currentPreviewMilestoneId: -1,
        tableMilestoneFilterId: null,
        isTaskPreviewVisible: false,
        isCreatingTask: { flag: false },
    };
    return { calls, usePM, useTM };
};

beforeEach(() => vi.clearAllMocks());

describe("the sidebar's project row", () => {
    const renderSidebar = () => {
        const { calls, usePM, useTM } = makeStubs();
        const useSM = {
            projectSprints: {},
            projectMilestones: {},
            projectFolders: {},
            tsLastMilestonesLoaded: 0,
            loadFoldersForProject: vi.fn().mockResolvedValue([]),
        };
        render(
            <CssVarsProvider>
                <ProjectsListItem
                    myself={myself}
                    setMyself={vi.fn()}
                    setOpenJoinProject={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    usePM={usePM as never}
                    useSM={useSM as never}
                    useTEM={{ currentTeam: { isGuest: false }, teamMemberProfiles: {} } as never}
                    useTM={useTM as never}
                    useUISM={{} as never}
                />
            </CssVarsProvider>
        );
        return { calls, usePM, useTM };
    };

    it("opens the clicked project through openProject, without the project list or the old pre-read", async () => {
        const { calls, usePM, useTM } = renderSidebar();

        fireEvent.click(screen.getByText("Beta"));

        expect(usePM.openProject).toHaveBeenCalledTimes(1);
        // The full record, shared-project fields included (the row used to set these by hand).
        expect(usePM.openProject.mock.calls[0][0]).toMatchObject({
            projectId: 2,
            projectName: "Beta",
            isPrivate: true,
            systemUserId: "sys-2",
            isExternal: true,
            hostTeamName: "Partner Co",
            projectLabels: B.projectLabels,
        });
        expect(usePM.loadProjectsAndTasks).not.toHaveBeenCalled();
        expect(usePM.setCurrentProject).not.toHaveBeenCalled();
        // The IndexedDB pre-read of the old click is gone; the table's own read does it.
        expect(popSpecificProjectTasks).not.toHaveBeenCalled();
        // Previews close first, then the project opens (the URL routing depends on that order).
        expect(calls.indexOf("closeTaskPreview")).toBeLessThan(calls.indexOf("openProject"));
        expect(useTM.setAllTasks).not.toHaveBeenCalled();
        // ...and all of it in the click itself.
        await Promise.resolve();
        expect(usePM.openProject).toHaveBeenCalledTimes(1);
    });

    it("clicking the project that is already open does nothing", () => {
        const { usePM, useTM } = renderSidebar();

        fireEvent.click(screen.getByText("Alpha"));

        expect(usePM.openProject).not.toHaveBeenCalled();
        expect(useTM.closeTaskPreview).not.toHaveBeenCalled();
    });
});

describe("a milestone of another project in the sidebar", () => {
    const milestone = {
        milestoneId: 200,
        projectId: 2,
        title: "Ship it",
        status: "Open",
        sprintId: null,
        folderId: null,
        isDeleted: false,
        dueDate: null,
        assignees: [],
        tasksClosed: 0,
        tasksTotal: 0,
    } as unknown as Milestone;

    const renderMilestones = (currentProjectId: number) => {
        const { calls, usePM, useTM } = makeStubs();
        const useSM = {
            projectSprints: { [currentProjectId]: [] },
            projectMilestones: { [currentProjectId]: [milestone] },
            projectFolders: { [currentProjectId]: [] },
            tsLastMilestonesLoaded: 1,
            loadFoldersForProject: vi.fn().mockResolvedValue([]),
        };
        render(
            <CssVarsProvider>
                <MilestonesListItem
                    currentProjectId={currentProjectId}
                    myself={myself}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{} as never}
                    usePM={usePM as never}
                    useSM={useSM as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useTM={useTM as never}
                    useUISM={{} as never}
                />
            </CssVarsProvider>
        );
        return { calls, usePM, useTM };
    };

    it("switches project through openProject in the same click that opens the milestone", () => {
        // The milestone is B's; A is open.
        const { calls, usePM, useTM } = renderMilestones(2);

        fireEvent.click(screen.getByText("Ship it"));

        expect(usePM.openProject).toHaveBeenCalledTimes(1);
        expect(usePM.openProject.mock.calls[0][0]).toMatchObject({ projectId: 2 });
        expect(usePM.loadProjectsAndTasks).not.toHaveBeenCalled();
        // Nothing is awaited in between: the milestone preview and its table scope
        // are set in the same click, after the project.
        expect(useTM.setCurrentPreviewKind).toHaveBeenCalledWith("milestone");
        expect(useTM.setCurrentPreviewMilestoneId).toHaveBeenCalledWith(200);
        expect(useTM.setTableMilestoneFilter).toHaveBeenLastCalledWith({
            milestoneId: 200,
            projectId: 2,
        });
        expect(calls.indexOf("closeTaskPreview")).toBeLessThan(calls.indexOf("openProject"));
        expect(calls.indexOf("openProject")).toBeLessThan(
            calls.indexOf("setCurrentPreviewMilestoneId")
        );
        expect(useTM.setAllTasks).not.toHaveBeenCalled();
    });

    it("a milestone of the open project switches nothing", () => {
        const { usePM, useTM } = renderMilestones(1);

        fireEvent.click(screen.getByText("Ship it"));

        expect(usePM.openProject).not.toHaveBeenCalled();
        expect(useTM.setCurrentPreviewMilestoneId).toHaveBeenCalledWith(200);
    });
});

describe("the dashboard's project picker", () => {
    const materialTheme = createTheme({ cssVariables: true });

    // Mounting the whole dashboard is slow on a loaded machine.
    it("switches through openProject", { timeout: 30_000 }, async () => {
        const { usePM, useTM } = makeStubs();
        const avatarContextValue = {
            myself,
            setMyself: vi.fn(),
            teamMemberProfiles: {},
            setTeamMemberProfiles: vi.fn(),
            socket: null,
            useCM: { allChats: [] },
            useUISM: {},
        } as never;
        render(
            <CssVarsProvider>
                <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
                    <AvatarContextProvider value={avatarContextValue}>
                        <TaskDashboard
                            myself={myself}
                            setMyself={vi.fn()}
                            socket={null}
                            useCM={{ allChats: [] } as never}
                            usePM={usePM as never}
                            useTEM={{ teamMemberProfiles: {} } as never}
                            useTM={useTM as never}
                            useUISM={{} as never}
                            useSM={
                                {
                                    projectSprints: {},
                                    currentSprint: null,
                                    projectMilestones: {},
                                    setCurrentSprint: vi.fn(),
                                } as never
                            }
                            onCloseTaskHome={vi.fn()}
                        />
                    </AvatarContextProvider>
                </ThemeProvider>
            </CssVarsProvider>
        );

        fireEvent.click(screen.getAllByRole("combobox")[0]);
        const list = await screen.findByRole("listbox");
        fireEvent.click(within(list).getByText("Beta"));

        await waitFor(() => expect(usePM.openProject).toHaveBeenCalledTimes(1));
        expect(usePM.openProject.mock.calls[0][0]).toMatchObject({ projectId: 2 });
        expect(usePM.loadProjectsAndTasks).not.toHaveBeenCalled();
        expect(usePM.setCurrentProject).not.toHaveBeenCalled();
        expect(useTM.closeTaskPreview).toHaveBeenCalled();
        expect(useTM.setAllTasks).not.toHaveBeenCalled();
    });
});
