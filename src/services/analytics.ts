/**
 * Thin wrapper around posthog-js. Call sites should import only from this
 * file — posthog-js itself is intentionally not imported anywhere else.
 *
 * Every method silently no-ops when:
 *   - VITE_POSTHOG_KEY / VITE_POSTHOG_HOST are missing (e.g. local dev
 *     without analytics, or production builds that haven't shipped a key
 *     yet),
 *   - `init()` has not been called (the public marketing pages call
 *     `startWithConsent()` instead, and only after the visitor pressed "Accept" in the
 *     consent banner; see `components/AnalyticsRouteGate` and `services/marketingConsent`), or
 *   - the user has switched analytics off (Settings, or the marketing banner / footer).
 *
 * `init()` reads the opt-out preference directly from localStorage so it
 * can apply *before* React has mounted; the AnalyticsPreferencesProvider
 * later mirrors any in-app changes back into the wrapper via setEnabled.
 *
 * When that preference is "off", posthog-js is not loaded at all. Probed with
 * posthog-js 1.445.4 (MIP-1742): `opt_out_capturing_by_default` stops the events but
 * the library still writes its cookie, localStorage and sessionStorage and requests
 * `/array/<key>/config.js`; `persistence: "memory"` stops the storage but not that
 * request. Only not initialising stores and sends nothing.
 */

import type { CaptureOptions } from "posthog-js";

import { sanitizeCaptureResult, sanitizeMarketingCaptureResult } from "./analyticsSanitize";

const PREFERENCES_STORAGE_KEY = "genos-analytics-preferences:v1";

type IdentityTraits = {
    teamId?: string;
    role?: string;
};

type PostHogClient = (typeof import("posthog-js"))["default"];

let initialized = false;
// `init()` was called: this page is not a marketing page. Lets a later "turn analytics
// back on" start the library, which an opted-out boot deliberately did not load.
let entered = false;
let userEnabled = true;

// posthog-js is ~350 kB of minified source and nothing needs it to render, so it is
// fetched by a dynamic `import()` that starts at boot but is NOT awaited: it stays off
// the entry's critical path (MIP-1605). A call that arrives before the chunk has
// loaded is queued and replayed in order once it has, so no early pageview, identify,
// reset or opt-out is lost.
let client: PostHogClient | null = null;
let loading: Promise<void> | null = null;
let failed = false;
let queue: Array<(posthog: PostHogClient) => void> = [];
// Started from a marketing page after "Accept" (`startWithConsent`): the library is kept to the
// minimum the visitor agreed to, see `scrubSessionProps`.
let marketingStart = false;

// posthog-js 1.445.4 keeps the session's entry data in its persistence under `$client_session_props`:
// the FULL landing address (query string and all) and the full referrer. It has no option to stop
// that. What leaves the browser is already cut down by the sanitizer (`$session_entry_url` is a
// path, the referrer a domain), but the stored copy would stay in localStorage, so on a marketing
// start it is deleted right after each capture. The next capture of the same session reads nothing
// and adds no `$session_entry_*`; PostHog derives a session's entry from its first event anyway.
const scrubSessionProps = (posthog: PostHogClient): void => {
    if (marketingStart) posthog.unregister("$client_session_props");
};

// What posthog-js leaves in the browser, by name: `ph_<key>_posthog` (cookie, localStorage,
// sessionStorage), `ph_<key>_session_registered_properties`, `..._primary_window_exists`,
// `..._window_id`, `__ph_opt_in_out_<key>`. Probed with 1.445.4 (MIP-1778).
const POSTHOG_STORAGE_KEY = /^(ph_|__ph_)/;

const whenLoaded = (call: (posthog: PostHogClient) => void): void => {
    if (client) call(client);
    else if (!failed) queue.push(call);
};

const readUserEnabledFromStorage = (): boolean => {
    if (typeof window === "undefined") return true;
    try {
        const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
        if (!raw) return true;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const obj = parsed as Record<string, unknown>;
            return typeof obj.enabled === "boolean" ? obj.enabled : true;
        }
        return true;
    } catch {
        return true;
    }
};

// Loads and configures posthog-js. Idempotent, and a no-op without a key/host or while the
// preference is off. `enabled` is the value a caller has just decided on (the switch being
// turned on); without it the stored preference decides.
const start = (enabled?: boolean, onMarketingPage = false): void => {
    if (initialized) return;
    const key = import.meta.env.VITE_POSTHOG_KEY;
    const host = import.meta.env.VITE_POSTHOG_HOST;
    if (!key || !host) return;

    userEnabled = enabled ?? readUserEnabledFromStorage();
    if (!userEnabled) return;

    initialized = true;

    loading = import("posthog-js")
        .then(({ default: posthog }) => {
            posthog.init(key, {
                api_host: host,
                autocapture: false,
                capture_pageview: false,
                disable_session_recording: true,
                persistence: "localStorage+cookie",
                // What leaves the browser must match the privacy page (MIP-1741).
                before_send: onMarketingPage
                    ? sanitizeMarketingCaptureResult
                    : sanitizeCaptureResult,
                // Started from a marketing page, after "Accept" (MIP-1778): the visitor agreed to
                // page views, button clicks and sign-ups, so everything else the library can switch
                // on from its remote config stays off. Each of these only reduces collection.
                ...(onMarketingPage
                    ? {
                          capture_heatmaps: false,
                          capture_dead_clicks: false,
                          capture_exceptions: false,
                          capture_performance: false,
                          // Do not keep the landing address and referrer in the browser: probed
                          // with 1.445.4, the cookie and localStorage hold `$initial_person_info`
                          // = the FULL landing URL (query string and all) and the full referrer,
                          // and sessionStorage the raw `utm_*` and `$referrer`. Nothing the
                          // privacy page lists needs them: the path, the campaign values and the
                          // referrer's domain are sent from the event itself.
                          save_referrer: false,
                          save_campaign_params: false,
                          disable_surveys: true,
                          disable_conversations: true,
                          disable_product_tours: true,
                          disable_web_experiments: true,
                          // The wrapper uses no feature flag, and the `/flags/` request carries the
                          // browser's timezone and device ID in a body `before_send` never sees.
                          advanced_disable_flags: true,
                      }
                    : {}),
            });
            client = posthog;
            const replay = queue;
            queue = [];
            for (const call of replay) call(posthog);
        })
        .catch(() => {
            // Chunk blocked or offline: behave like a blocked network request,
            // and stop queueing for the rest of the session.
            failed = true;
            queue = [];
        });
};

/**
 * Canonical event names. Add new ones here so the strings stay in one
 * place and TypeScript can autocomplete callers.
 */
export const ANALYTICS_EVENTS = {
    PAGEVIEW: "$pageview",
    // The demo funnel. A visitor arriving from the marketing pages has a
    // workspace seeded for them, but the demo's whole purpose is that they
    // ask Genos something and get a cited answer back — so the funnel has
    // to measure the ASK, not the signin. See `services/demoFunnel.ts`.
    DEMO_STARTED: "demo_started",
    DEMO_COMPLETED: "demo_completed",
    // A signin that never produced a workspace (rate limit, network, 5xx).
    // Its own event name on purpose: folding it into `demo_started` with a
    // `failed` property would put non-entrants in the funnel's first step
    // and depress the conversion rate by however many 429s we served.
    DEMO_START_FAILED: "demo_start_failed",
    // The marketing funnel (MIP-1266 step 2, MIP-1778): which button on a marketing page was
    // pressed, and an account was created. Properties are listed in `services/marketingFunnel`.
    CTA_CLICKED: "cta_clicked",
    SIGNUP_COMPLETED: "signup_completed",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS] | string;

/** Deletes every cookie and web-storage entry posthog-js wrote, in this browser. */
const clearPostHogStorage = (): void => {
    if (typeof window === "undefined") return;
    for (const storage of [window.localStorage, window.sessionStorage]) {
        try {
            for (const key of Object.keys(storage)) {
                if (POSTHOG_STORAGE_KEY.test(key)) storage.removeItem(key);
            }
        } catch {
            // Storage blocked: nothing was written there either.
        }
    }
    try {
        const host = window.location.hostname;
        const labels = host.split(".");
        // The library sets its cookie on the host, or on the parent domain (`.genosai.dev`).
        const domains = [undefined, host];
        for (let i = 1; i < labels.length - 1; i++) domains.push(`.${labels.slice(i).join(".")}`);
        for (const cookie of document.cookie.split(";")) {
            const name = cookie.split("=")[0]?.trim();
            if (!name || !POSTHOG_STORAGE_KEY.test(name)) continue;
            for (const domain of domains) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${
                    domain ? `; domain=${domain}` : ""
                }`;
            }
        }
    } catch {
        // Cookies blocked.
    }
};

export const analytics = {
    capture(
        event: AnalyticsEvent,
        properties?: Record<string, unknown>,
        options?: CaptureOptions
    ): void {
        if (!initialized || !userEnabled) return;
        if (client) {
            if (options) client.capture(event, properties, options);
            else client.capture(event, properties);
            scrubSessionProps(client);
            return;
        }
        if (failed) return;
        // Replayed after the chunk loads: pin the moment it actually happened.
        const timestamp = new Date();
        queue.push((posthog) => {
            posthog.capture(event, properties, { ...options, timestamp });
            scrubSessionProps(posthog);
        });
    },

    identify(distinctId: string, traits?: IdentityTraits): void {
        if (!initialized || !userEnabled || !distinctId) return;
        whenLoaded((posthog) => posthog.identify(distinctId, traits));
    },

    init(): void {
        entered = true;
        start();
    },

    /**
     * Starts the library on a marketing page. Only for a visitor who pressed "Accept" in the
     * consent banner (`services/marketingConsent` decides; this does not check).
     */
    startWithConsent(): void {
        entered = true;
        if (!initialized) marketingStart = true;
        start(true, true);
    },

    /** Whether the library has been started and the person has not switched it off. */
    isActive(): boolean {
        return initialized && userEnabled;
    },

    /** Whether a PostHog key and host were built in. Without them nothing here does anything. */
    isConfigured(): boolean {
        return Boolean(import.meta.env.VITE_POSTHOG_KEY && import.meta.env.VITE_POSTHOG_HOST);
    },

    /** Resolves once posthog-js has loaded and every queued call has been replayed. */
    whenReady(): Promise<void> {
        return loading ?? Promise.resolve();
    },

    reset(): void {
        if (!initialized) return;
        whenLoaded((posthog) => posthog.reset());
    },

    /** Whether the user has left analytics on. Other telemetry honours the same opt-out. */
    isEnabled(): boolean {
        return userEnabled;
    },

    setEnabled(enabled: boolean): void {
        userEnabled = enabled;
        // Turned back on after an opted-out boot that never loaded the library.
        if (enabled && entered) start(true);
        if (!initialized) return;
        whenLoaded((posthog) => {
            if (enabled) {
                posthog.opt_in_capturing();
            } else {
                posthog.opt_out_capturing();
                posthog.reset();
            }
        });
    },

    /**
     * Deletes what posthog-js stored in this browser (its cookie and web-storage entries).
     * For a visitor who rejects or withdraws on a marketing page: "off" there means nothing
     * is kept, not only that nothing is sent. Runs after any pending opt-out / reset has
     * been replayed, because `reset()` writes a fresh identifier of its own.
     */
    forgetStoredIdentifiers(): void {
        clearPostHogStorage();
        if (loading) void loading.then(clearPostHogStorage);
    },

    /** The stored preference, without starting anything. Default: on. */
    readStoredEnabled(): boolean {
        return readUserEnabledFromStorage();
    },

    /**
     * Stores the choice under the key the Settings switch uses (same `{ enabled }` shape), so
     * it holds when the person signs in later, and applies it to this page. Used by the
     * marketing footer, where no preferences provider is mounted.
     */
    persistEnabled(enabled: boolean): void {
        try {
            window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ enabled }));
        } catch {
            // Private mode / blocked storage: the choice applies to this page only.
        }
        analytics.setEnabled(enabled);
    },
};
