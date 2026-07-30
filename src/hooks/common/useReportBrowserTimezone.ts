import { useEffect } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";

const PREF_URL = "/user/preferences/timezone/";

/**
 * The browser's IANA timezone name, or `null` if it can't be determined.
 *
 * `resolvedOptions().timeZone` is the only way to get this; it is
 * universally supported in the browsers this app targets, but it can
 * legitimately return `undefined` in odd embeddings, so the caller must
 * handle `null` rather than assume a string.
 */
export const detectBrowserTimezone = (): string | null => {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return zone && typeof zone === "string" ? zone : null;
    } catch {
        return null;
    }
};

/**
 * Should the client write `browser` to the server?
 *
 * Pure so the policy is testable without a network. Two rules, and the
 * second is the one that matters at scale: **don't write when they already
 * agree**, or every app boot for every user becomes a needless UPDATE.
 */
export const shouldReportTimezone = ({
    browser,
    stored,
}: {
    /** From `detectBrowserTimezone()`. */
    browser: string | null;
    /** What the server currently has; `""` when it has never been told. */
    stored: string;
}): boolean => browser !== null && browser !== stored;

/**
 * Keep `CustomUser.timezone` in step with the browser.
 *
 * Server-side date-boundary math ("is this task due today", and later "send
 * this digest at 8am local") needs to know where the user is; nothing else
 * tells it. Runs once per authenticated session: GET what the server has,
 * PATCH only if the browser disagrees.
 *
 * Deliberately silent — no UI, no toast, no retry. If it fails the server
 * keeps falling back to `settings.TIME_ZONE`, which is exactly the old
 * behaviour, so a failure degrades rather than breaks.
 *
 * KNOWN BEHAVIOUR, and it becomes wrong the day a manual timezone setting
 * exists: this overwrites on travel. Someone in Tokyo who opens the app
 * from a laptop in Paris is recorded as being in Paris. That is the right
 * default while the value is browser-derived — it beats a stale zone — but
 * a user-chosen setting would have to win over this, and this hook would
 * then need to only fill in a NULL.
 */
export const useReportBrowserTimezone = (): void => {
    const { accessToken } = useAuth();

    useEffect(() => {
        const api = authApi(accessToken);
        if (!api) return;
        const browser = detectBrowserTimezone();
        if (browser === null) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await api.get<{ timezone: string }>(PREF_URL);
                if (cancelled) return;
                if (!shouldReportTimezone({ browser, stored: res.data.timezone ?? "" })) return;
                await api.patch(PREF_URL, { timezone: browser });
            } catch {
                /* see the docstring — a failure just leaves server time in use */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);
};
