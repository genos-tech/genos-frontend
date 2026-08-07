import { useEffect } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";
import { detectBrowserTimezone } from "../../utils/userTimezone";

const PREF_URL = "/user/preferences/timezone/";

// Moved to `utils/userTimezone` so the profile card can detect a zone
// without importing this hook's auth and axios dependencies. Re-exported
// because this is where the rest of the app already imports it from.
export { detectBrowserTimezone };

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
 * This also supplies the profile card's location when the user hasn't
 * picked one, which is the usual case: the browser reports the zone, not
 * the city, so someone in Osaka is recorded — correctly — as Asia/Tokyo.
 *
 * KNOWN BEHAVIOUR: this overwrites on travel. Someone in Tokyo who opens
 * the app from a laptop in Paris is recorded as being in Paris. That is
 * the right default for a value nobody chose, and it is why a manual pick
 * is stored in a SEPARATE column (`current_location`) instead of here —
 * readers resolve `current_location or timezone`, so the explicit answer
 * wins without this hook having to know that manual answers exist.
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
