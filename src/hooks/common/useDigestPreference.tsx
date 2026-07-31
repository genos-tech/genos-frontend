/**
 * Server-backed proactive-digest opt-out (UX tier model §8).
 *
 * Server-backed (GET/PATCH `/user/preferences/digest/`) rather than
 * localStorage for the same reason the web-search toggle is: the
 * DIGEST CRON reads the stored field — a client-only preference would
 * be invisible to it. Whether a digest fires at all, and how often,
 * comes from the plan (`digest_cadence`), deliberately not from user
 * config; this toggle is only the opt-out.
 *
 * `digestEnabled` is `null` while the initial GET is in flight (render
 * the switch disabled, not defaulted — flashing "on" and snapping off
 * reads like the setting changed itself).
 */

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";

const DIGEST_PREF_URL = "/user/preferences/digest/";

export const useDigestPreference = () => {
    const { accessToken } = useAuth();
    const [digestEnabled, setDigestEnabledState] = useState<boolean | null>(null);

    useEffect(() => {
        const api = authApi(accessToken);
        if (!api) return;
        let cancelled = false;
        void api
            .get<{ digest_enabled: boolean }>(DIGEST_PREF_URL)
            .then((res) => {
                if (!cancelled) setDigestEnabledState(!!res.data.digest_enabled);
            })
            .catch(() => {
                // Leave null — the switch stays disabled rather than
                // showing a value the server never confirmed.
            });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const setDigestEnabled = useCallback(
        (value: boolean) => {
            // Optimistic: the switch reflects the tap immediately; a
            // failed PATCH is caught silently and the next GET corrects.
            setDigestEnabledState(value);
            const api = authApi(accessToken);
            if (!api) return;
            void api.patch(DIGEST_PREF_URL, { digest_enabled: value }).catch(() => {});
        },
        [accessToken]
    );

    return { digestEnabled, setDigestEnabled };
};
