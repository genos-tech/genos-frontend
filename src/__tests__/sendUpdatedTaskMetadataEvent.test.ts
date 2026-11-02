import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendUpdatedSpecificTask } from "../features/tasks/services/sendUpdatedSpecificTask";
import { onTaskMetadataSaved } from "../features/tasks/services/taskEvents";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

const put = vi.fn();
vi.mock("../services/api", () => ({ authApi: () => ({ put }) }));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("../db/services/task-full.service", () => ({
    cacheFullTask: vi.fn().mockResolvedValue(undefined),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const task = {
    id: 7,
    title: "T",
    status: { status: "Closed" },
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

describe("the Recents reload signal on a task save", () => {
    const heard = vi.fn();

    beforeEach(() => {
        put.mockReset();
        heard.mockReset();
    });

    it("fires on a metadata save, and only once the PUT has landed", async () => {
        const off = onTaskMetadataSaved(heard);
        let land: (value: unknown) => void = () => {};
        put.mockReturnValue(new Promise((resolve) => (land = resolve)));

        const saving = sendUpdatedSpecificTask(null, myself, task, true, "tok");
        await vi.waitFor(() => expect(put).toHaveBeenCalled());
        expect(heard).not.toHaveBeenCalled();

        land({ data: { task: {} } });
        await saving;
        off();
        expect(heard).toHaveBeenCalledTimes(1);
    });

    it("stays quiet on a body autosave", async () => {
        const off = onTaskMetadataSaved(heard);
        put.mockResolvedValue({ data: { task: {} } });
        await sendUpdatedSpecificTask(null, myself, task, false, "tok");
        off();
        expect(put).toHaveBeenCalled();
        expect(heard).not.toHaveBeenCalled();
    });

    it("stays quiet when the save fails", async () => {
        const off = onTaskMetadataSaved(heard);
        put.mockRejectedValue(new Error("nope"));
        await sendUpdatedSpecificTask(null, myself, task, true, "tok").catch(() => {});
        off();
        expect(put).toHaveBeenCalled();
        expect(heard).not.toHaveBeenCalled();
    });
});
