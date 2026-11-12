/**
 * MIP-1416: the diagram reads the browser's synced copy of the project, not a
 * full download of it on every open.
 *
 * Opening a 288-task milestone's diagram in a 1,302-task project took ~7 s the
 * first time (Ken, 2026-11-12): `loadTaskGraph` asked the server for the whole
 * project on every open and every refresh, and that answer is only cached on
 * the server until the next task write in the project. It now brings the
 * browser's copy up to date first (a changes-since request, the task table's
 * own path) and reads it, and asks for the whole project only when that path
 * fails or finds nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskTableProps } from "../types/tasks";

const loadProjectTasks = vi.fn();
const popSpecificProjectTasks = vi.fn();
const loadProjectTasksFromApi = vi.fn();
const loadTaskDependenciesBatched = vi.fn();

vi.mock("../features/tasks/services/loadProjectTasks", () => ({
    loadProjectTasks: (...args: unknown[]) => loadProjectTasks(...args),
}));
vi.mock("../features/tasks/services/popSpecificProjectTasks", () => ({
    popSpecificProjectTasks: (...args: unknown[]) => popSpecificProjectTasks(...args),
}));
vi.mock("../features/tasks/services/loadProjectTasksFromApi", () => ({
    loadProjectTasksFromApi: (...args: unknown[]) => loadProjectTasksFromApi(...args),
}));
vi.mock("../features/tasks/services/loadTaskDependencies", () => ({
    loadTaskDependenciesBatched: (...args: unknown[]) => loadTaskDependenciesBatched(...args),
}));

const { loadTaskGraph } = await import("../features/tasks/diagram/services/loadTaskGraph");
const { taskTypes } = await import("../features/tasks/types/TaskTableTypes");

const task = (id: number, parentTaskId: number | null, status = "Open"): TaskTableProps =>
    ({
        id: String(id),
        title: `t${id}`,
        status,
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        projectId: 1,
        isMilestone: parentTaskId == null,
    }) as TaskTableProps;

const ROWS = [task(1, null), task(2, 1), task(3, 2, "Deleted")];
const myself = { userId: 1, teamId: 1 } as never;

describe("loadTaskGraph reads the synced project copy (MIP-1416)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadProjectTasks.mockResolvedValue([]);
        popSpecificProjectTasks.mockResolvedValue(ROWS);
        loadProjectTasksFromApi.mockResolvedValue({ tasks: ROWS });
        loadTaskDependenciesBatched.mockResolvedValue({ byTask: {}, failedIds: [] });
    });

    it("on a warm copy, never downloads the whole project", async () => {
        const graph = await loadTaskGraph(myself, 1, 1, "tok");

        expect(loadProjectTasks).toHaveBeenCalledWith(myself, 1, "tok");
        expect(loadProjectTasksFromApi).not.toHaveBeenCalled();
        expect(graph?.tasks.map((t) => t.id).sort()).toEqual(["1", "2", "3"]);
    });

    it("reads every status, Deleted included, as the full download did", async () => {
        await loadTaskGraph(myself, 1, 1, "tok");
        expect(popSpecificProjectTasks).toHaveBeenCalledWith(1, taskTypes.all.statuses);
        expect(taskTypes.all.statuses).toContain("Deleted");
    });

    it("syncs BEFORE it reads, on every load, so a refresh after an edit sees the edit", async () => {
        let release: () => void = () => {};
        loadProjectTasks.mockReturnValueOnce(new Promise<void>((r) => (release = r)));
        const pending = loadTaskGraph(myself, 1, 1, "tok");
        await Promise.resolve();
        expect(popSpecificProjectTasks).not.toHaveBeenCalled();
        release();
        await pending;
        expect(popSpecificProjectTasks).toHaveBeenCalledTimes(1);

        // The canvas's task-touched refresh is another `loadTaskGraph` call: it syncs again.
        await loadTaskGraph(myself, 1, 1, "tok");
        expect(loadProjectTasks).toHaveBeenCalledTimes(2);
        expect(loadProjectTasksFromApi).not.toHaveBeenCalled();
    });

    it("falls back to the full download when the sync fails", async () => {
        loadProjectTasks.mockRejectedValueOnce(new Error("Worker is not defined"));
        const graph = await loadTaskGraph(myself, 1, 1, "tok");

        expect(loadProjectTasksFromApi).toHaveBeenCalledWith(myself, 1, "tok", null);
        expect(graph?.tasks).toHaveLength(3);
    });

    it("falls back to the full download when the copy is empty", async () => {
        popSpecificProjectTasks.mockResolvedValueOnce([]);
        const graph = await loadTaskGraph(myself, 1, 1, "tok");

        expect(loadProjectTasksFromApi).toHaveBeenCalledTimes(1);
        expect(graph?.tasks).toHaveLength(3);
    });

    it("says the graph is incomplete when some dependency lines could not be loaded", async () => {
        expect((await loadTaskGraph(myself, 1, 1, "tok"))?.dependenciesIncomplete).toBe(false);

        loadTaskDependenciesBatched.mockResolvedValueOnce({ byTask: {}, failedIds: [2] });
        expect((await loadTaskGraph(myself, 1, 1, "tok"))?.dependenciesIncomplete).toBe(true);
    });
});
