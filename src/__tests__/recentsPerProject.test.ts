/**
 * Sidebar Recents: the tasks the user OPENED, 20 per PROJECT (not 20 in total).
 *
 * The grouping must key on projectId so two projects that happen to share a name
 * stay separate groups, and order by when the user opened a task (`tsOpened`), not
 * by when anyone last edited it (MIP-1063). `loadTeamTaskList`'s per-project
 * parameter stays for its other callers.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadTeamTaskList } from "../features/tasks/services/loadTaskSearchList";
import { groupRecentTasks, RECENTS_PER_PROJECT } from "../features/tasks/utils/groupRecentTasks";
import { UserProps } from "../types/admin";
import { SearchTeamTasksResponse } from "../types/tasks";

const get = vi.fn();
vi.mock("../services/api", () => ({ authApi: () => ({ get }) }));

const myself = { teamId: "team-1" } as unknown as UserProps;

const task = (
    taskId: number,
    projectId: number,
    projectName: string,
    tsOpened: string | undefined,
    tsUpdated = "2026-01-01T00:00:00Z"
): SearchTeamTasksResponse =>
    ({
        taskId,
        projectId,
        projectName,
        systemUserId: `sys-${projectId}`,
        projectTags: [],
        title: `t${taskId}`,
        status: {},
        tsUpdated,
        tsOpened,
    }) as unknown as SearchTeamTasksResponse;

describe("loadTeamTaskList top_n_per_project", () => {
    beforeEach(() => {
        get.mockReset();
        get.mockResolvedValue({ data: [] });
    });

    it("sends top_n_per_project when given", async () => {
        await loadTeamTaskList(myself, -1, "open,wip,blocked,pending", 20, "tok", true, 20);
        const url: string = get.mock.calls[0][0];
        expect(url).toContain("top_n_per_project=20");
        expect(url).toContain("statuses=open,wip,blocked,pending");
    });

    it("omits it by default so other callers keep the global cap", async () => {
        await loadTeamTaskList(myself, -1, "open", -1, "tok", false);
        expect(get.mock.calls[0][0]).not.toContain("top_n_per_project");
    });
});

describe("the per-project limit", () => {
    it("is 20", () => {
        expect(RECENTS_PER_PROJECT).toBe(20);
    });
});

describe("groupRecentTasks", () => {
    it("keeps same-named projects with different ids as separate groups", () => {
        const groups = groupRecentTasks([
            task(1, 10, "Website", "2026-01-02T00:00:00Z"),
            task(2, 11, "Website", "2026-01-01T00:00:00Z"),
        ]);
        expect(groups.map((g) => g.projectId)).toEqual([10, 11]);
        expect(groups.map((g) => g.tasks.length)).toEqual([1, 1]);
    });

    it("does not cap the total: 20 + 20 across two projects all render", () => {
        const rows = [
            ...Array.from({ length: 20 }, (_, i) =>
                task(i, 10, "A", `2026-01-01T00:${String(i).padStart(2, "0")}:00Z`)
            ),
            ...Array.from({ length: 20 }, (_, i) =>
                task(100 + i, 11, "B", `2026-01-02T00:${String(i).padStart(2, "0")}:00Z`)
            ),
        ];
        const groups = groupRecentTasks(rows);
        expect(groups).toHaveLength(2);
        expect(groups.reduce((n, g) => n + g.tasks.length, 0)).toBe(40);
        // Most recently opened project first; tasks newest open first.
        expect(groups[0].projectId).toBe(11);
        expect(groups[0].tasks[0].taskId).toBe(119);
    });

    it("orders by when the task was opened, not by when it was last edited", () => {
        const groups = groupRecentTasks([
            // Edited yesterday but opened a week ago ...
            task(1, 10, "A", "2026-01-01T00:00:00Z", "2026-02-09T00:00:00Z"),
            // ... opened today, last edited long ago.
            task(2, 10, "A", "2026-02-10T00:00:00Z", "2025-01-01T00:00:00Z"),
        ]);
        expect(groups[0].tasks.map((t) => t.taskId)).toEqual([2, 1]);
    });

    it("lists the project you opened something in most recently first", () => {
        const groups = groupRecentTasks([
            task(1, 10, "Edited a lot", "2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z"),
            task(2, 11, "Opened today", "2026-02-10T00:00:00Z", "2025-01-01T00:00:00Z"),
        ]);
        expect(groups.map((g) => g.projectId)).toEqual([11, 10]);
    });

    it("sorts a row with no open time last instead of first", () => {
        const groups = groupRecentTasks([
            task(1, 10, "A", undefined, "2026-03-01T00:00:00Z"),
            task(2, 10, "A", "2025-01-01T00:00:00Z"),
        ]);
        expect(groups[0].tasks.map((t) => t.taskId)).toEqual([2, 1]);
    });
});
