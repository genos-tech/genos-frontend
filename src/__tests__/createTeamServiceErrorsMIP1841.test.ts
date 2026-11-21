/**
 * MIP-1841: the create-team service reports a refusal as `{ field, message }`, so the form can
 * put it by the field it is about. The API shapes are in `createTeamErrorsMIP1841.test.tsx`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTeam } from "../features/admin/services/createTeam";
import { teamCreateCopy } from "../features/admin/services/teamCreateFailure";
import { getMessages } from "../i18n";

const copy = teamCreateCopy(getMessages());
const HINT = "Try with different team_name";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

// --- the service: the callback gets the field and the words -----------------------------------

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

describe("createTeam service reports the failure, not a generic line (MIP-1841)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const refuse = async (response: unknown, err: { isAxiosError: true; response?: unknown }) => {
        const { authApi } = await import("../services/api");
        const axios = await import("axios");
        vi.spyOn(axios.default, "isAxiosError").mockReturnValue(true);
        vi.mocked(authApi).mockReturnValue({
            post: vi.fn().mockRejectedValue({ ...err, response }),
        } as never);
        const onFailure = vi.fn();
        const result = await createTeam("tok", "Acme", "u1", onFailure);
        return { result, onFailure };
    };

    it("a taken name: the team-name field gets the taken-name line", async () => {
        const { result, onFailure } = await refuse(
            {
                status: 400,
                data: {
                    team_name: ["team master with this team name already exists."],
                    hint: HINT,
                },
            },
            { isAxiosError: true }
        );
        expect(result).toBeUndefined();
        expect(onFailure).toHaveBeenCalledWith({
            field: "teamName",
            message: copy.duplicateTeamName,
        });
    });

    it("a refused address is not blamed on the name", async () => {
        const { onFailure } = await refuse(
            { status: 400, data: { team_email: ["Enter a valid email address."], hint: HINT } },
            { isAxiosError: true }
        );
        expect(onFailure).toHaveBeenCalledWith({ field: "form", message: copy.teamEmailFailed });
        expect(onFailure).not.toHaveBeenCalledWith(
            expect.objectContaining({ message: copy.duplicateTeamName })
        );
    });

    it("a 5xx says try again, not the rename line", async () => {
        const { onFailure } = await refuse(
            { status: 500, data: "<html>Server Error</html>" },
            { isAxiosError: true }
        );
        expect(onFailure).toHaveBeenCalledWith({ field: "form", message: copy.serverError });
    });

    it("no response (network) says so", async () => {
        const { onFailure } = await refuse(undefined, { isAxiosError: true });
        expect(onFailure).toHaveBeenCalledWith({ field: "form", message: copy.network });
    });

    it("an unknown error gets the generic line", async () => {
        const axios = await import("axios");
        vi.spyOn(axios.default, "isAxiosError").mockReturnValue(false);
        const { authApi } = await import("../services/api");
        vi.mocked(authApi).mockReturnValue({
            post: vi.fn().mockRejectedValue(new TypeError("boom")),
        } as never);
        const onFailure = vi.fn();
        await createTeam("tok", "Acme", "u1", onFailure);
        expect(onFailure).toHaveBeenCalledWith({ field: "form", message: copy.generic });
    });
});
