/**
 * MIP-1042: what the app does when a conversion is confirmed. After the server
 * says yes, local state follows without a reload: the milestone list, the
 * table's rows, the converted row's caches, and the open preview, which switches
 * to the other kind. On a refusal the person reads the server's sentence and
 * nothing changes locally. The real services run over a stubbed transport.
 */
import { act, renderHook } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConvertTaskMilestone } from "../features/tasks/hooks/useConvertTaskMilestone";
import { subscribeRequestErrors } from "../services/requestErrorNotifier";
import { TaskTableProps } from "../types/tasks";

const invalidateCachedFullTask = vi.fn().mockResolvedValue(undefined);
vi.mock("../db/services/task-full.service", () => ({
    invalidateCachedFullTask: (...a: unknown[]) => invalidateCachedFullTask(...a),
}));
const forgetInFlightTask = vi.fn();
vi.mock("../features/tasks/services/taskLoadInFlight", () => ({
    forgetInFlightTask: (...a: unknown[]) => forgetInFlightTask(...a),
}));

const adapter = vi.fn();
let originalAdapter: typeof axios.defaults.adapter;
let bus: Array<[string, string | undefined]> = [];
let unsubscribe: () => void = () => {};
let now = 0;

beforeEach(() => {
    now += 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    invalidateCachedFullTask.mockClear();
    forgetInFlightTask.mockClear();
    bus = [];
    unsubscribe = subscribeRequestErrors(((kind: string, text?: string) =>
        bus.push([kind, text])) as never);
});
afterEach(() => {
    unsubscribe();
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

const reply = (status: number, data: unknown) =>
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        const response = { data, status, statusText: "", headers: {}, config };
        if (status < 300) return response;
        throw new AxiosError(`status ${status}`, "ERR_BAD_REQUEST", config, null, response);
    });

const row = (id: number, over: Partial<TaskTableProps> = {}) =>
    ({
        id: String(id),
        parentTaskId: null,
        rootTaskId: id,
        milestoneId: null,
        sprintId: null,
        isMilestone: false,
        ...over,
    }) as unknown as TaskTableProps;
const rows = () => [row(10), row(11, { parentTaskId: "10", rootTaskId: 10 }), row(20)];

const stores = (filterId: number | null = null) => {
    const useTM = {
        setAllTasks: vi.fn(),
        setCurrentPreviewTaskId: vi.fn(),
        setCurrentPreviewMilestoneId: vi.fn(),
        setIsTaskPreviewVisible: vi.fn(),
        loadTask: vi.fn().mockResolvedValue(undefined),
        tableMilestoneFilterId: filterId,
        setTableMilestoneFilter: vi.fn(),
    };
    const useSM = { applyMilestoneToState: vi.fn(), forgetMilestone: vi.fn() };
    return { useTM, useSM };
};
const mount = (s: ReturnType<typeof stores>) =>
    renderHook(() =>
        useConvertTaskMilestone({
            accessToken: "tok",
            useTM: s.useTM as never,
            useSM: s.useSM as never,
        })
    ).result.current;

/** The rows `setAllTasks` was asked to produce from `before`. */
const producedRows = (s: ReturnType<typeof stores>, before: TaskTableProps[]) =>
    (s.useTM.setAllTasks.mock.calls[0][0] as (r: TaskTableProps[]) => TaskTableProps[])(before);

describe("task -> milestone", () => {
    const answer = {
        milestone: { milestoneId: 5, taskId: 10, projectId: 1 },
        task: { taskId: 10, displayId: "MIP-10", projectId: 1, isMilestone: true, milestoneId: 5 },
    };

    it("brings local state along, then shows the milestone", async () => {
        reply(200, answer);
        const s = stores();
        const convert = mount(s);

        let ok = false;
        await act(async () => {
            ok = await convert.toMilestone(10);
        });

        expect(ok).toBe(true);
        expect(s.useSM.applyMilestoneToState).toHaveBeenCalledWith(answer.milestone);
        const after = producedRows(s, rows());
        expect(after.find((r) => r.id === "10")).toMatchObject({
            isMilestone: true,
            milestoneId: 5,
        });
        expect(after.find((r) => r.id === "11")).toMatchObject({
            milestoneId: 5,
            parentTaskId: "10",
        });
        expect(after.find((r) => r.id === "20")).toMatchObject({ milestoneId: null });
        expect(s.useTM.setCurrentPreviewMilestoneId).toHaveBeenCalledWith(5);
        expect(s.useTM.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
        // The row's cached copy described a task.
        expect(invalidateCachedFullTask).toHaveBeenCalledWith(10);
        expect(forgetInFlightTask).toHaveBeenCalledWith(10);
        expect(bus).toEqual([]);
    });

    it("on a refusal says why in the server's words and changes nothing", async () => {
        reply(400, {
            error: "Only a task with no parent can become a milestone.",
            code: "not_a_root_task",
        });
        const s = stores();
        const convert = mount(s);

        let ok = true;
        await act(async () => {
            ok = await convert.toMilestone(10);
        });

        expect(ok).toBe(false);
        expect(bus).toEqual([
            ["serverMessage", "Only a task with no parent can become a milestone."],
        ]);
        expect(s.useSM.applyMilestoneToState).not.toHaveBeenCalled();
        expect(s.useTM.setAllTasks).not.toHaveBeenCalled();
        expect(s.useTM.setCurrentPreviewMilestoneId).not.toHaveBeenCalled();
        expect(invalidateCachedFullTask).not.toHaveBeenCalled();
    });

    it("falls back to the generic toast when the server gave no sentence", async () => {
        adapter.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
        const s = stores();
        const convert = mount(s);
        await act(async () => {
            await convert.toMilestone(10);
        });
        expect(bus).toEqual([["requestFailed", undefined]]);
    });

    it("is a no-op when the host has no milestone store", async () => {
        const s = stores();
        const convert = renderHook(() =>
            useConvertTaskMilestone({
                accessToken: "tok",
                useTM: s.useTM as never,
                useSM: undefined,
            })
        ).result.current;

        expect(await convert.toMilestone(10)).toBe(false);
        expect(adapter).not.toHaveBeenCalled();
    });
});

describe("milestone -> task", () => {
    const answer = {
        task: {
            taskId: 10,
            displayId: "MIP-10",
            projectId: 1,
            isMilestone: false,
            milestoneId: null,
        },
        convertedMilestoneId: 5,
        subTasksKept: 1,
    };
    const asMilestone = () => [
        row(10, { isMilestone: true, milestoneId: 5, sprintId: 4 }),
        row(11, { parentTaskId: "10", rootTaskId: 10, milestoneId: 5, sprintId: 4 }),
        row(20),
    ];

    it("forgets the milestone locally, puts the rows back, and shows the task", async () => {
        reply(200, answer);
        const s = stores();
        const convert = mount(s);

        let ok = false;
        await act(async () => {
            ok = await convert.toTask(5, 1);
        });

        expect(ok).toBe(true);
        // Dropped from local state; the server's DELETE is never called.
        expect(s.useSM.forgetMilestone).toHaveBeenCalledWith(5, 1);
        expect(adapter).toHaveBeenCalledTimes(1);
        const after = producedRows(s, asMilestone());
        expect(after.find((r) => r.id === "10")).toMatchObject({
            isMilestone: false,
            milestoneId: null,
            sprintId: null,
        });
        expect(after.find((r) => r.id === "11")).toMatchObject({
            milestoneId: null,
            sprintId: null,
            parentTaskId: "10",
        });
        expect(s.useTM.setCurrentPreviewTaskId).toHaveBeenCalledWith(10);
        expect(s.useTM.loadTask).toHaveBeenCalledWith(1, 10);
        expect(s.useTM.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
        expect(invalidateCachedFullTask).toHaveBeenCalledWith(10);
    });

    it("clears a table scope that was narrowed to this milestone, and only that one", async () => {
        reply(200, answer);
        const scoped = stores(5);
        const convertScoped = mount(scoped);
        await act(async () => {
            await convertScoped.toTask(5, 1);
        });
        expect(scoped.useTM.setTableMilestoneFilter).toHaveBeenCalledWith(null);

        reply(200, answer);
        const other = stores(99);
        const convertOther = mount(other);
        await act(async () => {
            await convertOther.toTask(5, 1);
        });
        expect(other.useTM.setTableMilestoneFilter).not.toHaveBeenCalled();
    });

    it("on a refusal changes nothing", async () => {
        reply(404, { error: "Milestone not found.", code: "milestone_not_found" });
        const s = stores();
        const convert = mount(s);
        await act(async () => {
            await convert.toTask(5, 1);
        });

        expect(bus).toEqual([["serverMessage", "Milestone not found."]]);
        expect(s.useSM.forgetMilestone).not.toHaveBeenCalled();
        expect(s.useTM.setAllTasks).not.toHaveBeenCalled();
        expect(s.useTM.setCurrentPreviewTaskId).not.toHaveBeenCalled();
    });
});
