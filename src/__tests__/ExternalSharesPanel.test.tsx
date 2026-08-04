/**
 * "Teams in this chat", in the external GM profile.
 *
 * The panel's whole job is to render an asymmetry correctly, so that is
 * what these tests pin down: the guest team's managers get an add control,
 * and the host never does. A host "add" button would be a UI that offers an
 * action the server refuses — worse, one that implies the host picks the
 * other organization's people, which is exactly the misreading the
 * one-time-approval design exists to prevent.
 *
 * `canAdmit` comes from the server. The panel must not second-guess it from
 * team ids, so these fixtures set it directly.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExternalSharesPanel } from "../features/chat/components/modals/ExternalSharesPanel";
import type { ChannelShare } from "../types/channel";

const fetchChannelShares = vi.fn();
const fetchOwnTeamRoster = vi.fn();

vi.mock("../services/channel/channelService", () => ({
    channelService: {
        addMembers: vi.fn().mockResolvedValue({ members: [] }),
        fetchChannelShares: (...args: unknown[]) => fetchChannelShares(...args),
        removeMember: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("../features/admin/services/teamConnections", () => ({
    fetchOwnTeamRoster: (...args: unknown[]) => fetchOwnTeamRoster(...args),
    revokeExternalShare: vi.fn().mockResolvedValue(0),
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token" }),
}));

const share = (over: Partial<ChannelShare> = {}): ChannelShare => ({
    grantId: "g1",
    teamId: "22222222-2222-2222-2222-222222222222",
    teamName: "Acme",
    roleCeiling: "editor",
    status: "active",
    side: "given",
    canAdmit: false,
    participants: [{ avatarUrl: null, email: "z@acme.test", userId: "u9", userName: "Zoe" }],
    ...over,
});

const renderPanel = () =>
    render(
        <CssVarsProvider>
            <ExternalSharesPanel
                borderColor="#ccc"
                channelId="c1"
                labelColor="#666"
                myUserId="me"
                valueColor="#111"
            />
        </CssVarsProvider>
    );

describe("ExternalSharesPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchOwnTeamRoster.mockResolvedValue([
            { userEmail: "a@acme.test", userId: "u1", userName: "Ann" },
        ]);
    });

    it("renders nothing when the chat is not shared with anyone", async () => {
        fetchChannelShares.mockResolvedValue([]);
        const { container } = renderPanel();
        await waitFor(() => expect(fetchChannelShares).toHaveBeenCalled());
        expect(container.textContent).toBe("");
    });

    it("names each team and how many of their people are in", async () => {
        fetchChannelShares.mockResolvedValue([share()]);
        renderPanel();
        expect(await screen.findByText("Acme")).toBeTruthy();
        expect(screen.getByText(/1 participant/i)).toBeTruthy();
        expect(screen.getByText("Zoe")).toBeTruthy();
    });

    it("says who may add people, so the host is not left guessing", async () => {
        fetchChannelShares.mockResolvedValue([share()]);
        renderPanel();
        expect(await screen.findByText(/only their owner or editor can add them/i)).toBeTruthy();
    });

    it("offers no add control to the host team", async () => {
        fetchChannelShares.mockResolvedValue([share({ canAdmit: false, side: "given" })]);
        renderPanel();
        await screen.findByText("Acme");
        expect(screen.queryByLabelText(/add someone from your team/i)).toBeNull();
        expect(screen.queryByLabelText(/add someone from your team/i)).toBeNull();
    });

    it("offers the add control to a guest team's manager", async () => {
        fetchChannelShares.mockResolvedValue([share({ canAdmit: true, side: "received" })]);
        renderPanel();
        await screen.findByText("Acme");
        expect(screen.getByLabelText(/add someone from your team/i)).toBeTruthy();
    });

    it("shows a pending share as waiting on the other team", async () => {
        fetchChannelShares.mockResolvedValue([
            share({ canAdmit: true, participants: [], status: "pending" }),
        ]);
        renderPanel();
        expect(await screen.findByText(/waiting for this team to accept/i)).toBeTruthy();
        // Nothing to admit anyone to yet, so no add control either.
        expect(screen.queryByLabelText(/add someone from your team/i)).toBeNull();
    });

    it("shows the role ceiling, since it bounds what the guest can hand out", async () => {
        fetchChannelShares.mockResolvedValue([share({ roleCeiling: "viewer" })]);
        renderPanel();
        expect(await screen.findByText(/up to viewer/i)).toBeTruthy();
    });
});
