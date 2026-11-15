/**
 * A task save that names a collaborator who could not open the task (MIP-1567).
 *
 * genos-api refuses it with HTTP 400 for the WHOLE save. The picker no longer
 * offers such people, so this is a race (a member removed since the roster was
 * read). The save must say why, in the person's language and by NAME, keep every
 * other edit the person made, and drop only the refused collaborator before
 * sending the rest again. It must not loop.
 */
import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSendUpdatedTask } from "../hooks/tasks/useSendUpdatedTask";
import { useTaskEditState } from "../hooks/tasks/useTaskEditState";
import { useTaskSaveTriggers } from "../hooks/tasks/useTaskSaveTriggers";
import { fmt, getMessages } from "../i18n";
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
const ann = user("u-ann");
const bob = user("u-bob");
const stored = () => makeTask({ collaborators: [] });
const edited = (extra: Partial<TaskProps> = {}) =>
    makeTask({
        status: { status: "WIP" } as never,
        priority: { priority: "High" } as never,
        collaborators: [ann, bob],
        ...extra,
    });

const refusal = (id: string) => ({
    error: `\`collaborators\`: '${id}' is not a member of this project, so they could not open the task. Add them to the project first.`,
});

const adapter = vi.fn();
const refuse = (config: InternalAxiosRequestConfig, data: unknown) =>
    new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", config, null, {
        data,
        status: 400,
        statusText: "",
        headers: {},
        config,
    });
const putBody = (call: number): Record<string, unknown> =>
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

const restoredFn = vi.fn();

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
    return { state, preview, send };
};

const ok = (config: InternalAxiosRequestConfig) => ({
    data: { task: { ts_updated_at: "2026-11-15T00:00:00Z" } },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
});

const saveAndSettle = async (
    hook: ReturnType<typeof renderHook<ReturnType<typeof useHarness>, unknown>>
) => {
    act(() => hook.result.current.state.setTaskUpdated(true));
    await waitFor(() => {
        expect(adapter).toHaveBeenCalled();
        expect(hook.result.current.state.taskUpdated).toBe(false);
    });
};

describe("a save refused because a collaborator could not open the task", () => {
    it("names the person, keeps the other edits, drops only them and sends the rest again", async () => {
        adapter
            .mockImplementationOnce(async (config: InternalAxiosRequestConfig) => {
                throw refuse(config, refusal("u-bob"));
            })
            .mockImplementation(async (config: InternalAxiosRequestConfig) => ok(config));
        const hook = renderHook(() => useHarness(edited()));

        await saveAndSettle(hook);
        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
        await act(async () => {});

        // The first send carried everything, collaborators included.
        expect(putBody(0).collaborators).toEqual(["u-ann", "u-bob"]);
        expect(putBody(0).status).toBe("WIP");
        // The reason is the toast that stays, with a name, not an id.
        const reasons = bus.filter(([kind]) => kind === "serverMessage");
        expect(reasons).toHaveLength(1);
        expect(reasons[0][1]).toBe(
            fmt(getMessages().tasks.errors.collaboratorNotOnProject, { name: "u-bob" })
        );
        expect(reasons[0][1]).not.toContain("'u-bob'");
        // Sent again WITHOUT the refused person and WITH the other edits.
        expect(putBody(1).collaborators).toEqual(["u-ann"]);
        expect(putBody(1).status).toBe("WIP");
        expect(putBody(1).priority).toBe("High");
        // No reload of the stored task, which would have thrown the edits away.
        expect(loadSpecificTask).not.toHaveBeenCalled();
        // The working copy and the preview task keep the other edits and lose only Bob.
        const { state, preview } = hook.result.current;
        expect(state.tmpCurrentTaskContent.status.status).toBe("WIP");
        expect(state.tmpCurrentTaskContent.collaborators?.map((c) => c.userId)).toEqual(["u-ann"]);
        expect(preview?.collaborators?.map((c) => c.userId)).toEqual(["u-ann"]);
        expect(state.taskUpdated).toBe(false);
    });

    it("sends once more per refused person and then stops", async () => {
        const answers = ["u-ann", "u-bob"];
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
            const sent = JSON.parse(config.data).collaborators as string[];
            const refused = answers.find((id) => sent.includes(id));
            if (refused) throw refuse(config, refusal(refused));
            return ok(config);
        });
        const hook = renderHook(() => useHarness(edited()));

        await saveAndSettle(hook);
        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(3));
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 200)));

        expect(adapter).toHaveBeenCalledTimes(3);
        expect(putBody(2).collaborators).toEqual([]);
        expect(hook.result.current.state.taskUpdated).toBe(false);
    });

    it("any other refusal still puts the whole working copy back and sends once", async () => {
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
            throw refuse(config, { error: "assignee 'u9' is not a member of project 1." });
        });
        const hook = renderHook(() => useHarness(edited()));

        await saveAndSettle(hook);
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 200)));

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(loadSpecificTask).toHaveBeenCalledTimes(1);
        const { state } = hook.result.current;
        expect(state.tmpCurrentTaskContent.status.status).toBe("Open");
        expect(state.tmpCurrentTaskContent.collaborators).toEqual([]);
    });

    // MIP-1586. The put-back leaves the task dirty so the rest of the save is sent again; the body and
    // status flags are the same kind of "still unsent" and must not be cleared as if it had gone out.
    // Only the retry's own success (or a full refusal) clears them.
    const dirtyHook = () => {
        const hook = renderHook(() => useHarness(edited()));
        act(() => {
            hook.result.current.state.setTaskBodyEdited(true);
            hook.result.current.state.setTaskStatusUpdated(true);
        });
        return hook;
    };

    it("keeps the body and status flags set while the rest is still to be sent again", async () => {
        let release: () => void = () => {};
        adapter
            .mockImplementationOnce(async (config: InternalAxiosRequestConfig) => {
                throw refuse(config, refusal("u-bob"));
            })
            // The retry stays in flight: what the flags say NOW is what a close or an
            // autosave in that window would act on.
            .mockImplementationOnce(
                (config: InternalAxiosRequestConfig) =>
                    new Promise((resolve) => {
                        release = () => resolve(ok(config));
                    })
            );
        const hook = dirtyHook();

        act(() => hook.result.current.state.setTaskUpdated(true));
        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
        await act(async () => {});

        const { state } = hook.result.current;
        expect(state.taskUpdated).toBe(true);
        expect(state.taskBodyEdited).toBe(true);
        expect(state.taskStatusUpdated).toBe(true);

        // The retry landing is what finishes the save: now they fall.
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => ok(config));
        await act(async () => release());
        await waitFor(() => expect(hook.result.current.state.taskUpdated).toBe(false));
        expect(hook.result.current.state.taskBodyEdited).toBe(false);
        expect(hook.result.current.state.taskStatusUpdated).toBe(false);
    });

    it("a refusal that is put back whole (nothing is sent again) still clears them", async () => {
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
            throw refuse(config, { error: "assignee 'u9' is not a member of project 1." });
        });
        const hook = dirtyHook();

        await saveAndSettle(hook);
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(hook.result.current.state.taskBodyEdited).toBe(false);
        expect(hook.result.current.state.taskStatusUpdated).toBe(false);
    });

    it("falls back to the server's sentence when the person is not on the form", async () => {
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
            throw refuse(config, refusal("u-nobody"));
        });
        const hook = renderHook(() => useHarness(edited()));

        await saveAndSettle(hook);
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 200)));

        expect(adapter).toHaveBeenCalledTimes(1);
        const reasons = bus.filter(([kind]) => kind === "serverMessage");
        expect(reasons[0][1]).toBe(refusal("u-nobody").error);
        // Nobody to drop: the full put-back path ran.
        expect(loadSpecificTask).toHaveBeenCalledTimes(1);
    });
});
