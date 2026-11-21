/**
 * MIP-1709: the in-app "Create New Team" modal makes the same two choices as the first-run page:
 * the sample data (on by default) and the departments, with the same limits and wording, instead
 * of posting a bare name and giving a company's second team the empty app the plan is meant to avoid.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalCreateTeam } from "../features/admin/components/modals/ModalCreateTeam";
import { en } from "../i18n/locales/en";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const myself = { userId: "u1", teamId: "t1", userName: "Ken" } as never;
const copy = en.admin.joinTeam;
const names = (n: number) => Array.from({ length: n }, (_, i) => `Dept ${i}`).join("\n");

const created = {
    ok: true,
    status: 201,
    json: async () => ({ teamDetails: { teamId: "t2" } }),
} as Response;

const mount = () => {
    const setIsNewTeamCreated = vi.fn();
    render(
        <CssVarsProvider>
            <ModalCreateTeam
                myself={myself}
                setIsNewTeamCreated={setIsNewTeamCreated}
                setMyself={vi.fn()}
                setOpenCreateTeam={vi.fn()}
                openCreateTeam
            />
        </CssVarsProvider>
    );
    fireEvent.change(screen.getByPlaceholderText(en.admin.createTeamModal.teamNamePlaceholder), {
        target: { value: "Apollo" },
    });
    return { setIsNewTeamCreated };
};

const box = () => screen.getByPlaceholderText(copy.departmentsPlaceholder) as HTMLTextAreaElement;
const sample = () => screen.getByRole("checkbox", { name: copy.starterOptIn }) as HTMLInputElement;
const createButton = () =>
    screen.getByRole("button", { name: en.admin.createTeamModal.create }) as HTMLButtonElement;
const sentBody = () => JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));

describe("the Create New Team modal", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(created));
    });

    it("offers the departments box and the sample-data box, sample data on by default", () => {
        mount();

        expect(screen.getByText(copy.departmentsLabel)).toBeTruthy();
        expect(screen.getByText(copy.departmentsHint)).toBeTruthy();
        expect(sample().checked).toBe(true);
        expect(createButton().disabled).toBe(false);
    });

    it("sends the sample-data flag and the departments with the team", async () => {
        mount();
        fireEvent.change(box(), { target: { value: "Payments, Billing\nGrowth" } });
        fireEvent.click(createButton());

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        expect(sentBody()).toMatchObject({
            team_name: "Apollo",
            owner_id: "u1",
            with_starter: true,
            departments: ["Payments", "Billing", "Growth"],
        });
    });

    it("sends neither when the box is unticked and empty", async () => {
        mount();
        fireEvent.click(sample());
        fireEvent.click(createButton());

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        const body = sentBody();
        expect(body).not.toHaveProperty("with_starter");
        expect(body).not.toHaveProperty("departments");
    });

    it("a list the server would refuse is stopped here, with its reason, by button and by Enter", () => {
        mount();
        fireEvent.change(box(), { target: { value: names(21) } });

        expect(screen.getByText(copy.departmentsTooMany.replace("{max}", "20"))).toBeTruthy();
        expect(createButton().disabled).toBe(true);
        fireEvent.keyDown(
            screen.getByPlaceholderText(en.admin.createTeamModal.teamNamePlaceholder),
            { key: "Enter" }
        );
        expect(fetch).not.toHaveBeenCalled();
    });

    it("a name over thirty characters is refused with its own reason", () => {
        mount();
        fireEvent.change(box(), { target: { value: "x".repeat(31) } });

        expect(screen.getByText(copy.departmentsTooLong.replace("{max}", "30"))).toBeTruthy();
        expect(createButton().disabled).toBe(true);
    });

    it("says so when the server refuses the list anyway", async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: "bad", code: "invalid_departments" }),
        } as Response);
        const { setIsNewTeamCreated } = mount();
        fireEvent.change(box(), { target: { value: "Payments" } });
        await act(async () => {
            fireEvent.click(createButton());
        });

        await waitFor(() =>
            expect(
                screen.getByText(new RegExp(en.admin.auth.errors.invalidDepartments))
            ).toBeTruthy()
        );
        expect(setIsNewTeamCreated).not.toHaveBeenCalled();
    });
});
