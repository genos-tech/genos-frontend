/**
 * Which call-to-action a plan card shows — the whole upgrade /
 * downgrade / cancel decision, extracted as a pure function.
 *
 * It lives outside the component because the rule set is a 5x5 matrix
 * (viewer's tier x card's tier) with three cross-cutting gates, and the
 * one outcome that must NEVER occur — an existing subscriber routed to
 * `startCheckout` — is invisible in a rendered snapshot. Checkout
 * creates a *new* subscription on the same Stripe customer, so a
 * "downgrade" bought that way leaves two subscriptions billing in
 * parallel; the backend's reconcile takes the BEST active tier, so the
 * app would look completely healthy while the user paid twice. Hence
 * `checkout` is reachable from exactly one branch here, and it's
 * pinned by test.
 *
 * Everything else for a subscriber goes through the Stripe customer
 * portal's deep-link flows (`POST /billing/portal/` with `flow`), which
 * modify the subscription they already have — Stripe owns proration,
 * tax and SCA.
 */

import { SubscriptionTier } from "../../services/agentApi";
import { BillingSubscription, PurchasablePlan } from "../../services/billingApi";

/** Ladder order. Also the upgrade/downgrade test — nothing else in the
 *  app encodes it, and the API returns tiers as opaque strings. */
export const TIER_RANK: Record<SubscriptionTier, number> = {
    free: 0,
    core: 1,
    pro: 2,
    max: 3,
    enterprise: 4,
};

export type PlanCta =
    | { kind: "none" }
    /** This is the viewer's plan — a badge, not a button. */
    | { kind: "current" }
    /** Enterprise: mailto, no self-serve path. */
    | { kind: "contact" }
    /** Free viewer buying their first subscription. The ONLY checkout. */
    | { kind: "checkout"; plan: PurchasablePlan }
    /** Subscriber moving up or down — both are portal update flows;
     *  they differ only in wording and button emphasis. */
    | { kind: "upgrade"; plan: PurchasablePlan }
    | { kind: "downgrade"; plan: PurchasablePlan }
    /** The Free card, for a subscriber: cancel at period end. */
    | { kind: "cancel" };

export interface PlanCtaInput {
    /** The tier this card advertises. */
    cardTier: SubscriptionTier;
    /** The viewer's OWN tier. Deliberately not the effective tier: a
     *  team plan lifts what you can do, but personal plans are still
     *  bought, switched and cancelled off the personal one. */
    personalTier: SubscriptionTier | null;
    /** Stripe configured server-side. */
    billingEnabled: boolean;
    /** The server has a price for this card's tier. */
    purchasable: boolean;
    contactSales: boolean;
    /** The viewer's live subscription, or null. Null with a paid tier
     *  means an operator set it by hand (`feature_access set-tier`) —
     *  there is no Stripe object to switch or cancel. */
    subscription: BillingSubscription | null;
}

export const planCta = ({
    cardTier,
    personalTier,
    billingEnabled,
    purchasable,
    contactSales,
    subscription,
}: PlanCtaInput): PlanCta => {
    if (personalTier && cardTier === personalTier) return { kind: "current" };
    if (contactSales) return { kind: "contact" };
    if (!billingEnabled || !personalTier) return { kind: "none" };

    if (personalTier === "free") {
        return purchasable
            ? { kind: "checkout", plan: cardTier as PurchasablePlan }
            : { kind: "none" };
    }

    // Enterprise is operator-managed end to end — the backend's
    // reconcile explicitly skips it, so offering a self-serve switch
    // would produce a button that changes Stripe but not the tier.
    if (personalTier === "enterprise") return { kind: "none" };

    // Paid, but nothing in Stripe to act on.
    if (!subscription) return { kind: "none" };

    if (cardTier === "free") {
        // Already cancelled: the banner shows "Plan ends on X" and
        // links to the portal. A second "Cancel" here would be a no-op
        // button, and un-cancelling isn't one of Stripe's flows.
        const alreadyEnding = subscription.cancel_at_period_end || subscription.cancel_at !== null;
        return alreadyEnding ? { kind: "none" } : { kind: "cancel" };
    }
    if (!purchasable) return { kind: "none" };

    const plan = cardTier as PurchasablePlan;
    return TIER_RANK[cardTier] > TIER_RANK[personalTier]
        ? { kind: "upgrade", plan }
        : { kind: "downgrade", plan };
};
