/**
 * The `/workspace/plans` tier-comparison page.
 *
 * What matters: cards render straight from the `/billing/plans/`
 * payload (limits + Stripe prices), each card's CTA is wired to the
 * right billing call (free viewer → checkout; subscriber → portal
 * deep links, never a second checkout; enterprise → contact-sales),
 * and a Stripe-dark backend still renders the comparison with no
 * buttons. The CTA *decision* itself is unit-tested in
 * `planCta.test.ts`; these tests pin the wiring.
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
    fetchBillingSubscription: vi.fn(),
    fetchCreditPacks: vi.fn().mockResolvedValue(null),
    startCheckout: vi.fn().mockResolvedValue(undefined),
    openBillingPortal: vi.fn().mockResolvedValue(undefined),
    startCreditPackCheckout: vi.fn().mockResolvedValue(undefined),
    startTeamCheckout: vi.fn().mockResolvedValue(undefined),
    openTeamBillingPortal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/billingApi", () => billingApi);

const agentApi = vi.hoisted(() => ({
    fetchAgentFeatures: vi.fn().mockResolvedValue(null),
}));
// The page reads only `fetchAgentFeatures` (for the credit balance
// beside the packs); the real module's other exports stay intact.
vi.mock("../services/agentApi", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ...agentApi,
}));

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

const CORE_TIER: BillingPlans["tiers"][number] = {
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
};

// The real five-card ladder, for the switch/downgrade cases — those
// need a rung BELOW the viewer's tier to aim at.
const PLANS_WITH_CORE: BillingPlans = {
    billing_enabled: true,
    tiers: [PLANS.tiers[0], CORE_TIER, ...PLANS.tiers.slice(1)],
};

const ALL_PLANS = ["core", "pro", "max"];

const config = (over: object = {}) => ({
    enabled: true,
    plans: ["pro", "max"],
    personal_tier: "free",
    has_billing_account: false,
    ...over,
});

const subscription = (over: object = {}) => ({
    plan: "pro",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: 1789000000,
    cancel_at: null,
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
        // The display currency is inferred from the browser's TIME ZONE,
        // so without this the assertions below depend on the machine
        // running them — "usd" on a UTC CI box, "jpy" on a laptop in
        // Tokyo. Pin it, the same way the API's ceiling tests had to stop
        // reading AI_CEILING_* out of the ambient environment.
        //
        // Only `resolvedOptions` is stubbed: formatting still goes
        // through the real Intl, so date and price rendering elsewhere in
        // these tests is untouched.
        const realOptions = new Intl.DateTimeFormat().resolvedOptions();
        vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
            ...realOptions,
            timeZone: "America/New_York",
        });
        billingApi.fetchBillingPlans.mockResolvedValue(PLANS);
        billingApi.fetchBillingConfig.mockResolvedValue(config());
        // Default: viewer owns no teams — the section is absent.
        billingApi.fetchTeamBillingConfig.mockResolvedValue({ enabled: true, teams: [] });
        // Default: no live Stripe subscription (free viewer).
        billingApi.fetchBillingSubscription.mockResolvedValue(null);
    });

    it("renders every tier as a column, with Stripe prices and limits", async () => {
        // The page moved from five cards to one comparison table, so the
        // limits are now short CELLS under a shared row label rather than
        // finished sentences per tier ("20" under "AI asks per day", not
        // "20 AI asks every day"). The facts asserted are the same ones.
        renderPage();
        expect(await screen.findByText("Do more of your best work with Genos")).toBeTruthy();
        expect(screen.getByText("¥1,200")).toBeTruthy();
        expect(screen.getByText("¥2,500")).toBeTruthy();
        // "Free" appears as both the tier heading and the price line.
        expect(screen.getAllByText("Free").length).toBe(2);
        expect(screen.getByText("Contact sales")).toBeTruthy();

        // A row is labelled once and answered per column — the property
        // the table exists for.
        expect(screen.getByText("AI asks per day")).toBeTruthy();
        expect(screen.getByText("20")).toBeTruthy();
        expect(screen.getByText("Tasks per month")).toBeTruthy();
        expect(screen.getByText("10,000")).toBeTruthy();
        // Paid tiers + enterprise keep history forever.
        expect(screen.getAllByText("Forever").length).toBe(3);

        expect(screen.getByText("Best value")).toBeTruthy();
        // Premium models: one row, crossed only on Free. This is the one
        // row not derived from the limits payload — `model_daily` is
        // deliberately not published — so it is worth pinning that it
        // still renders at all.
        expect(screen.getByText("Premium AI models")).toBeTruthy();
    });

    it("free user gets checkout buttons; clicking starts the right plan", async () => {
        renderPage();
        const pro = await screen.findByText("Upgrade to Pro");
        expect(screen.getByText("Upgrade to Max")).toBeTruthy();
        expect(screen.getByText("Current plan")).toBeTruthy(); // on the free card
        fireEvent.click(pro);
        // The third argument is the DISPLAY currency the page was
        // quoting — checkout must sell the price the visitor was
        // looking at, not whatever the server defaults to.
        await waitFor(() =>
            expect(billingApi.startCheckout).toHaveBeenCalledWith("tok", "pro", "usd")
        );
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
        await waitFor(() =>
            expect(billingApi.startCheckout).toHaveBeenCalledWith("tok", "core", "usd")
        );
    });

    it("paid subscriber sees a manage-subscription banner with the renewal date", async () => {
        // The banner is the ONLY obvious route to a downgrade or a
        // cancel; before it existed a subscriber's only affordance was a
        // portal button buried on another tier's card.
        billingApi.fetchBillingConfig.mockResolvedValue(
            config({ personal_tier: "max", has_billing_account: true })
        );
        billingApi.fetchBillingSubscription.mockResolvedValue({
            plan: "max",
            status: "active",
            cancel_at_period_end: false,
            current_period_end: 1789000000,
            cancel_at: null,
        });
        renderPage();
        expect(await screen.findByText("Your plan")).toBeTruthy();
        expect(screen.getAllByText(/Renews on/).length).toBeGreaterThan(0);
        const manage = screen.getAllByText("Manage billing")[0];
        fireEvent.click(manage);
        await waitFor(() => expect(billingApi.openBillingPortal).toHaveBeenCalledWith("tok"));
        expect(billingApi.startCheckout).not.toHaveBeenCalled();
    });

    it("scheduled cancellation shows the end date, not a renewal", async () => {
        // cancel_at wins over current_period_end — Stripe sets both, and
        // showing "renews" for a cancelling subscription promises a
        // charge that isn't coming.
        billingApi.fetchBillingConfig.mockResolvedValue(
            config({ personal_tier: "pro", has_billing_account: true })
        );
        billingApi.fetchBillingSubscription.mockResolvedValue({
            plan: "pro",
            status: "active",
            cancel_at_period_end: true,
            current_period_end: 1789000000,
            cancel_at: 1789000000,
        });
        renderPage();
        expect(await screen.findByText("Your plan")).toBeTruthy();
        expect(screen.getAllByText(/Plan ends on/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Renews on/)).toBeNull();
    });

    it("operator-set tier explains itself instead of offering a dead button", async () => {
        // A tier set via `feature_access set-tier` has no Stripe
        // customer, so there is genuinely nothing to self-manage. The
        // banner must say so rather than render a portal button that
        // would 4xx.
        billingApi.fetchBillingConfig.mockResolvedValue(
            config({ personal_tier: "max", has_billing_account: false })
        );
        billingApi.fetchBillingSubscription.mockResolvedValue(null);
        renderPage();
        expect(await screen.findByText("Your plan")).toBeTruthy();
        expect(screen.getByText("Set by your administrator")).toBeTruthy();
        expect(screen.queryByText("Manage billing")).toBeNull();
    });

    it("free user gets no subscription banner", async () => {
        renderPage();
        await screen.findByText("Upgrade to Pro");
        expect(screen.queryByText("Your plan")).toBeNull();
    });

    it("subscriber with no live subscription gets the banner only", async () => {
        // has_billing_account without a subscription (cancelled, or a
        // tier set by hand) — there is no Stripe object for a per-card
        // switch to target, so the cards stay bare.
        billingApi.fetchBillingConfig.mockResolvedValue(
            config({ personal_tier: "pro", has_billing_account: true })
        );
        renderPage();
        expect(await screen.findByText("Current plan")).toBeTruthy(); // pro card
        expect(screen.queryByText("Upgrade to Max")).toBeNull();
        const manage = screen.getByText("Manage billing"); // the banner
        fireEvent.click(manage);
        await waitFor(() => expect(billingApi.openBillingPortal).toHaveBeenCalledWith("tok"));
    });

    it("subscriber gets per-card switch buttons, never a second checkout", async () => {
        // The reported gap: once you subscribed, every button vanished
        // and the only affordance left was a generic "Manage billing".
        billingApi.fetchBillingPlans.mockResolvedValue(PLANS_WITH_CORE);
        billingApi.fetchBillingConfig.mockResolvedValue(
            config({ personal_tier: "pro", has_billing_account: true, plans: ALL_PLANS })
        );
        billingApi.fetchBillingSubscription.mockResolvedValue(subscription());
        renderPage();

        // Up the ladder reads as an upgrade, down as a neutral switch.
        const up = await screen.findByText("Upgrade to Max");
        expect(screen.getByText("Switch to Core")).toBeTruthy();
        expect(screen.getByText("Current plan")).toBeTruthy(); // pro card
        fireEvent.click(up);
        await waitFor(() =>
            expect(billingApi.openBillingPortal).toHaveBeenCalledWith("tok", "update", "max")
        );
        // The whole point of the portal route: no parallel subscription.
        expect(billingApi.startCheckout).not.toHaveBeenCalled();
    });

    it("downgrading routes through the portal with the target plan", async () => {
        billingApi.fetchBillingPlans.mockResolvedValue(PLANS_WITH_CORE);
        billingApi.fetchBillingConfig.mockResolvedValue(
            config({ personal_tier: "max", has_billing_account: true, plans: ALL_PLANS })
        );
        billingApi.fetchBillingSubscription.mockResolvedValue(subscription({ plan: "max" }));
        renderPage();
        fireEvent.click(await screen.findByText("Switch to Core"));
        await waitFor(() =>
            expect(billingApi.openBillingPortal).toHaveBeenCalledWith("tok", "update", "core")
        );
        expect(billingApi.startCheckout).not.toHaveBeenCalled();
    });

    it("the free card becomes the cancel action for a subscriber", async () => {
        billingApi.fetchBillingConfig.mockResolvedValue(
            config({ personal_tier: "pro", has_billing_account: true })
        );
        billingApi.fetchBillingSubscription.mockResolvedValue(subscription());
        renderPage();
        fireEvent.click(await screen.findByText("Cancel plan"));
        await waitFor(() =>
            expect(billingApi.openBillingPortal).toHaveBeenCalledWith("tok", "cancel")
        );
    });

    it("hides the cancel button once a cancellation is scheduled", async () => {
        billingApi.fetchBillingConfig.mockResolvedValue(
            config({ personal_tier: "pro", has_billing_account: true })
        );
        billingApi.fetchBillingSubscription.mockResolvedValue(
            subscription({ cancel_at_period_end: true, cancel_at: 1789000000 })
        );
        renderPage();
        expect(await screen.findByText("Current plan")).toBeTruthy();
        expect(screen.queryByText("Cancel plan")).toBeNull();
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
        // The comparison still renders in full — only the buy buttons go.
        expect(screen.getByText("AI asks per day")).toBeTruthy();
        expect(screen.getByText("20")).toBeTruthy();
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
            expect(billingApi.startTeamCheckout).toHaveBeenCalledWith(
                "tok",
                "team-1",
                "pro",
                "usd"
            )
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

    describe("credit packs", () => {
        const CATALOGUE = {
            packs: [
                { pack: "pack_100", credits: 100, price: { amount: 3000, currency: "usd" } },
                { pack: "pack_10", credits: 10, price: null },
            ],
            currency: "usd",
            available: true,
            unavailable_reason: "",
        };

        it("offers the packs and starts checkout for the right one", async () => {
            billingApi.fetchCreditPacks.mockResolvedValue(CATALOGUE);
            renderPage();
            const buy = await screen.findByText(/Buy 100 credits/);
            // A pack whose price lookup failed still renders, priceless —
            // hiding it would make the catalogue depend on a cache.
            expect(screen.getByText(/Buy 10 credits/)).toBeTruthy();
            fireEvent.click(buy);
            await waitFor(() =>
                expect(billingApi.startCreditPackCheckout).toHaveBeenCalledWith(
                    "tok",
                    "pack_100",
                    "usd"
                )
            );
        });

        it("explains instead of offering when packs are unavailable", async () => {
            billingApi.fetchCreditPacks.mockResolvedValue({
                ...CATALOGUE,
                available: false,
                unavailable_reason: "Your plan already includes unlimited AI credits.",
            });
            renderPage();
            expect(
                await screen.findByText("Your plan already includes unlimited AI credits.")
            ).toBeTruthy();
            expect(screen.queryByText(/Buy 100 credits/)).toBeNull();
        });

        it("shows no packs section at all when the catalogue cannot load", async () => {
            billingApi.fetchCreditPacks.mockResolvedValue(null);
            renderPage();
            await screen.findByText("Do more of your best work with Genos");
            expect(screen.queryByText("Need more credits?")).toBeNull();
        });

        it("shows the current balance beside the packs, both buckets", async () => {
            billingApi.fetchCreditPacks.mockResolvedValue(CATALOGUE);
            agentApi.fetchAgentFeatures.mockResolvedValue({
                credits: {
                    unlimited: false,
                    balance: 150,
                    limit: 70,
                    used: 20,
                    period_end_iso: "2026-09-01T00:00:00+00:00",
                    per_request_max: 5,
                    purchased_balance: 100,
                },
            });
            renderPage();
            // 150 total, 100 purchased -> the meter reads the monthly 50
            // of 70, and the pack gets its own non-expiring line.
            expect(await screen.findByText(/50 of 70 AI credits left/)).toBeTruthy();
            expect(screen.getByText(/\+100 bought credits/)).toBeTruthy();
        });
    });
});
