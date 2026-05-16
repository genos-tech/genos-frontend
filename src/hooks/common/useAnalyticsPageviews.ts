import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { analytics, ANALYTICS_EVENTS } from "../../services/analytics";

/**
 * Fires a `$pageview` event on every pathname change. We deliberately
 * send `pathname` only — no search params or hash — so things like
 * `?token=…` and chat / task IDs stay out of analytics by default.
 * Enrich the payload here if you ever want richer pageview context.
 */
export const useAnalyticsPageviews = (): void => {
    const { pathname } = useLocation();

    useEffect(() => {
        analytics.capture(ANALYTICS_EVENTS.PAGEVIEW, { path: pathname });
    }, [pathname]);
};
