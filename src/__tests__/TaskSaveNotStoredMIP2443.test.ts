/**
 * MIP-2443: `sendUpdatedSpecificTask` swallows every failure but a 400, so its caller counted a
 * save that stored nothing as saved. It now says so, and whether sending it again can help.
 */
import { AxiosError } from "axios";
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

const task = {
    id: 7,
    title: "T",
    status: { status: "Open" },
    priority: {},
    effortLevel: {},
    project: { projectId: 1, projectName: "P" },
    assignee: { userId: "u1" },
    reporter: { userId: "u1" },
    tags: [],
    attachments: [],
    links: [],
    body: [],
} as unknown as TaskProps;

const httpError = (status?: number) => {
    const error = new AxiosError("failed");
    if (status) error.response = { status, data: {} } as never;
    return error;
};

const save = async () => {
    const onNotSaved = vi.fn();
    await sendUpdatedSpecificTask(
        null,
        { teamId: "t1", userId: "u1" } as unknown as UserProps,
        task,
        false,
        "tok",
        undefined,
        { onNotSaved }
    );
    return onNotSaved;
};

describe("a task save that stored nothing", () => {
    beforeEach(() => {
        put.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it.each([
        ["no answer", undefined, true],
        ["a server error", 503, true],
        ["an expired token", 401, true],
        ["a refusal", 403, false],
    ])("reports %s", async (_name, status, retry) => {
        put.mockRejectedValue(httpError(status));
        expect(await save()).toHaveBeenCalledWith(retry, expect.anything());
    });

    it("says nothing when the PUT stored the task", async () => {
        put.mockResolvedValue({ data: { task: {} } });
        expect(await save()).not.toHaveBeenCalled();
    });
});
