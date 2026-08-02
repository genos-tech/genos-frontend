/**
 * The quota meters read as "what's left", not "what you've used".
 *
 * Direction reversed 2026-08-02 by maintainer request: 0 used of 150
 * fills the bar; 150 used of 150 empties it. `CreditBalance` was flipped
 * in the same change — the two sit in one Settings modal and must not
 * drain opposite ways.
 *
 * The caption moved with the bar, and that part is not cosmetic. It used
 * to render "3 / 50 this month", a USED count. Beside a nearly-full bar
 * that says two opposite things at once, so it now reads "47 of 50 left
 * this month" — the same phrasing the credit meter already used.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanUsageSection } from "../components/layout/settings/PlanUsageSection";
import { I18nProvider } from "../i18n";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../services/billingApi", () => ({
    fetchBillingConfig: vi.fn(async () => null),
    fetchBillingSubscription: vi.fn(async () => null),
    openBillingPortal: vi.fn(),
    startCheckout: vi.fn(),
}));

const fetchAgentFeatures = vi.fn();
vi.mock("../services/agentApi", () => ({
    fetchAgentFeatures: (...a: unknown[]) => fetchAgentFeatures(...a),
}));

// `credits: null` is what routes the component down the per-dimension
// quota rows rather than the single credit meter.
const features = (used: number, limit: number | null) => ({
    tier: "pro",
    credits: null,
    llm_ask: { used, limit },
    web_search: { used: 0, limit: 10 },
    message_history_days: 30,
    max_upload_mb: 20,
});

const renderUsage = async (used: number, limit: number | null) => {
    fetchAgentFeatures.mockResolvedValue(features(used, limit));
    render(
        <I18nProvider>
            <PlanUsageSection />
        </I18nProvider>
    );
    await waitFor(() => expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0));
};

/** First bar is the AI-asks row — the one each case parameterises. */
const firstBar = (): number =>
    Number(screen.getAllByRole("progressbar")[0].getAttribute("aria-valuenow"));

describe("PlanUsageSection quota bars", () => {
    it("is FULL when nothing has been used", async () => {
        await renderUsage(0, 150);
        expect(firstBar()).toBe(100);
    });

    it("is EMPTY at the cap", async () => {
        await renderUsage(150, 150);
        expect(firstBar()).toBe(0);
    });

    it("drains proportionally in between", async () => {
        await renderUsage(30, 150);
        expect(firstBar()).toBe(80);
    });

    it("stays empty rather than negative past the cap", async () => {
        // A downgrade can lower a limit below what was already spent.
        await renderUsage(400, 150);
        expect(firstBar()).toBe(0);
    });

    it("captions the remainder, not the amount used", async () => {
        await renderUsage(3, 50);
        expect(screen.getByText(/47 of 50 left/)).toBeTruthy();
        // The old caption. If it ever comes back while the bar is
        // remaining-filled, the row contradicts itself.
        expect(screen.queryByText(/^3 \/ 50/)).toBeNull();
    });

    it("renders no bar for an unlimited allowance", async () => {
        fetchAgentFeatures.mockResolvedValue(features(0, null));
        render(
            <I18nProvider>
                <PlanUsageSection />
            </I18nProvider>
        );
        // Web searches still has a limit, so exactly one bar remains:
        // the unlimited row shows text instead of an empty meter.
        await waitFor(() => expect(screen.getAllByRole("progressbar").length).toBe(1));
    });
});
