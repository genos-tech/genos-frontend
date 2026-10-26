import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n";
import { listMySecurityEvents, SecurityEvent } from "../../services/developerApi";
import { SecurityEventRow } from "./SecurityLogSection";

/**
 * Settings → Account: the signed-in person's own security activity (MIP-745).
 *
 * "Was that sign-in from Ohio me?" is the question a person can answer best,
 * and until now these rows were recorded and shown to nobody.
 *
 * Unlike the team log it is never hidden: there is no "not allowed" answer to
 * read as "show nothing". A failure shows an error, because an empty list
 * would be a false statement about someone's own account.
 */
export const MySecurityActivity = () => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const m = t.settings.account;

    const [events, setEvents] = useState<SecurityEvent[] | null>(null);
    const [nextBefore, setNextBefore] = useState<number | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);

    // One path for the first page, a retry of it, and every older page.
    // `cursor` is null for the first page.
    const load = useCallback(
        async (cursor: number | null, isLive: () => boolean = () => true) => {
            setBusy(true);
            setFailed(false);
            const page = await listMySecurityEvents(accessToken, cursor);
            if (!isLive()) return;
            setBusy(false);
            if (!page) {
                setFailed(true);
                return;
            }
            setEvents((prev) =>
                cursor === null ? page.events : [...(prev ?? []), ...page.events]
            );
            setNextBefore(page.nextBefore);
        },
        [accessToken]
    );

    useEffect(() => {
        let live = true;
        setEvents(null);
        setNextBefore(null);
        void load(null, () => live);
        return () => {
            live = false;
        };
    }, [load]);

    return (
        <Box>
            <Typography level="title-sm">{m.activityHeading}</Typography>
            <Typography level="body-xs" sx={{ mt: 0.5, mb: 1.5 }}>
                {m.activityDescription}
            </Typography>
            {events === null && !failed && <CircularProgress size="sm" />}
            {failed && (
                <Alert color="danger" size="sm" sx={{ mb: 1 }}>
                    {m.activityLoadFailed}
                </Alert>
            )}
            {events !== null && (
                <Stack spacing={1}>
                    {events.length === 0 && (
                        <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                            {m.activityEmpty}
                        </Typography>
                    )}
                    {events.map((e) => (
                        <SecurityEventRow event={e} key={e.id} />
                    ))}
                </Stack>
            )}
            {/* A failed first page has no cursor, so the retry asks for it again;
                otherwise "Show older" (or its retry) carries the next cursor. */}
            {(nextBefore !== null || (events === null && failed)) && (
                <Button
                    loading={busy}
                    size="sm"
                    sx={{ mt: 1, alignSelf: "flex-start" }}
                    variant="plain"
                    onClick={() => void load(events === null ? null : nextBefore)}
                >
                    {failed ? m.activityRetry : m.activityLoadMore}
                </Button>
            )}
        </Box>
    );
};
