/**
 * "Connected teams", in the team profile.
 *
 * Two things this panel has to get right, both of them about not
 * overstating what a connection is:
 *
 * 1. It must say, in the UI, that connecting grants nothing. Users read
 *    "connect with Acme" as "Acme can see our stuff", and the server
 *    happily disagrees — so the sentence is the feature, not decoration.
 * 2. Disconnecting deletes real access on both sides, so it must never be
 *    one click.
 *
 * Actions are also owner/editor only. The list itself is not gated: a
 * viewer knowing which organizations their team works with is useful and
 * the team name is not a secret.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectedTeamsPanel } from "../features/admin/components/team/ConnectedTeamsPanel";
import type { TeamConnectionControls } from "../features/admin/components/team/useTeamConnections";
import type { TeamConnection } from "../features/admin/services/teamConnections";

const MY_TEAM = "11111111-1111-1111-1111-111111111111";

const connection = (over: Partial<TeamConnection> = {}): TeamConnection => ({
    connectionId: "c1",
    teamId: "22222222-2222-2222-2222-222222222222",
    teamName: "Acme",
    status: "active",
    direction: "outgoing",
    isOwner: false,
    isGuest: false,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
    ...over,
});

const controls = (over: Partial<TeamConnectionControls> = {}): TeamConnectionControls => ({
    active: [],
    incoming: [],
    outgoing: [],
    loading: false,
    busy: false,
    error: null,
    clearError: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    request: vi.fn().mockResolvedValue(true),
    respond: vi.fn().mockResolvedValue(true),
    revoke: vi.fn().mockResolvedValue(0),
    ...over,
});

const renderPanel = (
    over: Partial<TeamConnectionControls> = {},
    canManage = true,
    // The owner, unless a test is about somebody who isn't one. Defaults
    // to `canManage` so the existing cases keep describing one person.
    canDisconnect = canManage
) => {
    const c = controls(over);
    render(
        <CssVarsProvider>
            <ConnectedTeamsPanel
                borderColor="#ccc"
                canDisconnect={canDisconnect}
                canManage={canManage}
                connections={c}
                labelColor="#666"
                myTeamId={MY_TEAM}
                valueColor="#111"
            />
        </CssVarsProvider>
    );
    return c;
};

describe("ConnectedTeamsPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("says a connection grants nothing on its own", () => {
        renderPanel();
        expect(screen.getByText(/gives them access to nothing/i)).toBeTruthy();
    });

    it("shows an empty state rather than a bare heading", () => {
        renderPanel();
        expect(screen.getByText(/Not connected to any other team yet/i)).toBeTruthy();
    });

    it("requests a connection by team id", async () => {
        const c = renderPanel();
        fireEvent.change(screen.getByPlaceholderText(/Paste the other team's ID/i), {
            target: { value: "  33333333-3333-3333-3333-333333333333  " },
        });
        fireEvent.click(screen.getByRole("button", { name: /Request connection/i }));
        await waitFor(() =>
            expect(c.request).toHaveBeenCalledWith("33333333-3333-3333-3333-333333333333")
        );
    });

    it("refuses your own team's id without a round trip", async () => {
        // The server would refuse it too, but "same_team" as a red error
        // string is a worse answer than not asking.
        const c = renderPanel();
        fireEvent.change(screen.getByPlaceholderText(/Paste the other team's ID/i), {
            target: { value: MY_TEAM },
        });
        fireEvent.click(screen.getByRole("button", { name: /Request connection/i }));
        await waitFor(() => expect(screen.getByText(/your own team's ID/i)).toBeTruthy());
        expect(c.request).not.toHaveBeenCalled();
    });

    it("offers approve and decline on an incoming request", async () => {
        const c = renderPanel({
            incoming: [connection({ status: "pending", direction: "incoming" })],
        });
        expect(screen.getByText(/Wants to connect with your team/i)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /^Approve$/i }));
        await waitFor(() => expect(c.respond).toHaveBeenCalledWith("c1", true));
        fireEvent.click(screen.getByRole("button", { name: /^Decline$/i }));
        await waitFor(() => expect(c.respond).toHaveBeenCalledWith("c1", false));
    });

    it("gives an outgoing request no buttons, only a status", () => {
        renderPanel({ outgoing: [connection({ status: "pending", direction: "outgoing" })] });
        expect(screen.getByText(/Waiting for them to approve/i)).toBeTruthy();
        expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
    });

    it("does not disconnect on the first click", async () => {
        const c = renderPanel({ active: [connection()] });
        fireEvent.click(screen.getByRole("button", { name: /Disconnect/i }));
        // The confirm dialog is up; nothing has been withdrawn yet.
        await waitFor(() => expect(screen.getByText(/Disconnect from this team\?/i)).toBeTruthy());
        expect(c.revoke).not.toHaveBeenCalled();
    });

    it("warns that disconnecting removes their people immediately", async () => {
        renderPanel({ active: [connection()] });
        fireEvent.click(screen.getByRole("button", { name: /Disconnect/i }));
        await waitFor(() =>
            expect(
                screen.getByText(/removes their people from your data immediately/i)
            ).toBeTruthy()
        );
    });

    it("reports how many participants a disconnect withdrew", async () => {
        // Silently removing nine people from three projects is exactly
        // the surprise the confirmation exists to prevent, so the count
        // is shown after the fact.
        const c = renderPanel({
            active: [connection()],
            revoke: vi.fn().mockResolvedValue(9),
        });
        fireEvent.click(screen.getByRole("button", { name: /Disconnect/i }));
        await waitFor(() => screen.getByText(/Disconnect from this team\?/i));
        fireEvent.click(screen.getAllByRole("button", { name: /^Disconnect$/i }).pop()!);
        await waitFor(() => expect(c.revoke).toHaveBeenCalledWith("c1"));
        await waitFor(() => expect(screen.getByText(/Removed 9 external/i)).toBeTruthy());
    });

    it("shows a viewer the list but none of the actions", () => {
        renderPanel(
            {
                active: [connection()],
                incoming: [
                    connection({
                        connectionId: "c2",
                        teamName: "Globex",
                        status: "pending",
                        direction: "incoming",
                    }),
                ],
            },
            false
        );
        expect(screen.getByText("Acme")).toBeTruthy();
        expect(screen.getByText("Globex")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Disconnect/i })).toBeNull();
        expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
        expect(screen.queryByRole("button", { name: /Request connection/i })).toBeNull();
    });

    it("keeps disconnect away from an editor, who can do everything else", () => {
        // Ending a connection deletes live access in two companies with no
        // way back but to negotiate it again. The server refuses an editor;
        // offering them the button would only produce a 403.
        renderPanel({ active: [connection()] }, true, false);
        expect(screen.queryByRole("button", { name: /Disconnect/i })).toBeNull();
        expect(screen.getByRole("button", { name: /Request connection/i })).toBeTruthy();
    });

    it("labels the team that owns the shared work, not the reader's own", () => {
        renderPanel({ active: [connection({ isOwner: true })] });
        expect(screen.getByText("Owner")).toBeTruthy();
        expect(screen.queryByText("Guest")).toBeNull();
    });

    it("labels a team that works in our data as the guest", () => {
        renderPanel({ active: [connection({ isGuest: true })] });
        expect(screen.getByText("Guest")).toBeTruthy();
        expect(screen.queryByText("Owner")).toBeNull();
    });

    it("labels neither side while nothing has been shared yet", () => {
        // A real third state, not a fallback: connected, with no host and
        // no guest to name.
        renderPanel({ active: [connection()] });
        expect(screen.queryByText("Owner")).toBeNull();
        expect(screen.queryByText("Guest")).toBeNull();
    });

    it("drops the who-invited-whom line from a live connection", () => {
        // History that stopped being actionable the moment they accepted,
        // and it read as a second, contradicting claim beside the chip.
        renderPanel({ active: [connection({ isOwner: true })] });
        expect(screen.queryByText(/invited/i)).toBeNull();
    });

    it("surfaces a server error from the hook", () => {
        renderPanel({ error: "already_connected" });
        expect(screen.getByText("already_connected")).toBeTruthy();
    });
});
