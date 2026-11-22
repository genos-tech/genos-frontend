/**
 * Server-backed email-digest opt-out (GET/PATCH `/user/preferences/digest/`).
 *
 * Server-backed rather than localStorage because the digest cron reads
 * the stored field. (The proactive AI digest this endpoint used to carry
 * was decommissioned, MIP-1968.)
 *
 * `emailDigestEnabled` is `null` while the initial GET is in flight
 * (render the switch disabled, not defaulted: flashing "on" and snapping
 * off reads like the setting changed itself).
 */

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";

const DIGEST_PREF_URL = "/user/preferences/digest/";

export const useDigestPreference = () => {
    const { accessToken } = useAuth();
    // Stays null (switch disabled) until the server confirms a value.
    const [emailDigestEnabled, setEmailDigestEnabledState] = useState<boolean | null>(null);

    useEffect(() => {
        const api = authApi(accessToken);
        if (!api) return;
        let cancelled = false;
        void api
            .get<{ email_digest_enabled?: boolean }>(DIGEST_PREF_URL)
            .then((res) => {
                if (cancelled) return;
                if (typeof res.data.email_digest_enabled === "boolean") {
                    setEmailDigestEnabledState(res.data.email_digest_enabled);
                }
            })
            .catch(() => {
                // Leave null — the switch stays disabled rather than
                // showing a value the server never confirmed.
            });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const setEmailDigestEnabled = useCallback(
        (value: boolean) => {
            setEmailDigestEnabledState(value);
            const api = authApi(accessToken);
            if (!api) return;
            void api.patch(DIGEST_PREF_URL, { email_digest_enabled: value }).catch(() => {});
        },
        [accessToken]
    );

    return { emailDigestEnabled, setEmailDigestEnabled };
};
