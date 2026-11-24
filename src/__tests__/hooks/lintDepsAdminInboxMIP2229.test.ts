import { act } from "react";
import { renderHook } from "@testing-library/react";
import type { VirtuosoHandle } from "react-virtuoso";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollToBottomOnNewItem } from "../../features/inbox/hooks/inboxHooks";
import { useSelfDisplayZone } from "../../hooks/common/useSelfDisplayZone";
import type { InboxItemProps } from "../../types/common";

// MIP-2229 (exhaustive-deps, careful part): the user-profile status editor's
// zone memo and the inbox scroll effect keep their exact timing.

describe("useSelfDisplayZone", () => {
    it("prefers the manual location, then the saved timezone", () => {
        expect(
            renderHook(() =>
                useSelfDisplayZone({ currentLocation: "Asia/Tokyo", timezone: "Europe/Paris" })
            ).result.current
        ).toBe("Asia/Tokyo");
        expect(
            renderHook(() => useSelfDisplayZone({ timezone: "Europe/Paris" })).result.current
        ).toBe("Europe/Paris");
    });

    it("falls back to the browser zone, and to UTC when nothing resolves", () => {
        const spy = vi
            .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
            .mockReturnValue({ timeZone: "" } as Intl.ResolvedDateTimeFormatOptions);
        expect(renderHook(() => useSelfDisplayZone({})).result.current).toBe("UTC");
        spy.mockRestore();
    });

    it("follows a change of either field and keeps the value for a new equal object", () => {
        const { result, rerender } = renderHook((p) => useSelfDisplayZone(p), {
            initialProps: { currentLocation: "Asia/Tokyo", timezone: "Europe/Paris" },
        });
        expect(result.current).toBe("Asia/Tokyo");
        rerender({ currentLocation: "Asia/Tokyo", timezone: "Europe/Paris" });
        expect(result.current).toBe("Asia/Tokyo");
        rerender({ currentLocation: "America/New_York", timezone: "Europe/Paris" });
        expect(result.current).toBe("America/New_York");
        rerender({ currentLocation: undefined as unknown as string, timezone: "Europe/Paris" });
        expect(result.current).toBe("Europe/Paris");
    });
});

describe("useScrollToBottomOnNewItem", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const handle = () => ({ scrollToIndex: vi.fn() });
    const items = (n: number) => Array.from({ length: n }, () => ({})) as InboxItemProps[];

    it("scrolls to the top 300ms after the inbox changes, once per change", () => {
        const h = handle();
        const ref = { current: h as unknown as VirtuosoHandle };
        const { rerender } = renderHook(({ inbox }) => useScrollToBottomOnNewItem(ref, inbox), {
            initialProps: { inbox: items(1) },
        });
        act(() => {
            vi.advanceTimersByTime(299);
        });
        expect(h.scrollToIndex).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(h.scrollToIndex).toHaveBeenCalledTimes(1);
        expect(h.scrollToIndex).toHaveBeenCalledWith({ index: 0, behavior: "auto" });

        rerender({ inbox: items(2) });
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(h.scrollToIndex).toHaveBeenCalledTimes(2);
    });

    it("does nothing while the list is not mounted, and not on an unrelated re-render", () => {
        const empty = { current: null } as unknown as React.RefObject<VirtuosoHandle>;
        const inbox = items(1);
        renderHook(() => useScrollToBottomOnNewItem(empty, inbox));
        act(() => {
            vi.advanceTimersByTime(500);
        });

        const h = handle();
        const ref = { current: h as unknown as VirtuosoHandle };
        const { rerender } = renderHook(() => useScrollToBottomOnNewItem(ref, inbox));
        act(() => {
            vi.advanceTimersByTime(300);
        });
        rerender();
        rerender();
        act(() => {
            vi.advanceTimersByTime(600);
        });
        expect(h.scrollToIndex).toHaveBeenCalledTimes(1);
    });
});
