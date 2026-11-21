import { analytics } from "./analytics";
import { CONSENT_KEY, readConsent, type ConsentChoice } from "./consentStorage";

/**
 * The analytics consent choice (MIP-1778 for a visitor on the public marketing pages; MIP-1781
 * extends the same record to the app: one choice for the whole product).
 *
 * Counsel (2026-11-21): for EU/UK visitors a consent banner is needed. Until a visitor
 * presses "Accept", a marketing page loads no analytics, stores nothing of PostHog's and
 * sends nothing (the state MIP-1742 introduced). The choice itself is the one record kept
 * before that: `{ "choice": "accepted" | "rejected", "v": 1 }`, no identifier and no date,
 * strictly necessary to remember the answer. It is its OWN key and not the Settings
 * preference (`genos-analytics-preferences:v1`) on purpose: until MIP-1781 the app wrote
 * `{ enabled: true }` for every signed-in user on mount, so an existing user carries that
 * value without ever having been asked, and it is not a choice made on a banner. The two
 * are kept consistent instead:
 *
 *   - "Reject" also writes `{ enabled: false }` to the Settings preference, so analytics
 *     stays off in the app too;
 *   - "Accept" writes `{ enabled: true }`;
 *   - analytics runs (on a marketing page and in the app) only while the choice is
 *     "accepted" AND the Settings preference is not off, so turning it off in Settings wins
 *     everywhere. In the app, the Settings switch and the first-load prompt record the same
 *     choice (`chooseConsent(choice, "app")`).
 */

export { CONSENT_KEY, readConsent };
export type { ConsentChoice };

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
