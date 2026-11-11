import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n";
import { listMySecurityEvents, SecurityEvent } from "../../services/developerApi";
import { DataState } from "../ui/feedback/DataState";
import { ErrorState } from "../ui/feedback/ErrorState";
import { SkeletonRows } from "../ui/feedback/Skeleton";
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

    // Bumped whenever the list is reset (token change, unmount): an answer that started
    // before that, including one from an inline Retry, must not write into the new list.
    const generationRef = useRef(0);

    // One path for the first page, a retry of it, and every older page.
    // `cursor` is null for the first page.
    const load = useCallback(
        async (cursor: number | null) => {
            const generation = generationRef.current;
            setBusy(true);
            setFailed(false);
            const page = await listMySecurityEvents(accessToken, cursor);
            if (generation !== generationRef.current) return;
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
        generationRef.current += 1;
        setEvents(null);
        setNextBefore(null);
        void load(null);
        return () => {
            generationRef.current += 1;
        };
    }, [load]);

    return (
        <Box>
            <Typography level="title-sm">{m.activityHeading}</Typography>
            <Typography level="body-xs" sx={{ mt: 0.5, mb: 1.5 }}>
                {m.activityDescription}
            </Typography>
            <DataState
                error={failed}
                errorState={{
                    title: m.activityLoadFailed,
                    onRetry: () => void load(null),
                    "data-error": "security-activity",
                }}
                hasData={events !== null}
                loading={events === null && !failed}
                size="sm"
                skeleton={<SkeletonRows count={3} twoLines />}
            >
                <Stack spacing={1}>
                    {events?.length === 0 && (
                        <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                            {m.activityEmpty}
                        </Typography>
                    )}
                    {events?.map((e) => (
                        <SecurityEventRow event={e} key={e.id} />
                    ))}
                </Stack>
            </DataState>
            {/* An older page that failed keeps the rows already shown (DataState
                ignores `error` once there is data) and says so under them; its
                Retry asks for the SAME page, not the first one. */}
            {events !== null && failed && (
                <ErrorState
                    data-error="security-activity-older"
                    size="xs"
                    title={m.activityLoadFailed}
                    onRetry={() => void load(nextBefore)}
                />
            )}
            {nextBefore !== null && !failed && (
                <Button
                    loading={busy}
                    size="sm"
                    sx={{ mt: 1, alignSelf: "flex-start" }}
                    variant="plain"
                    onClick={() => void load(nextBefore)}
                >
                    {m.activityLoadMore}
                </Button>
            )}
        </Box>
    );
};
