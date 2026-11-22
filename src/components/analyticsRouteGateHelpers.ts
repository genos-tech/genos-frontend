import { routeFor } from "../lp/seo/routes";
import { analytics } from "../services/analytics";
import { marketingAnalyticsAllowed } from "../services/marketingConsent";

/**
 * Analytics starts when a visitor enters the app, or accepts the consent banner on a marketing
 * page (MIP-1742, MIP-1778). The public pages (`LP_ROUTES`, the blog) write no cookie or storage
 * and send nothing until then: the library is not even loaded. Probed with posthog-js 1.445.4,
 * no init option holds on its own (see `services/analytics.ts`), so the only reliable switch is
 * to not call `init`. A visitor who accepted earlier (and has not turned analytics off since)
 * gets it started on the next marketing page too.
 *
 * Everything else (sign-in, sign-up, demo, the workspace, an unknown path) calls `init()`, which
 * starts the library only for someone who pressed "Accept" (MIP-1781: the consent is asked once,
 * in the workspace, by `components/layout/AnalyticsConsentPrompt`) and has not switched it off.
 */
export const startAnalyticsOutsideMarketing = (pathname: string): void => {
    if (routeFor(pathname)) {
        if (marketingAnalyticsAllowed()) analytics.startWithConsent();
        return;
    }
    analytics.init();
};
