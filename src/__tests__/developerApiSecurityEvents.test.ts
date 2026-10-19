/**
 * What `listTeamSecurityEvents` asks for (MIP-725). A non-owner's 404 is
 * the normal answer, so it must not raise the global error toast, and
 * comes back as `null` — the panel's "hide the section".
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "../services/api";
import { listTeamSecurityEvents } from "../services/developerApi";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

const get = vi.fn();

beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { events: [], nextBefore: null } });
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
});

describe("listTeamSecurityEvents", () => {
    it("asks for the team's first page without the error toast", async () => {
        await listTeamSecurityEvents("tok", "t1");
        expect(get).toHaveBeenCalledWith("/team/security-events/", {
            params: { team_id: "t1" },
            suppressErrorToast: true,
        });
    });

    it("passes the cursor for an older page", async () => {
        await listTeamSecurityEvents("tok", "t1", 42);
        expect(get).toHaveBeenCalledWith("/team/security-events/", {
            params: { team_id: "t1", before: 42 },
            suppressErrorToast: true,
        });
    });

    it("is null for a non-owner's 404", async () => {
        get.mockRejectedValue(Object.assign(new Error("404"), { response: { status: 404 } }));
        expect(await listTeamSecurityEvents("tok", "t1")).toBeNull();
    });

    it("returns the page as the server sent it", async () => {
        const event = { id: 1, action: "member.added" };
        get.mockResolvedValue({ data: { events: [event], nextBefore: 1 } });
        expect(await listTeamSecurityEvents("tok", "t1")).toEqual({
            events: [event],
            nextBefore: 1,
        });
    });
});
