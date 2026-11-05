/**
 * MIP-970 step 5: `useProjectTaskManagement` no longer has a focus handler.
 *
 * It used to add its own, unthrottled, `focus` listener that reloaded the open
 * project's tasks AND its sprints on every focus, next to the throttled
 * `#`-menu refresh in App. Both now go through `useChangeRefresher` (mounted in
 * App, one throttled `/changes/` call), so a focus here must cost nothing.
 */
import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { loadProjectTasks } from "../../features/tasks/services/loadProjectTasks";
import { useProjectTaskManagement } from "../../hooks/common/useProjectTaskManagement";

vi.mock("../../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: vi.fn(async () => undefined),
}));
vi.mock("../../features/tasks/services/loadProjectTasks", () => ({
    loadProjectTasks: vi.fn(async () => undefined),
}));
vi.mock("../../features/tasks/services/popSpecificProjectTasks", () => ({
    popSpecificProjectTasks: vi.fn(async () => []),
}));
const sm = vi.hoisted(() => ({
    loadSprintsForProject: vi.fn(async () => undefined),
    refreshSprintsForProject: vi.fn(async () => true),
}));
vi.mock("../../hooks/tasks/useSprintMilestoneManagement", () => {
    const stub = {
        ...sm,
        loadConfigForProject: vi.fn(async () => undefined),
        loadMilestonesForProject: vi.fn(async () => undefined),
        refreshMilestone: vi.fn(async () => undefined),
        initializeSprintMilestoneStates: vi.fn(),
    };
    return { useSprintMilestoneManagement: () => stub };
});

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, null, children);

const settle = () =>
    act(async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    });

describe("useProjectTaskManagement focus", () => {
    it("a window focus reloads neither the project's tasks nor its sprints", async () => {
        const view = renderHook(
            () =>
                useProjectTaskManagement({
                    myself: { userId: "u1", teamId: "t1", userName: "Me", userEmail: "m@x.io" },
                    accessToken: "token",
                    currentTeamId: "",
                }),
            { wrapper }
        );
        act(() =>
            view.result.current.usePM.setCurrentProject({
                projectId: 10,
                projectName: "P",
                projectTags: [],
            } as never)
        );
        await settle();
        const tasksBefore = vi.mocked(loadProjectTasks).mock.calls.length;
        const sprintsBefore = sm.loadSprintsForProject.mock.calls.length;

        await act(async () => void window.dispatchEvent(new Event("focus")));
        await settle();

        expect(vi.mocked(loadProjectTasks).mock.calls.length).toBe(tasksBefore);
        expect(sm.loadSprintsForProject.mock.calls.length).toBe(sprintsBefore);
    });
});
