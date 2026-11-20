/**
 * The first month of Core, free (MIP-1737): where the end date shows, and what a paused
 * connected app looks like.
 *
 * What matters: the date is shown ONLY while the server says the trial is what gives the plan
 * (`trial_ends_at` non-null); nothing is worked out client-side (no end date from "30 days", no
 * plan from a date); a payer or an account whose trial ended sees no trial wording at all; and a
 * connection the plan doesn't include stays listed, labelled paused, and can still be revoked.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectedAppsSection } from "../components/layout/ConnectedAppsSection";
import { PlanUsageSection } from "../components/layout/settings/PlanUsageSection";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const billingApi = vi.hoisted(() => ({
    fetchBillingConfig: vi.fn(),
    fetchBillingSubscription: vi.fn(),
    startCheckout: vi.fn(),
    openBillingPortal: vi.fn(),
    refreshBillingTier: vi.fn(),
}));
vi.mock("../services/billingApi", () => billingApi);

const agentApi = vi.hoisted(() => ({ fetchAgentFeatures: vi.fn() }));
vi.mock("../services/agentApi", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    fetchAgentFeatures: agentApi.fetchAgentFeatures,
}));

const mcp = vi.hoisted(() => ({
    listMcpConnections: vi.fn(),
    updateMcpConnection: vi.fn(),
    revokeMcpConnection: vi.fn(),
}));
vi.mock("../services/mcpConnections", () => mcp);

const features = (over: Record<string, unknown> = {}) => ({
    tier: "core",
    tier_source: "personal",
    tier_team: null,
    llm_ask: { used: 1, limit: 100 },
    web_search: { used: 0, limit: 25 },
    message_retention_days: 365,
    upload_max_mb: 25,
    ...over,
});

const renderPlan = () =>
    render(
        <MemoryRouter>
            <CssVarsProvider>
                <PlanUsageSection />
            </CssVarsProvider>
        </MemoryRouter>
    );

describe("Plan & Usage during the first month of Core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        billingApi.fetchBillingConfig.mockResolvedValue({
            enabled: true,
            plans: ["core", "pro", "max"],
            personal_tier: "free",
            has_billing_account: false,
        });
        billingApi.fetchBillingSubscription.mockResolvedValue(null);
    });

    it("names the end date, and what happens after, while the trial grants the plan", async () => {
        agentApi.fetchAgentFeatures.mockResolvedValue(
            features({ trial_ends_at: "2026-12-20T12:00:00+00:00" })
        );
        renderPlan();
        const note = await screen.findByTestId("trial-end-note");
        expect(
            within(note).getByText(/Your free month of Core ends on December 20, 2026\./)
        ).toBeTruthy();
        expect(within(note).getByText(/Your data stays/)).toBeTruthy();
        expect(screen.getByText("Free trial")).toBeTruthy();
        // The buy buttons stay: a trial is not a subscription.
        expect(screen.getByText("Upgrade to Core")).toBeTruthy();
    });

    it("shows no trial wording to a payer or after the trial", async () => {
        agentApi.fetchAgentFeatures.mockResolvedValue(features({ trial_ends_at: null }));
        renderPlan();
        expect(await screen.findByText("Plan & Usage")).toBeTruthy();
        expect(screen.queryByTestId("trial-end-note")).toBeNull();
        expect(screen.queryByText("Free trial")).toBeNull();
    });

    it("says nothing for a date it cannot read", async () => {
        agentApi.fetchAgentFeatures.mockResolvedValue(features({ trial_ends_at: "not a date" }));
        renderPlan();
        expect(await screen.findByText("Plan & Usage")).toBeTruthy();
        expect(screen.queryByTestId("trial-end-note")).toBeNull();
    });
});

describe("a connected app the plan does not include", () => {
    const conn = (paused: boolean) => ({
        id: "c1",
        paused,
        client: { name: "Claude", kind: "registered" as const, host: "", url: "" },
        scope: "write" as const,
        allowDestructive: false,
        defaultTeamId: "t1",
        teamIds: ["t1"],
        teams: [{ id: "t1", name: "Alpha" }],
        lastUsedAt: null,
        createdAt: "2026-11-06T00:00:00Z",
    });

    beforeEach(() => vi.clearAllMocks());

    it("stays listed, marked paused, with the way back, and can still be revoked", async () => {
        mcp.listMcpConnections.mockResolvedValue({
            connections: [conn(true)],
            availableTeams: [{ id: "t1", name: "Alpha" }],
        });
        render(
            <CssVarsProvider>
                <ConnectedAppsSection />
            </CssVarsProvider>
        );
        const card = await screen.findByTestId("connected-app");
        expect(card.getAttribute("data-paused")).toBe("true");
        expect(within(card).getByText("Paused")).toBeTruthy();
        expect(within(card).getByText(/works again on Core or above/)).toBeTruthy();
        expect(within(card).getByText("Revoke")).toBeTruthy();
    });

    it("a live connection carries no paused wording", async () => {
        mcp.listMcpConnections.mockResolvedValue({
            connections: [conn(false)],
            availableTeams: [{ id: "t1", name: "Alpha" }],
        });
        render(
            <CssVarsProvider>
                <ConnectedAppsSection />
            </CssVarsProvider>
        );
        const card = await screen.findByTestId("connected-app");
        expect(card.getAttribute("data-paused")).toBeNull();
        expect(within(card).queryByText("Paused")).toBeNull();
    });
});
