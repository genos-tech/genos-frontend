/**
 * Thin wrapper around posthog-js. Call sites should import only from this
 * file — posthog-js itself is intentionally not imported anywhere else.
 *
 * Every method silently no-ops when:
 *   - VITE_POSTHOG_KEY / VITE_POSTHOG_HOST are missing (e.g. local dev
 *     without analytics, or production builds that haven't shipped a key
 *     yet), or
 *   - the user has flipped the opt-out toggle in Settings.
 *
 * `init()` reads the opt-out preference directly from localStorage so it
 * can apply *before* React has mounted; the AnalyticsPreferencesProvider
 * later mirrors any in-app changes back into the wrapper via setEnabled.
 */

const PREFERENCES_STORAGE_KEY = "genos-analytics-preferences:v1";

type IdentityTraits = {
    teamId?: string;
    role?: string;
};

type PostHogClient = (typeof import("posthog-js"))["default"];

let initialized = false;
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
        if (initialized) return;
        const key = import.meta.env.VITE_POSTHOG_KEY;
        const host = import.meta.env.VITE_POSTHOG_HOST;
        if (!key || !host) return;

        userEnabled = readUserEnabledFromStorage();

        const optedOutByDefault = !userEnabled;
        initialized = true;

        loading = import("posthog-js")
            .then(({ default: posthog }) => {
                posthog.init(key, {
                    api_host: host,
                    autocapture: false,
                    capture_pageview: false,
                    disable_session_recording: true,
                    opt_out_capturing_by_default: optedOutByDefault,
                    persistence: "localStorage+cookie",
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
};
