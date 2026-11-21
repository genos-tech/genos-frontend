import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { analytics, ANALYTICS_EVENTS } from "../../services/analytics";
import { useAnalyticsConsent } from "../../services/marketingConsent";

/**
 * Fires a `$pageview` event on every pathname change. We deliberately
 * send `pathname` only — no search params or hash — so things like
 * `?token=…` and chat / task IDs stay out of analytics by default.
 * Enrich the payload here if you ever want richer pageview context.
 *
 * The page open when "Accept" is pressed (MIP-1781) is counted then; before that the library
 * is not started and a view is not queued.
 */
export const useAnalyticsPageviews = (): void => {
    const { pathname } = useLocation();
    const { allowed } = useAnalyticsConsent();

    useEffect(() => {
        if (!allowed) return;
        analytics.capture(ANALYTICS_EVENTS.PAGEVIEW, { path: pathname });
    }, [pathname, allowed]);
};
