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

export type PurchasablePlan = "core" | "pro" | "max";

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
export async function startCheckout(
    accessToken: string,
    plan: PurchasablePlan,
    currency?: string
): Promise<void> {
    // `currency` selects WHICH declared price is sold, never a
    // conversion — the Stripe price already carries its own currency.
    const url = await postForUrl("/billing/checkout/", accessToken, { plan, currency });
    window.location.assign(url);
}

/**
 * Deep links into the Stripe customer portal.
 *
 * `update` lands on the confirm-this-switch screen for `plan`;
 * `switch` lands on Stripe's own plan picker (for callers with no
 * per-tier button to name a target from); `cancel` lands on the cancel
 * screen; omitted opens the portal home (invoices, payment method,
 * everything).
 *
 * This — NOT `startCheckout` — is how an existing subscriber changes
 * plan. Checkout would open a second parallel subscription on the same
 * customer. The backend degrades any flow the Stripe portal
 * configuration refuses back to the portal home, so a caller never has
 * to handle "this flow isn't available".
 */
export type PortalFlow = "update" | "switch" | "cancel";

/** Open the Stripe customer portal (plan changes, cancel, invoices). */
export async function openBillingPortal(
    accessToken: string,
    flow?: PortalFlow,
    plan?: PurchasablePlan
): Promise<void> {
    const url = await postForUrl("/billing/portal/", accessToken, { flow, plan });
    window.location.assign(url);
}

export interface PlanPrice {
    // Stripe's smallest-unit amount (JPY is zero-decimal: 1200 = ¥1,200).
    amount: number | null;
    currency: string;
    interval: string;
}

/** UX tier model capability vocabularies (mirror the server's TIER_QUOTAS). */
export type AgentToolLevel = "read" | "act" | "organize";
export type EffortLevel = "low" | "medium" | "high";
export type AgentMemoryLevel = "none" | "own" | "team";
export type IntegrationName = "web" | "google_calendar" | "github";
export type DigestCadence = "weekly" | "daily";

export interface PlanLimits {
    llm_ask_daily: number | null;
    web_search_daily: number | null;
    task_create_monthly: number | null;
    note_create_monthly: number | null;
    message_retention_days: number | null;
    upload_max_mb: number | null;
    /**
     * The plan's monthly AI credits. PRESENT ONLY when the server
     * enforces credits — its presence is the render switch, the same
     * payload-shape convention `credits` uses on /agent/features/.
     *
     * That is what stops this page advertising a limit the quota
     * engine has stopped applying: under credits the daily ask and
     * web-search caps still exist as numbers but bind nobody, so
     * rendering them would be selling a limit that isn't one.
     *
     * `null` = unlimited (enterprise). Absent = the daily era.
     */
    monthly_ai_credits?: number | null;
    /**
     * UX-pillar capability dimensions (UX tier model). All optional so
     * an older server payload still type-checks; they are tier CONFIG
     * served by the public plans endpoint, permissive for every tier
     * until the server-side flip.
     */
    agent_tool_level?: AgentToolLevel;
    max_effort?: EffortLevel;
    auto_effort?: boolean;
    agent_memory?: AgentMemoryLevel;
    agent_history_retention_days?: number | null;
    integrations?: IntegrationName[];
    digest_cadence?: DigestCadence | null;
    /** MCP is a Pro-and-up capability; absent on a server that predates it. */
    mcp_enabled?: boolean;
}

export interface PlanTier {
    tier: "free" | "core" | "pro" | "max" | "enterprise";
    price: PlanPrice | null; // null = unavailable (contact-sales / Stripe dark)
    purchasable: boolean;
    contact_sales: boolean;
    limits: PlanLimits;
}

export interface BillingPlans {
    billing_enabled: boolean;
    tiers: PlanTier[];
    /**
     * The currency these prices are quoted in. Comes from the server —
     * echoing back what we asked for would let a misconfigured price id
     * advertise the wrong currency, and Stripe is the authority on what
     * a customer will actually be charged.
     *
     * Optional so a client can talk to a server that predates
     * multi-currency without the page going blank.
     */
    currency?: string;
    /** Currencies with prices actually configured, default first. */
    supported_currencies?: string[];
}

/**
 * The tier comparison for the plans page — limits served straight
 * from the backend's enforcement table so the page can never drift
 * from what the quota engine applies.
 */
export async function fetchBillingPlans(
    accessToken: string,
    currency?: string
): Promise<BillingPlans | null> {
    try {
        const qs = currency ? `?currency=${encodeURIComponent(currency)}` : "";
        const resp = await fetch(`${API_BASE}/billing/plans/${qs}`, {
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
export async function fetchPublicBillingPlans(currency?: string): Promise<BillingPlans | null> {
    try {
        const qs = currency ? `?currency=${encodeURIComponent(currency)}` : "";
        const resp = await fetch(`${API_BASE}/billing/plans/${qs}`);
        if (!resp.ok) return null;
        return (await resp.json()) as BillingPlans;
    } catch {
        return null;
    }
}

export interface TeamBillingTeam {
    team_id: string;
    team_name: string;
    plan: "free" | "core" | "pro" | "max" | "enterprise";
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
    plan: PurchasablePlan,
    currency?: string
): Promise<void> {
    const url = await postForUrl("/billing/team/checkout/", accessToken, {
        team_id: teamId,
        plan,
        currency,
    });
    window.location.assign(url);
}

/** The TEAM's customer portal (owner-only): seats, plan, cancel, invoices. */
export async function openTeamBillingPortal(
    accessToken: string,
    teamId: string,
    flow?: PortalFlow,
    plan?: PurchasablePlan
): Promise<void> {
    const url = await postForUrl("/billing/team/portal/", accessToken, {
        team_id: teamId,
        flow,
        plan,
    });
    window.location.assign(url);
}

export interface BillingSubscription {
    // null = the subscription's price isn't mapped to a plan (env
    // misconfiguration server-side) — show the row, skip the plan name.
    plan: PurchasablePlan | null;
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
