import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OAuthConsentPage } from "../features/admin/components/OAuthConsentPage";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const getConsentContext = vi.fn();
const submitConsentDecision = vi.fn();
vi.mock("../services/mcpConnections", () => ({
    getConsentContext: (...a: unknown[]) => getConsentContext(...a),
    submitConsentDecision: (...a: unknown[]) => submitConsentDecision(...a),
}));

const QUERY =
    "?response_type=code&client_id=abc&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&state=xyz" +
    "&scope=mcp%3Aread+mcp%3Awrite+mcp%3Adestructive&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" +
    "&code_challenge_method=S256&resource=https%3A%2F%2Fapi.example.test%2Fmcp";

const CONTEXT = {
    client: { name: "Claude", kind: "registered", host: "", redirectHost: "claude.ai" },
    scopes: [
        { name: "mcp:read", description: "Read" },
        { name: "mcp:write", description: "Write" },
        { name: "mcp:destructive", description: "Delete" },
    ],
    teams: [
        { id: "t1", name: "Alpha" },
        { id: "t2", name: "Beta" },
    ],
    planAllowed: true,
    existing: null,
};

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const render = (search = QUERY) =>
    rtlRender(
        <CssVarsProvider>
            <MemoryRouter initialEntries={[`/oauth/consent${search}`]}>
                <Routes>
                    <Route element={<OAuthConsentPage />} path="/oauth/consent" />
                    <Route element={<Where />} path="/signin" />
                </Routes>
            </MemoryRouter>
        </CssVarsProvider>
    );

const assign = vi.fn();
const realLocation = window.location;

beforeEach(() => {
    getConsentContext.mockReset();
    submitConsentDecision.mockReset();
    assign.mockReset();
    localStorage.setItem("isSigningIn", "yes");
    localStorage.setItem("teamId", "t2");
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...realLocation, assign },
    });
    getConsentContext.mockResolvedValue({ ok: true, context: CONTEXT });
});

afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: realLocation });
    localStorage.clear();
});

describe("OAuthConsentPage", () => {
    it("shows who is asking, where it goes back to, and the starting choices", async () => {
        render();
        expect(
            await screen.findByRole("heading", { name: /Connect Claude to Genos/ })
        ).toBeTruthy();
        expect(screen.getByText(/sent back to claude\.ai/)).toBeTruthy();
        expect(screen.getByText(/Anyone can register an app under any name/)).toBeTruthy();
        // Read is always on and cannot be turned off.
        const read = screen.getByRole("checkbox", {
            name: /Read what you can see/,
        }) as HTMLInputElement;
        expect(read.checked).toBe(true);
        expect(read.disabled).toBe(true);
        // Write is what was asked for; deleting starts off.
        expect(
            (screen.getByRole("checkbox", { name: "Make changes" }) as HTMLInputElement).checked
        ).toBe(true);
        expect(
            (screen.getByRole("checkbox", { name: /Allow deleting/ }) as HTMLInputElement).checked
        ).toBe(false);
        // The team the member works in (t2) is the default and the only one ticked.
        expect((screen.getByRole("checkbox", { name: "Beta" }) as HTMLInputElement).checked).toBe(
            true
        );
        expect((screen.getByRole("checkbox", { name: "Alpha" }) as HTMLInputElement).checked).toBe(
            false
        );
        expect(
            (screen.getByRole("radio", { name: "Make Beta the default team" }) as HTMLInputElement)
                .checked
        ).toBe(true);
    });

    it("sends the query it was given, as the params, to the API", async () => {
        render();
        await screen.findByRole("heading", { name: /Connect Claude/ });
        const params = getConsentContext.mock.calls[0][1];
        expect(params.client_id).toBe("abc");
        expect(params.redirect_uri).toBe("https://claude.ai/cb");
        expect(params.resource).toEqual(["https://api.example.test/mcp"]);
    });

    it("shows the host of a client that is a metadata document, not the registered-app warning", async () => {
        getConsentContext.mockResolvedValue({
            ok: true,
            context: {
                ...CONTEXT,
                client: {
                    name: "Docs",
                    kind: "metadata_document",
                    host: "client.example.org",
                    redirectHost: "client.example.org",
                },
            },
        });
        render();
        expect(await screen.findByText(/identified by client\.example\.org/)).toBeTruthy();
        expect(screen.queryByText(/Anyone can register/)).toBeNull();
    });

    it("allowing sends the choices and goes to the address the API answers with", async () => {
        submitConsentDecision.mockResolvedValue({
            ok: true,
            redirectTo: "https://claude.ai/cb?code=c&state=xyz",
        });
        render();
        await screen.findByRole("heading", { name: /Connect Claude/ });
        const user = userEvent.setup();
        await user.click(screen.getByRole("checkbox", { name: /Allow deleting/ }));
        await user.click(screen.getByRole("checkbox", { name: "Alpha" }));
        await user.click(screen.getByRole("button", { name: "Allow" }));
        await waitFor(() =>
            expect(assign).toHaveBeenCalledWith("https://claude.ai/cb?code=c&state=xyz")
        );
        expect(submitConsentDecision).toHaveBeenCalledWith(
            "tok",
            expect.objectContaining({ client_id: "abc" }),
            {
                allow: true,
                scopes: ["mcp:read", "mcp:write", "mcp:destructive"],
                teamIds: ["t2", "t1"],
                defaultTeamId: "t2",
            }
        );
    });

    it("turning write off turns deleting off and disables it", async () => {
        render();
        await screen.findByRole("heading", { name: /Connect Claude/ });
        const user = userEvent.setup();
        await user.click(screen.getByRole("checkbox", { name: /Allow deleting/ }));
        await user.click(screen.getByRole("checkbox", { name: "Make changes" }));
        const del = screen.getByRole("checkbox", { name: /Allow deleting/ }) as HTMLInputElement;
        expect(del.checked).toBe(false);
        expect(del.disabled).toBe(true);
        submitConsentDecision.mockResolvedValue({
            ok: true,
            redirectTo: "https://claude.ai/cb?code=c",
        });
        await user.click(screen.getByRole("button", { name: "Allow" }));
        await waitFor(() => expect(submitConsentDecision).toHaveBeenCalled());
        expect(submitConsentDecision.mock.calls[0][2].scopes).toEqual(["mcp:read"]);
    });

    it("denying sends allow:false and goes where the API says", async () => {
        submitConsentDecision.mockResolvedValue({
            ok: true,
            redirectTo: "https://claude.ai/cb?error=access_denied&state=xyz",
        });
        render();
        await screen.findByRole("heading", { name: /Connect Claude/ });
        await userEvent.setup().click(screen.getByRole("button", { name: "Deny" }));
        await waitFor(() =>
            expect(assign).toHaveBeenCalledWith(
                "https://claude.ai/cb?error=access_denied&state=xyz"
            )
        );
        expect(submitConsentDecision.mock.calls[0][2]).toEqual({ allow: false });
    });

    it("never navigates to an address that is not https or loopback", async () => {
        submitConsentDecision.mockResolvedValue({ ok: true, redirectTo: "javascript:alert(1)" });
        render();
        await screen.findByRole("heading", { name: /Connect Claude/ });
        await userEvent.setup().click(screen.getByRole("button", { name: "Allow" }));
        expect(await screen.findByText("Something went wrong. Nothing was changed.")).toBeTruthy();
        expect(assign).not.toHaveBeenCalled();
    });

    it("cannot allow with no team ticked, and Allow is off without teams", async () => {
        getConsentContext.mockResolvedValue({ ok: true, context: { ...CONTEXT, teams: [] } });
        render();
        expect(await screen.findByText(/Join a team in Genos first/)).toBeTruthy();
        expect((screen.getByRole("button", { name: "Allow" }) as HTMLButtonElement).disabled).toBe(
            true
        );
        expect((screen.getByRole("button", { name: "Deny" }) as HTMLButtonElement).disabled).toBe(
            false
        );
    });

    it("shows the plan message and blocks Allow when the plan lacks MCP", async () => {
        getConsentContext.mockResolvedValue({
            ok: true,
            context: { ...CONTEXT, planAllowed: false },
        });
        render();
        expect(await screen.findByText(/Pro plan and above/)).toBeTruthy();
        expect((screen.getByRole("button", { name: "Allow" }) as HTMLButtonElement).disabled).toBe(
            true
        );
        expect(screen.getByRole("link", { name: "See plans" }).getAttribute("href")).toBe(
            "/plans"
        );
    });

    it("shows the plan message when the decision is refused for the plan", async () => {
        submitConsentDecision.mockResolvedValue({
            ok: false,
            failure: { error: "plan_required", description: "", redirectTo: null, status: 403 },
        });
        render();
        await screen.findByRole("heading", { name: /Connect Claude/ });
        await userEvent.setup().click(screen.getByRole("button", { name: "Allow" }));
        expect(await screen.findByText(/Pro plan and above/)).toBeTruthy();
        expect(assign).not.toHaveBeenCalled();
    });

    it("shows an invalid-teams refusal on the page and stays", async () => {
        submitConsentDecision.mockResolvedValue({
            ok: false,
            failure: { error: "invalid_teams", description: "x", redirectTo: null, status: 400 },
        });
        render();
        await screen.findByRole("heading", { name: /Connect Claude/ });
        await userEvent.setup().click(screen.getByRole("button", { name: "Allow" }));
        expect(await screen.findByText(/Choose only teams you belong to/)).toBeTruthy();
        expect(assign).not.toHaveBeenCalled();
    });

    it("a request the API refuses with a trusted address sends the browser back to the app", async () => {
        getConsentContext.mockResolvedValue({
            ok: false,
            failure: {
                error: "invalid_scope",
                description: "x",
                redirectTo: "https://claude.ai/cb?error=invalid_scope&state=xyz",
                status: 400,
            },
        });
        render();
        await waitFor(() =>
            expect(assign).toHaveBeenCalledWith(
                "https://claude.ai/cb?error=invalid_scope&state=xyz"
            )
        );
    });

    it("a request refused with no trusted address is shown, and the browser stays", async () => {
        getConsentContext.mockResolvedValue({
            ok: false,
            failure: {
                error: "invalid_request",
                description: "The redirect address is not registered.",
                redirectTo: null,
                status: 400,
            },
        });
        render();
        expect(await screen.findByText("The redirect address is not registered.")).toBeTruthy();
        expect(assign).not.toHaveBeenCalled();
    });

    it("an incomplete link says so without calling the API", async () => {
        render("?client_id=abc");
        expect(await screen.findByText("This link is incomplete")).toBeTruthy();
        expect(getConsentContext).not.toHaveBeenCalled();
    });

    it("signed out: remembers the request and goes to sign in", async () => {
        localStorage.removeItem("isSigningIn");
        render();
        expect((await screen.findByTestId("where")).textContent).toBe("/signin");
        expect(sessionStorage.getItem("genos-pending-return")).toBe(`/oauth/consent${QUERY}`);
        expect(getConsentContext).not.toHaveBeenCalled();
    });

    it("an expired session while loading goes to sign in and comes back", async () => {
        getConsentContext.mockResolvedValue({
            ok: false,
            failure: { error: "server_error", description: "", redirectTo: null, status: 401 },
        });
        render();
        expect((await screen.findByTestId("where")).textContent).toBe("/signin");
        expect(sessionStorage.getItem("genos-pending-return")).toBe(`/oauth/consent${QUERY}`);
    });

    it("an existing connection starts from its own settings", async () => {
        getConsentContext.mockResolvedValue({
            ok: true,
            context: {
                ...CONTEXT,
                existing: {
                    active: true,
                    scope: "read",
                    allowDestructive: false,
                    defaultTeamId: "t1",
                    teamIds: ["t1", "t2"],
                },
            },
        });
        render();
        expect(await screen.findByText(/Already connected/)).toBeTruthy();
        expect(
            (screen.getByRole("checkbox", { name: "Make changes" }) as HTMLInputElement).checked
        ).toBe(false);
        expect((screen.getByRole("checkbox", { name: "Alpha" }) as HTMLInputElement).checked).toBe(
            true
        );
        expect(
            (
                screen.getByRole("radio", {
                    name: "Make Alpha the default team",
                }) as HTMLInputElement
            ).checked
        ).toBe(true);
    });
});
