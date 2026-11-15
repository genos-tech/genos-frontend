/**
 * What a project move tells the person afterwards, and what it does when the
 * server refuses it because an assignee is not on the destination (MIP-1597).
 *
 * genos-api answers a move with `notesNarrowed` and `reportersOutsideDestination`
 * (top level, next to `movedFromProjectId`, on a move only) and refuses a move
 * that would leave an assignee outside with HTTP 400 `assignee_not_on_destination`.
 * The frontend has to work before and after that API ships: an answer without the
 * fields shows nothing.
 *
 * The real `authApi` runs with only the transport stubbed, so what the toast
 * store and the request-error bus carry is what the person would see.
 */
import { createElement, ReactNode, useState } from "react";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetToasts, useToasts } from "../components/ui/feedback/toastStore";
import { moveNoticeText } from "../features/tasks/services/moveNotice";
import { sendUpdatedSpecificTask } from "../features/tasks/services/sendUpdatedSpecificTask";
import { TaskSaveRefusedError } from "../features/tasks/services/taskSaveRefusedError";
import { updateMilestone } from "../features/tasks/sprint-milestone/services/updateMilestone";
import { dropRefusedMove } from "../features/tasks/utils/moveRefusal";
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
const forgetCachedSubtree = vi.fn();
vi.mock("../features/tasks/services/forgetCachedSubtree", () => ({
    forgetCachedSubtree: (...args: unknown[]) => forgetCachedSubtree(...args),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;
const user = (userId: string) => ({ userId, userName: userId }) as unknown as UserProps;

const KDS = { projectId: 1, projectName: "Kds", systemUserId: "sys", projectTags: [] };
const OPS = { projectId: 2, projectName: "Ops", systemUserId: "sys2", projectTags: [] };

const makeTask = (extra: Partial<TaskProps> = {}): TaskProps =>
    ({
        id: 42,
        displayId: "KDS-42",
        title: "A task",
        body: [],
        project: KDS,
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
        rootTaskId: null,
        milestoneId: null,
        sprintId: null,
        threadId: null,
        ...extra,
    }) as unknown as TaskProps;

// What the server holds, and what the person made of it: a status edit AND a
// project pick (which clears the tags, the milestone and the sprint).
const stored = () => makeTask({ tags: [{ tagId: 7 } as never], milestoneId: 9, sprintId: 3 });
const moved = () =>
    makeTask({
        project: OPS,
        status: { status: "WIP" } as never,
        tags: [],
        milestoneId: null,
        sprintId: null,
    });

const adapter = vi.fn();
const answerWith = (status: number, data: unknown) =>
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (status < 400) return { data, status, statusText: "OK", headers: {}, config };
        throw new AxiosError("failed", "ERR_BAD_REQUEST", config, null, {
            data,
            status,
            statusText: "",
            headers: {},
            config,
        });
    });
const putBody = (call: number): Record<string, unknown> =>
    JSON.parse(adapter.mock.calls[call][0].data);

const SAVED = { task: { ts_updated_at: "2026-11-15T00:00:00Z" } };
const REFUSAL = {
    error: "Task KDS-42 is assigned to u-zed, who is not on the destination project or its team. Nothing was changed.",
    code: "assignee_not_on_destination",
};

type BusEvent = [kind: string, text: string | undefined];
let bus: BusEvent[] = [];
let unsubscribe: () => void = () => {};
let originalAdapter: typeof axios.defaults.adapter;
let now = 0;

// The text a toast shows, whether its message is a string or a node.
const textOf = (message: ReactNode): string =>
    render(createElement("div", null, message)).container.textContent ?? "";
const toasts = () => renderHook(() => useToasts());
const t = () => getMessages().tasks.moveNotice;

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
    // The server filters getTask by project, so asking in the destination finds nothing.
    loadSpecificTask.mockImplementation(async (_me: unknown, projectId: number) =>
        projectId === 1 ? [stored()] : []
    );
    forgetCachedSubtree.mockReset();
    forgetCachedSubtree.mockResolvedValue(undefined);
    __resetToasts();
    bus = [];
    unsubscribe = subscribeRequestErrors(((kind: string, text?: string) =>
        bus.push([kind, text])) as never);
});

afterEach(() => {
    unsubscribe();
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

describe("moveNoticeText", () => {
    it("says how many note owners lost the Owner role, in whole words", () => {
        expect(moveNoticeText({ notesNarrowed: 3 })).toBe(fmt(t().notesNarrowed, { count: 3 }));
        expect(moveNoticeText({ notesNarrowed: 3 })).toBe(
            "3 people lost their Owner role on task notes because they are not on the destination project. Moving back restores the role."
        );
    });

    it("is plural-safe: one person reads as one person", () => {
        expect(moveNoticeText({ notesNarrowed: 1 })).toMatch(/^1 person lost their Owner role/);
        expect(moveNoticeText({ reportersOutsideDestination: 1 })).toBe(
            "1 person who filed these tasks is not on the destination project or its team."
        );
    });

    it("words the reporters neutrally: no promise about access either way", () => {
        const text = moveNoticeText({ reportersOutsideDestination: 4 })!;
        expect(text).toBe(
            "4 people who filed these tasks are not on the destination project or its team."
        );
        expect(text).not.toMatch(/access|keep|lose|lost|still/i);
    });

    it("puts both sentences in one notice when both counts are above 0", () => {
        expect(moveNoticeText({ notesNarrowed: 2, reportersOutsideDestination: 1 })).toBe(
            `${fmt(t().notesNarrowed, { count: 2 })} ${fmt(t().reportersOutsideDestination, { count: 1 })}`
        );
    });

    it.each([
        ["no fields (an API from before this change)", {}],
        ["zero counts", { notesNarrowed: 0, reportersOutsideDestination: 0 }],
        ["null counts", { notesNarrowed: null, reportersOutsideDestination: null }],
        ["counts that are not numbers", { notesNarrowed: "3", reportersOutsideDestination: true }],
        ["negative or NaN counts", { notesNarrowed: -1, reportersOutsideDestination: NaN }],
        ["no body at all", undefined],
    ])("shows nothing for %s", (_name, answer) => {
        expect(moveNoticeText(answer)).toBeNull();
    });
});

describe("a task moved to another project", () => {
    const moveAnswer = (extra: Record<string, unknown>) => ({
        ...SAVED,
        movedFromProjectId: 1,
        ...extra,
    });

    it("shows the notice for notesNarrowed > 0", async () => {
        answerWith(200, moveAnswer({ notesNarrowed: 2, reportersOutsideDestination: 0 }));
        const list = toasts();

        await sendUpdatedSpecificTask(null, myself, moved(), false, "tok");

        expect(list.result.current).toHaveLength(1);
        expect(textOf(list.result.current[0].message)).toBe(fmt(t().notesNarrowed, { count: 2 }));
        // Calm: the neutral tone, not the danger one a refusal uses.
        expect(list.result.current[0].tone).toBe("neutral");
        expect(bus).toEqual([]);
    });

    it("shows the notice for reportersOutsideDestination > 0", async () => {
        answerWith(200, moveAnswer({ notesNarrowed: 0, reportersOutsideDestination: 3 }));
        const list = toasts();

        await sendUpdatedSpecificTask(null, myself, moved(), false, "tok");

        expect(list.result.current.map((i) => textOf(i.message))).toEqual([
            fmt(t().reportersOutsideDestination, { count: 3 }),
        ]);
    });

    it("a move with sub-tasks: one notice for the whole subtree, and its cached copies forgotten", async () => {
        // The server sums the moved task and every sub-task that went with it,
        // so the person reads ONE notice, not one per sub-task.
        answerWith(200, moveAnswer({ notesNarrowed: 5, reportersOutsideDestination: 2 }));
        const list = toasts();

        await sendUpdatedSpecificTask(null, myself, moved(), false, "tok");

        expect(forgetCachedSubtree).toHaveBeenCalledWith(42, 1);
        expect(list.result.current).toHaveLength(1);
        expect(textOf(list.result.current[0].message)).toBe(
            `${fmt(t().notesNarrowed, { count: 5 })} ${fmt(t().reportersOutsideDestination, { count: 2 })}`
        );
    });

    it("shows nothing when both counts are 0", async () => {
        answerWith(200, moveAnswer({ notesNarrowed: 0, reportersOutsideDestination: 0 }));
        const list = toasts();

        await sendUpdatedSpecificTask(null, myself, moved(), false, "tok");

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(list.result.current).toEqual([]);
    });

    it("shows nothing when the answer has no such fields (API before #892)", async () => {
        answerWith(200, moveAnswer({}));
        const list = toasts();

        await sendUpdatedSpecificTask(null, myself, moved(), false, "tok");

        expect(adapter).toHaveBeenCalledTimes(1);
        expect(list.result.current).toEqual([]);
    });

    it("shows nothing for a save that did not move the task", async () => {
        answerWith(200, { ...SAVED, notesNarrowed: 4, reportersOutsideDestination: 4 });
        const list = toasts();

        await sendUpdatedSpecificTask(null, myself, makeTask(), false, "tok");

        expect(list.result.current).toEqual([]);
    });
});

describe("a task move the server refuses: assignee_not_on_destination", () => {
    it("throws the typed refusal with the code and shows the server's sentence", async () => {
        answerWith(400, REFUSAL);

        const saving = sendUpdatedSpecificTask(null, myself, moved(), true, "tok");

        await expect(saving).rejects.toBeInstanceOf(TaskSaveRefusedError);
        await expect(saving).rejects.toMatchObject({
            code: "assignee_not_on_destination",
            serverMessage: REFUSAL.error,
        });
        expect(bus[bus.length - 1]).toEqual(["serverMessage", REFUSAL.error]);
    });

    it("shows a sentence that names a sub-task by its display id, as written", async () => {
        const sentence =
            "KDS-47 is assigned to u-zed, who is not on the destination project or its team. Nothing was changed.";
        answerWith(400, { error: sentence, code: "assignee_not_on_destination" });

        await expect(
            sendUpdatedSpecificTask(null, myself, moved(), true, "tok")
        ).rejects.toMatchObject({ serverMessage: sentence });

        expect(bus[bus.length - 1]).toEqual(["serverMessage", sentence]);
        expect(forgetCachedSubtree).not.toHaveBeenCalled();
    });

    it("shows no move notice and writes nothing to the caches", async () => {
        answerWith(400, REFUSAL);
        const list = toasts();

        await expect(
            sendUpdatedSpecificTask(null, myself, moved(), true, "tok")
        ).rejects.toBeInstanceOf(TaskSaveRefusedError);

        expect(list.result.current).toEqual([]);
    });
});

// The preview's save loop, as TaskPreview wires it.
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
    });
    useTaskSaveTriggers(state, send);
    return { state, preview, send };
};

describe("the preview after a refused move", () => {
    it("puts the task back in its project, keeps the other edits and sends them again", async () => {
        adapter
            .mockImplementationOnce(async (config: InternalAxiosRequestConfig) => {
                throw new AxiosError("failed", "ERR_BAD_REQUEST", config, null, {
                    data: REFUSAL,
                    status: 400,
                    statusText: "",
                    headers: {},
                    config,
                });
            })
            .mockImplementation(async (config: InternalAxiosRequestConfig) => ({
                data: SAVED,
                status: 200,
                statusText: "OK",
                headers: {},
                config,
            }));
        const hook = renderHook(() => useHarness(moved()));

        act(() => hook.result.current.state.setTaskUpdated(true));
        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(hook.result.current.state.taskUpdated).toBe(false));
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 150)));

        // The stored task was asked for in the project it is stored in.
        expect(loadSpecificTask.mock.calls[0][1]).toBe(1);
        // First send carried the move and the status edit.
        expect(putBody(0).project).toBe(2);
        expect(putBody(0).status).toBe("WIP");
        // The reason stays on screen, as the server wrote it.
        expect(bus.filter(([kind]) => kind === "serverMessage")).toEqual([
            ["serverMessage", REFUSAL.error],
        ]);
        // Sent again WITHOUT the move and WITH the other edit; once, so no loop.
        expect(adapter).toHaveBeenCalledTimes(2);
        expect(putBody(1).project).toBe(1);
        expect(putBody(1).status).toBe("WIP");
        expect(putBody(1).milestone).toBe(9);
        expect(putBody(1).tags).toEqual([{ tagId: 7 }]);
        // The working copy and the preview task are back in the old project,
        // with the status edit kept.
        const { state, preview } = hook.result.current;
        expect(state.tmpCurrentTaskContent.project?.projectId).toBe(1);
        expect(state.tmpCurrentTaskContent.status.status).toBe("WIP");
        expect(state.tmpCurrentTaskContent.milestoneId).toBe(9);
        expect(preview?.project?.projectId).toBe(1);
        expect(preview?.status.status).toBe("WIP");
    });

    it("does not 'put back' to a copy that is in the destination: no resend loop", async () => {
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
            throw new AxiosError("failed", "ERR_BAD_REQUEST", config, null, {
                data: REFUSAL,
                status: 400,
                statusText: "",
                headers: {},
                config,
            });
        });
        // A stale copy that already shows the destination.
        getCachedFullTask.mockResolvedValue(moved());
        loadSpecificTask.mockResolvedValue([moved()]);
        const hook = renderHook(() => useHarness(moved()));

        act(() => hook.result.current.state.setTaskUpdated(true));
        await waitFor(() => expect(hook.result.current.state.taskUpdated).toBe(false));
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 250)));

        expect(adapter).toHaveBeenCalledTimes(1);
    });

    it("falls back to the full put-back when the stored task cannot be read", async () => {
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
            throw new AxiosError("failed", "ERR_BAD_REQUEST", config, null, {
                data: REFUSAL,
                status: 400,
                statusText: "",
                headers: {},
                config,
            });
        });
        getCachedFullTask.mockResolvedValue(undefined);
        loadSpecificTask.mockResolvedValue([]);
        const hook = renderHook(() => useHarness(moved()));

        act(() => hook.result.current.state.setTaskUpdated(true));
        await waitFor(() => expect(hook.result.current.state.taskUpdated).toBe(false));
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 150)));

        // Nothing is sent again (no loop on the refused values).
        expect(adapter).toHaveBeenCalledTimes(1);
    });
});

describe("a milestone moved to another project", () => {
    it("shows the notice when the move answer carries counts", async () => {
        answerWith(200, {
            milestone: { milestoneId: 5 },
            notesNarrowed: 1,
            reportersOutsideDestination: 2,
        });
        const list = toasts();

        const res = await updateMilestone({ milestoneId: 5, projectId: 2 }, "tok");

        expect(res).toBeDefined();
        expect(adapter.mock.calls[0][0].method).toBe("patch");
        expect(list.result.current.map((i) => textOf(i.message))).toEqual([
            `${fmt(t().notesNarrowed, { count: 1 })} ${fmt(t().reportersOutsideDestination, { count: 2 })}`,
        ]);
    });

    it("shows nothing for 0 or missing counts", async () => {
        const list = toasts();
        answerWith(200, {
            milestone: { milestoneId: 5 },
            notesNarrowed: 0,
            reportersOutsideDestination: 0,
        });
        await updateMilestone({ milestoneId: 5, projectId: 2 }, "tok");
        answerWith(200, { milestone: { milestoneId: 5 } });
        await updateMilestone({ milestoneId: 5, projectId: 2 }, "tok");

        expect(adapter).toHaveBeenCalledTimes(2);
        expect(list.result.current).toEqual([]);
    });

    it("shows nothing for a save that is not a move", async () => {
        answerWith(200, { milestone: { milestoneId: 5 }, notesNarrowed: 3 });
        const list = toasts();

        await updateMilestone({ milestoneId: 5, title: "New" }, "tok");

        expect(list.result.current).toEqual([]);
    });

    it("shows the server's sentence on the refusal and says the move was refused", async () => {
        answerWith(400, REFUSAL);
        const onMoveRefused = vi.fn();

        const res = await updateMilestone({ milestoneId: 5, projectId: 2 }, "tok", undefined, {
            onMoveRefused,
        });

        expect(res).toBeUndefined();
        expect(bus[bus.length - 1]).toEqual(["serverMessage", REFUSAL.error]);
        expect(onMoveRefused).toHaveBeenCalledTimes(1);
    });

    it("does not treat another 400 as a refused move", async () => {
        answerWith(400, { error: "something else", code: "other" });
        const onMoveRefused = vi.fn();

        await updateMilestone({ milestoneId: 5, projectId: 2 }, "tok", undefined, {
            onMoveRefused,
        });

        expect(onMoveRefused).not.toHaveBeenCalled();
        expect(bus.filter(([kind]) => kind === "serverMessage")).toEqual([]);
    });
});

describe("a refused milestone move leaves the other edits to send", () => {
    it("takes out the project and the tags the pick cleared, keeps the rest", () => {
        const patch = { milestoneId: 5, projectId: 2, tags: [], status: "WIP", dueDate: null };
        expect(dropRefusedMove(patch)).toBe(true);
        expect(patch).toEqual({ milestoneId: 5, status: "WIP", dueDate: null });
    });

    it("says there is nothing left to send when the move was the whole patch", () => {
        const patch = { milestoneId: 5, projectId: 2, tags: [] };
        expect(dropRefusedMove(patch)).toBe(false);
        expect(patch).toEqual({ milestoneId: 5 });
    });
});
