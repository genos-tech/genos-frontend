/**
 * MIP-948: after a task is created through the form, `uploadNewTask` caches
 * the new row in IndexedDB. It read `task.updatedAt` from the create response,
 * but that response is a DRF model serialisation, which names the time
 * `ts_updated_at` -- so the cached row ALWAYS had `updatedAt: null`, and the
 * socket's `ts_mentioned_at` for a body @mention was `undefined` (the sockets
 * service reads that key as required).
 *
 * `CREATE_RESPONSE` is a real answer of the local API to the form's PUT (the
 * form POSTs an empty scaffold row, then PUTs the real data to it), copied
 * byte for byte. `PROJECT_LIST_UPDATED_AT` is what `getProjectTasks` returned
 * for the same task at the same moment: the form a cached row must carry, so
 * it compares equal to the rows a project sync writes.
 */
import type { Socket } from "socket.io-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addTask } from "../features/tasks/services/addTask";
import { uploadNewTask } from "../features/tasks/services/uploadNewTask";
import type { ChatManagementState } from "../hooks/chats/useChatManagement";
import { channelService } from "../services/channel/channelService";
import type { UserProps } from "../types/admin";
import { ChannelKind } from "../types/channel";
import type { TaskProps } from "../types/tasks";

vi.mock("../features/tasks/utils/TaskMessageTemplate", () => ({
    taskMessageTemplate: () => [{ type: "paragraph", content: "task created" }],
}));

// `addTask` writes to IndexedDB through a Web Worker, which jsdom has no
// implementation for. The test reads what it was called with.
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(undefined),
}));

const CREATE_RESPONSE = {
    task: {
        task_id: 2962,
        chat_type: null,
        chat_id: null,
        thread_id: null,
        root_task_id: 2962,
        parent_task_id: null,
        title: "MIP-948 probe task",
        priority: "Normal",
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
        ts_updated_at: "2026-11-02T16:13:23.294468Z",
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

// The same task's row in `GET /task/getProjectTasks/` (`str(ts_updated_at)`).
const PROJECT_LIST_UPDATED_AT = "2026-11-02 16:13:23.294468+00:00";

const PM = { id: "pm-uuid", kind: ChannelKind.PM, projectId: 295 };
const USER = { userId: "u1", userName: "Me", teamId: "t1", teamName: "T" } as unknown as UserProps;

const makeTaskContent = (): TaskProps =>
    ({
        id: 2962,
        title: "MIP-948 probe task",
        project: { projectId: 295, projectName: "Probe Project", systemUserId: "sys-1" },
        assignee: null,
        reporter: USER,
        priority: { priority: "Normal" },
        effortLevel: { level: "" },
        status: { status: "Open" },
        body: [],
        dueDate: "",
        links: [],
        tags: [],
        chatType: 3,
        parentTaskId: null,
        rootTaskId: null,
        attachments: [],
    }) as unknown as TaskProps;

const useCM = {
    isThreadVisible: false,
    currentMainChat: null,
    currentThreadChat: null,
    setCurrentThreadChat: vi.fn(),
} as unknown as ChatManagementState;

const run = (response: unknown, socket: Socket | null = null) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => response }));
    return uploadNewTask({
        socket,
        myself: USER,
        taskContent: makeTaskContent(),
        useCM,
        accessToken: "token",
        setTitleError: vi.fn(),
        setTitleErrorOpen: vi.fn(),
        setCurrentPreviewTaskId: vi.fn(),
    });
};

const cachedRow = () => (addTask as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];

describe("uploadNewTask caches the new row with the server's updated time (MIP-948)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        (addTask as unknown as ReturnType<typeof vi.fn>).mockClear();
        vi.spyOn(channelService, "getSnapshot").mockReturnValue({
            channels: new Map([[PM.id, PM]]),
        } as unknown as ReturnType<typeof channelService.getSnapshot>);
        vi.spyOn(channelService, "listChannels").mockResolvedValue([PM] as unknown as Awaited<
            ReturnType<typeof channelService.listChannels>
        >);
        vi.spyOn(channelService, "handleChannelCreated").mockImplementation(() => undefined);
        vi.spyOn(channelService, "send").mockResolvedValue({
            id: "msg-1",
        } as unknown as Awaited<ReturnType<typeof channelService.send>>);
    });

    it("stores the response's ts_updated_at, in the form the project list uses", async () => {
        const result = await run(CREATE_RESPONSE);
        expect(result.ok).toBe(true);
        expect(addTask).toHaveBeenCalledTimes(1);
        expect(cachedRow().updatedAt).toBe(PROJECT_LIST_UPDATED_AT);
        // The rest of the row is what it always was.
        expect(cachedRow().id).toBe("2962");
        expect(cachedRow().displayId).toBe("PRB-38");
    });

    it("keeps null when the response carries no readable time", async () => {
        await run({ task: { ...CREATE_RESPONSE.task, ts_updated_at: undefined } });
        expect(cachedRow().updatedAt).toBeNull();
        (addTask as unknown as ReturnType<typeof vi.fn>).mockClear();
        await run({ task: { ...CREATE_RESPONSE.task, ts_updated_at: "not a time" } });
        expect(cachedRow().updatedAt).toBeNull();
    });

    it("sends the sockets service the time it requires with a body @mention", async () => {
        const emit = vi.fn();
        await run({ ...CREATE_RESPONSE, newly_mentioned_user_ids: ["u2"] }, {
            emit,
        } as unknown as Socket);
        expect(emit).toHaveBeenCalledTimes(1);
        const [event, payload] = emit.mock.calls[0];
        expect(event).toBe("task_body_mention");
        // Same value `sendUpdatedSpecificTask` sends: the response's own time.
        expect(payload.ts_mentioned_at).toBe("2026-11-02T16:13:23.294468Z");
        expect(payload.display_id).toBe("PRB-38");
    });
});
