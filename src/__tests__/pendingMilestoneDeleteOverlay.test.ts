/**
 * A milestone whose delete waits behind its Undo toast (MIP-1303) reads as Deleted in
 * `useSM.projectMilestones` at once, so the milestone sidebar and the pickers drop it
 * like the table does. The raw state stays the truth for every write and refetch.
 *
 * Two-sided, like the `allTasks` overlay: the SAME object while nothing applies (a new
 * identity re-runs every sidebar / picker selector), a real overlay while it is pending.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Milestone } from "../features/tasks/sprint-milestone/types";
import {
    overlayPendingMilestoneDeletes,
    taskDeleteKey,
} from "../features/tasks/utils/pendingTaskDelete";
import { __resetUndoables, flushUndoables, runUndoable } from "../hooks/common/useUndoableAction";
import { useSprintMilestoneManagement } from "../hooks/tasks/useSprintMilestoneManagement";

const milestone = (milestoneId: number, taskId: number | null, status = "Open"): Milestone =>
    ({
        milestoneId,
        taskId,
        projectId: 10,
        title: `Milestone ${milestoneId}`,
        status,
    }) as unknown as Milestone;

const world = () => ({ 10: [milestone(1, 101), milestone(2, 102)], 11: [milestone(3, 103)] });

const startDelete = (taskId: number, key = taskDeleteKey(taskId)) =>
    act(() =>
        runUndoable({
            key,
            message: "Milestone deleted",
            errorMessage: "failed",
            commit: () => Promise.resolve(),
            keepOnNavigate: true,
            releaseOnCommit: true,
        })
    );

afterEach(() => {
    __resetUndoables();
    vi.clearAllMocks();
});

describe("overlayPendingMilestoneDeletes", () => {
    it("is the SAME object when nothing is pending", () => {
        const by = world();
        expect(overlayPendingMilestoneDeletes(by, new Set())).toBe(by);
    });

    it("is the same object for a key of another kind, or of a task that is no milestone's", () => {
        const by = world();
        expect(overlayPendingMilestoneDeletes(by, new Set(["task-comment:5:9"]))).toBe(by);
        expect(overlayPendingMilestoneDeletes(by, new Set([taskDeleteKey(999)]))).toBe(by);
    });

    it("shows the milestone whose backing task is pending as Deleted and nothing else", () => {
        const by = world();
        const next = overlayPendingMilestoneDeletes(by, new Set([taskDeleteKey(101)]));
        expect(next[10][0]).toEqual({ ...by[10][0], status: "Deleted" });
        // The other milestone of the bucket, and the other bucket, are the same objects.
        expect(next[10][1]).toBe(by[10][1]);
        expect(next[11]).toBe(by[11]);
        // The input is not touched.
        expect(by[10][0].status).toBe("Open");
    });

    it("leaves a milestone with no backing task alone", () => {
        const by = { 10: [milestone(1, null)] };
        expect(overlayPendingMilestoneDeletes(by, new Set([taskDeleteKey(1)]))).toBe(by);
    });
});

describe("useSM.projectMilestones while a milestone delete is pending", () => {
    const setup = () => {
        const view = renderHook(() => useSprintMilestoneManagement("token"));
        act(() => view.result.current.setProjectMilestones(world()));
        return view;
    };

    it("is the SAME object when nothing is pending", () => {
        const { result, rerender } = setup();
        const before = result.current.projectMilestones;
        rerender();
        expect(result.current.projectMilestones).toBe(before);
    });

    it("shows the pending milestone as Deleted at once, and Undo brings it back", () => {
        const { result } = setup();
        const before = result.current.projectMilestones;
        startDelete(101);
        expect(result.current.projectMilestones[10][0].status).toBe("Deleted");
        expect(result.current.projectMilestones[10][1].status).toBe("Open");
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true }));
        });
        expect(result.current.projectMilestones).toEqual(before);
    });

    it("a refetch in the window cannot resurrect it", () => {
        const { result } = setup();
        startDelete(101);
        act(() => result.current.setProjectMilestones(world()));
        expect(result.current.projectMilestones[10][0].status).toBe("Deleted");
    });
});
