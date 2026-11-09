// MIP-1324: a project-task load that FAILS while the project list loads is not an
// unhandled promise rejection. `loadProjectsAndTasks` is awaited by an un-awaited IIFE in
// the `[myself]` effect, so the rejection of `loadProjectTasks` escaped as an
// "Unhandled Rejection: Failed to load project tasks" on every boot with the endpoint down.
//
// Fails at the REQUEST: the tasks worker channel rejects (what a failed
// `/task/getProjectTasks/` becomes), the real `loadProjectTasks` and the real
// `syncStatus` sit in between.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tasksChannel } from "../db/workers/channels";
import { useProjectManagement } from "../hooks/common/useProjectManagement";
import { syncStatus } from "../services/syncStatus";
import type { UserProps } from "../types/admin";

vi.mock("../db/workers/channels", () => ({ tasksChannel: { request: vi.fn() } }));
vi.mock("../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: vi.fn(async () => [
        {
            projectId: 5,
            projectName: "Alpha",
            projectTags: [],
            projectLabels: [],
            isPrivate: false,
            systemUserId: "sys",
            isJoined: true,
        },
    ]),
}));

const request = tasksChannel.request as ReturnType<typeof vi.fn>;
const myself = { teamId: "team-1", userId: "u1" } as UserProps;

const unhandled: unknown[] = [];
const onUnhandled = (e: unknown) => unhandled.push(e);

beforeEach(() => {
    unhandled.length = 0;
    request.mockReset();
    syncStatus.__reset();
    localStorage.clear();
    process.on("unhandledRejection", onUnhandled);
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
    vi.restoreAllMocks();
});

const flushRejections = () => new Promise((r) => setTimeout(r, 20));

describe("loadProjectsAndTasks when the project's tasks fail to load", () => {
    // This one first: every hook's boot effect leaves a 500 ms timer behind, and a
    // timer left by the other test would add a request to this one's count.
    it("the boot effect (un-awaited) raises no unhandled rejection, and a later load recovers", async () => {
        request.mockRejectedValueOnce(new Error("Failed to load project tasks"));
        const { result } = renderHook(() => useProjectManagement(myself, "tok", "team-1"));

        // The effect waits 500 ms, then calls it inside an IIFE nobody awaits.
        await waitFor(() => expect(request).toHaveBeenCalled(), { timeout: 3000 });
        const callsAtBoot = request.mock.calls.length;
        await flushRejections();
        expect(unhandled).toEqual([]);
        expect(syncStatus.getSnapshot().failed).toContain("tasks");

        // Retry (the banner's Retry re-runs the same loader): the request now succeeds.
        request.mockResolvedValueOnce("done");
        await act(async () => {
            await result.current.refreshProjectTasks(5);
        });
        expect(request).toHaveBeenCalledTimes(callsAtBoot + 1);
        expect(syncStatus.getSnapshot().failed).not.toContain("tasks");
    });

    it("resolves, logs, records the failure in the sync status, and still announces the project", async () => {
        request.mockRejectedValueOnce(new Error("Failed to load project tasks"));
        const { result } = renderHook(() => useProjectManagement(myself, "tok", "team-1"));

        await act(async () => {
            await result.current.loadProjectsAndTasks(-1);
        });
        await flushRejections();

        expect(unhandled).toEqual([]);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining("project 5"),
            expect.any(Error)
        );
        // The banner and its Retry exist because loadProjectTasks reported it.
        expect(syncStatus.getSnapshot().failed).toContain("tasks");
        // The table still reads whatever IndexedDB holds for the picked project.
        expect(result.current.currentProject?.projectId).toBe(5);
        expect(result.current.tsTasksLoadedToIDB?.projectId).toBe(5);
    });
});
