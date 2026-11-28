import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSelfDisplayZone } from "../../hooks/common/useSelfDisplayZone";

// MIP-2229 (exhaustive-deps, careful part): the user-profile status editor's
// zone memo keeps its exact timing.

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
