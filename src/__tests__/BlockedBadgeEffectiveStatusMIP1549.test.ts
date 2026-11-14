import { describe, expect, it } from "vitest";

import { isCurrentlyBlocked } from "../features/tasks/components/contents/base/TaskDependenciesBlock";
import { buildOpenBlockerCountByTask } from "../features/tasks/diagram/components/TaskFlowCanvas";
import type { TaskGraph } from "../features/tasks/diagram/types";
import { isOpenBlockerStatus, refBlocks } from "../features/tasks/utils/blockerStatus";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { TaskDependencyRef, TaskTableProps } from "../types/tasks";

/**
 * MIP-1549: the Blocked badge must agree with the server (api MIP-1544). A blocker under a Closed
 * or Deleted parent reads as Closed or Deleted there, so the dependent stays Open. The dependency
 * endpoints send that reading as `effectiveStatus`; the client reads it and never walks ancestors
 * for a blocker it may not have loaded.
 */

const ref = (
    own: string,
    effectiveStatus?: string | null,
    dependencyId = 1
): TaskDependencyRef => ({
    dependencyId,
    otherTaskId: 100 + dependencyId,
    displayId: `GEN-${100 + dependencyId}`,
    projectId: 1,
    projectName: "Genos",
    title: "Blocker",
    status: { code: 0, status: own, color: "", textColor: "" },
    ...(effectiveStatus === undefined ? {} : { effectiveStatus }),
    assigneeUserId: null,
    isMilestone: false,
});

const tm = (blockedBy: TaskDependencyRef[]): TaskManagementState =>
    ({ taskDependencies: { 7: { blocking: [], blockedBy } } }) as unknown as TaskManagementState;

describe("isCurrentlyBlocked reads the blocker's effective status", () => {
    it("a WIP blocker under a Closed parent does not block", () => {
        expect(isCurrentlyBlocked(7, tm([ref("WIP", "Closed")]))).toBe(false);
    });

    it("a WIP blocker under a Deleted parent does not block", () => {
        expect(isCurrentlyBlocked(7, tm([ref("WIP", "Deleted")]))).toBe(false);
    });

    it("a normal open blocker still blocks", () => {
        expect(isCurrentlyBlocked(7, tm([ref("WIP", "WIP")]))).toBe(true);
        expect(isCurrentlyBlocked(7, tm([ref("Open", "Open")]))).toBe(true);
    });

    it("reopening the parent flips it back (the refetched ref reads the blocker's own status)", () => {
        expect(isCurrentlyBlocked(7, tm([ref("WIP", "Closed")]))).toBe(false);
        expect(isCurrentlyBlocked(7, tm([ref("WIP", "WIP")]))).toBe(true);
    });

    it("one open blocker among resolved ones keeps the badge", () => {
        const refs = [ref("WIP", "Closed", 1), ref("Closed", "Closed", 2), ref("Open", "Open", 3)];
        expect(isCurrentlyBlocked(7, tm(refs))).toBe(true);
        expect(isCurrentlyBlocked(7, tm(refs.slice(0, 2)))).toBe(false);
    });

    it("a payload without the field falls back to the blocker's own status", () => {
        expect(isCurrentlyBlocked(7, tm([ref("WIP")]))).toBe(true);
        expect(isCurrentlyBlocked(7, tm([ref("Closed")]))).toBe(false);
        expect(isCurrentlyBlocked(7, tm([ref("WIP", null)]))).toBe(true);
    });

    it("no entry, no task id, no blockers: not blocked", () => {
        expect(isCurrentlyBlocked(null, tm([ref("WIP")]))).toBe(false);
        expect(isCurrentlyBlocked(8, tm([ref("WIP")]))).toBe(false);
        expect(isCurrentlyBlocked(7, tm([]))).toBe(false);
    });

    it("is case-insensitive like the server's own-status check", () => {
        expect(isOpenBlockerStatus("CLOSED")).toBe(false);
        expect(refBlocks(ref("wip", "closed"))).toBe(false);
    });
});

const row = (id: number, status: string, parentTaskId: number | null = null): TaskTableProps =>
    ({
        id: String(id),
        title: `t${id}`,
        status,
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        projectId: 1,
    }) as unknown as TaskTableProps;

const graphOf = (
    tasks: TaskTableProps[],
    dependencyEdges: Array<Record<string, unknown>>
): TaskGraph =>
    ({ rootTaskId: 1, tasks, externalTasks: [], dependencyEdges }) as unknown as TaskGraph;

const status = (label: string) => ({ code: 0, status: label, color: "", textColor: "" });

describe("the diagram's open-blocker count follows the same rule", () => {
    // 1 (root) > 2 (blocker, WIP) ; 3 depends on 2.
    const tree = (rootStatus: string) => [row(1, rootStatus), row(2, "WIP", 1), row(3, "Open", 1)];

    it("counts an open blocker", () => {
        const counts = buildOpenBlockerCountByTask(
            graphOf(tree("Open"), [
                {
                    dependencyId: 1,
                    blockerTaskId: 2,
                    blockedTaskId: 3,
                    otherStatus: status("WIP"),
                    blockerStatus: "WIP",
                },
            ])
        );
        expect(counts.get(3)).toBe(1);
    });

    it("does not count a blocker the server reads as Closed (it sits above this tree)", () => {
        const counts = buildOpenBlockerCountByTask(
            graphOf(tree("Open"), [
                {
                    dependencyId: 1,
                    blockerTaskId: 2,
                    blockedTaskId: 3,
                    otherStatus: status("WIP"),
                    blockerStatus: "Closed",
                },
            ])
        );
        expect(counts.get(3)).toBeUndefined();
    });

    it("does not count a WIP blocker under a Closed parent in the tree, and reopening flips it", () => {
        const edge = [
            { dependencyId: 1, blockerTaskId: 2, blockedTaskId: 3, otherStatus: status("Open") },
        ];
        expect(buildOpenBlockerCountByTask(graphOf(tree("Closed"), edge)).get(3)).toBeUndefined();
        expect(buildOpenBlockerCountByTask(graphOf(tree("Open"), edge)).get(3)).toBe(1);
    });

    it("an edge from the blocker's `blocking` list judges the blocker, not the blocked task", () => {
        // `otherStatus` is the BLOCKED task's (Open) here; the blocker 2 is Closed.
        const counts = buildOpenBlockerCountByTask(
            graphOf(
                [row(1, "Open"), row(2, "Closed", 1), row(3, "Open", 1)],
                [
                    {
                        dependencyId: 1,
                        blockerTaskId: 2,
                        blockedTaskId: 3,
                        otherStatus: status("Open"),
                    },
                ]
            )
        );
        expect(counts.get(3)).toBeUndefined();
    });

    it("a ghost blocker with no reading falls back to its status, as before", () => {
        const counts = buildOpenBlockerCountByTask(
            graphOf(tree("Open"), [
                { dependencyId: 1, blockerTaskId: 90, blockedTaskId: 3, otherStatus: null },
                {
                    dependencyId: 2,
                    blockerTaskId: 91,
                    blockedTaskId: 3,
                    otherStatus: status("Closed"),
                },
            ])
        );
        expect(counts.get(3)).toBe(1);
    });
});
