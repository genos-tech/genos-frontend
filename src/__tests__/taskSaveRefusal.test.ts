/**
 * A task save the server refuses (HTTP 400) has to reach the person (MIP-925).
 *
 * `sendUpdatedSpecificTask` used to catch the 400, report it through a
 * `setErrorMessage` callback no caller passes, and return as if nothing had
 * happened. The preview kept the value the person picked, the table row took
 * the optimistic copy `updateTaskFromTable` handed back, and the board's
 * rollback in `handleDragEnd` never ran because nothing threw.
 *
 * These run the REAL `authApi` (so the real response interceptor, which
 * already fires a generic toast for every 400) with only the transport
 * stubbed, so what the bus ends up carrying is what the snackbar would show.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendUpdatedSpecificTask } from "../features/tasks/services/sendUpdatedSpecificTask";
import { TaskSaveRefusedError } from "../features/tasks/services/taskSaveRefusedError";
import { updateTaskFromTable } from "../features/tasks/services/updateTaskFromTable";
import { getMessages } from "../i18n";
import { subscribeRequestErrors } from "../services/requestErrorNotifier";
import { UserProps } from "../types/admin";
import { TaskProps, TaskTableProps } from "../types/tasks";

const cacheFullTask = vi.fn().mockResolvedValue(undefined);
const addTask = vi.fn().mockResolvedValue(null);
const loadSpecificTask = vi.fn();
vi.mock("../db/services/task-full.service", () => ({
    cacheFullTask: (...args: unknown[]) => cacheFullTask(...args),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: (...args: unknown[]) => addTask(...args),
}));
vi.mock("../features/tasks/services/uploadTaskAttachments", () => ({
    uploadTaskAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: (...args: unknown[]) => loadSpecificTask(...args),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const user = { userId: "u1", userName: "u1" } as unknown as UserProps;

const makeTask = (extra: Partial<TaskProps> = {}): TaskProps =>
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

// What the transport answers: a status and a body.
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

// Every event the toast bus carries, in order.
type BusEvent = [kind: string, text: string | undefined];
let bus: BusEvent[] = [];
let unsubscribe: () => void = () => {};
let originalAdapter: typeof axios.defaults.adapter;

// The bus de-duplicates by kind within 4 s on the real clock; moving the
// clock forward between tests keeps one test's toast from hiding the next.
let now = 0;

beforeEach(() => {
    now += 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(console, "error").mockImplementation(() => {});
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    cacheFullTask.mockClear();
    addTask.mockClear();
    loadSpecificTask.mockReset();
    bus = [];
    unsubscribe = subscribeRequestErrors(((kind: string, text?: string) =>
        bus.push([kind, text])) as never);
});

afterEach(() => {
    unsubscribe();
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

const lastToast = (): BusEvent | undefined => bus[bus.length - 1];

describe("sendUpdatedSpecificTask on a refused save", () => {
    it("throws a typed error carrying the server's reason and shows that reason", async () => {
        const reason = "assignee 'u9' is not a member of project 1.";
        respondWith(400, { error: reason });

        const saving = sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok");

        await expect(saving).rejects.toBeInstanceOf(TaskSaveRefusedError);
        await expect(saving).rejects.toMatchObject({ serverMessage: reason, message: reason });
        // Vacuity guard: the PUT really went out.
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(adapter.mock.calls[0][0].method).toBe("put");
        expect(adapter.mock.calls[0][0].url).toBe("/task/");
        // The generic "couldn't complete" toast the interceptor fires for any
        // 400 comes first; the reason replaces it, so the reason is what stays.
        expect(lastToast()).toEqual(["serverMessage", reason]);
    });

    it("writes nothing locally: no cache write, no table-cache write", async () => {
        respondWith(400, { error: "nope" });

        await expect(
            sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok")
        ).rejects.toBeInstanceOf(TaskSaveRefusedError);

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(cacheFullTask).not.toHaveBeenCalled();
        expect(addTask).not.toHaveBeenCalled();
    });

    it("keeps the translated sub-task message for subtask_project_move_forbidden", async () => {
        respondWith(400, {
            error: "A sub-task cannot change project on its own.",
            code: "subtask_project_move_forbidden",
        });
        const setErrorMessage = vi.fn();
        const translated = getMessages().tasks.errors.subTaskProjectMoveForbidden;

        await expect(
            sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok", setErrorMessage)
        ).rejects.toMatchObject({ code: "subtask_project_move_forbidden" });

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(setErrorMessage).toHaveBeenCalledWith(translated);
        expect(lastToast()).toEqual(["serverMessage", translated]);
    });

    it("hands setErrorMessage the server's reason, not the old 'Message Id already exists'", async () => {
        respondWith(400, { error: "custom field 7 is not a number." });
        const setErrorMessage = vi.fn();

        await expect(
            sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok", setErrorMessage)
        ).rejects.toBeInstanceOf(TaskSaveRefusedError);

        expect(setErrorMessage).toHaveBeenCalledWith("custom field 7 is not a number.");
    });

    it("still throws, with no text, for a field-error body that has no 'error' key", async () => {
        // The PUT's last line is `Response(serializer.errors, 400)`: a map of
        // field -> [messages]. There is no single sentence to show, so the
        // generic toast the interceptor already raised stays; the save still
        // counts as refused so the caller puts local state back.
        respondWith(400, { title: ["This field may not be blank."] });

        const saving = sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok");

        await expect(saving).rejects.toBeInstanceOf(TaskSaveRefusedError);
        await expect(saving).rejects.toMatchObject({ serverMessage: null });
        expect(bus.map(([kind]) => kind)).toEqual(["requestFailed"]);
    });

    it("shows two different refusals that land within the dedupe window", async () => {
        respondWith(400, { error: "first reason" });
        await expect(
            sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok")
        ).rejects.toBeInstanceOf(TaskSaveRefusedError);
        respondWith(400, { error: "second reason" });
        await expect(
            sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok")
        ).rejects.toBeInstanceOf(TaskSaveRefusedError);

        const texts = bus.filter(([kind]) => kind === "serverMessage").map(([, text]) => text);
        expect(texts).toEqual(["first reason", "second reason"]);
    });

    it("collapses the same refusal repeated within the window into one toast", async () => {
        respondWith(400, { error: "same reason" });
        for (let i = 0; i < 3; i++) {
            await expect(
                sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok")
            ).rejects.toBeInstanceOf(TaskSaveRefusedError);
        }
        expect(adapter).toHaveBeenCalledTimes(3);
        expect(bus.filter(([kind]) => kind === "serverMessage")).toHaveLength(1);
    });
});

describe("sendUpdatedSpecificTask on everything that is not a 400", () => {
    it("still swallows a 500 and returns nothing (the generic server-error toast owns it)", async () => {
        respondWith(500, { detail: "boom" });

        const result = await sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok");

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(result).toBeUndefined();
        expect(bus.map(([kind]) => kind)).toEqual(["serverError"]);
    });

    it("still reports a 401 through setErrorMessage without throwing", async () => {
        respondWith(401, { detail: "expired" });
        const setErrorMessage = vi.fn();

        const result = await sendUpdatedSpecificTask(
            null,
            myself,
            makeTask(),
            true,
            "tok",
            setErrorMessage
        );

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(result).toBeUndefined();
        expect(setErrorMessage).toHaveBeenCalledWith(
            getMessages().tasks.errors.unauthorizedPleaseLogin
        );
    });

    it("still returns the uploaded attachments after a successful save", async () => {
        respondWith(200, { task: { ts_updated_at: "now" } });

        const result = await sendUpdatedSpecificTask(null, myself, makeTask(), false, "tok");

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(result).toEqual([]);
        expect(cacheFullTask).toHaveBeenCalledTimes(1);
        expect(bus).toEqual([]);
    });
});

// The table and the board both save through `updateTaskFromTable`. The board
// rolls its columns back in a `catch` around the call, so the contract that
// matters here is that a refusal REJECTS rather than coming back as a row.
describe("updateTaskFromTable on a refused save", () => {
    const row = (extra: Partial<TaskTableProps> = {}): TaskTableProps =>
        ({
            id: "42",
            title: "A task",
            status: "WIP",
            priority: "Medium",
            effortLevel: "Medium",
            dueDate: "",
            projectId: 1,
            parentTaskId: null,
            milestoneId: null,
            assigneeId: "u1",
            tags: [],
            ...extra,
        }) as unknown as TaskTableProps;

    beforeEach(() => {
        loadSpecificTask.mockResolvedValue([makeTask()]);
    });

    it("rejects with the typed refusal, so the board's rollback runs", async () => {
        const reason = "Destination project not found.";
        respondWith(400, { error: reason });

        const saving = updateTaskFromTable(row(), myself, null, "tok", [user]);

        await expect(saving).rejects.toBeInstanceOf(TaskSaveRefusedError);
        await expect(saving).rejects.toMatchObject({ serverMessage: reason });
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(lastToast()).toEqual(["serverMessage", reason]);
    });

    it("still hands back the edited row when the save fails any other way", async () => {
        respondWith(500, { detail: "boom" });

        const edited = row({ status: "Closed" });
        const result = await updateTaskFromTable(edited, myself, null, "tok", [user]);

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(result.status).toBe("Closed");
    });

    it("still hands back the edited row when the task cannot be loaded to build the save", async () => {
        loadSpecificTask.mockResolvedValue(undefined);

        const edited = row({ status: "Closed" });
        const result = await updateTaskFromTable(edited, myself, null, "tok", [user]);

        expect(adapter).not.toHaveBeenCalled();
        expect(result).toBe(edited);
    });
});
