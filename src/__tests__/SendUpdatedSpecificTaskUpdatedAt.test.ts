/**
 * MIP-948: a saved task is mirrored into the IndexedDB row cache and the
 * full-task cache. Both used to carry `updatedTask.updatedAt` -- the working
 * copy's time from BEFORE the save -- so after a save the caches said the
 * task was last updated at the time it was opened. The PUT answers with the
 * time the server stamped on the save (`task.ts_updated_at`); that is what
 * the caches must carry.
 *
 * `UPDATE_RESPONSE` is a real answer of the local API to a PUT that changed a
 * task's priority, copied byte for byte. The same task read through
 * `getTask` right after reported `updatedAt: "2026-11-02 16:27:23.079829+00:00"`
 * and, right before, `"2026-11-02 16:13:23.294468+00:00"`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cacheFullTask } from "../db/services/task-full.service";
import { addTask } from "../features/tasks/services/addTask";
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
    emitTaskMetadataSaved: vi.fn(),
    emitTasksBulkChanged: vi.fn(),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const UPDATE_RESPONSE = {
    task: {
        task_id: 2962,
        chat_type: null,
        chat_id: null,
        thread_id: null,
        root_task_id: 2962,
        parent_task_id: null,
        title: "MIP-948 probe task",
        priority: "High",
        effort_level: null,
        status: "Open",
        priority_code: 0,
        effort_level_code: 0,
        status_code: 0,
        content: [],
        links: null,
        due_date: null,
        start_date: null,
        tags: [],
        custom_field_values: null,
        mentioned_user_ids: [],
        linked_calendar_event_id: null,
        linked_calendar_id: null,
        is_deleted: false,
        is_init_task: false,
        is_milestone: false,
        project_task_number: 38,
        ts_created_at: "2026-11-02T16:13:16.426857Z",
        ts_updated_at: "2026-11-02T16:27:23.079829Z",
        team: "148a851b-edd4-4142-93d4-0fd3f0b87f94",
        project: 295,
        milestone: null,
        sprint: null,
        assignee: null,
        reporter: "c5d18ce2-69de-48fa-9a57-e5567a011c7d",
        collaborators: [],
        displayId: "PRB-38",
    },
    movedFromProjectId: null,
    newly_mentioned_user_ids: [],
    all_mentioned_user_ids: [],
    removed_user_ids: [],
};

const BEFORE_SAVE = "2026-11-02 16:13:23.294468+00:00"; // what getTask said when the task was opened
const AFTER_SAVE = "2026-11-02 16:27:23.079829+00:00"; // what getTask says after the PUT above

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const user = (userId: string) => ({ userId, userName: userId }) as unknown as UserProps;

const makeTask = (extra: Partial<TaskProps> = {}): TaskProps =>
    ({
        id: 2962,
        displayId: "PRB-38",
        title: "MIP-948 probe task",
        body: [],
        project: { projectId: 295, projectName: "Probe Project", systemUserId: "sys" },
        assignee: null,
        reporter: user("u1"),
        priority: { priority: "High" },
        effortLevel: { level: "" },
        status: { status: "Open" },
        dueDate: "",
        links: [],
        tags: [],
        attachments: [],
        parentTaskId: null,
        threadId: null,
        updatedAt: BEFORE_SAVE,
        ...extra,
    }) as unknown as TaskProps;

const fn = (f: unknown) => f as ReturnType<typeof vi.fn>;
const cachedRow = () => fn(addTask).mock.calls[0][0];
const cachedFullTask = () => fn(cacheFullTask).mock.calls[0][0];

describe("sendUpdatedSpecificTask caches the save's own updated time (MIP-948)", () => {
    beforeEach(() => {
        put.mockReset();
        fn(addTask).mockClear();
        fn(cacheFullTask).mockClear();
    });

    it("puts the time the server stamped on the save into the row cache", async () => {
        put.mockResolvedValue({ data: UPDATE_RESPONSE });
        await sendUpdatedSpecificTask(null, myself, makeTask(), false, "tok");
        expect(cachedRow().updatedAt).toBe(AFTER_SAVE);
        expect(cachedRow().updatedAt).not.toBe(BEFORE_SAVE);
    });

    it("puts the same time into the full-task cache, so the two agree", async () => {
        put.mockResolvedValue({ data: UPDATE_RESPONSE });
        await sendUpdatedSpecificTask(null, myself, makeTask(), false, "tok");
        expect(cachedFullTask().updatedAt).toBe(AFTER_SAVE);
        expect(cachedFullTask().updatedAt).toBe(cachedRow().updatedAt);
    });

    it("does not change the task object the caller passed in", async () => {
        put.mockResolvedValue({ data: UPDATE_RESPONSE });
        const task = makeTask();
        await sendUpdatedSpecificTask(null, myself, task, false, "tok");
        expect(task.updatedAt).toBe(BEFORE_SAVE);
    });

    it("falls back to the working copy's time when the answer has no readable one", async () => {
        put.mockResolvedValue({ data: { task: { ts_updated_at: "now" } } });
        await sendUpdatedSpecificTask(null, myself, makeTask(), false, "tok");
        expect(cachedRow().updatedAt).toBe(BEFORE_SAVE);
        expect(cachedFullTask().updatedAt).toBe(BEFORE_SAVE);
        fn(addTask).mockClear();
        fn(cacheFullTask).mockClear();
        put.mockResolvedValue({ data: {} });
        await sendUpdatedSpecificTask(
            null,
            myself,
            makeTask({ updatedAt: undefined }),
            false,
            "tok"
        );
        expect(cachedRow().updatedAt).toBeNull();
    });
});
