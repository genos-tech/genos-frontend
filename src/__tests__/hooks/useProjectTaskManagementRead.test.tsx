/**
 * When the table reads a project's rows (MIP-969, step 2).
 *
 * The effect that reads the open project's rows from IndexedDB was keyed on the
 * `currentProject` OBJECT. A switch sets that object several times (the click,
 * the tag reload, the "complete the record" effect), each one read all the rows
 * again, and when no refresh had been announced a 1 s timer held the read back.
 *
 * What must hold now:
 *   - a change of the project ID reads the rows at once, once;
 *   - a new object for the SAME project (a tag reload, a record completed from
 *     the list) reads nothing;
 *   - the announcement that the OPEN project's rows were refreshed reads again;
 *     the announcement for ANY OTHER project reads nothing;
 *   - rows of another team are not shown in a project of the user's own team,
 *     but a shared project (all rows belong to the host team) is never emptied,
 *     including when it was opened by a path that does not know it is shared;
 *   - two components that react to the project (as the sidebar and the Tasks
 *     page do) cause one read per switch and a bounded number of renders;
 *   - the cross-project milestone click (switch + open the milestone in one
 *     gesture) stays on the project it switched to, with the real URL routing.
 */
import { createElement, useEffect, type ReactNode } from "react";
import { act, render, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskRouting } from "../../features/tasks/hooks/useTaskRouting";
import { loadProjectTasks } from "../../features/tasks/services/loadProjectTasks";
import { popSpecificProjectTasks } from "../../features/tasks/services/popSpecificProjectTasks";
import { useProjectTaskManagement } from "../../hooks/common/useProjectTaskManagement";
import { ProjectProps, TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/popSpecificProjectTasks", () => ({
    popSpecificProjectTasks: vi.fn(async () => []),
}));
vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => []),
}));
vi.mock("../../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: vi.fn(async () => undefined),
}));
vi.mock("../../features/tasks/services/loadProjectTasks", () => ({
    loadProjectTasks: vi.fn(async () => []),
}));
vi.mock("../../features/notes/task-notes/services/loadTaskMeta", () => ({
    loadTaskMeta: vi.fn(async () => []),
}));
vi.mock("../../hooks/tasks/useSprintMilestoneManagement", () => {
    const stub = {
        loadConfigForProject: vi.fn(async () => undefined),
        loadSprintsForProject: vi.fn(async () => undefined),
        loadMilestonesForProject: vi.fn(async () => undefined),
        refreshMilestone: vi.fn(async () => undefined),
        initializeSprintMilestoneStates: vi.fn(),
    };
    return { useSprintMilestoneManagement: () => stub };
});

const read = vi.mocked(popSpecificProjectTasks);
const A = 10;
const B = 20;

// No userId: the project hook's own "load on mount" effect stays out of the way.
const myself = { userId: "", teamId: "t1", userName: "Me", userEmail: "m@x.io" };

const project = (projectId: number, over: Partial<ProjectProps> = {}): ProjectProps => ({
    projectId,
    projectName: `P${projectId}`,
    projectTags: [],
    isJoined: true,
    ...over,
});

const row = (id: number, projectId: number, teamId: string | null = "t1"): TaskTableProps =>
    ({
        id: String(id),
        title: `T${id}`,
        updatedAt: "2026-11-01 10:00:00",
        status: "Open",
        projectId,
        teamId,
        tags: [],
    }) as unknown as TaskTableProps;

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });

// The router hook ignores state changes for 100 ms after it set the project
// from the URL (`isNavigatingFromUrl`); a test that acts as the user has to wait that out.
const waitOutUrlSync = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
    });

const wrapper =
    (path = "/workspace/tasks") =>
    ({ children }: { children: ReactNode }) =>
        createElement(MemoryRouter, { initialEntries: [path] }, children);

const setup = () =>
    renderHook(
        () =>
            useProjectTaskManagement({
                myself: myself as never,
                accessToken: "token",
                currentTeamId: "",
            }),
        { wrapper: wrapper() }
    );

beforeEach(() => {
    vi.clearAllMocks();
    read.mockImplementation((async () => []) as never);
    localStorage.clear();
});

describe("useProjectTaskManagement — reading the open project's rows", () => {
    it("a project change reads the rows at once (no 1 s wait), and remembers the project", async () => {
        const view = setup();
        expect(read).not.toHaveBeenCalled();

        act(() => view.result.current.usePM.setCurrentProject(project(A)));
        await flush();

        expect(read).toHaveBeenCalledTimes(1);
        expect(read.mock.calls[0][0]).toBe(A);
        expect(localStorage.getItem("lastProjectId")).toBe(String(A));
    });

    it("a new object for the same project (tag reload, completed record) reads nothing", async () => {
        const view = setup();
        act(() => view.result.current.usePM.setCurrentProject(project(A)));
        await flush();
        read.mockClear();

        act(() =>
            view.result.current.usePM.setCurrentProject(
                project(A, { projectTags: [{ tagName: "x" } as never] })
            )
        );
        act(() => view.result.current.usePM.setCurrentProject(project(A, { isPrivate: true })));
        await flush();

        expect(read).not.toHaveBeenCalled();
    });

    it("switching to another project reads that project once", async () => {
        const view = setup();
        act(() => view.result.current.usePM.setCurrentProject(project(A)));
        await flush();
        read.mockClear();

        act(() => view.result.current.usePM.setCurrentProject(project(B)));
        await flush();

        expect(read).toHaveBeenCalledTimes(1);
        expect(read.mock.calls[0][0]).toBe(B);
    });

    it("the refresh of the open project reads its rows again; the refresh of another project reads nothing", async () => {
        const view = setup();
        act(() => view.result.current.usePM.setCurrentProject(project(A)));
        await flush();
        read.mockClear();

        await act(async () => {
            await view.result.current.usePM.refreshProjectTasks(A);
        });
        await flush();
        expect(read).toHaveBeenCalledTimes(1);
        expect(read.mock.calls[0][0]).toBe(A);
        read.mockClear();

        // A background refresh of a project the user is not in (the agent's bulk
        // write, a cross-project move) wrote IndexedDB, but is none of this table's business.
        await act(async () => {
            await view.result.current.usePM.refreshProjectTasks(B);
        });
        await flush();
        expect(read).not.toHaveBeenCalled();
    });
});

describe("useProjectTaskManagement — rows of other teams", () => {
    const rows = [row(1, A, "t1"), row(2, A, "t9"), row(3, A, null)];

    const open = async (listed: ProjectProps | null, opened: ProjectProps) => {
        read.mockImplementation((async () => rows) as never);
        const view = setup();
        if (listed) act(() => view.result.current.usePM.setTeamProjects([listed]));
        act(() => view.result.current.usePM.setCurrentProject(opened));
        await flush();
        return view;
    };

    it("a project of the user's own team shows only its own team's rows (and rows with no team)", async () => {
        const view = await open(project(A), project(A));

        expect(view.result.current.useTM.allTasks.map((t) => t.id)).toEqual(["1", "3"]);
    });

    it("a shared project (every row belongs to the host team) keeps all its rows", async () => {
        const shared = project(A, { isExternal: true, hostTeamId: "t9", hostTeamName: "Host" });
        const view = await open(shared, shared);

        expect(view.result.current.useTM.allTasks.map((t) => t.id)).toEqual(["1", "2", "3"]);
    });

    it("a shared project opened by a path that does not carry isExternal (chat, boot) is not emptied", async () => {
        const listed = project(A, { isExternal: true, hostTeamId: "t9", hostTeamName: "Host" });
        // `setCurrentProject({ projectId, projectName, projectTags, isPrivate, ... })`
        // as the chat bubbles and the boot path build it. (`isPrivate` is set: a
        // project without it is completed from the list by an effect of
        // useProjectManagement, which would hide the case.)
        const view = await open(listed, project(A, { isPrivate: false }));

        expect(view.result.current.useTM.allTasks.map((t) => t.id)).toEqual(["1", "2", "3"]);
    });

    it("a project that is not in the list at all is not filtered either", async () => {
        const view = await open(null, project(A));

        expect(view.result.current.useTM.allTasks.map((t) => t.id)).toEqual(["1", "2", "3"]);
    });
});

describe("useProjectTaskManagement — two components reacting to the project", () => {
    it("reads once per switch and settles in a bounded number of renders", async () => {
        read.mockImplementation((async (projectId: number) => [
            row(1, projectId),
            row(2, projectId),
        ]) as never);

        let renders = 0;
        type Hook = ReturnType<typeof useProjectTaskManagement>;
        // The sidebar's tag reload and the Tasks page's mount read, both of which
        // run in a Home that stays mounted whether or not it is the visible one.
        const Probe = ({ name, h, mountRead }: { name: string; h: Hook; mountRead: boolean }) => {
            renders += 1;
            // Fail fast instead of hanging if the two keep re-triggering each other.
            if (renders > 120) throw new Error(`reacting to the project in a loop (${name})`);
            const current = h.usePM.currentProject;
            const id = current?.projectId;
            useEffect(() => {
                if (!current) return;
                if (mountRead) void h.useTM.fetchProjectTasks(current.projectId);
                void Promise.resolve().then(() =>
                    h.usePM.setCurrentProject({
                        ...current,
                        projectTags: [{ tagName: "x", tagColor: "#000" } as never],
                    })
                );
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [id]);
            return <span data-testid={name}>{h.useTM.allTasks.length}</span>;
        };
        const Host = () => {
            const h = useProjectTaskManagement({
                myself: myself as never,
                accessToken: "token",
                currentTeamId: "",
            });
            return (
                <>
                    <Probe h={h} mountRead={false} name="sidebar" />
                    <Probe h={h} name="page" mountRead />
                    <button
                        data-testid="open-a"
                        onClick={() => h.usePM.setCurrentProject(project(A))}
                    />
                    <button
                        data-testid="open-b"
                        onClick={() => h.usePM.setCurrentProject(project(B))}
                    />
                </>
            );
        };

        const view = render(<Host />, { wrapper: wrapper() });
        await flush();
        read.mockClear();
        const before = renders;

        await act(async () => view.getByTestId("open-a").click());
        await flush();
        await flush();

        // The project effect reads once, and the page's own mount read is a
        // second request for the same project: two reads, of which only the
        // newest lands. The tag reloads (new object, same id) read nothing.
        expect(read.mock.calls.map((c) => c[0])).toEqual([A, A]);
        expect(view.getByTestId("sidebar").textContent).toBe("2");
        expect(view.getByTestId("page").textContent).toBe("2");
        expect(renders - before).toBeLessThan(40);

        read.mockClear();
        const mid = renders;
        await act(async () => view.getByTestId("open-b").click());
        await flush();
        await flush();
        expect(read.mock.calls.map((c) => c[0])).toEqual([B, B]);
        expect(renders - mid).toBeLessThan(40);
    });
});

describe("cross-project milestone click, with the real URL routing", () => {
    type Hook = ReturnType<typeof useProjectTaskManagement>;

    it("opening a milestone of another project in one gesture stays on that project", async () => {
        let latest!: Hook;
        let path = "";
        const Probe = () => {
            const h = useProjectTaskManagement({
                myself: myself as never,
                accessToken: "token",
                currentTeamId: "",
            });
            latest = h;
            useTaskRouting({ usePM: h.usePM, useTM: h.useTM, isActiveRoute: true });
            path = useLocation().pathname;
            return null;
        };
        render(<Probe />, { wrapper: wrapper(`/workspace/tasks/project/${A}`) });
        await flush();

        // The user is in A with one of its milestones open.
        act(() => latest.usePM.setTeamProjects([project(A), project(B)]));
        await flush();
        await waitOutUrlSync();
        expect(latest.usePM.currentProject?.projectId).toBe(A);
        act(() => {
            latest.useTM.setCurrentPreviewMilestoneId(100);
            latest.useTM.setIsTaskPreviewVisible(true);
        });
        await flush();
        expect(path).toBe(`/workspace/tasks/project/${A}/milestone/100`);

        // What the sidebar's milestone click does for a milestone of B.
        act(() => {
            latest.useTM.closeTaskPreview();
            latest.useTM.setTableMilestoneFilter(null);
            latest.useTM.setAllTasks([]);
            latest.usePM.openProject(project(B));
            latest.useTM.setCurrentPreviewKind("milestone");
            latest.useTM.setCurrentPreviewMilestoneId(200);
            latest.useTM.setIsTaskPreviewVisible(true);
            latest.useTM.setTableMilestoneFilter({ milestoneId: 200, projectId: B });
        });
        await flush();
        await flush();

        expect(latest.usePM.currentProject?.projectId).toBe(B);
        expect(path).toBe(`/workspace/tasks/project/${B}/milestone/200`);
        expect(latest.useTM.tableMilestoneFilterId).toBe(200);
        expect(loadProjectTasks).toHaveBeenCalledWith(expect.anything(), B, "token");
    });

    it("clicking a project in the sidebar with a task open lands on that project's page", async () => {
        let latest!: Hook;
        let path = "";
        const Probe = () => {
            const h = useProjectTaskManagement({
                myself: myself as never,
                accessToken: "token",
                currentTeamId: "",
            });
            latest = h;
            useTaskRouting({ usePM: h.usePM, useTM: h.useTM, isActiveRoute: true });
            path = useLocation().pathname;
            return null;
        };
        render(<Probe />, { wrapper: wrapper(`/workspace/tasks/project/${A}`) });
        await flush();
        act(() => latest.usePM.setTeamProjects([project(A), project(B)]));
        await flush();
        await waitOutUrlSync();
        act(() => {
            latest.useTM.setCurrentPreviewTaskId(5);
            latest.useTM.setIsTaskPreviewVisible(true);
        });
        await flush();

        act(() => {
            latest.useTM.closeTaskPreview();
            latest.useTM.setTableMilestoneFilter(null);
            latest.useTM.setIsTaskDashboardVisible(false);
            latest.useTM.setIsTaskTableVisible(true);
            latest.useTM.setAllTasks([]);
            latest.usePM.openProject(project(B));
        });
        await flush();
        await flush();

        expect(latest.usePM.currentProject?.projectId).toBe(B);
        expect(path).toBe(`/workspace/tasks/project/${B}`);
    });
});
