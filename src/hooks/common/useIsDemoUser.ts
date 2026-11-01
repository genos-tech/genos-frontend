import { useEffect, useState } from "react";

import { getMyProfile } from "../../features/admin/services/getMyProfile";

/**
 * Is the signed-in user a demo account? Read from the server (`is_demo` on
 * `GET /user/me/`), not from localStorage: a browser flag outlives the
 * session, so it could still say "demo" after a real user signed in on the
 * same browser (MIP-837).
 *
 * `false` until the profile has loaded, and `false` on any failure, so a
 * real user never sees a demo-only element flash in. The answer is kept per
 * `userId`: a token refresh does not refetch, and a different user starts
 * from `false` again.
 */
export const useIsDemoUser = (
    accessToken: string | null | undefined,
    userId: string | null | undefined
): boolean => {
    const [resolved, setResolved] = useState<{ userId: string; isDemo: boolean } | null>(null);
    const alreadyKnown = resolved != null && resolved.userId === userId;

    useEffect(() => {
        if (!accessToken || !userId || alreadyKnown) return;
        let cancelled = false;
        void getMyProfile(accessToken).then((profile) => {
            if (!cancelled && profile) setResolved({ userId, isDemo: profile.isDemo });
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken, userId, alreadyKnown]);

    return alreadyKnown && resolved.isDemo;
};
