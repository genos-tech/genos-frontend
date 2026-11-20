import { analytics, ANALYTICS_EVENTS } from "./analytics";
import { cleanUtm, GENOS_UTM_CARRIER, UTM_KEYS, type Utm } from "./analyticsSanitize";
import { marketingAnalyticsAllowed } from "./marketingConsentState";

/**
 * The marketing funnel events (MIP-1266 step 2, MIP-1778). Every one of them goes through
 * `analytics.capture`, so each is sent only while analytics runs, which on a marketing page
 * means the visitor pressed "Accept" (`services/marketingConsent`), and through the
 * `before_send` sanitizer, which is the only place campaign values are let through.
 *
 * Properties, and nothing else:
 *   - `$pageview`:        `path`, `lang`            (path only: no query string, no hash)
 *   - `cta_clicked`:      `cta`, `page`, `lang`     (`cta` is a `data-cta` name, `page` a path)
 *   - `signup_completed`: `method`                  (`email`, `invite`, `google`, `github`, `oauth`)
 * plus, on each of them, the first-touch campaign values (`utm_source`, `utm_medium`,
 * `utm_campaign`, `utm_content`, `utm_term`) when the visit arrived with some.
 *
 * No identifier is added here: marketing pages do not call `identify`; the library's own
 * random browser ID is what links a visit to a later sign-up.
 */

const UTM_STORAGE_KEY = "genos-first-touch-utm:v1";

// The address this visit started on, read when the module loads (it is imported at boot), so
// the campaign values survive a client-side move before the visitor answers the banner. It is
// only held in memory; nothing is stored or sent until "Accept".
const landingSearch = (): string => {
    try {
        return window.location.search;
    } catch {
        return "";
    }
};
const LANDING_SEARCH = landingSearch();

const utmFrom = (search: string): Utm => {
    const params = new URLSearchParams(search);
    const raw: Record<string, string> = {};
    for (const key of UTM_KEYS) {
        const value = params.get(key);
        if (value !== null) raw[key] = value;
    }
    return cleanUtm(raw);
};

const readStoredUtm = (): Utm => {
    try {
        const raw = window.sessionStorage.getItem(UTM_STORAGE_KEY);
        return raw ? cleanUtm(JSON.parse(raw)) : {};
    } catch {
        return {};
    }
};

/**
 * Holds the visit's FIRST campaign values in sessionStorage (this tab's visit only; gone when
 * it closes). Called only after "Accept". Keeps the first values: a later page does not
 * replace them.
 */
export const rememberFirstTouchUtm = (): void => {
    try {
        if (Object.keys(readStoredUtm()).length > 0) return;
        const first = utmFrom(LANDING_SEARCH);
        const utm = Object.keys(first).length > 0 ? first : utmFrom(window.location.search);
        if (Object.keys(utm).length > 0) {
            window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
        }
    } catch {
        // Private mode: the funnel degrades to events without campaign values.
    }
};

export const clearFirstTouchUtm = (): void => {
    try {
        window.sessionStorage.removeItem(UTM_STORAGE_KEY);
    } catch {
        // Nothing was stored.
    }
};

/** The carrier the sanitizer unpacks, or nothing. Never sends campaign values by itself. */
const attribution = (): Record<string, Utm> => {
    const utm = readStoredUtm();
    return Object.keys(utm).length > 0 ? { [GENOS_UTM_CARRIER]: utm } : {};
};

const CTA_NAME = /^[a-z0-9_]{1,60}$/;

export const trackMarketingPageview = (path: string, lang: string): void => {
    // Defence in depth: the caller checks too, but nothing is stored or sent without "Accept".
    if (!marketingAnalyticsAllowed()) return;
    rememberFirstTouchUtm();
    analytics.capture(ANALYTICS_EVENTS.PAGEVIEW, { path, lang, ...attribution() });
};

/**
 * A press on a marketing button that carries a `data-cta` name. Most of these buttons are
 * plain links into the app (a full page load), so the event is handed to the browser's
 * beacon, which survives the unload.
 */
export const trackCtaClicked = (cta: string | null, page: string, lang: string): void => {
    if (!cta || !CTA_NAME.test(cta) || !marketingAnalyticsAllowed()) return;
    analytics.capture(
        ANALYTICS_EVENTS.CTA_CLICKED,
        { cta, page, lang, ...attribution() },
        { transport: "sendBeacon", send_instantly: true }
    );
};

export type SignupMethod = "email" | "invite" | "google" | "github" | "oauth";

/**
 * An account was created (the API confirmed it). No email, name or id is sent. A caller whose
 * code can run twice for one account (the OAuth bounce page) passes a `latch` name, and the
 * event then leaves at most once per tab; the latch is only written while analytics runs.
 */
export const trackSignupCompleted = (method: SignupMethod, latch?: string): void => {
    if (!analytics.isActive()) return;
    if (latch) {
        const key = `genos-signup-reported:${latch}`;
        try {
            if (window.sessionStorage.getItem(key)) return;
            window.sessionStorage.setItem(key, "1");
        } catch {
            // Private mode: send; a double count is possible but rare.
        }
    }
    analytics.capture(ANALYTICS_EVENTS.SIGNUP_COMPLETED, { method, ...attribution() });
};
