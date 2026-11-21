import { analytics } from "./analytics";

/**
 * The consent choice of a visitor on the public marketing pages (MIP-1778).
 *
 * Counsel (2026-11-21): for EU/UK visitors a consent banner is needed. Until a visitor
 * presses "Accept", a marketing page loads no analytics, stores nothing of PostHog's and
 * sends nothing (the state MIP-1742 introduced). The choice itself is the one record kept
 * before that: `{ "choice": "accepted" | "rejected", "v": 1 }`, no identifier and no date,
 * strictly necessary to remember the answer. It is its OWN key and not the Settings
 * preference (`genos-analytics-preferences:v1`) on purpose: the app's preference provider
 * writes `{ enabled: true }` for every signed-in user on mount, which is not a choice made
 * on a banner. The two are kept consistent instead:
 *
 *   - "Reject" also writes `{ enabled: false }` to the Settings preference, so analytics
 *     stays off in the app too;
 *   - "Accept" writes `{ enabled: true }`;
 *   - analytics runs on a marketing page only while the choice is "accepted" AND the
 *     Settings preference is not off, so turning it off in Settings wins everywhere.
 */

export const CONSENT_KEY = "genos-marketing-consent:v1";

export type ConsentChoice = "accepted" | "rejected";

/** The stored choice, or null when the visitor has not chosen (or storage is blocked). */
export const readConsent = (): ConsentChoice | null => {
    try {
        const raw = window.localStorage.getItem(CONSENT_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const { choice, v } = parsed as { choice?: unknown; v?: unknown };
            if (v === 1 && (choice === "accepted" || choice === "rejected")) return choice;
        }
    } catch {
        // Unreadable or blocked: treated as no choice, which loads nothing.
    }
    return null;
};

/** True while analytics may run on a marketing page. */
export const marketingAnalyticsAllowed = (): boolean =>
    analytics.isConfigured() && readConsent() === "accepted" && analytics.readStoredEnabled();

/**
 * True when the banner must be shown: no choice yet. A visitor who switched analytics off in
 * Settings (or the old footer link) has already said no; the footer control stays available
 * for them.
 */
export const consentNeeded = (): boolean =>
    analytics.isConfigured() && readConsent() === null && analytics.readStoredEnabled();
