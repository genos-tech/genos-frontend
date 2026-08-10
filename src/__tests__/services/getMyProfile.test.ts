import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMyProfile } from "../../features/admin/services/getMyProfile";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
}));

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe("getMyProfile", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it("returns null without calling HTTP when there is no token", async () => {
        asMock(authApi).mockReturnValue(null);
        expect(await getMyProfile(null)).toBeNull();
        expect(authApi).toHaveBeenCalledWith(null);
    });

    it("GETs /user/me/ and maps is_offline_forced + custom_status + expiry", async () => {
        const get = vi.fn().mockResolvedValue({
            data: {
                is_offline_forced: true,
                custom_status: "🏝 OOO",
                custom_status_expiry: "2026-08-11T09:00:00Z",
            },
        });
        asMock(authApi).mockReturnValue({ get });

        const result = await getMyProfile("tok");

        expect(get).toHaveBeenCalledWith("/user/me/");
        expect(result).toEqual({
            isOfflineForced: true,
            customStatus: "🏝 OOO",
            customStatusExpiry: "2026-08-11T09:00:00Z",
        });
    });

    it("coerces missing custom_status to '' and missing expiry to null", async () => {
        const get = vi.fn().mockResolvedValue({ data: { custom_status: null } });
        asMock(authApi).mockReturnValue({ get });

        expect(await getMyProfile("tok")).toEqual({
            isOfflineForced: false,
            customStatus: "",
            customStatusExpiry: null,
        });
    });

    it("preserves an explicit null expiry as null (not coerced to '')", async () => {
        const get = vi.fn().mockResolvedValue({
            data: { custom_status: "🏝 OOO", custom_status_expiry: null },
        });
        asMock(authApi).mockReturnValue({ get });

        const result = await getMyProfile("tok");
        expect(result?.customStatusExpiry).toBeNull();
    });

    it("returns null on request failure (leaves local state untouched)", async () => {
        const get = vi.fn().mockRejectedValue(new Error("boom"));
        asMock(authApi).mockReturnValue({ get });

        expect(await getMyProfile("tok")).toBeNull();
    });
});
