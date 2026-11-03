import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";

const PREF_URL = "/user/preferences/share-answers/";

/**
 * "Let my answers help teammates" — `CustomUser.share_answers_with_team`.
 *
 * Server-backed (GET/PATCH `/user/preferences/share-answers/`), account-wide,
 * and ON by default (it was always on before there was a switch). When it is
 * on, a completed first-turn answer may be shown to teammates as an anonymous
 * "Previous answer" if they could see all of its sources. Turning it OFF
 * makes the server remove the person's existing answers from the team lane at
 * once.
 *
 * Unlike the other preference hooks this one is NOT optimistic. Its OFF
 * direction deletes something, so the switch must not claim "off" before the
 * server has said so: it stays where it was until the PATCH lands, `saving`
 * covers the gap, and `setEnabled` resolves to whether it stuck so the caller
 * can follow a successful OFF by clearing the list of shared answers.
 *
 * `enabled` is `null` until the first GET answers (or fails), and a failed GET
 * leaves it `null` rather than guessing: showing a default "on" for someone
 * who turned it off is the kind of wrong this page exists to prevent.
 */
export const useShareAnswersPreference = () => {
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
                const res = await api.get<{ share_answers_with_team: boolean }>(PREF_URL, {
                    suppressErrorToast: true,
                });
                if (!cancelled) setEnabledState(res.data.share_answers_with_team !== false);
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
                const res = await api.patch<{ share_answers_with_team: boolean }>(
                    PREF_URL,
                    { share_answers_with_team: value },
                    { suppressErrorToast: true }
                );
                // Trust the server's echo; fall back to what was asked for if
                // it ever answers without one.
                const echoed = res.data?.share_answers_with_team;
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
