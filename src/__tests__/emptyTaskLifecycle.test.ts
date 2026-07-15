/**
 * Guards the empty-task scaffold services behind the create-task form.
 *
 * The form renders nothing until `createEmptyTask` yields an id, so any
 * path where it neither resolves an id nor throws = the form spins forever
 * with no error. These tests pin "always one or the other".
 *
 * `deleteEmptyTask` is fire-and-forget cleanup, so its bar is the opposite:
 * don't throw for a no-op.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyTask } from "../features/tasks/services/createEmptyTask";
import { deleteEmptyTask } from "../features/tasks/services/deleteEmptyTask";

const MYSELF = { userId: "u1", teamId: "t1", userName: "Me" } as any;

const okCreate = (taskId: unknown) => ({
    ok: true,
    status: 200,
    json: async () => ({ task: { task_id: taskId } }),
});

const createArgs = (over = {}) => ({
    accessToken: "token",
    myself: MYSELF,
    projectId: 7,
    ...over,
});

describe("createEmptyTask", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("resolves the new task id", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okCreate(772)));
        await expect(createEmptyTask(createArgs())).resolves.toBe(772);
    });

    it("throws instead of returning silently when there is no access token", async () => {
        // The silent-hang path: this used to `return` with no id and no
        // error, leaving the form's loading pane up forever.
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        await expect(createEmptyTask(createArgs({ accessToken: null }))).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws when the backend rejects the create", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
        );
        await expect(createEmptyTask(createArgs())).rejects.toThrow();
    });

    it("surfaces the real failure when an error body isn't JSON", async () => {
        // Ok-check must precede `.json()`, or a proxy's HTML 502 throws an
        // opaque SyntaxError instead of the actual error.
        const jsonSpy = vi.fn().mockRejectedValue(new SyntaxError("Unexpected token <"));
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, status: 502, json: jsonSpy })
        );
        await expect(createEmptyTask(createArgs())).rejects.toThrow(/task/i);
        expect(jsonSpy).not.toHaveBeenCalled();
    });

    it.each([[undefined], [null], ["772"]])(
        "throws on a 200 whose body carries no numeric task id (%s)",
        async (taskId) => {
            // A non-number id would seed the form with `undefined` and
            // reproduce the endless loading pane one layer up.
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okCreate(taskId)));
            await expect(createEmptyTask(createArgs())).rejects.toThrow();
        }
    );

    it("passes the abort signal through so the caller can time it out", async () => {
        const fetchMock = vi.fn().mockResolvedValue(okCreate(1));
        vi.stubGlobal("fetch", fetchMock);
        const controller = new AbortController();
        await createEmptyTask(createArgs({ signal: controller.signal }));
        expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
    });

    it("rejects when the request is aborted, so a hung fetch is catchable", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }))
        );
        await expect(createEmptyTask(createArgs())).rejects.toThrow();
    });
});

describe("deleteEmptyTask", () => {
    let setInitialEmptyTaskId: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        setInitialEmptyTaskId = vi.fn();
    });
    afterEach(() => vi.unstubAllGlobals());

    const deleteArgs = () => ({
        accessToken: "token",
        myself: MYSELF,
        setInitialEmptyTaskId,
        taskId: 772,
    });

    it("resolves and clears the stale id on success", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
        await expect(deleteEmptyTask(deleteArgs())).resolves.toBeUndefined();
        expect(setInitialEmptyTaskId).toHaveBeenCalledWith(undefined);
    });

    it("treats a 404 as success — the row being gone IS the goal", async () => {
        // This 404 is what produced "Uncaught (in promise) Error: Failed to
        // delete the empty task" for what is really a no-op.
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
        await expect(deleteEmptyTask(deleteArgs())).resolves.toBeUndefined();
        // And the stale id still gets cleared — it's exactly what we don't
        // want left pointing at a row that isn't there.
        expect(setInitialEmptyTaskId).toHaveBeenCalledWith(undefined);
    });

    it("still throws on a real failure so callers can log it", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        await expect(deleteEmptyTask(deleteArgs())).rejects.toThrow();
        expect(setInitialEmptyTaskId).not.toHaveBeenCalled();
    });

    it("no-ops without an access token", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        await expect(
            deleteEmptyTask({ ...deleteArgs(), accessToken: null })
        ).resolves.toBeUndefined();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
