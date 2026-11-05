/**
 * A root task stays a root task in the browser's store (MIP-943).
 *
 * Both writes built the cached row with `String(task.parentTaskId)`, and
 * `String(null)` is the text "null". The table finds root rows with
 * `parentTaskId == null`, so such a row counted as the child of a parent that
 * does not exist and showed nowhere. The next sync usually replaced it; one that
 * ran while the save was in flight had already moved the checkpoint past it, and
 * then nothing ever would.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addTask } from "../features/tasks/services/addTask";
import { sendUpdatedSpecificTask } from "../features/tasks/services/sendUpdatedSpecificTask";
import { uploadNewTask } from "../features/tasks/services/uploadNewTask";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

const put = vi.fn();
vi.mock("../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/api")>()),
    authApi: () => ({ put }),
}));
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
    emitTaskMetadataSaved: vi.fn(),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: {
        updateTaskCard: vi.fn().mockResolvedValue(undefined),
        getSnapshot: () => ({ channels: new Map() }),
        listChannels: vi.fn().mockResolvedValue([]),
        handleChannelCreated: vi.fn(),
        send: vi.fn().mockResolvedValue({ id: "msg-1" }),
    },
}));
vi.mock("../features/tasks/utils/TaskMessageTemplate", () => ({
    taskMessageTemplate: () => [{ type: "paragraph", content: "task" }],
}));

const myself = { teamId: "t1", userId: "u1", userName: "u1" } as unknown as UserProps;

const makeTask = (parentTaskId: number | null): TaskProps =>
    ({
        id: 42,
        displayId: "KDS-42",
        title: "A task",
        body: [],
        project: { projectId: 1, projectName: "Kds", systemUserId: "sys" },
        assignee: myself,
        reporter: myself,
        priority: { priority: "Medium" },
        effortLevel: { level: "Medium" },
        status: { status: "Open" },
        dueDate: "",
        links: [],
        tags: [],
        attachments: [],
        chatType: 3,
        parentTaskId,
        rootTaskId: null,
        threadId: null,
    }) as unknown as TaskProps;

const cachedRow = () => vi.mocked(addTask).mock.calls[0][0] as { parentTaskId: unknown };

beforeEach(() => {
    vi.clearAllMocks();
    put.mockResolvedValue({ data: {} });
    // `uploadNewTask` posts with `fetch`, not the axios client.
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ task: { task_id: 42, displayId: "KDS-42", status: "Open" } }),
        })
    );
});

describe("the row cached after a save", () => {
    it("keeps a root task's parent null, not the text", async () => {
        await sendUpdatedSpecificTask(null, myself, makeTask(null), false, "tok");

        expect(addTask).toHaveBeenCalledTimes(1);
        expect(cachedRow().parentTaskId).toBeNull();
    });

    it("still writes a real parent as the string the server sends", async () => {
        await sendUpdatedSpecificTask(null, myself, makeTask(1474), false, "tok");

        expect(cachedRow().parentTaskId).toBe("1474");
    });
});

describe("the row cached after creating a task", () => {
    const create = (task: TaskProps) =>
        uploadNewTask({
            socket: null,
            myself,
            taskContent: task,
            useCM: {
                isThreadVisible: false,
                currentMainChat: null,
                currentThreadChat: null,
                setCurrentThreadChat: vi.fn(),
            },
            accessToken: "tok",
            setTitleError: vi.fn(),
            setTitleErrorOpen: vi.fn(),
            setCurrentPreviewTaskId: vi.fn(),
        } as never);

    it("keeps a root task's parent null, not the text", async () => {
        await create(makeTask(null));

        expect(addTask).toHaveBeenCalled();
        expect(cachedRow().parentTaskId).toBeNull();
    });

    it("still writes a real parent as a string", async () => {
        await create(makeTask(1474));

        expect(cachedRow().parentTaskId).toBe("1474");
    });
});
