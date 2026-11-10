// MIP-1399: a stale `localStorage.lastProjectId` (a project deleted, left, or lost) opened
// "No project selected" although the workspace has projects: `loadProjectsAndTasks` only
// ever looked for the remembered id in the list.
//
// Fails at the REQUEST: the project list answer and the tasks worker channel are the
// mocks (a 404 reaches the main thread as "... (HTTP 404)"); the real `loadProjectTasks`
// and the real `syncStatus` sit in between.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tasksChannel } from "../db/workers/channels";
import { loadTeamProjects } from "../features/tasks/services/loadTeamProjects";
import { useProjectManagement } from "../hooks/common/useProjectManagement";
import { syncStatus } from "../services/syncStatus";
import type { UserProps } from "../types/admin";

vi.mock("../db/workers/channels", () => ({ tasksChannel: { request: vi.fn() } }));
vi.mock("../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: vi.fn(),
}));

const request = tasksChannel.request as ReturnType<typeof vi.fn>;
const listMock = loadTeamProjects as unknown as ReturnType<typeof vi.fn>;
// No userId: the hook's own boot effect stays out of the way; the tests call the loader.
const myself = { teamId: "team-1", userId: "" } as UserProps;

const listed = (projectId: number, isJoined = true) => ({
    projectId,
    projectName: `P${projectId}`,
    projectTags: [],
    projectLabels: [],
    isPrivate: false,
    systemUserId: "sys",
    isJoined,
});
const requestedProjects = () =>
    request.mock.calls.map(([, payload]) => (payload as { projectId: number }).projectId);

beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue("done");
    listMock.mockReset();
    syncStatus.__reset();
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const open = async (target: number) => {
    const view = renderHook(() => useProjectManagement(myself, "tok", "team-1"));
    await act(async () => {
        await view.result.current.loadProjectsAndTasks(target);
    });
    return view;
};

describe("loadProjectsAndTasks with a remembered project", () => {
    it("falls back to the first joined project and clears the value when the list does not hold it", async () => {
        listMock.mockResolvedValue([listed(7, false), listed(5), listed(6)]);
        localStorage.setItem("lastProjectId", "999999");

        const view = await open(999999);

        expect(view.result.current.currentProject?.projectId).toBe(5);
        expect(requestedProjects()).toEqual([5]); // the stale id is never asked for
        expect(localStorage.getItem("lastProjectId")).toBeNull();
    });

    it("clears the value and opens nothing when the list is empty", async () => {
        listMock.mockResolvedValue([]);
        localStorage.setItem("lastProjectId", "999999");

        const view = await open(999999);

        expect(view.result.current.currentProject).toBeNull();
        expect(localStorage.getItem("lastProjectId")).toBeNull();
    });

    it("keeps a remembered project the list holds", async () => {
        listMock.mockResolvedValue([listed(5), listed(6)]);
        localStorage.setItem("lastProjectId", "6");

        const view = await open(6);

        expect(view.result.current.currentProject?.projectId).toBe(6);
        expect(requestedProjects()).toEqual([6]);
        expect(localStorage.getItem("lastProjectId")).toBe("6");
    });

    it("moves to the first other joined project, and forgets the value, when the listed project answers 404", async () => {
        listMock.mockResolvedValue([listed(5), listed(6)]);
        localStorage.setItem("lastProjectId", "6");
        request.mockRejectedValueOnce(new Error("Failed to load project tasks (HTTP 404)"));

        const view = await open(6);

        await waitFor(() => expect(view.result.current.currentProject?.projectId).toBe(5));
        expect(requestedProjects()).toEqual([6, 5]);
        expect(localStorage.getItem("lastProjectId")).toBeNull();
        // A project that is gone is forgotten, not failed: no banner for it.
        expect(syncStatus.getSnapshot().failed).toEqual([]);
        expect(view.result.current.tsTasksLoadedToIDB?.projectId).toBe(5);
    });

    it("shows no project when the only joined project answers 404", async () => {
        listMock.mockResolvedValue([listed(6), listed(7, false)]);
        localStorage.setItem("lastProjectId", "6");
        request.mockRejectedValueOnce(new Error("Failed to load project tasks (HTTP 404)"));

        const view = await open(6);

        expect(view.result.current.currentProject).toBeNull();
        expect(localStorage.getItem("lastProjectId")).toBeNull();
    });

    it("keeps the project on any other failure (server down, 500)", async () => {
        listMock.mockResolvedValue([listed(5), listed(6)]);
        localStorage.setItem("lastProjectId", "6");
        request.mockRejectedValueOnce(new Error("Failed to load project tasks (HTTP 500)"));

        const view = await open(6);

        expect(view.result.current.currentProject?.projectId).toBe(6);
        expect(localStorage.getItem("lastProjectId")).toBe("6");
        expect(syncStatus.getSnapshot().failed).toContain("tasks:6");
    });

    it("leaves a value another tab changed meanwhile alone", async () => {
        listMock.mockResolvedValue([listed(5)]);
        localStorage.setItem("lastProjectId", "5");

        await open(999999);

        expect(localStorage.getItem("lastProjectId")).toBe("5");
    });
});
