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
 * First-touch UTM for the landing funnel is a later step (MIP-1266, step 2):
 * it will be added back on purpose, from an allow-list, after counsel has
 * approved the wording.
 */

// Properties whose value is a page address. `$referrer` and `$initial_referrer`
// are handled separately (origin only).
const URL_KEY = /(^|_)url$/i;
const REFERRER_KEY = /referrer$/i;

// Campaign parameters the library lifts out of the URL (and its `$initial_` copies).
const CAMPAIGN_KEY =
    /^(\$initial_)?\$?(utm_[a-z0-9_]+|gclid|gclsrc|dclid|gbraid|wbraid|fbclid|msclkid|twclid|ttclid|li_fat_id|igshid|mc_cid|mc_eid|rdt_cid|epik|qclid|sccid|irclid)$/i;

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
        if (event.properties) next.properties = cleanProperties(event.properties);
        if (event.$set) next.$set = cleanProperties(event.$set);
        if (event.$set_once) next.$set_once = cleanProperties(event.$set_once);
        return next;
    } catch {
        // Never lose an event to a surprise in its shape.
        return event;
    }
};
