/**
 * Stripe billing client — thin wrappers over `/api/v2/billing/*`.
 *
 * Raw fetch (agentApi style): these are one-shot user-triggered calls
 * whose failure surfaces inline in the Plan & Usage tab, so the axios
 * interceptor's global toasts aren't wanted here.
 *
 * `startCheckout` / `openBillingPortal` NAVIGATE AWAY on success — the
 * returned URL is a Stripe-hosted page. The tier change itself lands
 * via the backend webhook; when the user returns
 * (`/?billing=success` / `/?billing=portal_return`),
 * `BillingReturnSnackbar` also fires `refreshBillingTier` so the tier
 * is pulled straight from Stripe even if the webhook was lost or
 * hasn't arrived yet, and the next `/agent/features/` fetch reflects
 * the new tier.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export type PurchasablePlan = "pro" | "max";

export interface BillingConfig {
    enabled: boolean;
    plans: PurchasablePlan[];
    // The user's OWN tier — a team plan may lift their effective tier
    // above this, but personal upgrades are still offered off it.
    personal_tier: string;
    has_billing_account: boolean;
}

export async function fetchBillingConfig(accessToken: string): Promise<BillingConfig | null> {
    try {
        const resp = await fetch(`${API_BASE}/billing/config/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) return null;
        return (await resp.json()) as BillingConfig;
    } catch {
        return null;
    }
}

async function postForUrl(path: string, accessToken: string, body?: unknown): Promise<string> {
    const resp = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body ?? {}),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || typeof data?.url !== "string") {
        throw new Error(data?.error || `Billing request failed (${resp.status})`);
    }
    return data.url;
}

/** Create a Checkout Session and navigate the browser to it. */
export async function startCheckout(accessToken: string, plan: PurchasablePlan): Promise<void> {
    const url = await postForUrl("/billing/checkout/", accessToken, { plan });
    window.location.assign(url);
}

/** Open the Stripe customer portal (plan changes, cancel, invoices). */
export async function openBillingPortal(accessToken: string): Promise<void> {
    const url = await postForUrl("/billing/portal/", accessToken);
    window.location.assign(url);
}

export interface PlanPrice {
    // Stripe's smallest-unit amount (JPY is zero-decimal: 1200 = ¥1,200).
    amount: number | null;
    currency: string;
    interval: string;
}

export interface PlanTier {
    tier: "free" | "pro" | "max" | "enterprise";
    price: PlanPrice | null; // null = unavailable (contact-sales / Stripe dark)
    purchasable: boolean;
    contact_sales: boolean;
    limits: {
        llm_ask_daily: number | null;
        web_search_daily: number | null;
        task_create_monthly: number | null;
        note_create_monthly: number | null;
        message_retention_days: number | null;
        upload_max_mb: number | null;
    };
}

export interface BillingPlans {
    billing_enabled: boolean;
    tiers: PlanTier[];
}

/**
 * The tier comparison for the plans page — limits served straight
 * from the backend's enforcement table so the page can never drift
 * from what the quota engine applies.
 */
export async function fetchBillingPlans(accessToken: string): Promise<BillingPlans | null> {
    try {
        const resp = await fetch(`${API_BASE}/billing/plans/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) return null;
        return (await resp.json()) as BillingPlans;
    } catch {
        return null;
    }
}

/**
 * No-auth variant for the public marketing pricing page (`/plans`),
 * which renders while logged out. Same endpoint, now AllowAny — see
 * BillingPlansView. The payload is user-agnostic (tier limits + public
 * prices). Returns null on any failure so the page can show a clean
 * "couldn't load pricing" state rather than crashing.
 */
export async function fetchPublicBillingPlans(): Promise<BillingPlans | null> {
    try {
        const resp = await fetch(`${API_BASE}/billing/plans/`);
        if (!resp.ok) return null;
        return (await resp.json()) as BillingPlans;
    } catch {
        return null;
    }
}

export interface TeamBillingTeam {
    team_id: string;
    team_name: string;
    plan: "free" | "pro" | "max" | "enterprise";
    seats: number;
    has_billing_account: boolean;
}

export interface TeamBillingConfig {
    enabled: boolean;
    // Teams the requester OWNS — empty for everyone else, so the UI
    // simply renders no team section.
    teams: TeamBillingTeam[];
}

export async function fetchTeamBillingConfig(
    accessToken: string
): Promise<TeamBillingConfig | null> {
    try {
        const resp = await fetch(`${API_BASE}/billing/team/config/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) return null;
        return (await resp.json()) as TeamBillingConfig;
    } catch {
        return null;
    }
}

/** Quantity-based team Checkout (owner-only) and navigate to it. */
export async function startTeamCheckout(
    accessToken: string,
    teamId: string,
    plan: PurchasablePlan
): Promise<void> {
    const url = await postForUrl("/billing/team/checkout/", accessToken, {
        team_id: teamId,
        plan,
    });
    window.location.assign(url);
}

/** The TEAM's customer portal (owner-only): seats, plan, cancel, invoices. */
export async function openTeamBillingPortal(accessToken: string, teamId: string): Promise<void> {
    const url = await postForUrl("/billing/team/portal/", accessToken, { team_id: teamId });
    window.location.assign(url);
}

export interface BillingSubscription {
    // null = the subscription's price isn't mapped to a plan (env
    // misconfiguration server-side) — show the row, skip the plan name.
    plan: "pro" | "max" | null;
    status: "active" | "trialing" | "past_due" | "paused";
    cancel_at_period_end: boolean;
    current_period_end: number | null; // unix seconds
    cancel_at: number | null; // unix seconds
}

/**
 * Renewal/expiry state for the Plan & Usage tab. Null when there is
 * nothing to show: no billing account, billing disabled server-side,
 * no live subscription — or any fetch failure (the row just hides).
 */
export async function fetchBillingSubscription(
    accessToken: string
): Promise<BillingSubscription | null> {
    try {
        const resp = await fetch(`${API_BASE}/billing/subscription/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) return null;
        const data = await resp.json().catch(() => null);
        return (data?.subscription as BillingSubscription | null) ?? null;
    } catch {
        return null;
    }
}

/**
 * Pull-based tier reconcile: the backend re-reads the subscription
 * state from Stripe and rewrites the tier. Fired when the browser
 * lands back from checkout/portal, so a lost or not-yet-delivered
 * webhook can't leave the app showing a stale plan. Fire-and-forget:
 * resolves to the reconciled personal tier, or null when billing is
 * disabled or the call fails (nothing to surface — the webhook path
 * still applies eventually).
 */
export async function refreshBillingTier(accessToken: string): Promise<string | null> {
    try {
        const resp = await fetch(`${API_BASE}/billing/refresh/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) return null;
        const data = await resp.json().catch(() => null);
        return typeof data?.personal_tier === "string" ? data.personal_tier : null;
    } catch {
        return null;
    }
}
