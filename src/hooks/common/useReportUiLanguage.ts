import { useEffect } from "react";

import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n";
import { authApi } from "../../services/api";

const PREF_URL = "/user/preferences/language/";

/**
 * Should the client write the active locale to the server?
 *
 * Pure for testability, mirroring `shouldReportTimezone`: never write when
 * they already agree, or every boot becomes a needless UPDATE.
 */
export const shouldReportLanguage = ({
    active,
    stored,
}: {
    /** The i18n provider's active locale ("en", "ja", ...). */
    active: string;
    /** What the server currently has; `""` when it has never been told. */
    stored: string;
}): boolean => active !== "" && active !== stored;

/**
 * Keep `CustomUser.language` in step with the active UI locale.
 *
 * The email notification channel renders in the user's language, and the
 * server has no other source for it — the exact counterpart of
 * `useReportBrowserTimezone`, with one deliberate difference: it re-runs
 * when the locale CHANGES (not just once per session), so switching the
 * app to 日本語 also switches the emails.
 *
 * Silent — a failure just means English emails, which is the fallback
 * behaviour anyway.
 */
export const useReportUiLanguage = (): void => {
    const { accessToken } = useAuth();
    const { locale } = useTranslation();

    useEffect(() => {
        const api = authApi(accessToken);
        if (!api || !locale) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await api.get<{ language: string }>(PREF_URL);
                if (cancelled) return;
                if (!shouldReportLanguage({ active: locale, stored: res.data.language ?? "" }))
                    return;
                await api.patch(PREF_URL, { language: locale });
            } catch {
                /* see the docstring — a failure just leaves English in use */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken, locale]);
};
