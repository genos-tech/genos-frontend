/**
 * MIP-1691: the create-team form takes an optional list of departments (one per line or
 * comma-separated), tells the person about a list the server would refuse before they send it,
 * and sends the names with the team.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JoinTeam } from "../features/admin/components/joinTeamFrom";
import { createTeam } from "../features/admin/services/createTeam";
import { en } from "../i18n/locales/en";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok", setAccessToken: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("socket.io-client", () => ({
    io: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));
vi.mock("../hooks/common/useWebSocket", () => ({ wsJoinTeamHook: vi.fn() }));
vi.mock("../features/admin/services/loadMyTeams", () => ({
    loadMyTeams: vi.fn().mockResolvedValue([]),
    membershipTeams: (teams: unknown[]) => teams,
}));
vi.mock("../features/admin/services/joinTeam", () => ({
    joinTeam: vi.fn().mockResolvedValue(true),
}));
vi.mock("../features/admin/services/createTeam", () => ({
    createTeam: vi.fn().mockResolvedValue({ teamDetails: { teamId: "t1", teamName: "Acme" } }),
}));
vi.mock("../services/privateProfileStore", () => ({
    clearPrivateProfile: vi.fn(),
    ensurePrivateProfile: vi.fn().mockResolvedValue(null),
}));

const copy = en.admin.joinTeam;
const names = (n: number) => Array.from({ length: n }, (_, i) => `Dept ${i}`).join("\n");

const mount = () => {
    localStorage.setItem("userId", "u1");
    render(
        <CssVarsProvider>
            <JoinTeam />
        </CssVarsProvider>
    );
    fireEvent.change(screen.getByPlaceholderText(copy.teamNamePlaceholder), {
        target: { value: "Acme" },
    });
    return screen.getByPlaceholderText(copy.departmentsPlaceholder) as HTMLTextAreaElement;
};

const createButton = () => screen.getByRole("button", { name: copy.createTeam });

describe("the departments box on the create-team form", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("is optional and says what each department gets", () => {
        mount();

        expect(screen.getByText(copy.departmentsLabel)).toBeTruthy();
        expect(screen.getByText(copy.departmentsHint)).toBeTruthy();
        expect(createButton().hasAttribute("disabled")).toBe(false);
    });

    it("sends the names, split on lines and commas, with the team", async () => {
        const box = mount();
        fireEvent.change(box, { target: { value: "Payments, Billing\nGrowth" } });
        fireEvent.click(createButton());

        await waitFor(() => expect(createTeam).toHaveBeenCalled());
        const args = vi.mocked(createTeam).mock.calls[0];
        expect(args[1]).toBe("Acme");
        expect(args[4]).toBe(true); // the sample-data box is still on by default
        expect(args[5]).toEqual(["Payments", "Billing", "Growth"]);
    });

    it("sends no departments when the box is empty", async () => {
        mount();
        fireEvent.click(createButton());

        await waitFor(() => expect(createTeam).toHaveBeenCalled());
        expect(vi.mocked(createTeam).mock.calls[0][5]).toEqual([]);
    });

    it("twenty is accepted", async () => {
        const box = mount();
        fireEvent.change(box, { target: { value: names(20) } });

        expect(createButton().hasAttribute("disabled")).toBe(false);
    });

    it("twenty-one is refused on the form: the reason shows and nothing is sent", async () => {
        const box = mount();
        fireEvent.change(box, { target: { value: names(21) } });

        expect(screen.getByText(copy.departmentsTooMany.replace("{max}", "20"))).toBeTruthy();
        expect(createButton().hasAttribute("disabled")).toBe(true);
        fireEvent.click(createButton());
        expect(createTeam).not.toHaveBeenCalled();
    });

    it("a name over thirty characters is refused with its own reason", () => {
        const box = mount();
        fireEvent.change(box, { target: { value: "x".repeat(31) } });

        expect(screen.getByText(copy.departmentsTooLong.replace("{max}", "30"))).toBeTruthy();
        expect(createButton().hasAttribute("disabled")).toBe(true);
    });

    it("the same name in another case counts once", () => {
        const box = mount();
        fireEvent.change(box, { target: { value: `${names(19)}\ndept 0\nDEPT 1` } });

        expect(createButton().hasAttribute("disabled")).toBe(false);
    });
});
