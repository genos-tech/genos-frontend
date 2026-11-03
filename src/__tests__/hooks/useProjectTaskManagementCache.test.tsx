/**
 * The remembered rows, with the workspace's real project + task hooks
 * (MIP-969, step 3).
 *
 * `useTaskManagementProjectCache.test.tsx` covers the swap itself. This file
 * covers what the workspace hands it:
 *   - every way of changing the open project (the sidebar's `openProject`, a
 *     plain `setCurrentProject` as Recents and chat do) swaps in the same commit;
 *   - a refresh that lands for a project the user is NOT in forgets that
 *     project's remembered rows, and one for the open project does not;
 *   - a project that leaves the team's list keeps nothing;
 *   - two components asking for the same switch in one tick cause one swap.
 *
 * The commit log is taken in a layout effect (see the other file for why).
 */
import { createElement, useLayoutEffect, type ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { popSpecificProjectTasks } from "../../features/tasks/services/popSpecificProjectTasks";
import { useProjectTaskManagement } from "../../hooks/common/useProjectTaskManagement";
import { ProjectProps, TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/popSpecificProjectTasks", () => ({
    popSpecificProjectTasks: vi.fn(),
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
const C = 30;

// No userId: the project hook's own "load on mount" effect stays out of the way.
const myself = { userId: "", teamId: "t1", userName: "Me", userEmail: "m@x.io" };

const project = (projectId: number): ProjectProps => ({
    projectId,
    projectName: `P${projectId}`,
    projectTags: [],
    isPrivate: false,
    isJoined: true,
});

const row = (id: number, projectId: number): TaskTableProps =>
    ({
        id: String(id),
        title: `T${id}`,
        updatedAt: "2026-11-01 10:00:00",
        status: "Open",
        projectId,
        teamId: "t1",
        tags: [],
    }) as unknown as TaskTableProps;

const store: Record<number, TaskTableProps[]> = {
    [A]: [row(1, A), row(2, A), row(3, A)],
    [B]: [row(5, B), row(6, B)],
    [C]: [row(8, C)],
};

type Hook = ReturnType<typeof useProjectTaskManagement>;
type Commit = { project: number | null; ids: string[]; rowProjects: number[] };
let commits: Commit[];
let live: Hook;

const Host = ({ extra }: { extra?: (h: Hook) => ReactNode }) => {
    const h = useProjectTaskManagement({
        myself: myself as never,
        accessToken: "token",
        currentTeamId: "",
    });
    live = h;
    useLayoutEffect(() => {
        commits.push({
            project: h.usePM.currentProject?.projectId ?? null,
            ids: h.useTM.allTasks.map((r) => String(r.id)),
            rowProjects: [...new Set(h.useTM.allTasks.map((r) => Number(r.projectId)))],
        });
    });
    return <>{extra?.(h)}</>;
};

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: ["/workspace/tasks"] }, children);

const mount = async () => {
    const view = render(<Host />, { wrapper });
    act(() => live.usePM.setTeamProjects([project(A), project(B), project(C)]));
    await flush();
    return view;
};

/** Open a project the way the sidebar does, and let its read land. */
const click = async (projectId: number) => {
    act(() => live.usePM.openProject(project(projectId)));
    await flush();
    await flush();
};

const during = async (fn: () => void | Promise<void>) => {
    const from = commits.length;
    await fn();
    return commits.slice(from);
};
const noForeignRows = (list: Commit[]) =>
    list.every((c) => c.rowProjects.every((p) => p === c.project));

beforeEach(() => {
    vi.clearAllMocks();
    commits = [];
    read.mockImplementation((async (projectId: number) => store[projectId] ?? []) as never);
});

describe("remembered rows in the workspace", () => {
    it("a click on a project already seen paints its rows in the click's own commit", async () => {
        await mount();
        await click(A);
        await click(B);

        const back = await during(async () => {
            act(() => live.usePM.openProject(project(A)));
        });

        expect(back[0].project).toBe(A);
        expect(back[0].ids).toEqual(["1", "2", "3"]);
        expect(noForeignRows(commits)).toBe(true);
    });

    it("a plain setCurrentProject (Recents, chat) swaps the rows as well", async () => {
        await mount();
        await click(A);
        await click(B);

        const back = await during(async () => {
            act(() => live.usePM.setCurrentProject(project(A)));
        });

        expect(back[0].ids).toEqual(["1", "2", "3"]);
        expect(noForeignRows(commits)).toBe(true);
    });

    it("a refresh that lands for a project the user has left forgets that project's rows", async () => {
        await mount();
        await click(A);
        await click(B);

        // The agent's bulk write (or a cross-project move) refreshed A while the user is in B.
        await act(async () => {
            await live.usePM.refreshProjectTasks(A);
        });
        await flush();

        const back = await during(async () => {
            act(() => live.usePM.setCurrentProject(project(A)));
        });
        expect(back[0].ids).toEqual([]);
    });

    it("a refresh of the open project does not forget what is remembered for the others", async () => {
        await mount();
        await click(A);
        await click(B);

        await act(async () => {
            await live.usePM.refreshProjectTasks(B);
        });
        await flush();

        const back = await during(async () => {
            act(() => live.usePM.setCurrentProject(project(A)));
        });
        expect(back[0].ids).toEqual(["1", "2", "3"]);
    });

    it("a project that leaves the team's list (deleted, or left) keeps no rows", async () => {
        await mount();
        await click(A);
        await click(B);
        await click(C);

        act(() => live.usePM.setTeamProjects([project(B), project(C)]));
        await flush();

        const toA = await during(async () => {
            act(() => live.usePM.setCurrentProject(project(A)));
        });
        expect(toA[0].ids).toEqual([]);
        const toB = await during(async () => {
            act(() => live.usePM.setCurrentProject(project(B)));
        });
        expect(toB[0].ids).toEqual(["5", "6"]);
    });

    it("deleting the open project (project to none, list shrinks) and recreating nothing leaves no rows behind", async () => {
        await mount();
        await click(A);
        await click(B);

        act(() => {
            live.usePM.setCurrentProject(null);
            live.usePM.setTeamProjects([project(A), project(C)]);
        });
        await flush();

        expect(live.useTM.allTasks).toEqual([]);
        // B's rows were dropped with the project; A's are still remembered.
        const toB = await during(async () => {
            act(() => live.usePM.setCurrentProject(project(B)));
        });
        expect(toB[0].ids).toEqual([]);
    });

    it("two components opening the same project in one tick swap once and settle", async () => {
        let renders = 0;
        const Opener = ({ name }: { name: string; h: Hook }) => {
            renders += 1;
            // Fail fast instead of hanging if the two keep re-triggering each other.
            if (renders > 200) throw new Error(`opening in a loop (${name})`);
            return null;
        };
        const view = render(
            <Host
                extra={(h) => (
                    <>
                        <Opener h={h} name="sidebar" />
                        <Opener h={h} name="dashboard" />
                    </>
                )}
            />,
            { wrapper }
        );
        act(() => live.usePM.setTeamProjects([project(A), project(B), project(C)]));
        await flush();
        await click(A);
        await click(B);

        const before = renders;
        const log = await during(async () => {
            act(() => {
                // The sidebar row and the dashboard picker, in the same tick.
                live.usePM.openProject(project(A));
                live.usePM.openProject(project(A));
            });
            await flush();
            await flush();
        });

        expect(live.usePM.currentProject?.projectId).toBe(A);
        expect(live.useTM.allTasks.map((r) => r.id)).toEqual(["1", "2", "3"]);
        expect(noForeignRows(commits)).toBe(true);
        // The first commit already held A's rows, and none was empty.
        expect(log[0].ids).toEqual(["1", "2", "3"]);
        expect(log.every((c) => c.ids.length === 3)).toBe(true);
        expect(log.length).toBeLessThan(10);
        expect(renders - before).toBeLessThan(60);
        view.unmount();
    });
});
