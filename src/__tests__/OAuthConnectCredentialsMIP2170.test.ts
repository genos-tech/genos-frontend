/**
 * The connect XHR must send credentials: the server pins the connect to this browser with an
 * HttpOnly cookie set on that response (MIP-2170), and a cross-origin XHR without
 * `withCredentials` makes the browser drop it, so the callback would refuse every connect.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirectToOAuthConnect } from "../features/integrations/services/oauth";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const post = vi.fn();

describe("redirectToOAuthConnect", () => {
    beforeEach(() => {
        post.mockReset();
        vi.mocked(authApi).mockReturnValue({ post } as unknown as ReturnType<typeof authApi>);
        Object.defineProperty(window, "location", {
            value: { href: "http://localhost/" },
            writable: true,
        });
    });

    it.each(["google", "github"] as const)("posts the %s connect with credentials", async (p) => {
        post.mockResolvedValue({ data: { url: "https://provider.test/auth?state=s" } });

        const ok = await redirectToOAuthConnect(p, "token");

        expect(ok).toBe(true);
        expect(post).toHaveBeenCalledWith(
            `/oauth/${p}/initiate/`,
            { intent: "connect", next: "/workspace/integrations" },
            { withCredentials: true }
        );
        expect(window.location.href).toBe("https://provider.test/auth?state=s");
    });
});
