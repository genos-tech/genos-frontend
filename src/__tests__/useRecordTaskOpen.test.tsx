/**
 * Recording an open (MIP-1063): once per task shown, never for a placeholder,
 * and the sidebar is told only after the server has it.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOnTaskOpened } from "../features/tasks/hooks/useOnTaskOpened";
import { useRecordTaskOpen } from "../features/tasks/hooks/useRecordTaskOpen";

const recordTaskOpen = vi.fn();
vi.mock("../features/tasks/services/recentTasks", () => ({
    recordTaskOpen: (...a: unknown[]) => recordTaskOpen(...a),
}));
let token: string | null = "tok";
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: token }) }));

const flush = () => act(async () => {});

beforeEach(() => {
    recordTaskOpen.mockReset();
    recordTaskOpen.mockResolvedValue(true);
    token = "tok";
});

describe("useRecordTaskOpen", () => {
    it("records the task that is shown", async () => {
        renderHook(() => useRecordTaskOpen(7));
        await flush();
        expect(recordTaskOpen).toHaveBeenCalledTimes(1);
        expect(recordTaskOpen).toHaveBeenCalledWith(7, "tok");
    });

    it.each([[null], [undefined], [0], [-1], [Number.NaN]])(
        "records nothing for %s (nothing real is shown)",
        async (id) => {
            renderHook(() => useRecordTaskOpen(id));
            await flush();
            expect(recordTaskOpen).not.toHaveBeenCalled();
        }
    );

    it("does not record again for a re-render or a refreshed token", async () => {
        const { rerender } = renderHook(() => useRecordTaskOpen(7));
        await flush();
        token = "tok2";
        rerender();
        rerender();
        await flush();
        expect(recordTaskOpen).toHaveBeenCalledTimes(1);
    });

    it("records each task as it is switched to, and a return to an earlier one", async () => {
        const { rerender } = renderHook(({ id }) => useRecordTaskOpen(id), {
            initialProps: { id: 1 as number | null },
        });
        rerender({ id: 2 });
        rerender({ id: 1 });
        await flush();
        expect(recordTaskOpen.mock.calls.map((c) => c[0])).toEqual([1, 2, 1]);
    });

    it("counts the same task shown again after nothing was shown as a new open", async () => {
        const { rerender } = renderHook(({ id }) => useRecordTaskOpen(id), {
            initialProps: { id: 5 as number | null },
        });
        rerender({ id: null });
        rerender({ id: 5 });
        await flush();
        expect(recordTaskOpen).toHaveBeenCalledTimes(2);
    });

    it("waits for a session: no token, no post, then one once it arrives", async () => {
        token = null;
        const { rerender } = renderHook(() => useRecordTaskOpen(9));
        await flush();
        expect(recordTaskOpen).not.toHaveBeenCalled();
        token = "tok";
        rerender();
        await flush();
        expect(recordTaskOpen).toHaveBeenCalledTimes(1);
    });
});

describe("telling the sidebar", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("reloads Recents after the server recorded the open, once for a burst", async () => {
        const reload = vi.fn();
        renderHook(() => useOnTaskOpened(reload, 500));
        const { rerender } = renderHook(({ id }) => useRecordTaskOpen(id), {
            initialProps: { id: 1 },
        });
        rerender({ id: 2 });
        rerender({ id: 3 });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(reload).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("does not reload when the open was not recorded", async () => {
        recordTaskOpen.mockResolvedValue(false);
        const reload = vi.fn();
        renderHook(() => useOnTaskOpened(reload, 500));
        renderHook(() => useRecordTaskOpen(1));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(reload).not.toHaveBeenCalled();
    });
});
