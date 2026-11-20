/**
 * Thin wrapper around posthog-js. Call sites should import only from this
 * file — posthog-js itself is intentionally not imported anywhere else.
 *
 * Every method silently no-ops when:
 *   - VITE_POSTHOG_KEY / VITE_POSTHOG_HOST are missing (e.g. local dev
 *     without analytics, or production builds that haven't shipped a key
 *     yet),
 *   - `init()` has not been called (the public marketing pages never call it,
 *     see `components/AnalyticsRouteGate`), or
 *   - the user has switched analytics off (Settings, or the marketing footer).
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

import { sanitizeCaptureResult } from "./analyticsSanitize";

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
const start = (enabled?: boolean): void => {
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
                before_send: sanitizeCaptureResult,
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
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS] | string;

export const analytics = {
    capture(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
        if (!initialized || !userEnabled) return;
        if (client) {
            client.capture(event, properties);
            return;
        }
        if (failed) return;
        // Replayed after the chunk loads: pin the moment it actually happened.
        const timestamp = new Date();
        queue.push((posthog) => posthog.capture(event, properties, { timestamp }));
    },

    identify(distinctId: string, traits?: IdentityTraits): void {
        if (!initialized || !userEnabled || !distinctId) return;
        whenLoaded((posthog) => posthog.identify(distinctId, traits));
    },

    init(): void {
        entered = true;
        start();
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
