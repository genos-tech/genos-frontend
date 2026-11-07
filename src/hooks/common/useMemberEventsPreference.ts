import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";

const PREF_URL = "/user/preferences/member-events/";

/**
 * "Notice what my AI apps open" — `CustomUser.member_events_enabled`.
 *
 * Server-backed (GET/PATCH `/user/preferences/member-events/`), account-wide, and
 * ON by default. When on, Genos notes which tasks, notes and projects the
 * person's connected AI apps open or change over MCP: references only, never
 * text, visible only to them, kept 180 days. Turning it OFF makes the server
 * delete everything noted.
 *
 * Not optimistic, for the same reason as `useShareAnswersPreference`: the OFF
 * direction deletes, so the switch stays where it was until the server has
 * answered, `saving` covers the gap, and `setEnabled` resolves to whether it
 * stuck. `enabled` stays `null` when the GET fails rather than guessing "on".
 */
export const useMemberEventsPreference = () => {
    const { accessToken } = useAuth();
    const [enabled, setEnabledState] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const api = authApi(accessToken);
        if (!api) {
            setEnabledState(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        (async () => {
            try {
                const res = await api.get<{ member_events_enabled: boolean }>(PREF_URL, {
                    suppressErrorToast: true,
                });
                const value = res.data?.member_events_enabled;
                if (!cancelled) setEnabledState(typeof value === "boolean" ? value : null);
            } catch {
                if (!cancelled) setEnabledState(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const setEnabled = useCallback(
        async (value: boolean): Promise<boolean> => {
            const api = authApi(accessToken);
            if (!api) return false;
            setSaving(true);
            try {
                const res = await api.patch<{ member_events_enabled: boolean }>(
                    PREF_URL,
                    { member_events_enabled: value },
                    { suppressErrorToast: true }
                );
                const echoed = res.data?.member_events_enabled;
                setEnabledState(typeof echoed === "boolean" ? echoed : value);
                return true;
            } catch {
                return false;
            } finally {
                setSaving(false);
            }
        },
        [accessToken]
    );

    return { enabled, loading, saving, setEnabled };
};
