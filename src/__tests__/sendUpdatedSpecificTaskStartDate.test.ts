/**
 * The task save sends `start_date` only when the working copy has a
 * value for it (MIP-912).
 *
 * The PUT is a full save, and the server reads a `start_date: null` as
 * "clear the start date". So the key has to mean exactly one thing:
 *   - `undefined`  -> the object does not carry the field (a stale cache
 *                     entry, a partial task): leave the stored date alone,
 *                     send NO `start_date` key;
 *   - `null`       -> the user pressed Clear: send `start_date: null`;
 *   - a string     -> the date.
 * Before this, `?? null` collapsed the first two into one, which was
 * harmless only while the server dropped every null.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendUpdatedSpecificTask } from "../features/tasks/services/sendUpdatedSpecificTask";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

const put = vi.fn();
vi.mock("../services/api", () => ({ authApi: () => ({ put }) }));
vi.mock("../db/services/task-full.service", () => ({
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
    emitTasksBulkChanged: vi.fn(),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const user = (userId: string) => ({ userId, userName: userId }) as unknown as UserProps;

const makeTask = (extra: Partial<TaskProps> = {}): TaskProps =>
    ({
        id: 42,
        displayId: "KDS-42",
        title: "A task",
        body: [],
        project: { projectId: 1, projectName: "Kds", systemUserId: "sys" },
        assignee: user("u1"),
        reporter: user("u1"),
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

// Runs a save and returns the body of the PUT it made.
const savedBody = async (task: TaskProps): Promise<Record<string, unknown>> => {
    await sendUpdatedSpecificTask(null, myself, task, false, "tok");
    expect(put).toHaveBeenCalledTimes(1);
    const [url, body] = put.mock.calls[0];
    expect(url).toBe("/task/");
    return body as Record<string, unknown>;
};

describe("sendUpdatedSpecificTask start_date", () => {
    beforeEach(() => {
        put.mockReset();
        put.mockResolvedValue({ data: { task: { ts_updated_at: "now" } } });
    });

    it("leaves the key out when the task does not carry a start date", async () => {
        const task = makeTask();
        expect("startDate" in task).toBe(false);
        const body = await savedBody(task);
        expect("start_date" in body).toBe(false);
    });

    it("also leaves it out when startDate is explicitly undefined", async () => {
        const body = await savedBody(makeTask({ startDate: undefined }));
        expect("start_date" in body).toBe(false);
    });

    it("sends null when the start date was cleared", async () => {
        const body = await savedBody(makeTask({ startDate: null }));
        expect("start_date" in body).toBe(true);
        expect(body.start_date).toBeNull();
    });

    it("sends the date when there is one", async () => {
        const body = await savedBody(makeTask({ startDate: "2026-11-02" }));
        expect(body.start_date).toBe("2026-11-02");
    });

    it("keeps due_date semantics: an empty due date is still sent as null", async () => {
        const body = await savedBody(makeTask({ dueDate: "" }));
        expect("due_date" in body).toBe(true);
        expect(body.due_date).toBeNull();
    });

    it("does not send start_date when the caller says this save does not edit it", async () => {
        await sendUpdatedSpecificTask(
            null,
            myself,
            makeTask({ startDate: "2026-11-02" }),
            false,
            "tok",
            undefined,
            { sendStartDate: false }
        );
        const [, body] = put.mock.calls[0];
        expect("start_date" in body).toBe(false);
    });
});
