import posthog from "posthog-js";

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
    teamName?: string;
    role?: string;
};

let initialized = false;
let userEnabled = true;

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
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS] | string;

export const analytics = {
    capture(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
        if (!initialized || !userEnabled) return;
        posthog.capture(event, properties);
    },

    identify(distinctId: string, traits?: IdentityTraits): void {
        if (!initialized || !userEnabled || !distinctId) return;
        posthog.identify(distinctId, traits);
    },

    init(): void {
        if (initialized) return;
        const key = import.meta.env.VITE_POSTHOG_KEY;
        const host = import.meta.env.VITE_POSTHOG_HOST;
        if (!key || !host) return;

        userEnabled = readUserEnabledFromStorage();

        posthog.init(key, {
            api_host: host,
            autocapture: false,
            capture_pageview: false,
            disable_session_recording: true,
            opt_out_capturing_by_default: !userEnabled,
            persistence: "localStorage+cookie",
        });

        initialized = true;
    },

    reset(): void {
        if (!initialized) return;
        posthog.reset();
    },

    setEnabled(enabled: boolean): void {
        userEnabled = enabled;
        if (!initialized) return;
        if (enabled) {
            posthog.opt_in_capturing();
        } else {
            posthog.opt_out_capturing();
            posthog.reset();
        }
    },
};
