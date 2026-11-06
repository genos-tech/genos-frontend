/**
 * The two calls behind the sidebar's Recents (MIP-1063): read the user's opened
 * tasks, and record that one was opened.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadRecentTasks, recordTaskOpen } from "../features/tasks/services/recentTasks";
import { UserProps } from "../types/admin";

const get = vi.fn();
const post = vi.fn();
vi.mock("../services/api", () => ({ authApi: () => ({ get, post }) }));

const myself = { teamId: "team-1" } as unknown as UserProps;
const httpError = (status: number) =>
    Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status } });

beforeEach(() => {
    get.mockReset();
    post.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    // A spy keeps its calls across tests unless it is restored.
    vi.restoreAllMocks();
});

describe("loadRecentTasks", () => {
    it("asks for the user's list in the current team", async () => {
        get.mockResolvedValue({ data: [{ taskId: 1 }] });
        expect(await loadRecentTasks(myself, "tok")).toEqual([{ taskId: 1 }]);
        expect(get).toHaveBeenCalledWith("/task/recent/", { params: { team_id: "team-1" } });
    });

    it("resolves undefined on a failure, so the caller keeps the list it has", async () => {
        get.mockRejectedValue(httpError(500));
        expect(await loadRecentTasks(myself, "tok")).toBeUndefined();
    });

    it("resolves undefined for an answer that is not a list", async () => {
        get.mockResolvedValue({ data: { error: "x" } });
        expect(await loadRecentTasks(myself, "tok")).toBeUndefined();
    });
});

describe("recordTaskOpen", () => {
    it("posts the task id and says it was recorded", async () => {
        post.mockResolvedValue({ data: {} });
        expect(await recordTaskOpen(42, "tok")).toBe(true);
        expect(post).toHaveBeenCalledWith("/task/recent/open/", { task_id: 42 });
    });

    it("a 404 (a draft, or a task the user cannot open) is not recorded and not logged", async () => {
        post.mockRejectedValue(httpError(404));
        expect(await recordTaskOpen(42, "tok")).toBe(false);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("any other failure is not recorded and is logged", async () => {
        post.mockRejectedValue(httpError(500));
        expect(await recordTaskOpen(42, "tok")).toBe(false);
        expect(console.error).toHaveBeenCalled();
    });
});
