import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPageTitle } from "../features/tasks/utils/getPageTitle";

const get = vi.fn();
const authApi = vi.fn((token: string | null | undefined) => (token ? { get } : null));

vi.mock("../services/api", () => ({
    authApi: (token: string | null | undefined) => authApi(token),
}));

// The endpoint requires sign-in since MIP-717. It used to be called with a
// bare fetch and the URL pasted into the query string unencoded.
describe("getPageTitle", () => {
    beforeEach(() => {
        get.mockReset();
        authApi.mockClear();
    });

    it("sends the caller's token and the URL as an encoded param", async () => {
        get.mockResolvedValue({ data: { title: "Example Domain" } });
        const url = "https://example.com/a?b=1&c=2";
        await expect(getPageTitle("tok", url)).resolves.toBe("Example Domain");
        expect(authApi).toHaveBeenCalledWith("tok");
        expect(get).toHaveBeenCalledWith("/getPageTitle/", {
            params: { url },
            suppressErrorToast: true,
        });
    });

    it("makes no request without a token", async () => {
        await expect(getPageTitle(null, "https://example.com/")).resolves.toBeNull();
        expect(get).not.toHaveBeenCalled();
    });

    it("treats a refusal or a 429 as no title", async () => {
        get.mockRejectedValue({ response: { status: 429 } });
        await expect(getPageTitle("tok", "https://example.com/")).resolves.toBeNull();
    });

    it("treats an empty or missing title as no title", async () => {
        get.mockResolvedValueOnce({ data: { title: "" } });
        await expect(getPageTitle("tok", "https://example.com/")).resolves.toBeNull();
        get.mockResolvedValueOnce({ data: { title: null } });
        await expect(getPageTitle("tok", "https://example.com/")).resolves.toBeNull();
    });
});
