/**
 * MIP-1042: the conversion calls and the milestone read that follows a
 * conversion. A refused conversion carries the server's code and sentence; the
 * shared "request failed" toast is off for these calls (the caller shows the
 * sentence), and a converted milestone's 410 is an answer, not a failure.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    convertMilestoneToTask,
    convertTaskToMilestone,
} from "../features/tasks/sprint-milestone/services/convertTaskMilestone";
import { lookupMilestone } from "../features/tasks/sprint-milestone/services/loadMilestone";

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

const reply = (status: number, data: unknown) =>
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        const response = { data, status, statusText: "", headers: {}, config };
        // Mirror axios: a status `validateStatus` rejects becomes an error.
        const ok = config.validateStatus ? config.validateStatus(status) : status < 300;
        if (ok) return response;
        throw new AxiosError(`status ${status}`, "ERR_BAD_REQUEST", config, null, response);
    });

describe("convertTaskToMilestone", () => {
    it("posts the task id and returns the milestone and the task row", async () => {
        const body = {
            milestone: { milestoneId: 5, taskId: 10 },
            task: {
                taskId: 10,
                displayId: "MIP-10",
                projectId: 1,
                isMilestone: true,
                milestoneId: 5,
            },
        };
        reply(200, body);

        const res = await convertTaskToMilestone(10, "tok");

        expect(res).toEqual({ ok: true, data: body });
        const sent = adapter.mock.calls[0][0];
        expect(sent.url).toBe("/task/convert-to-milestone/");
        expect(sent.method).toBe("post");
        expect(JSON.parse(sent.data)).toEqual({ task_id: 10 });
    });

    it("turns the shared error toast off (the caller shows the server's sentence)", async () => {
        reply(200, {});
        await convertTaskToMilestone(10, "tok");
        expect(adapter.mock.calls[0][0].suppressErrorToast).toBe(true);
    });

    it("carries the server's code and sentence when it refuses", async () => {
        reply(400, {
            error: "Only a task with no parent can become a milestone.",
            code: "not_a_root_task",
        });

        const res = await convertTaskToMilestone(10, "tok");

        expect(res).toEqual({
            ok: false,
            status: 400,
            code: "not_a_root_task",
            message: "Only a task with no parent can become a milestone.",
        });
    });

    it("reports a failure with no response (offline) without throwing", async () => {
        adapter.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
        expect(await convertTaskToMilestone(10, "tok")).toEqual({
            ok: false,
            status: null,
            code: null,
            message: null,
        });
    });

    it("sends nothing without a token", async () => {
        const res = await convertTaskToMilestone(10, null);
        expect(res.ok).toBe(false);
        expect(adapter).not.toHaveBeenCalled();
    });
});

describe("convertMilestoneToTask", () => {
    it("posts the milestone id", async () => {
        const body = {
            task: {
                taskId: 10,
                displayId: "MIP-10",
                projectId: 1,
                isMilestone: false,
                milestoneId: null,
            },
            convertedMilestoneId: 5,
            subTasksKept: 3,
        };
        reply(200, body);

        const res = await convertMilestoneToTask(5, "tok");

        expect(res).toEqual({ ok: true, data: body });
        const sent = adapter.mock.calls[0][0];
        expect(sent.url).toBe("/milestone/convert-to-task/");
        expect(JSON.parse(sent.data)).toEqual({ milestone_id: 5 });
        expect(sent.suppressErrorToast).toBe(true);
    });

    it("answers a missing milestone with the 404", async () => {
        reply(404, { error: "Milestone not found." });
        const res = await convertMilestoneToTask(5, "tok");
        expect(res).toMatchObject({ ok: false, status: 404, message: "Milestone not found." });
    });
});

describe("lookupMilestone", () => {
    const ref = {
        taskId: 10,
        displayId: "MIP-10",
        projectId: 1,
        isMilestone: false,
        milestoneId: null,
    };

    it("returns the milestone when it exists", async () => {
        reply(200, { milestone: { milestoneId: 5, title: "M" } });
        expect(await lookupMilestone(5, "tok")).toEqual({
            kind: "found",
            milestone: { milestoneId: 5, title: "M" },
        });
    });

    it("follows a 410 'converted' answer to the task it names, without an error", async () => {
        reply(410, { code: "milestone_converted_to_task", convertedToTask: ref });

        const res = await lookupMilestone(5, "tok");

        expect(res).toEqual({ kind: "converted", task: ref });
        // The 410 was accepted as an answer: no error was logged for it.
        expect(console.error).not.toHaveBeenCalled();
    });

    it("treats a 410 that isn't the converted answer as missing", async () => {
        reply(410, { error: "gone" });
        expect(await lookupMilestone(5, "tok")).toEqual({ kind: "missing" });
    });

    it("treats a plain 404 as missing", async () => {
        reply(404, { error: "Milestone not found." });
        expect(await lookupMilestone(5, "tok")).toEqual({ kind: "missing" });
    });
});
