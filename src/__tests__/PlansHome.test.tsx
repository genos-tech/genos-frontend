/**
 * The `/workspace/plans` tier-comparison page.
 *
 * What matters: cards render straight from the `/billing/plans/`
 * payload (limits + Stripe prices), the CTA matrix mirrors
 * `PlanUsageSection` (free user → checkout buttons; existing personal
 * subscription → portal, never a second checkout; enterprise →
 * contact-sales), and a Stripe-dark backend still renders the
 * comparison with no buttons.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlansHome } from "../features/billing/PlansHome";
import type { BillingPlans } from "../services/billingApi";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const billingApi = vi.hoisted(() => ({
    fetchBillingPlans: vi.fn(),
    fetchBillingConfig: vi.fn(),
    fetchTeamBillingConfig: vi.fn(),
    startCheckout: vi.fn().mockResolvedValue(undefined),
    openBillingPortal: vi.fn().mockResolvedValue(undefined),
    startTeamCheckout: vi.fn().mockResolvedValue(undefined),
    openTeamBillingPortal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/billingApi", () => billingApi);

const PLANS: BillingPlans = {
    billing_enabled: true,
    tiers: [
        {
            tier: "free",
            price: { amount: 0, currency: "jpy", interval: "month" },
            purchasable: false,
            contact_sales: false,
            limits: {
                llm_ask_daily: 20,
                web_search_daily: 10,
                task_create_monthly: 200,
                note_create_monthly: 100,
                message_retention_days: 90,
                upload_max_mb: 10,
            },
        },
        {
            tier: "pro",
            price: { amount: 1200, currency: "jpy", interval: "month" },
            purchasable: true,
            contact_sales: false,
            limits: {
                llm_ask_daily: 100,
                web_search_daily: 25,
                task_create_monthly: 2000,
                note_create_monthly: 1000,
                message_retention_days: null,
                upload_max_mb: 25,
            },
        },
        {
            tier: "max",
            price: { amount: 2500, currency: "jpy", interval: "month" },
            purchasable: true,
            contact_sales: false,
            limits: {
                llm_ask_daily: 1000,
                web_search_daily: 100,
                task_create_monthly: 10000,
                note_create_monthly: 5000,
                message_retention_days: null,
                upload_max_mb: 100,
            },
        },
        {
            tier: "enterprise",
            price: null,
            purchasable: false,
            contact_sales: true,
            limits: {
                llm_ask_daily: null,
                web_search_daily: null,
                task_create_monthly: null,
                note_create_monthly: null,
                message_retention_days: null,
                upload_max_mb: 200,
            },
        },
    ],
};

const config = (over: object = {}) => ({
    enabled: true,
    plans: ["pro", "max"],
    personal_tier: "free",
    has_billing_account: false,
    ...over,
});

const renderPage = () =>
    render(
        <CssVarsProvider>
            <PlansHome />
        </CssVarsProvider>
    );

describe("PlansHome", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        billingApi.fetchBillingPlans.mockResolvedValue(PLANS);
        billingApi.fetchBillingConfig.mockResolvedValue(config());
        // Default: viewer owns no teams — the section is absent.
        billingApi.fetchTeamBillingConfig.mockResolvedValue({ enabled: true, teams: [] });
    });

    it("renders all four cards with Stripe prices and limits", async () => {
        renderPage();
        expect(await screen.findByText("Do more of your best work with Genos")).toBeTruthy();
        expect(screen.getByText("¥1,200")).toBeTruthy();
        expect(screen.getByText("¥2,500")).toBeTruthy();
        // "Free" appears as both the tier chip and the price line.
        expect(screen.getAllByText("Free").length).toBe(2);
        expect(screen.getByText("Contact sales")).toBeTruthy();
        expect(screen.getByText("20 AI asks every day")).toBeTruthy();
        expect(screen.getByText("10,000 tasks per month")).toBeTruthy();
        // Paid tiers + enterprise lead with unlimited history.
        expect(screen.getAllByText("Unlimited message history").length).toBe(3);
        // The recommended card carries the badge; paid tiers advertise
        // premium models (pro + max — enterprise has everything anyway).
        expect(screen.getByText("Best value")).toBeTruthy();
        expect(screen.getAllByText("Premium AI models included").length).toBe(3);
    });

    it("free user gets checkout buttons; clicking starts the right plan", async () => {
        renderPage();
        const pro = await screen.findByText("Upgrade to Pro");
        expect(screen.getByText("Upgrade to Max")).toBeTruthy();
        expect(screen.getByText("Current plan")).toBeTruthy(); // on the free card
        fireEvent.click(pro);
        await waitFor(() => expect(billingApi.startCheckout).toHaveBeenCalledWith("tok", "pro"));
    });

    it("renders a Core checkout button and starts the core plan", async () => {
        // Core is the cheapest paid rung; the CTA label comes from a
        // per-plan map, so a wrong entry would silently mislabel or
        // start checkout for the wrong plan.
        billingApi.fetchBillingPlans.mockResolvedValue({
            billing_enabled: true,
            tiers: [
                ...PLANS.tiers.slice(0, 1),
                {
                    tier: "core",
                    price: { amount: 1200, currency: "jpy", interval: "month" },
                    purchasable: true,
                    contact_sales: false,
                    limits: {
                        llm_ask_daily: 100,
                        web_search_daily: 25,
                        task_create_monthly: 1000,
                        note_create_monthly: 500,
                        message_retention_days: null,
                        upload_max_mb: 25,
                    },
                },
                ...PLANS.tiers.slice(1),
            ],
        });
        billingApi.fetchBillingConfig.mockResolvedValue(config({ plans: ["core", "pro", "max"] }));
        renderPage();
        const core = await screen.findByText("Upgrade to Core");
        fireEvent.click(core);
        await waitFor(() => expect(billingApi.startCheckout).toHaveBeenCalledWith("tok", "core"));
    });

    it("existing personal subscriber gets the portal, never a second checkout", async () => {
        billingApi.fetchBillingConfig.mockResolvedValue(
            config({ personal_tier: "pro", has_billing_account: true })
        );
        renderPage();
        expect(await screen.findByText("Current plan")).toBeTruthy(); // pro card
        expect(screen.queryByText("Upgrade to Pro")).toBeNull();
        expect(screen.queryByText("Upgrade to Max")).toBeNull();
        const manage = screen.getByText("Manage billing"); // max card only
        fireEvent.click(manage);
        await waitFor(() => expect(billingApi.openBillingPortal).toHaveBeenCalledWith("tok"));
    });

    it("enterprise card links to contact-sales", async () => {
        renderPage();
        const contact = await screen.findByText("Contact us");
        expect(contact.closest("a")?.getAttribute("href")).toContain("mailto:");
    });

    it("Stripe-dark backend still renders the comparison, without buttons", async () => {
        billingApi.fetchBillingPlans.mockResolvedValue({
            ...PLANS,
            billing_enabled: false,
            tiers: PLANS.tiers.map((t) =>
                t.tier === "pro" || t.tier === "max"
                    ? { ...t, price: null, purchasable: false }
                    : t
            ),
        });
        billingApi.fetchBillingConfig.mockResolvedValue(null);
        renderPage();
        expect(await screen.findByText("Do more of your best work with Genos")).toBeTruthy();
        expect(screen.getByText("20 AI asks every day")).toBeTruthy();
        expect(screen.queryByText("Upgrade to Pro")).toBeNull();
        expect(screen.queryByText("Manage billing")).toBeNull();
        expect(screen.queryByText("¥1,200")).toBeNull();
    });

    it("no owned teams: no team section", async () => {
        renderPage();
        expect(await screen.findByText("Do more of your best work with Genos")).toBeTruthy();
        expect(screen.queryByText("Team plan")).toBeNull();
    });

    it("owned free team: seat-priced checkout buttons wired with the team id", async () => {
        billingApi.fetchTeamBillingConfig.mockResolvedValue({
            enabled: true,
            teams: [
                {
                    team_id: "team-1",
                    team_name: "Apollo",
                    plan: "free",
                    seats: 3,
                    has_billing_account: false,
                },
            ],
        });
        renderPage();
        expect(await screen.findByText("Team plan")).toBeTruthy();
        expect(screen.getByText("Apollo")).toBeTruthy();
        expect(screen.getByText("3 seats")).toBeTruthy();
        // Price math from the plans payload: ¥1,200 × 3 seats.
        expect(screen.getByText(/¥1,200 × 3 seats \/ month/)).toBeTruthy();
        fireEvent.click(screen.getByText("Team Pro"));
        await waitFor(() =>
            expect(billingApi.startTeamCheckout).toHaveBeenCalledWith("tok", "team-1", "pro")
        );
    });

    it("paid team: portal button, never a second checkout", async () => {
        billingApi.fetchTeamBillingConfig.mockResolvedValue({
            enabled: true,
            teams: [
                {
                    team_id: "team-1",
                    team_name: "Apollo",
                    plan: "pro",
                    seats: 3,
                    has_billing_account: true,
                },
            ],
        });
        renderPage();
        const manage = await screen.findByText("Manage team billing");
        expect(screen.queryByText("Team Pro")).toBeNull();
        fireEvent.click(manage);
        await waitFor(() =>
            expect(billingApi.openTeamBillingPortal).toHaveBeenCalledWith("tok", "team-1")
        );
    });
});
