import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateUserProfile } from "../../features/admin/services/updateUserProfile";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
}));

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

/** Grab the payload object the mocked `put` was called with. */
const putPayload = (put: ReturnType<typeof vi.fn>) =>
    put.mock.calls[0][1] as Record<string, unknown>;

describe("updateUserProfile — custom_status_expiry", () => {
    beforeEach(() => vi.clearAllMocks());

    it("sends custom_status_expiry when an ISO instant is provided", async () => {
        const put = vi.fn().mockResolvedValue({ data: {} });
        asMock(authApi).mockReturnValue({ put });

        await updateUserProfile({
            accessToken: "tok",
            userId: "u1",
            customStatus: "🏝 OOO",
            customStatusExpiry: "2026-08-11T09:00:00Z",
        });

        expect(put).toHaveBeenCalledWith("/user/profile/", expect.anything());
        const payload = putPayload(put);
        expect(payload.custom_status).toBe("🏝 OOO");
        expect(payload.custom_status_expiry).toBe("2026-08-11T09:00:00Z");
    });

    it("sends an explicit null to clear the expiry (present-and-null)", async () => {
        const put = vi.fn().mockResolvedValue({ data: {} });
        asMock(authApi).mockReturnValue({ put });

        await updateUserProfile({
            accessToken: "tok",
            userId: "u1",
            customStatus: "",
            customStatusExpiry: null,
        });

        const payload = putPayload(put);
        // The key must be present with a null value — the server exempts it
        // from its None-strip only if it actually arrives.
        expect("custom_status_expiry" in payload).toBe(true);
        expect(payload.custom_status_expiry).toBeNull();
    });

    it("omits custom_status_expiry entirely when the field is not supplied", async () => {
        const put = vi.fn().mockResolvedValue({ data: {} });
        asMock(authApi).mockReturnValue({ put });

        await updateUserProfile({
            accessToken: "tok",
            userId: "u1",
            isOfflineForced: "true",
        });

        const payload = putPayload(put);
        expect("custom_status_expiry" in payload).toBe(false);
        // Unrelated single-field edits stay scoped — no status keys leak in.
        expect("custom_status" in payload).toBe(false);
        expect(payload.is_offline_forced).toBe(true);
    });
});

describe("updateUserProfile — location_shared", () => {
    beforeEach(() => vi.clearAllMocks());

    it("sends location_shared:false when the user opts out", async () => {
        const put = vi.fn().mockResolvedValue({ data: {} });
        asMock(authApi).mockReturnValue({ put });

        await updateUserProfile({ accessToken: "tok", userId: "u1", locationShared: false });

        const payload = putPayload(put);
        // Must be present with the boolean — false is the meaningful value.
        expect("location_shared" in payload).toBe(true);
        expect(payload.location_shared).toBe(false);
    });

    it("sends location_shared:true when re-sharing", async () => {
        const put = vi.fn().mockResolvedValue({ data: {} });
        asMock(authApi).mockReturnValue({ put });

        await updateUserProfile({ accessToken: "tok", userId: "u1", locationShared: true });

        expect(putPayload(put).location_shared).toBe(true);
    });

    it("omits location_shared when the field is not supplied", async () => {
        const put = vi.fn().mockResolvedValue({ data: {} });
        asMock(authApi).mockReturnValue({ put });

        await updateUserProfile({
            accessToken: "tok",
            userId: "u1",
            currentLocation: "Asia/Tokyo",
        });

        const payload = putPayload(put);
        expect("location_shared" in payload).toBe(false);
        expect(payload.current_location).toBe("Asia/Tokyo");
    });
});
