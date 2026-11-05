/**
 * The task preview when the server refuses a save (MIP-925).
 *
 * Before: the 400 was swallowed, `useSendUpdatedTask` carried on as if the
 * save had worked, and the preview went on showing the value the person
 * picked while the server held the old one. Now the hook puts the working
 * copy back to what the server holds, WITHOUT marking the task dirty.
 *
 * That last part is the trap. The preview saves from two effects
 * (`useTaskSaveTriggers`): one keyed on the save-request counter, one that
 * re-sends whenever the attachment list still holds a never-uploaded file and
 * `taskUpdated` is false. A refused save uploads nothing, so keeping that
 * file in the list would re-send it the moment the flag went false, get
 * another 400, and go round forever with a toast per round. The harness below
 * wires the REAL edit-state hook, the REAL save hook and the REAL triggers,
 * and the PUT is a counted transport stub, so "no loop" is asserted on the PUT
 * count itself.
 */
import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSendUpdatedTask } from "../hooks/tasks/useSendUpdatedTask";
import { useTaskEditState } from "../hooks/tasks/useTaskEditState";
import { useTaskSaveTriggers } from "../hooks/tasks/useTaskSaveTriggers";
import { getMessages } from "../i18n";
import { subscribeRequestErrors } from "../services/requestErrorNotifier";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

const getCachedFullTask = vi.fn();
vi.mock("../db/services/task-full.service", () => ({
    getCachedFullTask: (...args: unknown[]) => getCachedFullTask(...args),
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

// What the server holds, and what the person has edited it into.
const stored = () => makeTask();
const edited = (extra: Partial<TaskProps> = {}) =>
    makeTask({
        status: { status: "WIP" },
        assignee: user("u9"),
        title: "A task",
        ...extra,
    } as Partial<TaskProps>);
const unsent = (id: number) => ({
    attachment_id: id,
    file: new File(["x"], "x.txt", { type: "text/plain" }),
    name: "x.txt",
    type: "text/plain",
});

// ---- transport + toast bus -------------------------------------------------

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
const putBody = (call = 0): Record<string, unknown> =>
    JSON.parse(adapter.mock.calls[call][0].data);

type BusEvent = [kind: string, text: string | undefined];
let bus: BusEvent[] = [];
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
    getCachedFullTask.mockReset();
    getCachedFullTask.mockResolvedValue(stored());
    loadSpecificTask.mockReset();
    loadSpecificTask.mockResolvedValue([stored()]);
    bus = [];
    unsubscribe = subscribeRequestErrors(((kind: string, text?: string) =>
        bus.push([kind, text])) as never);
});

afterEach(() => {
    unsubscribe();
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

const lastToast = () => bus[bus.length - 1];

// ---- the harness: the preview's own wiring ---------------------------------

// What the panel's own assignee/reporter chips are told. Module-level so the
// hook's dependency list does not churn between renders.
const restoredCalls: TaskProps[] = [];
const restoredFn = (task: TaskProps) => {
    restoredCalls.push(task);
};

const useHarness = (initial: TaskProps) => {
    const [preview, setPreview] = useState<TaskProps | undefined>(initial);
    const state = useTaskEditState(initial);
    const send = useSendUpdatedTask({
        socket: null,
        myself,
        accessToken: "tok",
        currentPreviewTask: preview,
        setCurrentPreviewTask: setPreview,
        taskEditState: state,
        bodyRef: { current: [] },
        onStoredTaskRestored: restoredFn,
    });
    useTaskSaveTriggers(state, send);
    return { state, preview, setPreview, send };
};

const mount = (initial: TaskProps) => {
    restoredCalls.length = 0;
    return renderHook(() => useHarness(initial));
};

// Request a metadata save the way a picker does, and wait for it to finish.
// `dropFile` adds a never-uploaded file in the same step, the way the attachment
// tab does (working copy + file list + save request together).
const saveAndSettle = async (hook: ReturnType<typeof mount>, dropFile?: number) => {
    act(() => {
        const { state, setPreview } = hook.result.current;
        if (dropFile !== undefined) {
            state.setTmpCurrentTaskContent((prev) => ({
                ...prev,
                attachments: [...(prev.attachments ?? []), unsent(dropFile)],
            }));
            state.setUploadedFiles((prev) => [...prev, unsent(dropFile)] as never);
            // TaskPreview mirrors the working copy into the preview task on
            // every change, so the preview task holds the file too.
            setPreview((prev) =>
                prev
                    ? ({
                          ...prev,
                          attachments: [...(prev.attachments ?? []), unsent(dropFile)],
                      } as TaskProps)
                    : prev
            );
        }
        state.setTaskUpdated(true);
    });
    await waitFor(() => {
        expect(adapter).toHaveBeenCalled();
        expect(hook.result.current.state.taskUpdated).toBe(false);
    });
};

// Give a runaway loop every chance to show itself.
const letLoopsRun = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 200)));

describe("a refused save from the task preview", () => {
    const reason = "assignee 'u9' is not a member of project 1.";

    it("shows the server's reason and puts the working copy back to what is stored", async () => {
        respondWith(400, { error: reason });
        const hook = mount(edited());

        await saveAndSettle(hook);

        // Vacuity guard: the refused value really was sent.
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(putBody().assignee).toBe("u9");
        expect(putBody().status).toBe("WIP");
        // The reason, in the server's words, is the toast that stays.
        expect(lastToast()).toEqual(["serverMessage", reason]);
        // Reloaded from the server, not answered from the cache.
        expect(loadSpecificTask).toHaveBeenCalledTimes(1);
        expect(loadSpecificTask.mock.calls[0][4]).toEqual({ forceRefresh: true });
        // The working copy and the preview task both went back.
        const { state, preview } = hook.result.current;
        expect(state.tmpCurrentTaskContent.status.status).toBe("Open");
        expect(state.tmpCurrentTaskContent.assignee?.userId).toBe("u1");
        expect(preview?.status.status).toBe("Open");
        expect(preview?.assignee?.userId).toBe("u1");
        // The panel's own assignee/reporter chips are told.
        expect(restoredCalls).toHaveLength(1);
        expect(restoredCalls[0].assignee?.userId).toBe("u1");
        // And it is NOT dressed up as a successful save.
        expect(state.taskBodySaved).toBe(false);
    });

    it("sends the refused save exactly once: no re-send, no toast storm", async () => {
        respondWith(400, { error: reason });
        const hook = mount(edited());

        await saveAndSettle(hook);
        const seqAfterEdit = hook.result.current.state.taskUpdateSeq;
        await letLoopsRun();

        expect(adapter).toHaveBeenCalledTimes(1);
        // Nothing asked for another save.
        expect(hook.result.current.state.taskUpdateSeq).toBe(seqAfterEdit);
        expect(hook.result.current.state.taskUpdated).toBe(false);
        expect(bus.filter(([kind]) => kind === "serverMessage")).toHaveLength(1);
    });

    it("does not loop on a file that was never uploaded, and drops it", async () => {
        // The trap: a refused PUT uploads nothing, so a pending (negative-id)
        // attachment would trip the re-send effect as soon as the flag fell.
        respondWith(400, { error: reason });
        const hook = mount(edited());

        await saveAndSettle(hook, -1);
        await letLoopsRun();

        expect(adapter).toHaveBeenCalledTimes(1);
        const { state } = hook.result.current;
        expect(state.tmpCurrentTaskContent.attachments?.some((a) => a.attachment_id < 0)).toBe(
            false
        );
        expect(state.uploadedFiles.some((a) => a.attachment_id < 0)).toBe(false);
        // The preview task too: TaskPreview's same-task sync copies it back into
        // the working copy once the 5 s local-edit window has passed.
        expect(hook.result.current.preview?.attachments?.some((a) => a.attachment_id < 0)).toBe(
            false
        );
    });

    it("keeps settling when the refusal is about what is STORED, every full save repeats it", async () => {
        // An assignee removed from the project while the editor was open: the
        // stored task itself is what the server refuses, so the reload hands
        // back the same bad value and any resend would be refused again.
        respondWith(400, { error: reason });
        loadSpecificTask.mockResolvedValue([makeTask({ assignee: user("u9") })]);
        getCachedFullTask.mockResolvedValue(makeTask({ assignee: user("u9") }));
        const hook = mount(edited());

        await saveAndSettle(hook, -3);
        await letLoopsRun();

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(bus.filter(([kind]) => kind === "serverMessage")).toHaveLength(1);
    });

    it("reloads with the project the task is STORED in, not the refused move", async () => {
        // GET /task/getTask filters on project_id, so asking with the
        // destination of a refused move would come back empty and revert
        // nothing.
        respondWith(400, {
            error: "A sub-task cannot change project on its own.",
            code: "subtask_project_move_forbidden",
        });
        const moved = edited({
            project: { projectId: 2, projectName: "Other", systemUserId: "sys2" },
        } as Partial<TaskProps>);
        const hook = mount(moved);

        await saveAndSettle(hook);

        expect(putBody().project).toBe(2);
        expect(loadSpecificTask).toHaveBeenCalledTimes(1);
        expect(loadSpecificTask.mock.calls[0][1]).toBe(1);
        expect(hook.result.current.state.tmpCurrentTaskContent.project.projectId).toBe(1);
        // The existing sub-task message keeps working through the preview too.
        expect(lastToast()).toEqual([
            "serverMessage",
            getMessages().tasks.errors.subTaskProjectMoveForbidden,
        ]);
    });

    it("keeps the typed title, puts the picked values back, and leaves the body to the editor", async () => {
        respondWith(400, { error: reason });
        const body = [{ type: "paragraph", content: "typed since the last save" }];
        const hook = mount(edited({ body: body as never }));
        act(() => hook.result.current.state.setTaskTitle("Typed title"));

        await saveAndSettle(hook);

        // Vacuity guard: the typed title really was in the refused save.
        expect(putBody().title).toBe("Typed title");
        const { state, preview } = hook.result.current;
        // The title stays as typed in the input, the working copy AND the
        // preview task (TaskPreview's same-task sync copies the preview task's
        // title back into the input, so all three have to agree).
        expect(state.taskTitle).toBe("Typed title");
        expect(state.tmpCurrentTaskContent.title).toBe("Typed title");
        expect(preview?.title).toBe("Typed title");
        // The picked values still went back.
        expect(state.tmpCurrentTaskContent.status.status).toBe("Open");
        expect(preview?.assignee?.userId).toBe("u1");
        // The body is the collaborative editor's; reverting it would eat typing.
        expect(state.tmpCurrentTaskContent.body).toEqual(body);
    });

    it("does not re-send the kept title by itself, and sends it with the next save", async () => {
        respondWith(400, { error: reason });
        const hook = mount(edited());
        act(() => hook.result.current.state.setTaskTitle("Typed title"));

        await saveAndSettle(hook);
        await letLoopsRun();

        // Kept, not retried: one PUT, one toast, and nothing marked dirty.
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(hook.result.current.state.taskUpdated).toBe(false);
        expect(bus.filter(([kind]) => kind === "serverMessage")).toHaveLength(1);

        // The person fixes the picked value and saves again: the kept title
        // goes up with it.
        respondWith(200, {});
        await act(async () => {
            hook.result.current.state.setTaskUpdated(true);
        });
        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
        expect(putBody(1).title).toBe("Typed title");
    });

    it("falls back to the stored title when the box was emptied", async () => {
        respondWith(400, { error: reason });
        const hook = mount(edited());
        act(() => hook.result.current.state.setTaskTitle(""));

        await saveAndSettle(hook);

        // An empty title is never sent: the old one stands in for it.
        expect(putBody().title).toBe("A task");
        expect(hook.result.current.state.tmpCurrentTaskContent.title).toBe("A task");
        expect(hook.result.current.preview?.title).toBe("A task");
    });

    it("leaves a task the person switched to meanwhile alone", async () => {
        respondWith(400, { error: reason });
        let resolveReload: (value: TaskProps[]) => void = () => {};
        loadSpecificTask.mockReturnValue(
            new Promise<TaskProps[]>((resolve) => (resolveReload = resolve))
        );
        const hook = mount(edited());
        act(() => hook.result.current.state.setTaskUpdated(true));
        await waitFor(() => expect(loadSpecificTask).toHaveBeenCalledTimes(1));

        // While the reload is in flight the preview moves on to another task.
        const other = makeTask({
            id: 77,
            title: "Other task",
            status: { status: "Closed" },
        } as never);
        act(() => {
            hook.result.current.state.setTmpCurrentTaskContent(other);
            hook.result.current.state.setTaskTitle("Other task");
        });
        await act(async () => resolveReload([stored()]));

        const { state } = hook.result.current;
        expect(state.tmpCurrentTaskContent.id).toBe(77);
        expect(state.tmpCurrentTaskContent.status.status).toBe("Closed");
        expect(state.taskTitle).toBe("Other task");
        expect(restoredCalls).toHaveLength(0);
    });

    it("still drops the unsent file and settles when the stored copy cannot be loaded", async () => {
        respondWith(400, { error: reason });
        getCachedFullTask.mockResolvedValue(null);
        loadSpecificTask.mockResolvedValue(undefined);
        const hook = mount(edited());

        await saveAndSettle(hook, -2);
        await letLoopsRun();

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(lastToast()).toEqual(["serverMessage", reason]);
        expect(
            hook.result.current.state.tmpCurrentTaskContent.attachments?.some(
                (a) => a.attachment_id < 0
            )
        ).toBe(false);
        // Nothing was reloaded here, so only the early drop can clear the preview task.
        expect(hook.result.current.preview?.attachments?.some((a) => a.attachment_id < 0)).toBe(
            false
        );
    });
});

describe("the same hook around a refused save it did not start", () => {
    it("a save fired while switching away shows the reason but touches no preview state", async () => {
        respondWith(400, { error: "nope, not that one" });
        const hook = mount(edited());
        const before = hook.result.current.state.tmpCurrentTaskContent;

        // TaskPreview's switch effect calls `sendUpdatedTask(true)` and does
        // not await it, so a rejection here would be unhandled.
        await act(async () => {
            await hook.result.current.send(true);
        });

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(lastToast()).toEqual(["serverMessage", "nope, not that one"]);
        expect(loadSpecificTask).not.toHaveBeenCalled();
        expect(hook.result.current.state.tmpCurrentTaskContent).toBe(before);
        expect(restoredCalls).toHaveLength(0);
    });

    it("a successful save is unchanged: marked saved, nothing reloaded", async () => {
        respondWith(200, { task: { ts_updated_at: "now" } });
        const hook = mount(edited());

        await saveAndSettle(hook);

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(loadSpecificTask).not.toHaveBeenCalled();
        expect(bus).toEqual([]);
        expect(hook.result.current.state.taskBodySaved).toBe(true);
        expect(hook.result.current.state.tmpCurrentTaskContent.status.status).toBe("WIP");
    });
});
