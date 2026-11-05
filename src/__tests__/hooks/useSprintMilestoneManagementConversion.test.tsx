/**
 * MIP-1042: the milestone store's two conversion hooks.
 *
 *   - Reading a milestone that became a task fills `convertedMilestones`, which
 *     an open preview or an old link follows to the task.
 *   - `forgetMilestone` drops a milestone from local state WITHOUT deleting it on
 *     the server: it became a task, it is not gone.
 */
import { act, renderHook } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSprintMilestoneManagement } from "../../hooks/tasks/useSprintMilestoneManagement";

vi.mock("../../db/services/task-full.service", () => ({
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../features/tasks/services/taskLoadInFlight", () => ({ forgetInFlightTask: vi.fn() }));
vi.mock("../../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(null),
}));

const adapter = vi.fn();
let originalAdapter: typeof axios.defaults.adapter;
beforeEach(() => {
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

const answerBy = (handler: (config: InternalAxiosRequestConfig) => [number, unknown]) =>
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        const [status, data] = handler(config);
        const response = { data, status, statusText: "", headers: {}, config };
        const ok = config.validateStatus ? config.validateStatus(status) : status < 300;
        if (ok) return response;
        throw new AxiosError(`status ${status}`, "ERR_BAD_REQUEST", config, null, response);
    });

const milestone = (id: number, taskId: number) => ({
    milestoneId: id,
    taskId,
    projectId: 1,
    title: `M${id}`,
    assignees: [],
    tags: [],
});
const ref = {
    taskId: 10,
    displayId: "MIP-10",
    projectId: 1,
    isMilestone: false,
    milestoneId: null,
};

describe("refreshMilestone on a milestone that became a task", () => {
    it("records where it went, and returns null", async () => {
        answerBy(() => [410, { code: "milestone_converted_to_task", convertedToTask: ref }]);
        const { result } = renderHook(() => useSprintMilestoneManagement("tok"));

        let found: unknown = "unset";
        await act(async () => {
            found = await result.current.refreshMilestone(5);
        });

        expect(found).toBeNull();
        expect(result.current.convertedMilestones).toEqual({ 5: ref });
    });

    it("does not record a plain 404", async () => {
        answerBy(() => [404, { error: "Milestone not found." }]);
        const { result } = renderHook(() => useSprintMilestoneManagement("tok"));
        await act(async () => {
            await result.current.refreshMilestone(5);
        });
        expect(result.current.convertedMilestones).toEqual({});
    });

    it("does not record a milestone that exists", async () => {
        answerBy(() => [200, { milestone: milestone(5, 10) }]);
        const { result } = renderHook(() => useSprintMilestoneManagement("tok"));
        await act(async () => {
            await result.current.refreshMilestone(5);
        });
        expect(result.current.convertedMilestones).toEqual({});
        expect(result.current.projectMilestones[1]?.map((m) => m.milestoneId)).toEqual([5]);
    });
});

describe("forgetMilestone", () => {
    it("drops the milestone from local state and never calls the server", async () => {
        answerBy(() => [200, { milestone: milestone(5, 10) }]);
        const { result } = renderHook(() => useSprintMilestoneManagement("tok"));
        await act(async () => {
            await result.current.refreshMilestone(5);
        });
        expect(result.current.projectMilestones[1]).toHaveLength(1);
        adapter.mockClear();

        act(() => result.current.forgetMilestone(5, 1));

        expect(result.current.projectMilestones[1]).toEqual([]);
        expect(adapter).not.toHaveBeenCalled();
    });

    it("keeps the other milestones", async () => {
        let n = 0;
        answerBy(() => [200, { milestone: milestone(++n === 1 ? 5 : 6, n === 1 ? 10 : 11) }]);
        const { result } = renderHook(() => useSprintMilestoneManagement("tok"));
        await act(async () => {
            await result.current.refreshMilestone(5);
        });
        await act(async () => {
            await result.current.refreshMilestone(6);
        });

        act(() => result.current.forgetMilestone(5, 1));

        expect(result.current.projectMilestones[1].map((m) => m.milestoneId)).toEqual([6]);
    });
});
