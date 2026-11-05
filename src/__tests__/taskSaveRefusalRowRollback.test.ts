/**
 * A refused save must also take the TABLE ROW back (MIP-968).
 *
 * An edit reaches the task's row the moment the working copy changes, before
 * the save is answered. If the server then refuses the save, `useSendUpdatedTask`
 * puts the working copy and the host's preview back to what is stored, and the
 * row has to follow, or the table keeps showing a value that exists nowhere
 * else. The row used to follow through the `isTaskUpdated` flag loop; it now
 * follows through `usePreviewEditMirror`, which only pushes a working copy that
 * is not the host's preview object. This runs the real wiring of TaskPreview
 * (host state, edit state, save hook, save triggers, mirror) against a counted
 * transport stub and reads the row.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePreviewEditMirror } from "../features/tasks/components/contents/utils/usePreviewEditMirror";
import { useSendUpdatedTask } from "../hooks/tasks/useSendUpdatedTask";
import { useTaskEditState } from "../hooks/tasks/useTaskEditState";
import { useTaskManagement } from "../hooks/tasks/useTaskManagement";
import { useTaskSaveTriggers } from "../hooks/tasks/useTaskSaveTriggers";
import { subscribeRequestErrors } from "../services/requestErrorNotifier";
import { UserProps } from "../types/admin";
import { TaskProps, TaskTableProps } from "../types/tasks";

vi.mock("../db/services/task-full.service", () => ({
    getCachedFullTask: vi.fn().mockResolvedValue(null),
    cacheFullTask: vi.fn().mockResolvedValue(undefined),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
}));
const loadSpecificTask = vi.fn();
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: (...args: unknown[]) => loadSpecificTask(...args),
}));
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/tasks/services/uploadTaskAttachments", () => ({
    uploadTaskAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const user = (userId: string) => ({ userId, userName: userId }) as unknown as UserProps;

const makeTask = (extra: Record<string, unknown> = {}): TaskProps =>
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
        concatTags: "//",
        attachments: [],
        parentTaskId: null,
        rootTaskId: 42,
        threadId: null,
        createdDate: "2026-07-01",
        updatedAt: "2026-07-20 10:00:00",
        ...extra,
    }) as unknown as TaskProps;

const ROW = {
    id: "42",
    displayId: "KDS-42",
    title: "A task",
    priority: "Medium",
    effortLevel: "Medium",
    createdDate: "2026-07-01",
    updatedAt: "2026-07-20 10:00:00",
    status: "Open",
    assigneeId: "u1",
    assigneeName: "u1",
    parentTaskId: null,
    rootTaskId: 42,
    teamId: "t1",
    projectId: 1,
    tags: [],
    concatTags: "//",
    isMilestone: false,
    milestoneId: null,
    sprintId: null,
} as unknown as TaskTableProps;

const adapter = vi.fn();
const respondWith = (status: number, data: unknown) => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (status < 400) return { data, status, statusText: "OK", headers: {}, config };
        throw new AxiosError(
            `Request failed with status code ${status}`,
            "ERR_BAD_REQUEST",
            config,
            null,
            { data, status, statusText: "", headers: {}, config }
        );
    });
};

/** A refusal the test answers by hand, so the row can be read while the save is out. */
const holdRefusal = () => {
    let refuse!: () => void;
    adapter.mockImplementation(
        (config: InternalAxiosRequestConfig) =>
            new Promise((_resolve, reject) => {
                refuse = () =>
                    reject(
                        new AxiosError(
                            "Request failed with status code 400",
                            "ERR_BAD_REQUEST",
                            config,
                            null,
                            {
                                data: { error: "status 'WIP' is not allowed here." },
                                status: 400,
                                statusText: "",
                                headers: {},
                                config,
                            }
                        )
                    );
            })
    );
    return () => refuse();
};

let unsubscribe: () => void = () => {};
let originalAdapter: typeof axios.defaults.adapter;
let now = 0;

beforeEach(() => {
    now += 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(console, "error").mockImplementation(() => {});
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    loadSpecificTask.mockReset();
    // The server still holds the task as it was.
    loadSpecificTask.mockResolvedValue([makeTask()]);
    unsubscribe = subscribeRequestErrors((() => {}) as never);
});

afterEach(() => {
    unsubscribe();
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

// The task as loaded: the working copy starts from it, as TaskPreview's does.
const LOADED = makeTask();

/** TaskPreview's wiring over the real host state (preview slot + table rows). */
const useHarness = () => {
    const tm = useTaskManagement(myself, "tok");
    const state = useTaskEditState(LOADED);
    const send = useSendUpdatedTask({
        socket: null,
        myself,
        accessToken: "tok",
        currentPreviewTask: tm.currentPreviewTask,
        setCurrentPreviewTask: tm.setCurrentPreviewTask,
        taskEditState: state,
        bodyRef: { current: [] },
    });
    useTaskSaveTriggers(state, send);
    usePreviewEditMirror({
        working: state.tmpCurrentTaskContent,
        preview: tm.currentPreviewTask,
        myself,
        setPreview: tm.setCurrentPreviewTask,
        syncRow: tm.syncPreviewEdit,
        setAssignee: vi.fn(),
        setReporter: vi.fn(),
    });
    return { tm, state };
};

const open = async () => {
    const view = renderHook(() => useHarness());
    act(() => {
        view.result.current.tm.setAllTasks([ROW]);
        view.result.current.tm.setCurrentPreviewTask(LOADED);
    });
    await act(async () => {});
    return view;
};
const statusOfRow = (view: Awaited<ReturnType<typeof open>>) =>
    view.result.current.tm.allTasks[0].status;

describe("the table row when the server refuses a save from the preview", () => {
    it("shows the edit while the save is out, and goes back to the stored value when it is refused", async () => {
        const refuse = holdRefusal();
        const view = await open();
        expect(statusOfRow(view)).toBe("Open");

        // The person picks a status: the working copy changes, a save is requested.
        act(() => {
            view.result.current.state.setTmpCurrentTaskContent((prev) => ({
                ...prev,
                status: { status: "WIP" } as TaskProps["status"],
            }));
            view.result.current.state.setTaskUpdated(true);
        });
        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
        expect(JSON.parse(adapter.mock.calls[0][0].data).status).toBe("WIP");
        // The edit reached the row while the save is still out (vacuity guard:
        // without it the "back to Open" below proves nothing)...
        expect(statusOfRow(view)).toBe("WIP");

        // ...and the refusal takes it back: working copy, preview AND row.
        await act(async () => refuse());
        await waitFor(() => expect(view.result.current.state.taskUpdated).toBe(false));
        await waitFor(() =>
            expect(view.result.current.state.tmpCurrentTaskContent.status.status).toBe("Open")
        );
        await waitFor(() => expect(statusOfRow(view)).toBe("Open"));
        expect(view.result.current.tm.currentPreviewTask?.status.status).toBe("Open");
    });

    it("an accepted save leaves the edit on the row (the harness can show a stuck rollback)", async () => {
        respondWith(200, { task: { ts_updated_at: "2026-07-20T11:00:00Z" } });
        const view = await open();

        act(() => {
            view.result.current.state.setTmpCurrentTaskContent((prev) => ({
                ...prev,
                status: { status: "WIP" } as TaskProps["status"],
            }));
            view.result.current.state.setTaskUpdated(true);
        });
        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(view.result.current.state.taskUpdated).toBe(false));

        expect(statusOfRow(view)).toBe("WIP");
    });
});
