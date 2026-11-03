/**
 * MIP-968: opening or switching a task loads it ONCE.
 *
 * Three effects in `useProjectTaskManagement` each called the task loader on
 * every click:
 *   1. "load updated task" (its real job: surface a task that was just created),
 *   2. the freshness check (its real job: reload the OPEN task when its table
 *      row turns out to be newer),
 *   3. `loadTask` (the main load, and the only one that marks a failed load).
 * Effects 1 and 2 fired on a plain open as well, so every click made three
 * identical `getTask` calls. This runs the real hook with the loader mocked and
 * counts the calls.
 */
import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadSpecificTask } from "../../features/tasks/services/loadSpecificTask";
import { useProjectTaskManagement } from "../../hooks/common/useProjectTaskManagement";
import { TaskProps, TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(),
}));
vi.mock("../../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: vi.fn(async () => undefined),
}));
vi.mock("../../features/tasks/services/loadProjectTasks", () => ({
    loadProjectTasks: vi.fn(async () => undefined),
}));
// A project change now reads the project's rows at once (it used to wait 1 s);
// without this stub that read would reach for the IndexedDB worker. The store
// holds what the test puts in the table, so that read lands the same rows.
const idb = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock("../../features/tasks/services/popSpecificProjectTasks", () => ({
    popSpecificProjectTasks: vi.fn(async () => idb.rows),
}));
vi.mock("../../features/notes/task-notes/services/loadTaskMeta", () => ({
    loadTaskMeta: vi.fn(async () => []),
}));
// Sprint / milestone loading is a different concern with its own endpoints.
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

const T10 = "2026-11-01 10:00:00";
const T11 = "2026-11-01 11:00:00";
const T12 = "2026-11-01 12:00:00";

const row = (id: number, updatedAt: string): TaskTableProps =>
    ({
        id: String(id),
        displayId: `PRJ-${id}`,
        title: `Task ${id}`,
        priority: "High",
        effortLevel: "M",
        createdDate: "2026-11-01",
        updatedAt,
        dueDate: null,
        daysLeft: null,
        status: "Open",
        assigneeId: null,
        assigneeEmail: null,
        assigneeName: null,
        assigneeImgPath: null,
        parentTaskId: null,
        rootTaskId: id,
        threadId: null,
        tags: [],
        concatTags: "//",
        teamId: "t1",
        projectId: 10,
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
    }) as unknown as TaskTableProps;

const taskFor = (id: number, updatedAt: string): TaskProps =>
    ({
        id,
        displayId: `PRJ-${id}`,
        title: `Task ${id}`,
        priority: { priority: "High" },
        effortLevel: { level: "M" },
        status: { status: "Open" },
        createdDate: "2026-11-01",
        updatedAt,
        dueDate: null,
        daysLeft: null,
        tags: [],
        concatTags: "//",
        assignee: null,
        parentTaskId: null,
        rootTaskId: id,
        threadId: null,
        project: { projectId: 10 },
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
    }) as unknown as TaskProps;

// What the server holds per task; the loader answers from here.
let server: Record<number, string>;
const loader = vi.mocked(loadSpecificTask);

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, null, children);

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });

/** The hook with project 10 selected and the given rows in the table. */
const setup = async (rows: TaskTableProps[]) => {
    idb.rows = rows;
    const view = renderHook(
        () =>
            useProjectTaskManagement({
                myself: { userId: "u1", teamId: "t1", userName: "Me", userEmail: "m@x.io" },
                accessToken: "token",
                currentTeamId: "",
            }),
        { wrapper }
    );
    act(() =>
        view.result.current.usePM.setCurrentProject({
            projectId: 10,
            projectName: "P",
            projectTags: [],
        } as never)
    );
    act(() => view.result.current.useTM.setAllTasks(rows));
    await flush();
    loader.mockClear();
    return view;
};

const open = async (view: Awaited<ReturnType<typeof setup>>, id: number) => {
    act(() => view.result.current.useTM.setCurrentPreviewTaskId(id));
    await flush();
};

beforeEach(() => {
    vi.clearAllMocks();
    server = { 5: T10, 6: T11 };
    loader.mockImplementation((async (_me: unknown, _p: number, taskId: number) => {
        const at = server[taskId];
        return at ? [taskFor(taskId, at)] : [];
    }) as never);
});

describe("useProjectTaskManagement — one load per open", () => {
    it("a first open (nothing previewed yet) loads the task exactly once", async () => {
        const view = await setup([row(5, T10), row(6, T11)]);

        await open(view, 5);

        expect(loader).toHaveBeenCalledTimes(1);
        expect(loader.mock.calls[0][2]).toBe(5);
        expect(view.result.current.useTM.currentPreviewTask?.id).toBe(5);
    });

    it("a switch loads the incoming task exactly once (the outgoing one is not reloaded)", async () => {
        const view = await setup([row(5, T10), row(6, T11)]);
        await open(view, 5);
        loader.mockClear();

        // Task 6's row is newer than the still-shown task 5. That used to fire
        // the freshness check against the OUTGOING task as well.
        await open(view, 6);

        expect(loader).toHaveBeenCalledTimes(1);
        expect(loader.mock.calls[0][2]).toBe(6);
        expect(view.result.current.useTM.currentPreviewTask?.id).toBe(6);
    });

    it("a switch to a task whose row is OLDER than the outgoing one loads once too", async () => {
        server = { 5: T12, 6: T10 };
        const view = await setup([row(5, T12), row(6, T10)]);
        await open(view, 5);
        loader.mockClear();

        await open(view, 6);

        expect(loader).toHaveBeenCalledTimes(1);
        expect(view.result.current.useTM.currentPreviewTask?.id).toBe(6);
    });

    it("a newer table row for the OPEN task still reloads it", async () => {
        const view = await setup([row(5, T10), row(6, T10)]);
        await open(view, 5);
        loader.mockClear();

        // A teammate (or a background job) changed task 5; the refreshed list
        // carries its new `updatedAt`.
        server[5] = T12;
        act(() => view.result.current.useTM.setAllTasks([row(5, T12), row(6, T10)]));
        await flush();

        expect(loader).toHaveBeenCalledTimes(1);
        expect(loader.mock.calls[0][2]).toBe(5);
        expect(view.result.current.useTM.currentPreviewTask?.updatedAt).toBe(T12);
    });

    it("a newer row for a task that is NOT open loads nothing", async () => {
        const view = await setup([row(5, T10), row(6, T10)]);
        await open(view, 5);
        loader.mockClear();

        act(() => view.result.current.useTM.setAllTasks([row(5, T10), row(6, T12)]));
        await flush();

        expect(loader).not.toHaveBeenCalled();
    });

    it("creating a task still upserts its row into the table", async () => {
        const view = await setup([row(5, T10)]);
        // The new task is the one in the preview; the table does not have it yet.
        server[99] = T12;
        await open(view, 99);
        expect(view.result.current.useTM.allTasks.map((t) => t.id)).toEqual(["5"]);

        act(() => view.result.current.useTM.setIsNewTaskCreated(true));
        await flush();

        const rows = view.result.current.useTM.allTasks;
        expect(rows.map((t) => t.id)).toEqual(["5", "99"]);
        expect(rows[1].updatedAt).toBe(T12);
        // The flag is consumed (nothing sticks and re-fires).
        expect(view.result.current.useTM.isNewTaskCreated).toBe(false);
    });

    it("creating a task upserts the row exactly once, not once per effect", async () => {
        const view = await setup([row(5, T10)]);
        await open(view, 5);
        loader.mockClear();

        server[5] = T10;
        act(() => view.result.current.useTM.setIsNewTaskCreated(true));
        await flush();

        // The flag effect is the one allowed load here; the id did not change.
        expect(loader).toHaveBeenCalledTimes(1);
        expect(view.result.current.useTM.isNewTaskCreated).toBe(false);
    });

    it("a failed load still marks the selected task as failed (MIP-962 releases on it)", async () => {
        const view = await setup([row(5, T10), row(7, T10)]);
        // Task 7 is not on the server: the loader answers [].
        await open(view, 7);

        expect(loader).toHaveBeenCalledTimes(1);
        expect(view.result.current.useTM.previewLoadFailedTaskId).toBe(7);
        expect(view.result.current.useTM.currentPreviewTask).toBeUndefined();
    });
});
