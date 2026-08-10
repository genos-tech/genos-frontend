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

    it("GETs /user/me/ and maps is_offline_forced + custom_status", async () => {
        const get = vi.fn().mockResolvedValue({
            data: { is_offline_forced: true, custom_status: "🏝 OOO" },
        });
        asMock(authApi).mockReturnValue({ get });

        const result = await getMyProfile("tok");

        expect(get).toHaveBeenCalledWith("/user/me/");
        expect(result).toEqual({ isOfflineForced: true, customStatus: "🏝 OOO" });
    });

    it("coerces a missing/null custom_status to empty string and falsy offline to false", async () => {
        const get = vi.fn().mockResolvedValue({ data: { custom_status: null } });
        asMock(authApi).mockReturnValue({ get });

        expect(await getMyProfile("tok")).toEqual({ isOfflineForced: false, customStatus: "" });
    });

    it("returns null on request failure (leaves local state untouched)", async () => {
        const get = vi.fn().mockRejectedValue(new Error("boom"));
        asMock(authApi).mockReturnValue({ get });

        expect(await getMyProfile("tok")).toBeNull();
    });
});
