/**
 * MIP-1972: after a milestone is picked, the table must show its loading skeleton until the
 * rows are filtered for THAT milestone, and never the previous milestone's rows.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAppliedMilestoneScope } from "../features/tasks/hooks/useAppliedMilestoneScope";

afterEach(cleanup);

describe("useAppliedMilestoneScope", () => {
    it("is settled on first render, with or without a scope", () => {
        expect(renderHook(() => useAppliedMilestoneScope(null)).result.current.settled).toBe(true);
        expect(renderHook(() => useAppliedMilestoneScope(7)).result.current.settled).toBe(true);
    });

    it("is unsettled the moment the scope changes, until the filter's write lands", () => {
        const { result, rerender } = renderHook(({ id }) => useAppliedMilestoneScope(id), {
            initialProps: { id: null as number | null },
        });
        rerender({ id: 5 });
        expect(result.current.settled).toBe(false);
        const write = vi.fn();
        act(() => result.current.apply(write));
        expect(write).toHaveBeenCalledTimes(1);
        expect(result.current.settled).toBe(true);
    });

    it("stamps the write with the scope of the render, not a later one", () => {
        const { result, rerender } = renderHook(({ id }) => useAppliedMilestoneScope(id), {
            initialProps: { id: 1 as number | null },
        });
        rerender({ id: 2 });
        act(() => result.current.apply(() => {}));
        expect(result.current.settled).toBe(true);
        // Switching again to a third milestone: unsettled again, settled by its own write.
        rerender({ id: 3 });
        expect(result.current.settled).toBe(false);
        act(() => result.current.apply(() => {}));
        expect(result.current.settled).toBe(true);
    });

    it("leaving the scope (back to all tasks) also waits for the rows", () => {
        const { result, rerender } = renderHook(({ id }) => useAppliedMilestoneScope(id), {
            initialProps: { id: 4 as number | null },
        });
        rerender({ id: null });
        expect(result.current.settled).toBe(false);
        act(() => result.current.apply(() => {}));
        expect(result.current.settled).toBe(true);
    });
});

describe("milestone switch gate and store", () => {
    it("hides the rows and shows the skeleton from the click until the switch ends", async () => {
        const { render, screen } = await import("@testing-library/react");
        const { MilestoneSwitchGate } = await import(
            "../features/tasks/components/table/MilestoneSwitchGate"
        );
        const store = await import("../features/tasks/state/milestoneSwitchStore");
        render(
            <MilestoneSwitchGate skeleton={<div>skeleton</div>}>
                <div>old rows</div>
            </MilestoneSwitchGate>
        );
        expect(screen.queryByText("skeleton")).toBeNull();
        expect(screen.getByText("old rows").parentElement?.style.display).toBe("");

        act(() => store.beginMilestoneSwitch(9));
        expect(screen.getByText("skeleton")).toBeTruthy();
        expect(screen.getByText("old rows").parentElement?.style.display).toBe("none");
        expect(store.getPendingMilestoneSwitch()).toBe(9);

        act(() => store.endMilestoneSwitch());
        expect(screen.queryByText("skeleton")).toBeNull();
        expect(screen.getByText("old rows").parentElement?.style.display).toBe("");
    });

    it("clears a switch that never completes", async () => {
        vi.useFakeTimers();
        const store = await import("../features/tasks/state/milestoneSwitchStore");
        store.beginMilestoneSwitch(3);
        vi.advanceTimersByTime(6100);
        expect(store.getPendingMilestoneSwitch()).toBeNull();
        vi.useRealTimers();
    });

    it("applies the filter write at once while a switch is pending", async () => {
        const store = await import("../features/tasks/state/milestoneSwitchStore");
        const { result, rerender } = renderHook(({ id }) => useAppliedMilestoneScope(id), {
            initialProps: { id: null as number | null },
        });
        rerender({ id: 5 });
        store.beginMilestoneSwitch(5);
        const write = vi.fn();
        act(() => result.current.apply(write));
        expect(write).toHaveBeenCalled();
        expect(result.current.settled).toBe(true);
        store.endMilestoneSwitch();
    });
});
