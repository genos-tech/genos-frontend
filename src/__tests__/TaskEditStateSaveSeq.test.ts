import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useTaskEditState } from "../hooks/tasks/useTaskEditState";
import { TaskProps } from "../types/tasks";

// The intermittent "I changed the status, the preview showed it, then the
// table showed the old one — and reopening the task showed the old one
// too".
//
// Nothing was reverting. The metadata-save effect in TaskPreview was keyed
// on the `taskUpdated` BOOLEAN, and React coalesces `setState(true)` while
// the value is already true. An edit made while a previous save was still
// in flight therefore produced no state change, no effect re-run, and was
// never PUT — it lived only in local preview state until the next reload
// dropped it.
//
// `taskUpdateSeq` gives every save REQUEST its own identity so none can be
// swallowed.
describe("useTaskEditState save-request counter", () => {
    const task = { id: 1, title: "t" } as unknown as TaskProps;

    it("bumps the counter on each setTaskUpdated(true)", () => {
        const { result } = renderHook(() => useTaskEditState(task));
        const start = result.current.taskUpdateSeq;

        act(() => result.current.setTaskUpdated(true));
        expect(result.current.taskUpdateSeq).toBe(start + 1);

        act(() => result.current.setTaskUpdated(true));
        expect(result.current.taskUpdateSeq).toBe(start + 2);
    });

    it("bumps even while the boolean is ALREADY true — the swallowed-edit case", () => {
        const { result } = renderHook(() => useTaskEditState(task));

        act(() => result.current.setTaskUpdated(true));
        const afterFirst = result.current.taskUpdateSeq;
        expect(result.current.taskUpdated).toBe(true);

        // Second edit lands mid-save: the boolean does not change...
        act(() => result.current.setTaskUpdated(true));
        expect(result.current.taskUpdated).toBe(true);
        // ...but the request counter must, or this save is lost.
        expect(result.current.taskUpdateSeq).toBe(afterFirst + 1);
    });

    it("coalesces two edits in ONE batch into a single save request", () => {
        // Both land in one React batch (e.g. a picker that sets the
        // milestone and the auto-synced sprint together) — one save is
        // correct there, and one is what the counter reports.
        const { result } = renderHook(() => useTaskEditState(task));
        const start = result.current.taskUpdateSeq;

        act(() => {
            result.current.setTaskUpdated(true);
            result.current.setTaskUpdated(true);
        });

        expect(result.current.taskUpdateSeq).toBe(start + 2);
    });

    it("does NOT bump when a save completes (setTaskUpdated(false))", () => {
        const { result } = renderHook(() => useTaskEditState(task));

        act(() => result.current.setTaskUpdated(true));
        const afterEdit = result.current.taskUpdateSeq;

        act(() => result.current.setTaskUpdated(false));
        expect(result.current.taskUpdated).toBe(false);
        // Finishing a save is not a new save request — bumping here would
        // make the effect fire a second, redundant PUT.
        expect(result.current.taskUpdateSeq).toBe(afterEdit);
    });
});
