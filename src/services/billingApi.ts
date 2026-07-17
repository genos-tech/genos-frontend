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
 * (`/?billing=success`), the app shows a confirmation and the next
 * `/agent/features/` fetch reflects the new tier.
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
