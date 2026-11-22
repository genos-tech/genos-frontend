/**
 * MIP-1906: a failed milestone load must not read as "this project has no milestones".
 *
 * `loadMilestonesForProject` used to store `res?.milestones ?? []`, so a request that
 * FAILED wiped a list that was already loaded and, on a first load, wrote an empty list the
 * sidebar, the pickers and the dashboard showed as "no milestones". It now behaves like
 * `loadSprintsChecked`: a failure keeps what was there, and `milestonesFailed` says so.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Milestone } from "../features/tasks/sprint-milestone/types";
import { useSprintMilestoneManagement } from "../hooks/tasks/useSprintMilestoneManagement";

const loadProjectMilestonesMock = vi.fn();
vi.mock("../features/tasks/sprint-milestone/services", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    loadProjectMilestones: (...args: unknown[]) => loadProjectMilestonesMock(...args),
}));

const PROJECT_ID = 1;
const milestone = (milestoneId: number): Milestone =>
    ({
        milestoneId,
        projectId: PROJECT_ID,
        title: `M${milestoneId}`,
        status: "Open",
    }) as Milestone;

const renderSM = () => renderHook(() => useSprintMilestoneManagement("tok"));
const load = async (hook: ReturnType<typeof renderSM>) => {
    let out: Milestone[] = [];
    await act(async () => {
        out = await hook.result.current.loadMilestonesForProject(PROJECT_ID);
    });
    return out;
};

beforeEach(() => loadProjectMilestonesMock.mockReset());

describe("loadMilestonesForProject on a failed request (MIP-1906)", () => {
    it("keeps the loaded list and flags the failure", async () => {
        const hook = renderSM();
        loadProjectMilestonesMock.mockResolvedValueOnce({ milestones: [milestone(5)] });
        await load(hook);
        expect(hook.result.current.projectMilestones[PROJECT_ID]).toHaveLength(1);
        expect(hook.result.current.milestonesFailed[PROJECT_ID]).toBeFalsy();
        const stamp = hook.result.current.tsLastMilestonesLoaded;

        loadProjectMilestonesMock.mockResolvedValueOnce(undefined);
        const returned = await load(hook);
        expect(returned).toHaveLength(1);
        expect(hook.result.current.projectMilestones[PROJECT_ID]).toHaveLength(1);
        expect(hook.result.current.milestonesFailed[PROJECT_ID]).toBe(true);
        expect(hook.result.current.tsLastMilestonesLoaded).toBe(stamp);
    });

    it("leaves the key absent when the very first load fails, so it is not 'no milestones'", async () => {
        const hook = renderSM();
        loadProjectMilestonesMock.mockResolvedValueOnce(undefined);
        const returned = await load(hook);
        expect(returned).toEqual([]);
        expect(PROJECT_ID in hook.result.current.projectMilestones).toBe(false);
        expect(hook.result.current.milestonesFailed[PROJECT_ID]).toBe(true);
    });

    it("clears the flag once a later load works, and a real empty project stays an empty list", async () => {
        const hook = renderSM();
        loadProjectMilestonesMock.mockResolvedValueOnce(undefined);
        await load(hook);
        loadProjectMilestonesMock.mockResolvedValueOnce({ milestones: [] });
        await load(hook);
        expect(hook.result.current.projectMilestones[PROJECT_ID]).toEqual([]);
        expect(hook.result.current.milestonesFailed[PROJECT_ID]).toBe(false);
    });
});
