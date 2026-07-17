/**
 * The renewal / expiry row in Settings → Plan & Usage.
 *
 * What matters: an active subscription shows its renewal date; a
 * scheduled cancellation flips the label to "plan ends" plus the
 * warning note (the user asked for exactly this — you must be able to
 * see that a cancel is pending); past_due surfaces the payment
 * problem; and with no subscription the row simply doesn't exist.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlanUsageSection } from "../components/layout/settings/PlanUsageSection";
import type { BillingSubscription } from "../services/billingApi";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

// `vi.mock` factories are hoisted above ordinary consts — anything a
// factory closes over must come from `vi.hoisted`.
const billingApi = vi.hoisted(() => ({
    fetchBillingConfig: vi.fn(),
    fetchBillingSubscription: vi.fn(),
    startCheckout: vi.fn(),
    openBillingPortal: vi.fn(),
    refreshBillingTier: vi.fn(),
}));
vi.mock("../services/billingApi", () => billingApi);

vi.mock("../services/agentApi", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    fetchAgentFeatures: vi.fn().mockResolvedValue({
        tier: "pro",
        tier_source: "personal",
        tier_team: null,
        llm_ask: { used: 1, limit: 100 },
        web_search: { used: 0, limit: 50 },
        message_retention_days: null,
        upload_max_mb: 25,
    }),
}));

// 2026-08-13 12:00 UTC — renders as "August 13, 2026" in en.
const PERIOD_END = 1786622400;

const sub = (over: Partial<BillingSubscription> = {}): BillingSubscription => ({
    plan: "pro",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: PERIOD_END,
    cancel_at: null,
    ...over,
});

const renderSection = () =>
    render(
        <MemoryRouter>
            <CssVarsProvider>
                <PlanUsageSection />
            </CssVarsProvider>
        </MemoryRouter>
    );

describe("PlanUsageSection subscription row", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        billingApi.fetchBillingConfig.mockResolvedValue({
            enabled: true,
            plans: ["pro", "max"],
            personal_tier: "pro",
            has_billing_account: true,
        });
    });

    it("active subscription shows the renewal date", async () => {
        billingApi.fetchBillingSubscription.mockResolvedValue(sub());
        renderSection();
        expect(await screen.findByText("Renews on")).toBeTruthy();
        expect(screen.getByText(/August 13, 2026/)).toBeTruthy();
        expect(screen.queryByText("Plan ends on")).toBeNull();
        expect(screen.queryByText(/cancellation is scheduled/i)).toBeNull();
    });

    it("scheduled cancellation shows the end date and the warning", async () => {
        billingApi.fetchBillingSubscription.mockResolvedValue(
            sub({ cancel_at_period_end: true, cancel_at: PERIOD_END })
        );
        renderSection();
        expect(await screen.findByText("Plan ends on")).toBeTruthy();
        expect(screen.getByText(/August 13, 2026/)).toBeTruthy();
        expect(screen.getByText(/cancellation is scheduled/i)).toBeTruthy();
        expect(screen.queryByText("Renews on")).toBeNull();
    });

    it("past_due surfaces the payment problem", async () => {
        billingApi.fetchBillingSubscription.mockResolvedValue(sub({ status: "past_due" }));
        renderSection();
        expect(await screen.findByText(/payment problem/i)).toBeTruthy();
    });

    it("no subscription renders no renewal row", async () => {
        billingApi.fetchBillingSubscription.mockResolvedValue(null);
        renderSection();
        // Wait for the section to finish loading first.
        expect(await screen.findByText("AI asks")).toBeTruthy();
        expect(screen.queryByText("Renews on")).toBeNull();
        expect(screen.queryByText("Plan ends on")).toBeNull();
    });
});
