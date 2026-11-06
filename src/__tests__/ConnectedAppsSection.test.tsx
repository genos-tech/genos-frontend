import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectedAppsSection } from "../components/layout/ConnectedAppsSection";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listMcpConnections = vi.fn();
const updateMcpConnection = vi.fn();
const revokeMcpConnection = vi.fn();
vi.mock("../services/mcpConnections", () => ({
    listMcpConnections: (...a: unknown[]) => listMcpConnections(...a),
    updateMcpConnection: (...a: unknown[]) => updateMcpConnection(...a),
    revokeMcpConnection: (...a: unknown[]) => revokeMcpConnection(...a),
}));

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const AVAILABLE = [
    { id: "t1", name: "Alpha" },
    { id: "t2", name: "Beta" },
    { id: "t3", name: "Gamma" },
];

const CONN = {
    id: "c1",
    client: { name: "Claude", kind: "registered" as const, host: "" },
    scope: "write" as const,
    allowDestructive: false,
    defaultTeamId: "t1",
    teamIds: ["t1", "t2"],
    teams: [
        { id: "t1", name: "Alpha" },
        { id: "t2", name: "Beta" },
    ],
    lastUsedAt: null,
    createdAt: "2026-11-06T00:00:00Z",
};

beforeEach(() => {
    listMcpConnections.mockReset();
    updateMcpConnection.mockReset();
    revokeMcpConnection.mockReset();
    listMcpConnections.mockResolvedValue({ connections: [CONN], availableTeams: AVAILABLE });
});

describe("ConnectedAppsSection", () => {
    it("lists each connection with what it may do and where", async () => {
        render(<ConnectedAppsSection />);
        const card = await screen.findByTestId("connected-app");
        expect(within(card).getByText("Claude")).toBeTruthy();
        expect(within(card).getByText("Read & write")).toBeTruthy();
        expect(within(card).queryByText("Can delete")).toBeNull();
        expect(within(card).getByText(/Teams: Alpha, Beta/)).toBeTruthy();
        expect(within(card).getByText(/default Alpha/)).toBeTruthy();
        expect(within(card).getByText("Not used yet")).toBeTruthy();
    });

    it("says so when nothing is connected", async () => {
        listMcpConnections.mockResolvedValue({ connections: [], availableTeams: AVAILABLE });
        render(<ConnectedAppsSection />);
        expect(await screen.findByText("No apps connected yet.")).toBeTruthy();
    });

    it("says so when the list cannot be loaded", async () => {
        listMcpConnections.mockResolvedValue(null);
        render(<ConnectedAppsSection />);
        expect(await screen.findByText("Couldn't load your connected apps.")).toBeTruthy();
    });

    it("revoking asks first, in the page, and removes the card on yes", async () => {
        revokeMcpConnection.mockResolvedValue({ ok: true });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Revoke" }));
        expect(screen.getByText(/Revoke Claude\? It stops working immediately\./)).toBeTruthy();
        expect(revokeMcpConnection).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Revoke" }));
        await waitFor(() => expect(revokeMcpConnection).toHaveBeenCalledWith("tok", "c1"));
        await waitFor(() => expect(screen.queryByTestId("connected-app")).toBeNull());
    });

    it("cancelling the confirm revokes nothing", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Revoke" }));
        await user.click(screen.getByRole("button", { name: "Cancel" }));
        expect(revokeMcpConnection).not.toHaveBeenCalled();
        expect(screen.getByTestId("connected-app")).toBeTruthy();
    });

    it("keeps the card and says so when revoking fails", async () => {
        revokeMcpConnection.mockResolvedValue({ ok: false, gone: false, error: null });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Revoke" }));
        await user.click(screen.getByRole("button", { name: "Revoke" }));
        expect(await screen.findByText("Couldn't revoke that app. Try again.")).toBeTruthy();
        expect(screen.getByTestId("connected-app")).toBeTruthy();
    });

    it("turning write off saves read-only scopes", async () => {
        updateMcpConnection.mockResolvedValue({
            ok: true,
            connection: { ...CONN, scope: "read" },
        });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Change" }));
        await user.click(screen.getByRole("checkbox", { name: "Make changes" }));
        await waitFor(() =>
            expect(updateMcpConnection).toHaveBeenCalledWith("tok", "c1", { scopes: ["mcp:read"] })
        );
        expect(await screen.findByText("Read")).toBeTruthy();
    });

    it("deleting is only offered with write", async () => {
        listMcpConnections.mockResolvedValue({
            connections: [{ ...CONN, scope: "read" }],
            availableTeams: AVAILABLE,
        });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        await userEvent.setup().click(screen.getByRole("button", { name: "Change" }));
        expect(
            (screen.getByRole("checkbox", { name: /Allow deleting/ }) as HTMLInputElement).disabled
        ).toBe(true);
    });

    it("removing a team saves the rest and moves the default if needed", async () => {
        updateMcpConnection.mockResolvedValue({
            ...CONN,
            teamIds: ["t2"],
            defaultTeamId: "t2",
            teams: [CONN.teams[1]],
        });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Change" }));
        await user.click(screen.getByRole("button", { name: "Remove Alpha from this app" }));
        await waitFor(() =>
            expect(updateMcpConnection).toHaveBeenCalledWith("tok", "c1", {
                teamIds: ["t2"],
                defaultTeamId: "t2",
            })
        );
    });

    it("the last team cannot be removed", async () => {
        listMcpConnections.mockResolvedValue({
            connections: [{ ...CONN, teamIds: ["t1"], teams: [CONN.teams[0]] }],
            availableTeams: [CONN.teams[0]],
        });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        await userEvent.setup().click(screen.getByRole("button", { name: "Change" }));
        expect(
            (
                screen.getByRole("button", {
                    name: "Remove Alpha from this app",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });

    it("changing the default team saves it", async () => {
        updateMcpConnection.mockResolvedValue({
            ok: true,
            connection: { ...CONN, defaultTeamId: "t2" },
        });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Change" }));
        await user.click(screen.getByRole("radio", { name: "Make Beta the default team" }));
        await waitFor(() =>
            expect(updateMcpConnection).toHaveBeenCalledWith("tok", "c1", { defaultTeamId: "t2" })
        );
    });

    it("says so when a change cannot be saved", async () => {
        updateMcpConnection.mockResolvedValue({ ok: false, gone: false, error: null });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Change" }));
        await user.click(screen.getByRole("checkbox", { name: "Make changes" }));
        expect(await screen.findByText("Couldn't save that change.")).toBeTruthy();
    });

    it("shows the host of a client that is a metadata document", async () => {
        listMcpConnections.mockResolvedValue({
            connections: [
                {
                    ...CONN,
                    client: {
                        name: "Docs",
                        kind: "metadata_document",
                        host: "client.example.org",
                    },
                },
            ],
            availableTeams: AVAILABLE,
        });
        render(<ConnectedAppsSection />);
        expect(await screen.findByText("client.example.org")).toBeTruthy();
    });

    it("offers only the teams the connection does not have yet", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Change" }));
        expect(screen.getByRole("checkbox", { name: "Add Gamma to this app" })).toBeTruthy();
        expect(screen.queryByRole("checkbox", { name: "Add Alpha to this app" })).toBeNull();
        expect(screen.queryByRole("checkbox", { name: "Add Beta to this app" })).toBeNull();
        expect(screen.queryByText(/connect the app again/i)).toBeNull();
    });

    it("adding a team sends the union and keeps the default", async () => {
        updateMcpConnection.mockResolvedValue({
            ok: true,
            connection: {
                ...CONN,
                teamIds: ["t1", "t2", "t3"],
                teams: [...CONN.teams, { id: "t3", name: "Gamma" }],
            },
        });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Change" }));
        await user.click(screen.getByRole("checkbox", { name: "Add Gamma to this app" }));
        await waitFor(() =>
            expect(updateMcpConnection).toHaveBeenCalledWith("tok", "c1", {
                teamIds: ["t1", "t2", "t3"],
                defaultTeamId: "t1",
            })
        );
        // Now it has Gamma, so it is no longer offered.
        await waitFor(() =>
            expect(screen.queryByRole("checkbox", { name: "Add Gamma to this app" })).toBeNull()
        );
    });

    it("offers nothing to add when the member has no other team", async () => {
        listMcpConnections.mockResolvedValue({ connections: [CONN], availableTeams: CONN.teams });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        await userEvent.setup().click(screen.getByRole("button", { name: "Change" }));
        expect(screen.queryByText("Add a team")).toBeNull();
    });

    it("a change to a connection that is gone says so and refreshes the list", async () => {
        updateMcpConnection.mockResolvedValue({ ok: false, gone: true, error: null });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        listMcpConnections.mockResolvedValue({ connections: [], availableTeams: AVAILABLE });
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Change" }));
        await user.click(screen.getByRole("checkbox", { name: "Make changes" }));
        expect(await screen.findByText("That app was already disconnected.")).toBeTruthy();
        await waitFor(() => expect(screen.queryByTestId("connected-app")).toBeNull());
        expect(listMcpConnections).toHaveBeenCalledTimes(2);
    });

    it("revoking a connection that is already gone just removes the card", async () => {
        revokeMcpConnection.mockResolvedValue({ ok: false, gone: true, error: null });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        listMcpConnections.mockResolvedValue({ connections: [], availableTeams: AVAILABLE });
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Revoke" }));
        await user.click(screen.getByRole("button", { name: "Revoke" }));
        await waitFor(() => expect(screen.queryByTestId("connected-app")).toBeNull());
        expect(screen.queryByText("Couldn't revoke that app. Try again.")).toBeNull();
    });
});
