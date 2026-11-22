import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

import { startAnalyticsOutsideMarketing } from "./analyticsRouteGateHelpers";

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
