import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

import { routeFor } from "../lp/seo/routes";
import { analytics } from "../services/analytics";

/**
 * Analytics starts when a visitor enters the app, not when they read a marketing page
 * (MIP-1742). The public pages (`LP_ROUTES`, the blog) write no cookie or storage and send
 * nothing: the library is not even loaded. Probed with posthog-js 1.445.4, no init option
 * holds on its own (see `services/analytics.ts`), so the only reliable switch is to not
 * call `init`.
 *
 * Everything else (sign-in, sign-up, demo, the workspace, an unknown path) starts it as
 * before, subject to the stored opt-out preference.
 */
export const startAnalyticsOutsideMarketing = (pathname: string): void => {
    if (routeFor(pathname)) return;
    analytics.init();
};

/**
 * Covers a client-side move from a marketing page into the app (the plans page links to
 * `/signup` with a router `Link`; `/` hands a signed-in visitor to the workspace). A
 * LAYOUT effect on purpose: `analytics.capture` drops a call made before `init`, and the
 * first `$pageview` of a direct load is sent from a passive effect lower in the tree.
 */
export const AnalyticsRouteGate = (): null => {
    const { pathname } = useLocation();
    useLayoutEffect(() => {
        startAnalyticsOutsideMarketing(pathname);
    }, [pathname]);
    return null;
};
