/**
 * The client-side upload guard must follow the user's PLAN, not a
 * constant.
 *
 * This is pinned here because the failure it replaces was invisible:
 * `MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024` sat below every paid
 * tier's server limit, so the browser — not the plan — was the binding
 * constraint. A Max subscriber with a 100 MB entitlement was refused a
 * 6 MB file by their own client, the request never left, and the
 * server's "Upgrade your plan to upload larger files" copy was
 * unreachable by construction. Nothing failed; the feature was simply
 * absent while looking present.
 *
 * The four states that matter are each asserted below, because three of
 * them are ways to reintroduce the bug:
 *   - a resolved tier limit  → enforce exactly that
 *   - `upload_max_mb: null`  → NOT unlimited, and NOT zero (`size > null`
 *                              coerces to `size > 0` and rejects
 *                              everything); mirror the server's ceiling
 *   - not loaded yet         → permissive, or a slow first paint
 *                              recreates the original bug
 *   - an upgrade mid-session → the ceiling moves without a reload
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BILLING_REFRESHED } from "../components/layout/BillingReturnSnackbar";
import { useFileSizeGuard } from "../components/ui/feedback/useFileSizeGuard";
import { ABSOLUTE_MAX_UPLOAD_BYTES } from "../utils/uploadLimits";

const MIB = 1024 * 1024;

vi.mock("../context/AuthContext", () => ({
    useOptionalAccessToken: () => "test-token",
}));

// Stubbed at the resolver, the single seam between the guard and the
// network — the guard's contract is "whatever the tier says", so the
// tier is what the test states.
const resolveUploadLimitBytes = vi.fn();
const invalidateUploadLimit = vi.fn();
vi.mock("../services/uploadLimit", () => ({
    resolveUploadLimitBytes: (...args: unknown[]) => resolveUploadLimitBytes(...args),
    invalidateUploadLimit: () => invalidateUploadLimit(),
}));

const makeFile = (name: string, size: number): File => {
    const f = new File(["x"], name, { type: "application/pdf" });
    Object.defineProperty(f, "size", { value: size });
    return f;
};

/** Never-settling promise — models "the payload hasn't arrived yet". */
const pending = () => new Promise<number | null>(() => {});

describe("upload guard follows the plan", () => {
    beforeEach(() => {
        resolveUploadLimitBytes.mockReset();
        invalidateUploadLimit.mockReset();
    });

    it("enforces the resolved tier limit, not a fixed 5 MB", async () => {
        resolveUploadLimitBytes.mockResolvedValue(50 * MIB); // pro
        const { result } = renderHook(() => useFileSizeGuard());
        await waitFor(() => expect(result.current.limitBytes).toBe(50 * MIB));

        // The exact file the old constant refused a paying user.
        const upload = vi.fn().mockResolvedValue("ok");
        await expect(
            result.current.guardUploadFile(upload)(makeFile("a.pdf", 6 * MIB))
        ).resolves.toBe("ok");
        expect(upload).toHaveBeenCalledTimes(1);
    });

    it("still rejects above the tier limit, and names that limit", async () => {
        resolveUploadLimitBytes.mockResolvedValue(50 * MIB);
        const { result } = renderHook(() => useFileSizeGuard());
        await waitFor(() => expect(result.current.limitBytes).toBe(50 * MIB));

        const upload = vi.fn();
        await expect(
            result.current.guardUploadFile(upload)(makeFile("big.pdf", 51 * MIB))
        ).rejects.toThrow(/50 MB/);
        expect(upload, "no bytes leave the browser").not.toHaveBeenCalled();
        // The toast reads the limit off the rejection, so a stale
        // constant can't make it claim a different number. `waitFor`
        // because the state write lands in the rejected promise's tick.
        await waitFor(() => expect(result.current.rejection?.limitBytes).toBe(50 * MIB));
    });

    it("treats a null tier limit as the server's ceiling, not unlimited and not zero", async () => {
        resolveUploadLimitBytes.mockResolvedValue(null);
        const { result } = renderHook(() => useFileSizeGuard());
        await waitFor(() => expect(result.current.limitBytes).toBe(ABSOLUTE_MAX_UPLOAD_BYTES));

        // `size > null` would coerce to `size > 0` and reject this.
        const upload = vi.fn().mockResolvedValue("ok");
        await expect(result.current.guardUploadFile(upload)(makeFile("a.pdf", 1))).resolves.toBe(
            "ok"
        );
        // ...and it is still a ceiling, not Infinity.
        await expect(
            result.current.guardUploadFile(vi.fn())(
                makeFile("huge.bin", ABSOLUTE_MAX_UPLOAD_BYTES + 1)
            )
        ).rejects.toThrow();
    });

    it("is permissive while the limit is still loading", async () => {
        resolveUploadLimitBytes.mockReturnValue(pending());
        const { result } = renderHook(() => useFileSizeGuard());

        // Defaulting to the smallest limit "to be safe" here is exactly
        // the bug: a user on a slow connection would be back to 5 MB.
        expect(result.current.limitBytes).toBe(ABSOLUTE_MAX_UPLOAD_BYTES);
        const upload = vi.fn().mockResolvedValue("ok");
        await expect(
            result.current.guardUploadFile(upload)(makeFile("a.pdf", 40 * MIB))
        ).resolves.toBe("ok");
    });

    it("picks up a new ceiling after an upgrade, without a reload", async () => {
        resolveUploadLimitBytes.mockResolvedValue(5 * MIB); // free
        const { result } = renderHook(() => useFileSizeGuard());
        await waitFor(() => expect(result.current.limitBytes).toBe(5 * MIB));

        // The keep-alive Homes never unmount, so a user who upgrades in
        // an open tab would otherwise keep the old cap until the TTL.
        resolveUploadLimitBytes.mockResolvedValue(100 * MIB); // max
        act(() => {
            window.dispatchEvent(new CustomEvent(BILLING_REFRESHED));
        });
        await waitFor(() => expect(result.current.limitBytes).toBe(100 * MIB));
        expect(invalidateUploadLimit, "the cached value must be dropped too").toHaveBeenCalled();
    });

    it("filterFiles splits a drop against the tier limit", async () => {
        resolveUploadLimitBytes.mockResolvedValue(25 * MIB); // core
        const { result } = renderHook(() => useFileSizeGuard());
        await waitFor(() => expect(result.current.limitBytes).toBe(25 * MIB));

        const small = makeFile("small.pdf", 20 * MIB);
        const big = makeFile("big.pdf", 30 * MIB);
        let accepted: File[] = [];
        act(() => {
            accepted = result.current.filterFiles([small, big]);
        });
        expect(accepted).toEqual([small]);
        expect(result.current.rejection?.files).toEqual([{ name: "big.pdf", size: 30 * MIB }]);
        expect(result.current.rejection?.limitBytes).toBe(25 * MIB);
    });
});
