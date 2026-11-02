import { useEffect } from "react";

import { analytics } from "../../services/analytics";
import type { UserProps } from "../../types/admin";

/**
 * Re-identifies the current user with PostHog whenever the load-bearing
 * identity traits (userId, teamId, role) change. The team NAME is customer
 * data and is deliberately not sent (MIP-864): the opaque teamId carries the
 * same analytic value. No-op until
 * `myself.userId` is populated. Reset on sign-out is handled where the
 * sign-out actually happens (sidebar.tsx, AuthContext.forceSignOut), not
 * here — this hook only knows about the live-user direction.
 */
export const useAnalyticsIdentity = (myself: UserProps | null | undefined): void => {
    const userId = myself?.userId;
    const teamId = myself?.teamId;
    const role = myself?.role;

    useEffect(() => {
        if (!userId) return;
        analytics.identify(userId, { role, teamId });
    }, [userId, teamId, role]);
};
