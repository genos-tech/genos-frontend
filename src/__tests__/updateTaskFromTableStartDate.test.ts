/**
 * A table / board inline edit never changes the start date, so its PUT
 * must not carry one (MIP-912).
 *
 * `updateTaskFromTable` builds its payload from `loadSpecificTask`, which
 * answers from the IndexedDB full-task cache with no freshness check. That
 * snapshot can lag the server (a teammate, the diagram or the agent set a
 * start date after it was cached) and older entries may not have the key
 * at all. If the save re-sent whatever the snapshot holds, a cached `null`
 * would clear a real date, and a stale date would overwrite a newer one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateTaskFromTable } from "../features/tasks/services/updateTaskFromTable";
import { UserProps } from "../types/admin";
import { TaskProps, TaskTableProps } from "../types/tasks";

const put = vi.fn();
const cacheFullTask = vi.fn().mockResolvedValue(undefined);
const loadSpecificTask = vi.fn();
vi.mock("../services/api", () => ({ authApi: () => ({ put }) }));
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: (...args: unknown[]) => loadSpecificTask(...args),
}));
vi.mock("../db/services/task-full.service", () => ({
    cacheFullTask: (...args: unknown[]) => cacheFullTask(...args),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/tasks/services/uploadTaskAttachments", () => ({
    uploadTaskAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../features/tasks/services/taskEvents", () => ({
    emitTasksBulkChanged: vi.fn(),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const user = { userId: "u1", userName: "u1" } as unknown as UserProps;

const cachedTask = (extra: Partial<TaskProps> = {}): TaskProps =>
    ({
        id: 42,
        displayId: "KDS-42",
        title: "A task",
        body: [],
        project: { projectId: 1, projectName: "Kds", systemUserId: "sys" },
        assignee: user,
        reporter: user,
        priority: { priority: "Medium" },
        effortLevel: { level: "Medium" },
        status: { status: "Open" },
        dueDate: "",
        links: [],
        tags: [],
        attachments: [],
        parentTaskId: null,
        threadId: null,
        ...extra,
    }) as unknown as TaskProps;

const row = {
    id: "42",
    projectId: 1,
    title: "A task",
    status: "WIP",
    priority: "Medium",
    effortLevel: "Medium",
    dueDate: null,
    parentTaskId: null,
    milestoneId: null,
    tags: [],
} as unknown as TaskTableProps;

const putBody = async (cached: TaskProps) => {
    loadSpecificTask.mockResolvedValue([cached]);
    await updateTaskFromTable(row, myself, null, "tok", [user]);
    expect(put).toHaveBeenCalledTimes(1);
    return put.mock.calls[0][1] as Record<string, unknown>;
};

describe("updateTaskFromTable start_date", () => {
    beforeEach(() => {
        put.mockReset();
        put.mockResolvedValue({ data: { task: { ts_updated_at: "now" } } });
        cacheFullTask.mockClear();
        loadSpecificTask.mockReset();
    });

    it("sends the inline edit but no start_date when the cached task has a null one", async () => {
        const body = await putBody(cachedTask({ startDate: null }));
        expect(body.status).toBe("WIP");
        expect("start_date" in body).toBe(false);
    });

    it("sends no start_date when the cached task has a date either", async () => {
        const body = await putBody(cachedTask({ startDate: "2026-11-02" }));
        expect("start_date" in body).toBe(false);
    });

    it("sends no start_date when the cached task predates the field", async () => {
        const body = await putBody(cachedTask());
        expect("start_date" in body).toBe(false);
    });

    it("still mirrors the cached start date into the full-task cache", async () => {
        await putBody(cachedTask({ startDate: "2026-11-02" }));
        expect(cacheFullTask).toHaveBeenCalledTimes(1);
        expect(cacheFullTask.mock.calls[0][0].startDate).toBe("2026-11-02");
    });
});
