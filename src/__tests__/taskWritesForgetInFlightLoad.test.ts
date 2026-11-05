/**
 * MIP-968: a save must never hand back a pre-save task.
 *
 * `loadSpecificTask` lets concurrent callers share the load that is running.
 * If a `getTask` started before a save is still running when the save writes
 * the task's IndexedDB entry, anyone who asks for the task AFTER the save has
 * to start a new load, not join the old one. These run the real loader and the
 * real write paths, and check that the next caller gets its own request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteTaskAttachment } from "../features/tasks/services/deleteTaskAttachment";
import { loadSpecificTask } from "../features/tasks/services/loadSpecificTask";
import { sendUpdatedSpecificTask } from "../features/tasks/services/sendUpdatedSpecificTask";
import { forgetInFlightTask } from "../features/tasks/services/taskLoadInFlight";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
vi.mock("../services/api", () => ({
    authApi: () => ({ get: apiGet, put: apiPut, delete: apiDelete }),
}));
vi.mock("../db/services/task-full.service", () => ({
    getCachedFullTask: vi.fn().mockResolvedValue(null),
    cacheFullTask: vi.fn().mockResolvedValue(undefined),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/tasks/services/uploadTaskAttachments", () => ({
    uploadTaskAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../features/tasks/services/taskEvents", () => ({
    emitTaskMetadataSaved: vi.fn(),
    emitTasksBulkChanged: vi.fn(),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const me = { userId: "u1", teamId: "t1" } as unknown as UserProps;
const PRE_SAVE = [{ id: 2962, title: "before", updatedAt: "2026-11-02 16:13:23" }];
const POST_SAVE = [{ id: 2962, title: "after", updatedAt: "2026-11-02 16:27:23" }];

const task = {
    id: 2962,
    displayId: "PRB-38",
    title: "after",
    body: [],
    project: { projectId: 295, projectName: "P", systemUserId: "sys" },
    assignee: null,
    reporter: { userId: "u1", userName: "u1" },
    priority: { priority: "High" },
    effortLevel: { level: "" },
    status: { status: "Open" },
    dueDate: "",
    links: [],
    tags: [],
    attachments: [],
    parentTaskId: null,
    threadId: null,
    updatedAt: "2026-11-02 16:13:23",
} as unknown as TaskProps;

/** Start a `getTask` that stays in flight until the returned function runs. */
const startPreSaveLoad = () => {
    let release!: () => void;
    apiGet.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                release = () => resolve({ data: PRE_SAVE });
            })
    );
    const load = loadSpecificTask(me, 295, 2962, "tok");
    return { load, release: () => release() };
};

beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({ data: POST_SAVE });
    apiPut.mockResolvedValue({
        data: { task: { ts_updated_at: "2026-11-02T16:27:23.079829Z" }, movedFromProjectId: null },
    });
    apiDelete.mockResolvedValue({ status: 204 });
});

// A failing test must not leave its pending load behind for the next one.
afterEach(() => forgetInFlightTask(2962));

const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("writes that touch a task's cache stop the running load from being shared", () => {
    it("a save: the caller after it gets a fresh request, the one before keeps its own", async () => {
        const pre = startPreSaveLoad();
        await settle();

        await sendUpdatedSpecificTask(null, me, task, false, "tok");
        const afterLoad = loadSpecificTask(me, 295, 2962, "tok");
        await settle();
        // Its own request went out while the pre-save one is still pending.
        expect(apiGet).toHaveBeenCalledTimes(2);
        const after = await afterLoad;

        expect(after[0].title).toBe("after");

        pre.release();
        expect((await pre.load)[0].title).toBe("before");
    });

    it("an attachment delete: the caller after it gets a fresh request", async () => {
        const pre = startPreSaveLoad();
        await settle();

        await deleteTaskAttachment(2962, 5, "tok");
        const afterLoad = loadSpecificTask(me, 295, 2962, "tok");
        await settle();
        expect(apiGet).toHaveBeenCalledTimes(2);
        const after = await afterLoad;

        expect(after[0].title).toBe("after");

        pre.release();
        await pre.load;
    });
});
