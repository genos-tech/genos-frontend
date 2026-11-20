import type { BeforeSendFn, CaptureResult, Properties } from "posthog-js";

/**
 * Makes what posthog-js sends match what the privacy page states (MIP-1741).
 *
 * The page (counsel-approved) says PostHog receives "the path of the pages you
 * view (without query strings)". posthog-js adds more on its own: the full
 * `$current_url` with its query string, the full `$referrer`, campaign
 * parameters read from the URL (`utm_*`, `gclid`, ...), the browser language
 * and the timezone. This runs as `before_send` on EVERY event, so the rule
 * holds for each call site, present and future:
 *
 *   - a URL loses its query string and hash;
 *   - a referrer is cut to its origin (`https://example.com`), `$direct` stays;
 *   - campaign parameters, the browser language and the timezone are dropped.
 *
 * It never drops an event and never throws: analytics must not break a page.
 * What is NOT removed here (the screen size, the browser and OS the library
 * derives, the address a request comes from) is device data the page does not
 * list; it is the owner's call whether counsel adds it to the row.
 *
 * First-touch UTM for the landing funnel (MIP-1778, MIP-1266 step 2) is added back
 * on purpose and only from an allow-list: the caller hands the five `utm_*` values
 * over in ONE carrier property (`GENOS_UTM_CARRIER`), and this is the only place
 * that turns it into `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and
 * `utm_term`, after checking each value (at most 100 characters, plain characters
 * only). The `utm_*` values the library lifts out of the page address itself are
 * still dropped, so nothing reaches PostHog that did not pass through here.
 */

/** The property a caller puts first-touch campaign values in; never sent as such. */
export const GENOS_UTM_CARRIER = "genos_utm";

/** The only campaign parameters that are ever sent. */
export const UTM_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

const UTM_VALUE = /^[A-Za-z0-9_.~+\- ]{1,100}$/;

/** A campaign value that is safe to send, or undefined. Never throws. */
export const cleanUtmValue = (value: unknown): string | undefined =>
    typeof value === "string" && UTM_VALUE.test(value) ? value : undefined;

/** Keeps only the five allowed keys whose values pass `cleanUtmValue`. */
export const cleanUtm = (value: unknown): Utm => {
    const out: Utm = {};
    if (!value || typeof value !== "object") return out;
    const source = value as Record<string, unknown>;
    for (const key of UTM_KEYS) {
        const cleaned = cleanUtmValue(source[key]);
        if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
};

// Properties whose value is a page address. `$referrer` and `$initial_referrer`
// are handled separately (origin only).
const URL_KEY = /(^|_)url$/i;
const REFERRER_KEY = /referrer$/i;

// Campaign parameters the library lifts out of the URL (and its `$initial_` and `$session_entry_` copies).
const CAMPAIGN_KEY =
    /^(\$initial_|\$session_entry_)?\$?(utm_[a-z0-9_]+|gclid|gclsrc|dclid|gbraid|wbraid|fbclid|msclkid|twclid|ttclid|li_fat_id|igshid|mc_cid|mc_eid|rdt_cid|epik|qclid|sccid|irclid)$/i;

const LANGUAGE_OR_TIMEZONE_KEY = /(^|[_$])(browser_language(_prefix)?|timezone(_offset)?)$/i;

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

const withoutQueryAndHash = (value: string): string => value.replace(/[?#][\s\S]*$/, "");

const originOnly = (value: string): string => {
    if (!HAS_SCHEME.test(value)) return value; // "$direct" and the like
    try {
        return new URL(value).origin;
    } catch {
        return withoutQueryAndHash(value);
    }
};

const cleanProperties = (properties: Properties): Properties => {
    const out: Properties = {};
    for (const [key, value] of Object.entries(properties)) {
        if (key === GENOS_UTM_CARRIER) continue; // unpacked below, from `properties` only
        if (CAMPAIGN_KEY.test(key) || LANGUAGE_OR_TIMEZONE_KEY.test(key)) continue;
        if (typeof value === "string") {
            if (REFERRER_KEY.test(key)) {
                out[key] = originOnly(value);
                continue;
            }
            if (URL_KEY.test(key)) {
                out[key] = HAS_SCHEME.test(value) ? withoutQueryAndHash(value) : value;
                continue;
            }
        }
        out[key] = value;
    }
    return out;
};

export const sanitizeCaptureResult: BeforeSendFn = (event: CaptureResult | null) => {
    if (!event) return event;
    try {
        const next: CaptureResult = { ...event };
        if (event.properties) {
            next.properties = {
                ...cleanProperties(event.properties),
                ...cleanUtm(event.properties[GENOS_UTM_CARRIER]),
            };
        }
        if (event.$set) next.$set = cleanProperties(event.$set);
        if (event.$set_once) next.$set_once = cleanProperties(event.$set_once);
        return next;
    } catch {
        // Never lose an event to a surprise in its shape.
        return event;
    }
};
