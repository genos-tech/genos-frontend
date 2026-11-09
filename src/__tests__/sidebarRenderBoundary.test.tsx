/**
 * The project / milestone sidebar must not re-render for a render of `AppBody`
 * that changed nothing it shows (MIP-971).
 *
 * `AppBody` renders about a dozen times for one task click, and every manager
 * (`usePM`, `useTM`, `useSM`, `useTEM`, `useCM`, `useUISM`) is a NEW object on
 * every one of those renders. The sidebar took all six whole, so the whole
 * tree (every project row and every milestone row) re-rendered on each pass.
 *
 * This renders `TaskSidebar` through its public entry point, with the full
 * managers, exactly as `TaskHomeLayout` and `MobileTaskHome` do, and counts
 * renders at leaves that only the tree under test renders:
 *   - `ProjectIdentityRow`: once per visible project, per `ProjectsListItem` render;
 *   - `MilestoneRowActions`: once per live milestone row, per `MilestonesListItem` render;
 *   - `RecentProjectGroup`: once per recent project, per `RecentsListItem` render;
 *   - the Home / Table / Board / Search icons: once per render of the sidebar's own
 *     body, of the two view buttons, and of the search box.
 * Data (project list, milestones, chats, ...) is held at module level, so a
 * render only changes what the test says it changes. The manager OBJECTS and
 * the non-`useCallback` functions are new on every render, as in the app.
 */

import { useState, type ComponentProps } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskSidebar } from "../features/tasks/components/sidebar/TaskSidebarMain";
import { loadRecentTasks } from "../features/tasks/services/recentTasks";
import { emitTaskOpened } from "../features/tasks/services/taskEvents";
import type { Milestone } from "../features/tasks/sprint-milestone/types";
import type { UserProps } from "../types/admin";
import type { ProjectProps } from "../types/tasks";

// ---------------------------------------------------------------- counters

const counts = { projectRows: 0, milestoneRows: 0, shell: 0, recents: 0, views: 0, search: 0 };

// Icons only the sidebar draws, one place each: they count renders of the
// components that own them, without touching those components.
//   Home: the sidebar's own body. Table / Board: the two view buttons.
//   Search: the search box.
vi.mock("@mui/icons-material/HomeRounded", () => ({
    default: () => {
        counts.shell += 1;
        return null;
    },
}));
vi.mock("@mui/icons-material/TableChart", () => ({
    default: () => {
        counts.views += 1;
        return null;
    },
}));
vi.mock("@mui/icons-material/ViewKanban", () => ({
    default: () => {
        counts.views += 1;
        return null;
    },
}));
vi.mock("@mui/icons-material/SearchRounded", () => ({
    default: () => {
        counts.search += 1;
        return null;
    },
}));
// One folder per recent project: a render of `RecentsListItem` renders it once
// (it is not memoized itself).
vi.mock("../features/tasks/components/sidebar/RecentProjectGroup", async () => {
    const actual = await vi.importActual<
        typeof import("../features/tasks/components/sidebar/RecentProjectGroup")
    >("../features/tasks/components/sidebar/RecentProjectGroup");
    return {
        ...actual,
        RecentProjectGroup: (props: ComponentProps<typeof actual.RecentProjectGroup>) => {
            counts.recents += 1;
            return <actual.RecentProjectGroup {...props} />;
        },
    };
});

vi.mock("../features/tasks/components/ProjectIdentityRow", () => ({
    ProjectIdentityRow: ({ project }: { project: { projectName: string } }) => {
        counts.projectRows += 1;
        return <span>{project.projectName}</span>;
    },
    // The Favorites rows draw a project's avatar (MIP-1352); not counted here.
    ProjectAvatar: () => <span data-testid="project-avatar" />,
}));

vi.mock("../features/tasks/components/sidebar/projects_subs/MilestoneFolderMenus", async () => {
    const actual = await vi.importActual<
        typeof import("../features/tasks/components/sidebar/projects_subs/MilestoneFolderMenus")
    >("../features/tasks/components/sidebar/projects_subs/MilestoneFolderMenus");
    return {
        ...actual,
        MilestoneRowActions: () => {
            counts.milestoneRows += 1;
            return null;
        },
    };
});

// ----------------------------------------------------------------- network

const RECENT = [
    {
        projectId: 3,
        projectName: "Gamma",
        systemUserId: "sys-3",
        projectTags: [],
        taskId: 3001,
        title: "Recent one",
        status: { status: "open", color: "", textColor: "" },
        tsUpdated: "2026-01-02T00:00:00.000Z",
        tsOpened: "2026-01-02T00:00:00.000Z",
    },
    {
        projectId: 3,
        projectName: "Gamma",
        systemUserId: "sys-3",
        projectTags: [],
        taskId: 3002,
        title: "Recent two",
        status: { status: "open", color: "", textColor: "" },
        tsUpdated: "2026-01-01T00:00:00.000Z",
        tsOpened: "2026-01-01T00:00:00.000Z",
    },
];

const loadTags = vi.fn(async () => []);
vi.mock("../features/tasks/services/loadProjectTags", () => ({
    loadProjectTags: (...a: unknown[]) => (loadTags as (...x: unknown[]) => unknown)(...a),
}));
vi.mock("../features/tasks/services/loadTaskSearchList", () => ({
    loadTeamTaskList: vi.fn(async () => []),
}));
// Recents comes from the tasks the user opened (MIP-1063).
vi.mock("../features/tasks/services/recentTasks", () => ({
    loadRecentTasks: vi.fn(async () => RECENT),
    recordTaskOpen: vi.fn(async () => true),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

// -------------------------------------------------------------------- data
// Module level on purpose: only what a test patches may change between renders.

const myself = { userId: "me", userName: "Me", teamId: "team1" } as unknown as UserProps;
const noMembers = {};

const ALPHA: ProjectProps = {
    projectId: 1,
    projectName: "Alpha",
    projectTags: [],
    isPrivate: false,
    isJoined: true,
    systemUserId: "sys-1",
};
const BETA: ProjectProps = {
    projectId: 2,
    projectName: "Beta",
    projectTags: [],
    isPrivate: false,
    isJoined: true,
    systemUserId: "sys-2",
};
const TEAM_PROJECTS = [ALPHA, BETA];

const milestone = (milestoneId: number, projectId: number, title: string): Milestone =>
    ({
        milestoneId,
        projectId,
        title,
        status: "Open",
        sprintId: null,
        folderId: null,
        isDeleted: false,
        dueDate: null,
        assignees: [],
        tasksClosed: 0,
        tasksTotal: 0,
    }) as unknown as Milestone;

const MS_ALPHA = milestone(100, 1, "Ship alpha");
const MS_BETA = milestone(200, 2, "Ship beta");
const MILESTONES = { 1: [MS_ALPHA], 2: [MS_BETA] };
const SPRINTS = { 1: [], 2: [] };
const FOLDERS = { 1: [], 2: [] };
const ALL_CHATS: never[] = [];
const MEMBER = { isGuest: false } as never;

// Stable functions: React `useState` setters and `useCallback`s in the real hooks.
const stable = {
    setTableMilestoneFilter: vi.fn(),
    setCurrentPreviewKind: vi.fn(),
    setIsTaskPreviewVisible: vi.fn(),
    setIsCreatingTask: vi.fn(),
    setCurrentProject: vi.fn(),
    setOpenCreateProject: vi.fn(),
    loadFoldersForProject: vi.fn(async () => []),
    createFolder: vi.fn(async () => null),
    renameFolder: vi.fn(async () => null),
    removeFolder: vi.fn(async () => true),
    moveMilestoneToFolder: vi.fn(async () => null),
    // Favorites (MIP-1053): useCallbacks in the real hook.
    isMilestoneFavorited: () => false,
    toggleMilestoneFavorite: vi.fn(),
    noteMilestoneOpened: vi.fn(),
    setOpenJoinProject: vi.fn(),
    setMyself: vi.fn(),
};

// ------------------------------------------------------------------- world

type World = {
    tm: {
        currentPreviewTaskId: number;
        currentPreviewKind: "task" | "milestone";
        currentPreviewMilestoneId: number;
        tableMilestoneFilterId: number | null;
        isTaskTableVisible: boolean;
        isTaskDashboardVisible: boolean;
        isSprintBoardVisible: boolean;
        tagsRevision: number;
        // Read by other parts of the app, never by the sidebar.
        allTasks: unknown[];
        currentPreviewTask: unknown;
        isTaskPreviewVisible: boolean;
        isCreatingTask: { flag: boolean };
    };
    pm: {
        teamProjects: ProjectProps[];
        currentProject: ProjectProps | null;
        openCreateProject: boolean;
        tsTasksLoadedToIDB: unknown;
    };
    sm: {
        projectSprints: Record<number, unknown[]>;
        projectMilestones: Record<number, Milestone[]>;
        projectFolders: Record<number, unknown[]>;
        milestoneFavorites: unknown[];
        tsLastMilestonesLoaded: number | undefined;
        currentMilestone: unknown;
        // A `useCallback` on the access token: it changes when the token is refreshed.
        loadFoldersForProject: (projectId: number) => Promise<unknown[]>;
    };
    cm: { allChats: unknown[]; unReadChatCounts: number };
    tem: {
        currentTeam: { isGuest: boolean };
        teamMemberProfiles: Record<string, unknown>;
        teamMembers: unknown[];
        currentTeamId: string;
    };
    uism: { isLoading: boolean };
};

const initialWorld = (): World => ({
    tm: {
        currentPreviewTaskId: -1,
        currentPreviewKind: "task",
        currentPreviewMilestoneId: -1,
        tableMilestoneFilterId: null,
        isTaskTableVisible: true,
        isTaskDashboardVisible: false,
        isSprintBoardVisible: false,
        tagsRevision: 0,
        allTasks: [],
        currentPreviewTask: undefined,
        isTaskPreviewVisible: false,
        isCreatingTask: { flag: false },
    },
    pm: {
        teamProjects: TEAM_PROJECTS,
        currentProject: ALPHA,
        openCreateProject: false,
        tsTasksLoadedToIDB: undefined,
    },
    sm: {
        projectSprints: SPRINTS,
        projectMilestones: MILESTONES,
        projectFolders: FOLDERS,
        milestoneFavorites: [],
        tsLastMilestonesLoaded: 1,
        currentMilestone: undefined,
        loadFoldersForProject: stable.loadFoldersForProject,
    },
    cm: { allChats: ALL_CHATS, unReadChatCounts: 0 },
    tem: {
        currentTeam: MEMBER,
        teamMemberProfiles: noMembers,
        teamMembers: [],
        currentTeamId: "team1",
    },
    uism: { isLoading: false },
});

// Which render each call came from: the newest implementation has the highest.
let generation = 0;
const calls: string[] = [];
const makeFn = (name: string) => {
    const g = generation;
    return (...args: unknown[]) => {
        calls.push(`${name}@${g}`);
        return args;
    };
};

let setWorld: (updater: (w: World) => World) => void = () => {};

// What `AppBody` does: every render builds every manager anew. Values come from
// the world; the functions the real hooks do not memoize are new each time.
const Harness = () => {
    const [world, set] = useState<World>(initialWorld);
    setWorld = set;
    generation += 1;

    const useTM = {
        ...world.tm,
        ...stable,
        setIsTaskTableVisible: makeFn("setIsTaskTableVisible"),
        setIsTaskDashboardVisible: makeFn("setIsTaskDashboardVisible"),
        setIsSprintBoardVisible: makeFn("setIsSprintBoardVisible"),
        setCurrentPreviewTaskId: makeFn("setCurrentPreviewTaskId"),
        setCurrentPreviewMilestoneId: makeFn("setCurrentPreviewMilestoneId"),
        closeTaskPreview: makeFn("closeTaskPreview"),
    };
    const usePM = {
        ...world.pm,
        ...stable,
        openProject: makeFn("openProject"),
    };
    const useSM = { ...stable, ...world.sm };
    const useTEM = { ...world.tem };
    const useCM = { ...world.cm };
    const useUISM = { ...world.uism, setIsLoading: makeFn("setIsLoading") };

    return (
        <TaskSidebar
            myself={myself}
            setMyself={stable.setMyself}
            setOpenJoinProject={stable.setOpenJoinProject}
            socket={null}
            useCM={useCM as never}
            usePM={usePM as never}
            useSM={useSM as never}
            useTEM={useTEM as never}
            useTM={useTM as never}
            useUISM={useUISM as never}
        />
    );
};

type Patch = { [K in keyof World]?: Partial<World[K]> };
const patch = (p: Patch) =>
    act(() =>
        setWorld((w) => {
            const next = { ...w } as World;
            for (const k of Object.keys(p) as (keyof World)[]) {
                (next as Record<string, unknown>)[k] = { ...w[k], ...p[k] };
            }
            return next;
        })
    );
/** A render of the harness in which no value changed (managers are all new). */
const bump = () => patch({});

const mount = async () => {
    // The theme provider sits ABOVE the part that re-renders, as it does in the
    // app (`AppBody` is inside it): its context must not change on a bump.
    render(
        <CssVarsProvider>
            <Harness />
        </CssVarsProvider>
    );
    // Recents and the tag fetch resolve after mount.
    await act(async () => {});
};

const snapshot = () => ({ ...counts });
/** The two tree counters only (the shell body legitimately renders on a task click). */
const tree = () => ({ projectRows: counts.projectRows, milestoneRows: counts.milestoneRows });
const text = (s: string) => screen.getByText(s);
const row = (label: string) => text(label).closest("[role=button]") as HTMLElement;
const isSelected = (label: string) => row(label).classList.contains("Mui-selected");

beforeEach(() => {
    counts.projectRows = 0;
    counts.milestoneRows = 0;
    counts.shell = 0;
    counts.recents = 0;
    counts.views = 0;
    counts.search = 0;
    calls.length = 0;
    generation = 0;
    vi.clearAllMocks();
});

// ---------------------------------------------------------------- the tests

describe("an AppBody render that changes nothing the sidebar shows", () => {
    it("renders every project row and milestone row at least once on mount", async () => {
        await mount();
        // Two projects, one live milestone each.
        expect(counts.projectRows).toBeGreaterThanOrEqual(2);
        expect(counts.milestoneRows).toBeGreaterThanOrEqual(2);
    });

    it("moves no project or milestone row when every manager is a new object with the same values", async () => {
        await mount();
        const before = snapshot();
        for (let i = 0; i < 5; i += 1) bump();
        expect(snapshot()).toEqual(before);
    });

    it.each<[string, Patch]>([
        ["allTasks", { tm: { allTasks: [{ taskId: 1 }] } }],
        ["currentPreviewTask", { tm: { currentPreviewTask: { taskId: 1 } } }],
        ["isTaskPreviewVisible", { tm: { isTaskPreviewVisible: true } }],
        ["isCreatingTask", { tm: { isCreatingTask: { flag: true } } }],
        ["usePM.openCreateProject", { pm: { openCreateProject: true } }],
        ["usePM.tsTasksLoadedToIDB", { pm: { tsTasksLoadedToIDB: { ts: 1, projectId: 1 } } }],
        ["useSM.currentMilestone", { sm: { currentMilestone: { milestoneId: 100 } } }],
        ["useCM.unReadChatCounts", { cm: { unReadChatCounts: 4 } }],
        ["useTEM.teamMembers", { tem: { teamMembers: [{ userId: "u2" }] } }],
        ["useTEM.currentTeamId", { tem: { currentTeamId: "team2" } }],
        ["useUISM.isLoading", { uism: { isLoading: true } }],
    ])("moves no project or milestone row when %s changes", async (_name, change) => {
        await mount();
        const before = snapshot();
        patch(change);
        expect(snapshot()).toEqual(before);
    });

    it("a task click (currentPreviewTaskId changes) moves no project or milestone row, but moves the Recents highlight", async () => {
        await mount();
        const before = snapshot();
        patch({ tm: { currentPreviewTaskId: 3002, isTaskPreviewVisible: true } });
        await act(async () => {});
        expect(tree()).toEqual({
            projectRows: before.projectRows,
            milestoneRows: before.milestoneRows,
        });
        // The sidebar's own body does render: the highlight follows the id.
        expect(snapshot().shell).toBeGreaterThan(before.shell);
        expect(snapshot().recents).toBeGreaterThan(before.recents);
        // The task is in Recents: its folder opens by itself and the row is current.
        const current = screen.getByText("Recent two").closest("[role=button]") as HTMLElement;
        expect(current.getAttribute("aria-current")).toBe("true");
        expect(
            (screen.getByText("Recent one").closest("[role=button]") as HTMLElement).getAttribute(
                "aria-current"
            )
        ).toBeNull();
    });

    it("moves nothing when the preview switches from one task to another", async () => {
        await mount();
        patch({ tm: { currentPreviewTaskId: 3001 } });
        await act(async () => {});
        const before = tree();
        patch({ tm: { currentPreviewTaskId: 3002 } });
        patch({ tm: { currentPreviewTaskId: 3001 } });
        expect(tree()).toEqual(before);
    });
});

describe("when Recents reloads (MIP-1063)", () => {
    const settle = (ms: number) =>
        act(async () => {
            await new Promise((resolve) => setTimeout(resolve, ms));
        });

    it("reloads once the preview has had an open recorded, once for a burst", async () => {
        await mount();
        const loaded = vi.mocked(loadRecentTasks).mock.calls.length;
        await act(async () => {
            emitTaskOpened();
            emitTaskOpened();
            emitTaskOpened();
        });
        await settle(700);
        expect(vi.mocked(loadRecentTasks).mock.calls.length).toBe(loaded + 1);
    });

    it("does not reload for a change of the previewed id alone: the open is recorded by the preview", async () => {
        await mount();
        const loaded = vi.mocked(loadRecentTasks).mock.calls.length;
        patch({ tm: { currentPreviewTaskId: 3002, isTaskPreviewVisible: true } });
        await settle(700);
        expect(vi.mocked(loadRecentTasks).mock.calls.length).toBe(loaded);
    });
});

describe("a change of something the sidebar shows", () => {
    it("moves the selected-task highlight in Recents", async () => {
        await mount();
        patch({ tm: { currentPreviewTaskId: 3001 } });
        await act(async () => {});
        expect(
            (screen.getByText("Recent one").closest("[role=button]") as HTMLElement).getAttribute(
                "aria-current"
            )
        ).toBe("true");
        patch({ tm: { currentPreviewTaskId: 3002 } });
        expect(
            (screen.getByText("Recent one").closest("[role=button]") as HTMLElement).getAttribute(
                "aria-current"
            )
        ).toBeNull();
        expect(
            (screen.getByText("Recent two").closest("[role=button]") as HTMLElement).getAttribute(
                "aria-current"
            )
        ).toBe("true");
    });

    it("moves the selected-milestone highlight (and only that milestone's)", async () => {
        await mount();
        expect(isSelected("Ship beta")).toBe(false);
        const before = snapshot();
        patch({ tm: { currentPreviewKind: "milestone", currentPreviewMilestoneId: 200 } });
        expect(isSelected("Ship beta")).toBe(true);
        expect(isSelected("Ship alpha")).toBe(false);
        expect(snapshot().milestoneRows).toBeGreaterThan(before.milestoneRows);
    });

    it("moves the selected-project highlight", async () => {
        await mount();
        expect(isSelected("Alpha")).toBe(true);
        expect(isSelected("Beta")).toBe(false);
        patch({ pm: { currentProject: BETA } });
        expect(isSelected("Alpha")).toBe(false);
        expect(isSelected("Beta")).toBe(true);
    });

    it("moves the view toggles (Home, Table, Board)", async () => {
        await mount();
        expect(isSelected("Table")).toBe(true);
        expect(isSelected("Board")).toBe(false);
        expect(isSelected("Home")).toBe(false);
        patch({ tm: { isTaskTableVisible: false, isSprintBoardVisible: true } });
        expect(isSelected("Table")).toBe(false);
        expect(isSelected("Board")).toBe(true);
        patch({ tm: { isSprintBoardVisible: false, isTaskDashboardVisible: true } });
        expect(isSelected("Board")).toBe(false);
        expect(isSelected("Home")).toBe(true);
    });

    it("re-fetches the project's tags when tagsRevision changes", async () => {
        await mount();
        const fetched = loadTags.mock.calls.length;
        expect(fetched).toBeGreaterThanOrEqual(1);
        patch({ tm: { tagsRevision: 1 } });
        await act(async () => {});
        expect(loadTags.mock.calls.length).toBe(fetched + 1);
    });

    it("tableMilestoneFilterId is read fresh: the next click on that milestone un-scopes it", async () => {
        await mount();
        fireEvent.click(text("Ship alpha"));
        expect(stable.setTableMilestoneFilter).toHaveBeenLastCalledWith({
            milestoneId: 100,
            projectId: 1,
        });
        patch({ tm: { tableMilestoneFilterId: 100 } });
        fireEvent.click(text("Ship alpha"));
        expect(stable.setTableMilestoneFilter).toHaveBeenLastCalledWith(null);
    });

    it("shows a project that arrives in teamProjects, and its milestones", async () => {
        await mount();
        const gamma = { ...ALPHA, projectId: 9, projectName: "Delta", systemUserId: "sys-9" };
        patch({ pm: { teamProjects: [...TEAM_PROJECTS, gamma] } });
        expect(text("Delta")).toBeTruthy();
    });

    it("shows a milestone that arrives in projectMilestones", async () => {
        await mount();
        patch({
            sm: {
                projectMilestones: {
                    ...MILESTONES,
                    1: [MS_ALPHA, milestone(101, 1, "Ship alpha two")],
                },
            },
        });
        expect(text("Ship alpha two")).toBeTruthy();
    });

    // A value only the project / milestone tree reads. The tree re-renders where it
    // reads it and NOWHERE ELSE: not Recents, not the view buttons, not the search
    // box, and (for what only `ProjectsListItem` reads) not the milestone rows.
    it.each<[string, Patch, boolean]>([
        ["useCM.allChats", { cm: { allChats: [] } }, false],
        // One slice carries `currentTeam` and `teamMemberProfiles` to the whole tree.
        ["useTEM.currentTeam", { tem: { currentTeam: { isGuest: false } } }, true],
        ["useTEM.teamMemberProfiles", { tem: { teamMemberProfiles: {} } }, true],
        ["useSM.projectFolders", { sm: { projectFolders: { 1: [], 2: [] } } }, true],
        ["useSM.projectSprints", { sm: { projectSprints: { 1: [], 2: [] } } }, true],
        [
            "useSM.projectMilestones",
            { sm: { projectMilestones: { 1: [MS_ALPHA], 2: [MS_BETA] } } },
            true,
        ],
        ["usePM.currentProject", { pm: { currentProject: BETA } }, true],
        ["useTM.tableMilestoneFilterId", { tm: { tableMilestoneFilterId: 100 } }, true],
    ])(
        "%s re-renders the tree where it is read and nothing else",
        async (_name, change, milestonesRead) => {
            await mount();
            const before = snapshot();
            patch(change);
            const after = snapshot();
            expect(after.projectRows).toBeGreaterThan(before.projectRows);
            if (milestonesRead) {
                expect(after.milestoneRows).toBeGreaterThan(before.milestoneRows);
            } else {
                expect(after.milestoneRows).toBe(before.milestoneRows);
            }
            expect(after.recents).toBe(before.recents);
            expect(after.views).toBe(before.views);
            expect(after.search).toBe(before.search);
        }
    );

    it("shows Favorites above Recents, and a favorite re-renders neither Recents, the views nor the search (MIP-1053)", async () => {
        await mount();
        // No favorites yet: no folder.
        expect(screen.queryByTestId("sidebar-favorites")).toBeNull();
        const before = snapshot();
        patch({
            sm: {
                milestoneFavorites: [
                    {
                        milestoneId: 100,
                        taskId: null,
                        displayId: null,
                        title: "Ship alpha",
                        status: "Open",
                        projectId: 1,
                        projectName: "Alpha",
                        teamId: null,
                        tsFavorited: "",
                        tsLastOpened: null,
                    },
                ],
            },
        });
        const folder = screen.getByTestId("sidebar-favorites");
        const recents = screen.getByText("Recents");
        // DOCUMENT_POSITION_FOLLOWING: Recents comes after Favorites.
        expect(
            folder.compareDocumentPosition(recents) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        const after = snapshot();
        expect(after.recents).toBe(before.recents);
        expect(after.views).toBe(before.views);
        expect(after.search).toBe(before.search);
    });

    // MIP-1055: each folder of the real sidebar saves under its own id.
    it("saves the open state of Recents, Projects, a project and Join project under their own ids", async () => {
        localStorage.clear();
        await mount();
        const key = `genos.taskSidebar.open.v1.${localStorage.getItem("userId") || "anon"}`;
        const saved = () => JSON.parse(localStorage.getItem(key) ?? "{}");
        const toggle = (label: string) =>
            fireEvent.click(
                screen
                    .getAllByText(label)
                    .map((e) => e.closest("[role=button]"))
                    .find((e) => e) as HTMLElement
            );
        toggle("Recents");
        expect(saved()).toEqual({ recents: true });
        // Projects starts open; closing it is a choice worth keeping.
        toggle("Projects");
        expect(saved()).toEqual({ recents: true, projects: false });
        toggle("Projects");
        toggle("Alpha");
        expect(saved()).toMatchObject({ projects: true, "project:1": true });
        // Another project is a separate entry.
        expect(saved()["project:2"]).toBeUndefined();
        toggle("Join Project");
        expect(saved()["join-project"]).toBe(true);
    });

    it("a view flag re-renders the view buttons and the Home button, and no row", async () => {
        await mount();
        const before = snapshot();
        patch({ tm: { isTaskTableVisible: false, isSprintBoardVisible: true } });
        const after = snapshot();
        expect(after.views).toBeGreaterThan(before.views);
        expect(after.projectRows).toBe(before.projectRows);
        expect(after.milestoneRows).toBe(before.milestoneRows);
        expect(after.recents).toBe(before.recents);
        expect(after.search).toBe(before.search);
    });

    it("re-loads each project's folders when loadFoldersForProject changes (a token refresh), and on tsLastMilestonesLoaded", async () => {
        await mount();
        const firstLoads = stable.loadFoldersForProject.mock.calls.length;
        expect(firstLoads).toBeGreaterThanOrEqual(2);

        // The effect lists the function as a dependency: a new one must re-run it,
        // with the project ids. (Wrapping it in a never-changing function would
        // silently stop this.)
        const refreshed = vi.fn(async () => []);
        patch({ sm: { loadFoldersForProject: refreshed } });
        expect(refreshed.mock.calls.map((c) => c[0]).sort()).toEqual([1, 2]);

        patch({ sm: { tsLastMilestonesLoaded: 2 } });
        expect(refreshed.mock.calls.length).toBe(4);
    });

    it("hides Join / New project for a guest", async () => {
        await mount();
        expect(screen.queryByText("New Project")).not.toBeNull();
        patch({ tem: { currentTeam: { isGuest: true } } });
        expect(screen.queryByText("New Project")).toBeNull();
    });
});

describe("the sidebar always calls the newest implementation of a function", () => {
    it("after unrelated renders, a project click uses closeTaskPreview and openProject of the LATEST render", async () => {
        await mount();
        for (let i = 0; i < 3; i += 1) bump();
        const before = snapshot();
        const latest = generation;
        fireEvent.click(text("Beta"));
        expect(calls).toContain(`closeTaskPreview@${latest}`);
        expect(calls).toContain(`openProject@${latest}`);
        // The click opens that row's own collapse (a state of the row), which
        // renders that one project row and nothing else; the manager state does
        // not change in this harness.
        expect(snapshot().milestoneRows).toBe(before.milestoneRows);
        expect(snapshot().projectRows).toBeLessThanOrEqual(before.projectRows + 1);
    });

    it("the Home / Table / Board buttons call the latest view setters", async () => {
        await mount();
        for (let i = 0; i < 2; i += 1) bump();
        const latest = generation;
        fireEvent.click(text("Home"));
        expect(calls).toContain(`setIsTaskDashboardVisible@${latest}`);
        expect(calls).toContain(`setIsTaskTableVisible@${latest}`);
        expect(calls).toContain(`setIsSprintBoardVisible@${latest}`);
        calls.length = 0;
        bump();
        const next = generation;
        fireEvent.click(text("Board"));
        expect(calls).toContain(`setIsSprintBoardVisible@${next}`);
        expect(calls.some((c) => c.endsWith(`@${latest}`))).toBe(false);
    });

    it("a Recents click uses the latest setCurrentPreviewTaskId", async () => {
        await mount();
        // Open Gamma's folder (closed by default), then render again.
        fireEvent.click(text("Gamma"));
        for (let i = 0; i < 2; i += 1) bump();
        const latest = generation;
        fireEvent.click(text("Recent one"));
        expect(stable.setCurrentProject).toHaveBeenCalled();
        expect(stable.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
        // setCurrentPreviewTaskId is not stable in the real hook.
        expect(calls).toContain(`setCurrentPreviewTaskId@${latest}`);
    });

    it("a milestone click uses the latest setCurrentPreviewMilestoneId", async () => {
        await mount();
        for (let i = 0; i < 2; i += 1) bump();
        const latest = generation;
        fireEvent.click(text("Ship alpha"));
        expect(calls).toContain(`setCurrentPreviewMilestoneId@${latest}`);
    });
});
