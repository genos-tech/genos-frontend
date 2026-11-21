/**
 * MIP-1864: the "Include sample instruction data" box must reach the server as `with_starter:
 * true`, and an unticked box must send nothing. The server seeds only on the literal `true`, so
 * a box that is ticked but not sent leaves a fresh team empty.
 *
 * The request body is what is checked; the rows it seeds are covered by the api tests.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTeam } from "../features/admin/services/createTeam";

const post = vi.hoisted(() => vi.fn());

vi.mock("../services/api", () => ({
    authApi: () => ({ post }),
}));

describe("createTeam sends the sample-data choice (MIP-1864)", () => {
    beforeEach(() => {
        post.mockReset();
        post.mockResolvedValue({ data: { teamDetails: { teamId: "t1" } } });
    });

    it("sends with_starter: true when the box is ticked", async () => {
        await createTeam("token", "Acme", "user-1", undefined, true);
        expect(post).toHaveBeenCalledTimes(1);
        const [url, body] = post.mock.calls[0];
        expect(url).toBe("/team/create/");
        expect(body).toMatchObject({ team_name: "Acme", owner_id: "user-1", with_starter: true });
    });

    it("sends no with_starter key when the box is unticked", async () => {
        await createTeam("token", "Acme", "user-1", undefined, false);
        const [, body] = post.mock.calls[0];
        expect(body).not.toHaveProperty("with_starter");
    });

    it("sends no with_starter key when the choice is not passed", async () => {
        await createTeam("token", "Acme", "user-1");
        const [, body] = post.mock.calls[0];
        expect(body).not.toHaveProperty("with_starter");
    });

    it("sends the departments with the sample flag, so the example department is seeded too", async () => {
        await createTeam("token", "Acme", "user-1", undefined, true, ["Sample dept"]);
        const [, body] = post.mock.calls[0];
        expect(body).toMatchObject({ with_starter: true, departments: ["Sample dept"] });
    });
});
