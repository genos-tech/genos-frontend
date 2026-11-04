/**
 * MIP-1015: the project's milestone list must ask for Blocked milestones.
 *
 * `GET /milestone/list/` filters by `statuses` on the server, and the API
 * moves a milestone to "Blocked" by itself when a dependency blocks it. A
 * loader that leaves "Blocked" out never receives that milestone, so after
 * a project load it is missing from the sidebar, the task filter, the
 * milestone picker and the dashboard until something upserts it one by one.
 *
 * Both of this hook's loaders are pinned here: the one that runs when the
 * project opens, and the one that runs after a bulk change (an agent plan, a
 * bulk update). "Deleted" must stay out: with no `statuses` at all the API
 * returns every milestone row that is not soft-deleted, "Deleted" status
 * included.
 */
import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { emitTasksBulkChanged } from "../../features/tasks/services/taskEvents";
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
    loadMilestonesForProject: vi.fn(async () => undefined),
}));
vi.mock("../../hooks/tasks/useSprintMilestoneManagement", () => {
    const stub = {
        ...sm,
        loadSprintsForProject: vi.fn(async () => undefined),
        refreshSprintsForProject: vi.fn(async () => true),
        loadConfigForProject: vi.fn(async () => undefined),
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

/** Every live milestone status, in no particular order. */
const EXPECTED = ["Blocked", "Closed", "Open", "Pending", "WIP"];

const statusesOf = (call: unknown[]): string[] =>
    [...((call[1] as { statuses: readonly string[] }).statuses ?? [])].sort();

const openProject = async () => {
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
    return view;
};

describe("useProjectTaskManagement milestone list statuses", () => {
    it("the project load asks for Blocked milestones and not Deleted ones", async () => {
        sm.loadMilestonesForProject.mockClear();
        await openProject();

        expect(sm.loadMilestonesForProject).toHaveBeenCalledTimes(1);
        const call = sm.loadMilestonesForProject.mock.calls[0] as unknown[];
        expect(call[0]).toBe(10);
        expect(statusesOf(call)).toEqual(EXPECTED);
    });

    it("the reload after a bulk change asks for Blocked milestones too", async () => {
        await openProject();
        sm.loadMilestonesForProject.mockClear();

        await act(async () => emitTasksBulkChanged(10));
        await settle();

        expect(sm.loadMilestonesForProject).toHaveBeenCalledTimes(1);
        const call = sm.loadMilestonesForProject.mock.calls[0] as unknown[];
        expect(call[0]).toBe(10);
        expect(statusesOf(call)).toEqual(EXPECTED);
    });
});
