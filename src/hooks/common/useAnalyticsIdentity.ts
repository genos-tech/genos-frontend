import { useEffect } from "react";

import { analytics } from "../../services/analytics";
import { useAnalyticsConsent } from "../../services/marketingConsent";
import type { UserProps } from "../../types/admin";

/**
 * Re-identifies the current user with PostHog whenever the load-bearing
 * identity traits (userId, teamId, role) change. The team NAME is customer
 * data and is deliberately not sent (MIP-864): the opaque teamId carries the
 * same analytic value. No-op until
 * `myself.userId` is populated, and until analytics is allowed (MIP-1781): nothing is sent
 * before "Accept", and it identifies again at once when "Accept" is pressed (or the Settings
 * switch is turned on). Reset on sign-out is handled where the
 * sign-out actually happens (sidebar.tsx, AuthContext.forceSignOut), not
 * here — this hook only knows about the live-user direction.
 */
export const useAnalyticsIdentity = (myself: UserProps | null | undefined): void => {
    const userId = myself?.userId;
    const teamId = myself?.teamId;
    const role = myself?.role;
    const { allowed } = useAnalyticsConsent();

    useEffect(() => {
        if (!userId || !allowed) return;
        analytics.identify(userId, { role, teamId });
    }, [userId, teamId, role, allowed]);
};
