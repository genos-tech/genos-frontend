/**
 * The plan-card CTA matrix (`planCta`).
 *
 * Tested directly rather than through `PlansHome` because it's a 5x5
 * grid (viewer tier x card tier) with three cross-cutting gates, and
 * the outcome that matters most — an existing subscriber never being
 * routed to Checkout — is a silent failure in a rendered snapshot:
 * a second Checkout Session opens a SECOND subscription on the same
 * Stripe customer, and the backend's reconcile (best active tier wins)
 * would keep showing the right plan while the user was billed twice.
 */
import { describe, expect, it } from "vitest";

import { planCta, PlanCtaInput } from "../features/billing/planCta";
import type { BillingSubscription } from "../services/billingApi";

const LIVE: BillingSubscription = {
    plan: "pro",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: 1789000000,
    cancel_at: null,
};

const at = (over: Partial<PlanCtaInput> = {}) =>
    planCta({
        cardTier: "max",
        personalTier: "free",
        billingEnabled: true,
        purchasable: true,
        contactSales: false,
        subscription: null,
        ...over,
    });

describe("planCta", () => {
    it("marks the viewer's own tier as current, whatever else is true", () => {
        expect(at({ cardTier: "pro", personalTier: "pro" })).toEqual({ kind: "current" });
        // Beats contact-sales: an enterprise viewer on the enterprise
        // card should see the badge, not a "contact us" button.
        expect(
            at({ cardTier: "enterprise", personalTier: "enterprise", contactSales: true })
        ).toEqual({ kind: "current" });
    });

    it("sends only free viewers to checkout", () => {
        expect(at({ personalTier: "free" })).toEqual({ kind: "checkout", plan: "max" });
        // Every paid viewer, every direction — none may reach checkout.
        for (const personalTier of ["core", "pro", "max"] as const) {
            for (const cardTier of ["core", "pro", "max"] as const) {
                const cta = at({ personalTier, cardTier, subscription: LIVE });
                expect(cta.kind).not.toBe("checkout");
            }
        }
    });

    it("splits a subscriber's other cards into upgrade and downgrade", () => {
        const sub = { subscription: LIVE, personalTier: "pro" as const };
        expect(at({ ...sub, cardTier: "max" })).toEqual({ kind: "upgrade", plan: "max" });
        expect(at({ ...sub, cardTier: "core" })).toEqual({ kind: "downgrade", plan: "core" });
    });

    it("turns the free card into a cancel for a subscriber", () => {
        expect(at({ cardTier: "free", personalTier: "core", subscription: LIVE })).toEqual({
            kind: "cancel",
        });
    });

    it("hides cancel once a cancellation is already scheduled", () => {
        // Stripe sets both fields; either one means it's already done.
        for (const scheduled of [{ cancel_at_period_end: true }, { cancel_at: 1789000000 }]) {
            expect(
                at({
                    cardTier: "free",
                    personalTier: "core",
                    subscription: { ...LIVE, ...scheduled },
                })
            ).toEqual({ kind: "none" });
        }
    });

    it("offers a paid viewer nothing without a live subscription", () => {
        // `feature_access set-tier` grants a tier with no Stripe object
        // behind it — every portal flow would have nothing to target.
        for (const cardTier of ["free", "core", "max"] as const) {
            expect(at({ cardTier, personalTier: "pro", subscription: null })).toEqual({
                kind: "none",
            });
        }
    });

    it("leaves enterprise viewers alone", () => {
        // The backend's reconcile explicitly skips enterprise, so a
        // self-serve switch would change Stripe but not the tier.
        expect(at({ cardTier: "core", personalTier: "enterprise", subscription: LIVE })).toEqual({
            kind: "none",
        });
    });

    it("routes the enterprise card to contact-sales for everyone else", () => {
        expect(at({ cardTier: "enterprise", contactSales: true, purchasable: false })).toEqual({
            kind: "contact",
        });
        expect(
            at({
                cardTier: "enterprise",
                contactSales: true,
                purchasable: false,
                personalTier: "max",
                subscription: LIVE,
            })
        ).toEqual({ kind: "contact" });
    });

    it("renders no buttons when Stripe is dark or the tier is unknown", () => {
        expect(at({ billingEnabled: false })).toEqual({ kind: "none" });
        expect(at({ personalTier: null })).toEqual({ kind: "none" });
        // A tier the server hasn't priced can't be switched to either.
        expect(at({ purchasable: false, personalTier: "core", subscription: LIVE })).toEqual({
            kind: "none",
        });
    });
});
