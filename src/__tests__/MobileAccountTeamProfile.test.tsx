/**
 * Reaching the team profile from a phone.
 *
 * The sidebar's team dropdown — where "Show Team Profile" lives on
 * desktop — renders `null` below 900px, so the team's roster, owner,
 * invite button and connected teams had no entry point at all on mobile.
 * The Account sheet in the bottom tab bar is where the rest of that
 * sidebar was rehomed, so the row belongs there too.
 *
 * `getMyTeams` already answers with full team profiles and the sheet
 * already calls it for the switcher, so the row reads the fetch that was
 * happening anyway rather than issuing its own.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileAccountSheet } from "../components/layout/MobileAccountSheet";
import type { TeamProfileProps, UserProps } from "../types/admin";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => true }));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token" }),
    useOptionalAccessToken: () => "token",
}));
vi.mock("../hooks/common/useSignOut", () => ({ useSignOut: () => vi.fn() }));

const loadMyTeams = vi.fn();
// `membershipTeams` stays real — which teams the switcher offers is part
// of what this sheet has to get right.
vi.mock("../features/admin/services/loadMyTeams", async (importOriginal) => ({
    ...((await importOriginal()) as object),
    loadMyTeams: (...args: unknown[]) => loadMyTeams(...args),
}));
vi.mock("../features/admin/services/switchTeam", () => ({ switchTeam: vi.fn() }));

// Stubs for the leaves. The team-profile stub reports which team it was
// handed, which is the part worth asserting — the sheet has to pass the
// profile of the team you are IN, not merely open the modal.
vi.mock("../features/admin/components/modals/ModalTeamProfile", () => ({
    ModalTeamProfile: ({
        teamProfile,
        openModalTeamProfile,
    }: {
        teamProfile: TeamProfileProps;
        openModalTeamProfile: boolean;
    }) =>
        openModalTeamProfile ? <div data-testid="team-profile">{teamProfile.teamId}</div> : null,
}));
vi.mock("../features/admin/components/modals/ModalUserProfile", () => ({
    UserProfile: () => null,
}));
vi.mock("../components/layout/SettingsModal", () => ({ SettingsModal: () => null }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <div /> }));

const profile = (teamId: string, isGuest?: boolean): TeamProfileProps => ({
    teamId,
    teamName: `Team ${teamId}`,
    teamEmail: `${teamId}@example.com`,
    teamOwnerId: "u-owner",
    teamImgPath: "",
    teamMembers: [],
    tsCreatedAt: "2026-01-01T00:00:00Z",
    isGuest,
});

const myself = { userId: "u-me", teamId: "t-mine", teamName: "Team t-mine" } as UserProps;

const renderSheet = () =>
    render(
        <CssVarsProvider>
            <MobileAccountSheet
                myself={myself}
                open={true}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
                onClose={vi.fn()}
            />
        </CssVarsProvider>
    );

const teamProfileRow = () => screen.getByRole("button", { name: /show team profile/i });

beforeEach(() => {
    vi.clearAllMocks();
    loadMyTeams.mockResolvedValue([profile("t-mine"), profile("t-other")]);
});

describe("the Account sheet's team profile row", () => {
    it("opens the profile of the team you are in", async () => {
        const user = userEvent.setup();
        renderSheet();

        await waitFor(() => expect(teamProfileRow()).toBeEnabled());
        await user.click(teamProfileRow());

        expect(await screen.findByTestId("team-profile")).toHaveTextContent("t-mine");
    });

    it("waits for the team list rather than opening an empty modal", async () => {
        // A tap before the fetch lands has no profile to show. Disabled
        // says so; a live button that silently does nothing does not.
        let resolve: (teams: TeamProfileProps[]) => void = () => {};
        loadMyTeams.mockReturnValue(
            new Promise<TeamProfileProps[]>((r) => {
                resolve = r;
            })
        );
        renderSheet();

        expect(teamProfileRow()).toBeDisabled();
        resolve([profile("t-mine")]);
        await waitFor(() => expect(teamProfileRow()).toBeEnabled());
    });

    it("survives a team whose profile the fetch never returned", async () => {
        // Signed into a team that `getMyTeams` doesn't list back (a failed
        // load, or a membership the server dropped). Nothing to show, so
        // the row stays disabled instead of opening a blank profile.
        loadMyTeams.mockResolvedValue([profile("t-other")]);
        renderSheet();

        await waitFor(() => expect(loadMyTeams).toHaveBeenCalled());
        expect(teamProfileRow()).toBeDisabled();
    });

    it("still offers only teams you belong to in the switcher", async () => {
        loadMyTeams.mockResolvedValue([
            profile("t-mine"),
            profile("t-host", true),
            profile("t-other"),
        ]);
        const user = userEvent.setup();
        renderSheet();

        await waitFor(() => expect(teamProfileRow()).toBeEnabled());
        await user.click(screen.getByRole("button", { name: /switch team/i }));

        // The host-team shell of another organization's share is not a
        // team you can switch into — the profile row must not have
        // reintroduced it by widening what the sheet keeps.
        expect(await screen.findByText("Team t-other")).toBeInTheDocument();
        expect(screen.queryByText("Team t-host")).not.toBeInTheDocument();
    });
});
