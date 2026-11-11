/**
 * MIP-1410. The PR column's Refresh click asks the PR detail route to skip the server's cache
 * (`?fresh=1`), so a CI run that just finished shows. A plain call is exactly what it always was.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPullDetail } from "../../features/integrations/services/github";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({ authApi: vi.fn() }));

const mockAuthApi = vi.mocked(authApi);
const PATH = "/github/pulls/acme/rocket/7/";

beforeEach(() => {
    mockAuthApi.mockReset();
});

describe("getPullDetail", () => {
    it("sends no params at all on a plain call: the request is the one it always was", async () => {
        const get = vi.fn().mockResolvedValue({ data: { pull: {} } });
        mockAuthApi.mockReturnValue({ get } as never);

        await getPullDetail("tok", "acme", "rocket", 7);

        expect(get).toHaveBeenCalledWith(PATH, { suppressErrorToast: true });
    });

    it("`fresh: true` sends ?fresh=1 and keeps the toast out of it", async () => {
        const get = vi.fn().mockResolvedValue({ data: { pull: {} } });
        mockAuthApi.mockReturnValue({ get } as never);

        await getPullDetail("tok", "acme", "rocket", 7, undefined, { fresh: true });

        expect(get).toHaveBeenCalledWith(PATH, {
            suppressErrorToast: true,
            params: { fresh: "1" },
        });
    });

    it("`fresh: false` is a plain call", async () => {
        const get = vi.fn().mockResolvedValue({ data: { pull: {} } });
        mockAuthApi.mockReturnValue({ get } as never);

        await getPullDetail("tok", "acme", "rocket", 7, undefined, { fresh: false });

        expect(get).toHaveBeenCalledWith(PATH, { suppressErrorToast: true });
    });

    it("answers the same on a fresh call: the body, and a refusal as 'unavailable'", async () => {
        const body = { pull: { number: 7 } };
        mockAuthApi.mockReturnValue({ get: vi.fn().mockResolvedValue({ data: body }) } as never);
        expect(await getPullDetail("tok", "acme", "rocket", 7, undefined, { fresh: true })).toBe(
            body
        );

        const refused = Object.assign(new Error("502"), {
            isAxiosError: true,
            response: { status: 502, data: { upstream_status: 404 } },
        });
        mockAuthApi.mockReturnValue({ get: vi.fn().mockRejectedValue(refused) } as never);
        expect(await getPullDetail("tok", "acme", "rocket", 7, undefined, { fresh: true })).toBe(
            "unavailable"
        );
    });
});
