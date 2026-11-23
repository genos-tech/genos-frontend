/**
 * MIP-2090: the GitHub row of the Connections card, one test per state.
 *
 * The server adds a `github_app` block to `/integrations/me/` only while GITHUB_APP_ENABLED is
 * on. Without it the card is the OAuth-era card, byte for byte; with it the row says what the
 * team's installation and the person's authorization are, and every button goes through the
 * same Connect GitHub call.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionsSection } from "../features/integrations/components/ConnectionsSection";
import type { ConnectionsResponse } from "../features/integrations/services/connections";

const listConnections = vi.fn();
const disconnectAccount = vi.fn();
const redirectToOAuthConnect = vi.fn();

vi.mock("../features/integrations/services/connections", async () => {
    const actual = await vi.importActual<
        typeof import("../features/integrations/services/connections")
    >("../features/integrations/services/connections");
    return {
        ...actual,
        listConnections: (...a: unknown[]) => listConnections(...a),
        disconnectAccount: (...a: unknown[]) => disconnectAccount(...a),
    };
});
vi.mock("../features/integrations/services/oauth", () => ({
    redirectToOAuthConnect: (...a: unknown[]) => redirectToOAuthConnect(...a),
}));

const account = (over: object) => ({
    id: "a1",
    provider: "github",
    provider_email: "ken@example.com",
    label: "ken",
    scopes: [],
    connected_at: "2026-11-01T00:00:00Z",
    is_primary: false,
    ...over,
});

const installation = (over: object = {}) => ({
    installation_id: 11,
    account_login: "genos-tech",
    account_type: "Organization",
    repository_selection: "selected",
    suspended: false,
    manage_url: "https://github.com/organizations/genos-tech/settings/installations/11",
    ...over,
});

const block = (over: object = {}) => ({
    enabled: true,
    team_id: "team-1",
    can_link: true,
    installations: [] as object[],
    ...over,
});

const respond = (connections: object[], github_app?: object) =>
    listConnections.mockResolvedValue({
        primary_auth_provider: "email",
        connections,
        ...(github_app ? { github_app } : {}),
    } as ConnectionsResponse);

const setup = () =>
    render(
        <CssVarsProvider>
            <ConnectionsSection accessToken="tok" />
        </CssVarsProvider>
    );

/** The card of the (first) GitHub row. */
const githubCard = async (): Promise<HTMLElement> => {
    const title = (await screen.findAllByText("GitHub"))[0];
    return title.closest(".MuiCard-root") as HTMLElement;
};

beforeEach(() => {
    vi.clearAllMocks();
    disconnectAccount.mockResolvedValue(true);
});
afterEach(cleanup);

describe("GitHub row: App off", () => {
    it("no block from the server: exactly the OAuth-era row, no App wording", async () => {
        respond([account({})]);
        setup();
        const card = await githubCard();
        expect(within(card).getByText("ken@example.com")).toBeTruthy();
        expect(within(card).getByRole("button", { name: "Disconnect" })).toBeTruthy();
        expect(card.textContent).not.toMatch(/GitHub App|Reconnect|Authorize|Manage on GitHub/);
    });

    it("a block that says enabled=false is also off", async () => {
        respond([account({})], block({ enabled: false, installations: [installation()] }));
        setup();
        const card = await githubCard();
        expect(card.textContent).not.toMatch(/GitHub App|Authorize|Manage on GitHub/);
    });

    it("not connected, App off: the plain Connect button", async () => {
        respond([]);
        setup();
        const card = await githubCard();
        expect(within(card).getByText("Not connected")).toBeTruthy();
        fireEvent.click(within(card).getByRole("button", { name: "Connect" }));
        expect(redirectToOAuthConnect).toHaveBeenCalledWith(
            "github",
            "tok",
            undefined,
            expect.any(Function)
        );
    });
});

describe("GitHub row: App on", () => {
    it("not connected, nothing installed: Connect (the server picks the install page)", async () => {
        respond([], block());
        setup();
        const card = await githubCard();
        expect(within(card).getByText("Not connected")).toBeTruthy();
        fireEvent.click(within(card).getByRole("button", { name: "Connect" }));
        expect(redirectToOAuthConnect).toHaveBeenCalledTimes(1);
        expect(redirectToOAuthConnect.mock.calls[0][0]).toBe("github");
    });

    it("connected through the App: says so and links each installation's settings page", async () => {
        respond(
            [account({ id: "app1", provider: "github_app" })],
            block({
                installations: [
                    installation(),
                    installation({
                        installation_id: 22,
                        account_login: "kamikenpro",
                        account_type: "User",
                        manage_url: "https://github.com/settings/installations/22",
                    }),
                ],
            })
        );
        setup();
        const card = await githubCard();
        expect(card.textContent).toMatch(/Connected through the Genos GitHub App/);
        expect(card.textContent).toMatch(/read-only/);
        const links = within(card).getAllByRole("link", { name: /Manage on GitHub/ });
        expect(links.map((a) => a.getAttribute("href"))).toEqual([
            "https://github.com/organizations/genos-tech/settings/installations/11",
            "https://github.com/settings/installations/22",
        ]);
        for (const a of links) {
            expect(a.getAttribute("target")).toBe("_blank");
            expect(a.getAttribute("rel")).toContain("noreferrer");
        }
        // The connection itself is the App's authorization: it has a Disconnect.
        expect(within(card).getByRole("button", { name: "Disconnect" })).toBeTruthy();
    });

    it("needs authorize: the team installed the App, this person has not authorized it", async () => {
        respond([], block({ installations: [installation()] }));
        setup();
        const card = await githubCard();
        expect(card.textContent).toMatch(
            /Your team installed the GitHub App on genos-tech\. Authorize it/
        );
        expect(within(card).getByRole("link", { name: /Manage on GitHub/ })).toBeTruthy();
        fireEvent.click(within(card).getByRole("button", { name: "Authorize" }));
        expect(redirectToOAuthConnect).toHaveBeenCalledTimes(1);
        expect(within(card).queryByRole("button", { name: "Connect" })).toBeNull();
    });

    it("needs authorize with a legacy OAuth row: Authorize beside the old Disconnect", async () => {
        respond([account({})], block({ installations: [installation()] }));
        setup();
        const card = await githubCard();
        expect(within(card).getByRole("button", { name: "Authorize" })).toBeTruthy();
        expect(within(card).getByRole("button", { name: "Disconnect" })).toBeTruthy();
    });

    it("legacy OAuth connection, nothing installed: the narrower-access hint and Reconnect", async () => {
        respond([account({})], block());
        setup();
        const card = await githubCard();
        expect(card.textContent).toMatch(/narrower, per-repository access/);
        fireEvent.click(within(card).getByRole("button", { name: "Reconnect" }));
        expect(redirectToOAuthConnect).toHaveBeenCalledTimes(1);
    });

    it("an App authorization but no installation for this team: Install", async () => {
        respond([account({ id: "app1", provider: "github_app" })], block());
        setup();
        const card = await githubCard();
        expect(card.textContent).toMatch(/isn't installed for this team yet/);
        fireEvent.click(within(card).getByRole("button", { name: "Install" }));
        expect(redirectToOAuthConnect).toHaveBeenCalledTimes(1);
    });

    it("a suspended installation is flagged and still links to GitHub", async () => {
        respond(
            [account({ id: "app1", provider: "github_app" })],
            block({ installations: [installation({ suspended: true })] })
        );
        setup();
        const card = await githubCard();
        expect(within(card).getByText("Suspended on GitHub")).toBeTruthy();
        expect(within(card).getByRole("link", { name: /Manage on GitHub/ })).toBeTruthy();
    });

    it("a person who may not link (not owner or editor) cannot press Authorize or Connect", async () => {
        respond([], block({ can_link: false, installations: [installation()] }));
        setup();
        const card = await githubCard();
        const button = within(card).getByRole("button", { name: "Authorize" });
        expect(button.hasAttribute("disabled")).toBe(true);
    });

    it("an unknown team (team_id null) never locks the button: the server answers", async () => {
        respond([], block({ team_id: null, can_link: false, installations: [installation()] }));
        setup();
        const card = await githubCard();
        const button = within(card).getByRole("button", { name: "Authorize" });
        expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("both an App row and a legacy row: two rows, each with its own Disconnect", async () => {
        respond(
            [
                account({ id: "app1", provider: "github_app", provider_email: "app@example.com" }),
                account({ id: "old1", provider: "github", provider_email: "old@example.com" }),
            ],
            block({ installations: [installation()] })
        );
        setup();
        expect(await screen.findByText("app@example.com")).toBeTruthy();
        expect(screen.getByText("old@example.com")).toBeTruthy();
        // Google has none; the two GitHub rows each carry one Disconnect.
        expect(screen.getAllByRole("button", { name: "Disconnect" })).toHaveLength(2);
    });
});

describe("disconnecting the App authorization", () => {
    it("names GitHub, says the installation stays, and removes that row only", async () => {
        respond(
            [account({ id: "app1", provider: "github_app" })],
            block({ installations: [installation()] })
        );
        setup();
        const card = await githubCard();
        fireEvent.click(within(card).getByRole("button", { name: "Disconnect" }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Disconnect GitHub?")).toBeTruthy();
        expect(dialog.textContent).toMatch(/authorization of the GitHub App/);
        expect(dialog.textContent).toMatch(/installation stays on GitHub/);
        fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
        await waitFor(() => expect(disconnectAccount).toHaveBeenCalledTimes(1));
        expect(disconnectAccount.mock.calls[0][1]).toBe("app1");
    });
});
