// MIP-1055: the task sidebar remembers which folders are open or closed, in
// this browser only (localStorage), so a reload does not reset them.
//   - the storage helper: one map per person, tolerant of broken storage;
//   - every kind of folder: sections, projects, milestone folders, Past
//     milestones and its year / sprint levels, Recents' project groups;
//   - Recents' auto-reveal of the open task's folder is NOT saved.

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Toggler } from "../features/tasks/components/sidebar/common";
import { MilestonesListItem } from "../features/tasks/components/sidebar/projects_subs/MilestonesListItem";
import { RecentProjectGroup } from "../features/tasks/components/sidebar/RecentProjectGroup";
import {
    readSidebarOpen,
    useSidebarOpen,
    writeSidebarOpen,
} from "../features/tasks/components/sidebar/useSidebarOpen";
import type { Milestone, MilestoneFolder, Sprint } from "../features/tasks/sprint-milestone/types";
import type { SearchTeamTasksResponse } from "../types/tasks";

const KEY = (user: string) => `genos.taskSidebar.open.v1.${user}`;
const stored = (user = "u1") => JSON.parse(localStorage.getItem(KEY(user)) ?? "null");

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("userId", "u1");
});
afterEach(() => vi.restoreAllMocks());

describe("the storage helper", () => {
    it("falls back to the default until the folder has been opened or closed", () => {
        expect(readSidebarOpen("recents", false)).toBe(false);
        expect(readSidebarOpen("projects", true)).toBe(true);
    });

    it("remembers a choice, per person", () => {
        writeSidebarOpen("recents", true);
        expect(readSidebarOpen("recents", false)).toBe(true);
        expect(stored()).toEqual({ recents: true });
        // Another person on the same browser starts from the defaults.
        localStorage.setItem("userId", "u2");
        expect(readSidebarOpen("recents", false)).toBe(false);
        localStorage.setItem("userId", "u1");
        expect(readSidebarOpen("recents", false)).toBe(true);
    });

    it("keeps what it was told for a closed folder too (a default-open folder the user closed)", () => {
        writeSidebarOpen("projects", false);
        expect(readSidebarOpen("projects", true)).toBe(false);
    });

    it("ignores a corrupt or foreign value instead of throwing", () => {
        localStorage.setItem(KEY("u1"), "{not json");
        expect(readSidebarOpen("recents", true)).toBe(true);
        localStorage.setItem(KEY("u1"), JSON.stringify(["recents"]));
        expect(readSidebarOpen("recents", true)).toBe(true);
        localStorage.setItem(KEY("u1"), JSON.stringify({ recents: "yes", projects: false }));
        expect(readSidebarOpen("recents", true)).toBe(true);
        expect(readSidebarOpen("projects", true)).toBe(false);
    });

    it("works with storage that throws (a blocked or private window)", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("denied");
        });
        expect(readSidebarOpen("recents", true)).toBe(true);
        expect(() => writeSidebarOpen("recents", false)).not.toThrow();
        const { result } = renderHook(() => useSidebarOpen("recents", false));
        act(() => result.current[1](true));
        // The folder still opens; it is only not remembered.
        expect(result.current[0]).toBe(true);
    });

    it("keeps the newest 400 entries, so the map cannot grow for ever", () => {
        for (let i = 0; i < 450; i += 1) writeSidebarOpen(`project:${i}`, true);
        const map = stored();
        expect(Object.keys(map)).toHaveLength(400);
        expect(map["project:449"]).toBe(true);
        expect(map["project:0"]).toBeUndefined();
        expect(map["project:50"]).toBe(true);
    });
});

describe("useSidebarOpen", () => {
    it("starts from the saved state and saves each change", () => {
        writeSidebarOpen("favorites", false);
        const { result } = renderHook(() => useSidebarOpen("favorites", true));
        expect(result.current[0]).toBe(false);
        act(() => result.current[1]((prev) => !prev));
        expect(result.current[0]).toBe(true);
        expect(stored().favorites).toBe(true);
    });

    it("without an id it is plain state and saves nothing", () => {
        const { result } = renderHook(() => useSidebarOpen(undefined, false));
        act(() => result.current[1](true));
        expect(result.current[0]).toBe(true);
        expect(localStorage.getItem(KEY("u1"))).toBeNull();
    });

    it("re-reads when the same component is handed another folder", () => {
        writeSidebarOpen("project:1", true);
        const { result, rerender } = renderHook(({ id }) => useSidebarOpen(id, false), {
            initialProps: { id: "project:1" },
        });
        expect(result.current[0]).toBe(true);
        rerender({ id: "project:2" });
        expect(result.current[0]).toBe(false);
    });
});

describe("Toggler (sections, projects)", () => {
    const Section = ({ storageKey, open = false }: { storageKey?: string; open?: boolean }) => (
        <Toggler
            defaultExpanded={open}
            storageKey={storageKey}
            renderToggle={({ open: isOpen, setOpen }) => (
                <button type="button" onClick={() => setOpen(!isOpen)}>
                    {isOpen ? "close" : "open"}
                </button>
            )}
        >
            <div>body</div>
        </Toggler>
    );

    it("a folder opened before a reload is open after it", () => {
        const first = render(<Section storageKey="recents" />);
        fireEvent.click(screen.getByText("open"));
        expect(screen.getByText("close")).toBeTruthy();
        first.unmount();
        // "Reload": a fresh mount.
        render(<Section storageKey="recents" />);
        expect(screen.getByText("close")).toBeTruthy();
    });

    it("a default-open folder the user closed stays closed after a reload", () => {
        const first = render(<Section storageKey="projects" open />);
        fireEvent.click(screen.getByText("close"));
        first.unmount();
        render(<Section storageKey="projects" open />);
        expect(screen.getByText("open")).toBeTruthy();
    });

    it("two folders do not share a state", () => {
        const first = render(<Section storageKey="project:1" />);
        fireEvent.click(screen.getByText("open"));
        first.unmount();
        render(<Section storageKey="project:2" />);
        expect(screen.getByText("open")).toBeTruthy();
    });

    it("a Toggler with no key behaves as before: nothing saved", () => {
        render(<Section />);
        fireEvent.click(screen.getByText("open"));
        expect(localStorage.getItem(KEY("u1"))).toBeNull();
    });
});

// -------------------------------------------------------- milestone tree

const P = 7;
const ms = (milestoneId: number, title: string, over: Partial<Milestone> = {}): Milestone =>
    ({
        milestoneId,
        projectId: P,
        title,
        status: "Open",
        sprintId: null,
        folderId: null,
        isDeleted: false,
        dueDate: "2026-11-20",
        assignees: [],
        tasksClosed: 1,
        tasksTotal: 3,
        ...over,
    }) as unknown as Milestone;
const SPRINTS = [
    {
        sprintId: 1,
        name: "Old sprint",
        status: "archived",
        isDeleted: false,
        endDate: "2026-10-14",
    },
] as unknown as Sprint[];
const FOLDERS: MilestoneFolder[] = [
    { folderId: 3, projectId: P, name: "Q4", sortOrder: 1, tsCreatedAt: "", tsUpdatedAt: "" },
];
const MILESTONES = [
    ms(1, "In a folder", { folderId: 3 }),
    ms(2, "Archived", { status: "Closed", sprintId: 1 }),
];
const mountTree = () =>
    render(
        <CssVarsProvider>
            <MilestonesListItem
                currentProjectId={P}
                myself={{ userId: "me" } as never}
                usePM={{ currentProject: { projectId: P }, teamProjects: [] } as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useTM={{} as never}
                useSM={
                    {
                        projectSprints: { [P]: SPRINTS },
                        projectMilestones: { [P]: MILESTONES },
                        projectFolders: { [P]: FOLDERS },
                        tsLastMilestonesLoaded: 1,
                        loadFoldersForProject: vi.fn().mockResolvedValue(FOLDERS),
                        milestoneFavorites: [],
                        isMilestoneFavorited: () => false,
                        toggleMilestoneFavorite: vi.fn(),
                        noteMilestoneOpened: vi.fn(),
                    } as never
                }
            />
        </CssVarsProvider>
    );

describe("milestone folders in a project", () => {
    it("a milestone folder starts open, and a closed one stays closed after a reload", () => {
        const first = mountTree();
        expect(screen.queryByText("In a folder")).not.toBeNull();
        fireEvent.click(screen.getByText("Q4"));
        expect(screen.queryByText("In a folder")).toBeNull();
        expect(stored()[`project:${P}:folder:3`]).toBe(false);
        first.unmount();
        mountTree();
        expect(screen.queryByText("In a folder")).toBeNull();
    });

    it("Past milestones, its year and its sprint each remember their own state", () => {
        const first = mountTree();
        expect(screen.queryByText("2026")).toBeNull();
        fireEvent.click(screen.getByText("Past milestones"));
        fireEvent.click(screen.getByText("2026"));
        expect(screen.queryByText("Old sprint")).not.toBeNull();
        expect(stored()).toMatchObject({
            [`project:${P}:past`]: true,
            [`project:${P}:past:2026`]: true,
        });
        first.unmount();
        // After a reload the year is open too, down to the sprint's own folder.
        mountTree();
        expect(screen.queryByText("2026")).not.toBeNull();
        expect(screen.queryByText("Old sprint")).not.toBeNull();
        expect(screen.queryByText("Archived")).toBeNull();
        fireEvent.click(screen.getByText("Old sprint"));
        expect(screen.queryByText("Archived")).not.toBeNull();
    });

    it("another project's folders are not affected", () => {
        writeSidebarOpen(`project:${P + 1}:folder:3`, false);
        mountTree();
        expect(screen.queryByText("In a folder")).not.toBeNull();
    });
});

// ----------------------------------------------------------- Recents group

const task = (taskId: number): SearchTeamTasksResponse =>
    ({
        taskId,
        title: `Task ${taskId}`,
        status: "Open",
        projectId: 5,
        projectName: "Alpha",
        displayId: `ALP-${taskId}`,
    }) as unknown as SearchTeamTasksResponse;
const GROUP = {
    projectId: 5,
    projectName: "Alpha",
    systemUserId: "s",
    tasks: [task(1), task(2)],
};
const mountGroup = (selectedTaskId = -1) =>
    render(
        <CssVarsProvider>
            <RecentProjectGroup
                group={GROUP as never}
                selectedTaskId={selectedTaskId}
                onOpenTask={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("Recents' project groups", () => {
    it("remembers a group the user opened", () => {
        const first = mountGroup();
        fireEvent.click(screen.getByText("Alpha"));
        expect(screen.queryByText("Task 1")).not.toBeNull();
        first.unmount();
        mountGroup();
        expect(screen.queryByText("Task 1")).not.toBeNull();
    });

    it("keeps one project's group separate from another's", () => {
        const other = { ...GROUP, projectId: 6, projectName: "Beta", tasks: [task(3)] };
        const first = render(
            <CssVarsProvider>
                <RecentProjectGroup
                    group={GROUP as never}
                    selectedTaskId={-1}
                    onOpenTask={vi.fn()}
                />
                <RecentProjectGroup
                    group={other as never}
                    selectedTaskId={-1}
                    onOpenTask={vi.fn()}
                />
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByText("Alpha"));
        expect(stored()).toEqual({ "recents:5": true });
        first.unmount();
        render(
            <CssVarsProvider>
                <RecentProjectGroup
                    group={GROUP as never}
                    selectedTaskId={-1}
                    onOpenTask={vi.fn()}
                />
                <RecentProjectGroup
                    group={other as never}
                    selectedTaskId={-1}
                    onOpenTask={vi.fn()}
                />
            </CssVarsProvider>
        );
        expect(screen.queryByText("Task 1")).not.toBeNull();
        expect(screen.queryByText("Task 3")).toBeNull();
    });

    it("the auto-reveal of the open task's group is not saved", () => {
        const first = mountGroup(2);
        expect(screen.queryByText("Task 2")).not.toBeNull();
        expect(stored()).toBeNull();
        first.unmount();
        // Later, with a different task open: the group is back to closed.
        mountGroup(-1);
        expect(screen.queryByText("Task 1")).toBeNull();
    });

    it("a group the user closes after a reveal stays closed", () => {
        mountGroup(2);
        expect(screen.queryByText("Task 2")).not.toBeNull();
        fireEvent.click(screen.getByText("Alpha"));
        expect(screen.queryByText("Task 2")).toBeNull();
    });
});
