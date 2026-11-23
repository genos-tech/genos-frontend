/**
 * MIP-2090: for a team whose GitHub connection is the App, the GitHub tab drops "Register a
 * repository" and the manual webhook steps (they exist only because the OAuth integration needs
 * a hook per repository), and the repo-access card says the selection is made on GitHub. For
 * every other team the tab is what it was.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GithubTab } from "../features/integrations/IntegrationsHome";
import {
    isGithubConnected,
    teamUsesGithubApp,
    type ConnectionsResponse,
} from "../features/integrations/services/connections";

vi.mock("../features/integrations/services/github", async () => {
    const actual = await vi.importActual<
        typeof import("../features/integrations/services/github")
    >("../features/integrations/services/github");
    return {
        ...actual,
        listMyPulls: vi.fn().mockResolvedValue({ pulls: [] }),
        listAccessibleRepos: vi.fn().mockResolvedValue({
            repos: [],
            owners: [],
            truncated: false,
            manage_url: "https://github.com/apps/genos-test-app/installations/new",
        }),
    };
});
vi.mock("../features/integrations/components/GithubRepoRegistration", () => ({
    GithubRepoRegistration: () => <div data-testid="register-repo" />,
}));

const renderTab = (appMode: boolean) =>
    render(
        <CssVarsProvider>
            <MemoryRouter>
                <GithubTab accessToken="tok" appMode={appMode} githubConnected />
            </MemoryRouter>
        </CssVarsProvider>
    );

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("GitHub tab", () => {
    it("OAuth team: register-a-repository, manual webhook and the re-authorize button show", async () => {
        renderTab(false);
        expect(await screen.findByTestId("register-repo")).toBeTruthy();
        expect(screen.getByText("Auto-close tasks when their PR is merged")).toBeTruthy();
        expect(await screen.findByRole("button", { name: "Re-authorize GitHub" })).toBeTruthy();
        expect(screen.getByText(/reaches GitHub with your account's permissions/)).toBeTruthy();
    });

    it("App team: neither panel shows; the access card points at the installation", async () => {
        renderTab(true);
        expect(await screen.findByText(/through the GitHub App/)).toBeTruthy();
        expect(screen.queryByTestId("register-repo")).toBeNull();
        expect(screen.queryByText("Auto-close tasks when their PR is merged")).toBeNull();
        expect(screen.queryByRole("button", { name: "Re-authorize GitHub" })).toBeNull();
        const manage = await screen.findByRole("link", { name: /Manage access on GitHub/ });
        expect(manage.getAttribute("href")).toBe(
            "https://github.com/apps/genos-test-app/installations/new"
        );
    });
});

describe("what counts as the App", () => {
    const data = (over: Partial<ConnectionsResponse>): ConnectionsResponse => ({
        primary_auth_provider: "email",
        connections: [],
        ...over,
    });
    const inst = {
        installation_id: 1,
        account_login: "a",
        account_type: "User" as const,
        repository_selection: "all" as const,
        suspended: false,
        manage_url: "https://github.com/settings/installations/1",
    };
    const app = (over: object = {}) => ({
        enabled: true,
        team_id: "t",
        can_link: true,
        installations: [inst],
        ...over,
    });

    it("needs the block, enabled, and at least one installation", () => {
        expect(teamUsesGithubApp(null)).toBe(false);
        expect(teamUsesGithubApp(data({}))).toBe(false);
        expect(teamUsesGithubApp(data({ github_app: app({ enabled: false }) }))).toBe(false);
        expect(teamUsesGithubApp(data({ github_app: app({ installations: [] }) }))).toBe(false);
        expect(teamUsesGithubApp(data({ github_app: app() }))).toBe(true);
    });

    it("an App authorization alone is a GitHub connection, like the legacy one", () => {
        const row = (provider: "github" | "github_app") => ({
            id: "x",
            provider,
            provider_email: null,
            label: "x",
            scopes: [],
            connected_at: "",
            is_primary: false,
        });
        expect(isGithubConnected(data({ connections: [row("github_app")] }))).toBe(true);
        expect(isGithubConnected(data({ connections: [row("github")] }))).toBe(true);
        expect(isGithubConnected(data({}))).toBe(false);
        expect(isGithubConnected(null)).toBe(false);
    });
});
