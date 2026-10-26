import { useCallback, useEffect, useState } from "react";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import { Box, Button, Chip, Sheet, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../context/AuthContext";
import { fmt, useTranslation } from "../../i18n";
import { listTeamSecurityEvents, SecurityEvent } from "../../services/developerApi";

type Props = {
    teamId: string;
};

/**
 * One row of a security log: what happened, to whom, by whom, when, from
 * where, and through which surface. Shared by the team log (Developer) and a
 * person's own log (Account) so the two cannot describe an event differently.
 */
export const SecurityEventRow = ({ event: e }: { event: SecurityEvent }) => {
    const { t, locale } = useTranslation();
    const s = t.settings.developer.securityLog;

    // The server's English label covers an action added after this
    // client was built.
    const actionLabel = (s.actions as Record<string, string>)[e.action] ?? e.actionLabel;
    const sourceLabel = (s.sources as Record<string, string>)[e.source] ?? e.source;
    const isAlert = e.action.startsWith("alert.");

    return (
        <Sheet
            color={isAlert ? "warning" : "neutral"}
            data-testid="security-event"
            sx={{ borderRadius: 8, p: 1.25, minWidth: 0 }}
            variant="soft"
        >
            <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm" noWrap>
                        {actionLabel}
                        {e.targetLabel && (
                            <Typography component="span" level="body-sm" sx={{ opacity: 0.8 }}>
                                {" "}
                                — {e.targetLabel}
                            </Typography>
                        )}
                    </Typography>
                    <Typography level="body-xs" sx={{ opacity: 0.7 }} noWrap>
                        {fmt(s.byWhen, {
                            actor: e.actorLabel || s.unknownActor,
                            when: new Date(e.createdAt).toLocaleString(locale),
                        })}
                        {e.ip && (
                            <Box component="span" sx={{ fontFamily: "monospace" }}>
                                {" "}
                                · {e.ip}
                            </Box>
                        )}
                    </Typography>
                </Box>
                <Chip size="sm" variant="soft">
                    {sourceLabel}
                </Chip>
            </Stack>
        </Sheet>
    );
};

/**
 * Settings → Developer: the team's security log, for its owner.
 *
 * Hidden, not shown empty, for everyone else — the server answers 404
 * to editors and members alike, and the same `null` the team key list
 * uses keeps it out of their panel. A failure AFTER the first page is
 * the one error shown, because by then the owner knows the log exists.
 */
export const SecurityLogSection = ({ teamId }: Props) => {
    const { t, locale } = useTranslation();
    const { accessToken } = useAuth();
    const s = t.settings.developer.securityLog;

    // `null` = not the owner (or the first load failed): hidden.
    const [events, setEvents] = useState<SecurityEvent[] | null>(null);
    const [nextBefore, setNextBefore] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [moreFailed, setMoreFailed] = useState(false);

    useEffect(() => {
        let live = true;
        setEvents(null);
        setNextBefore(null);
        setMoreFailed(false);
        void listTeamSecurityEvents(accessToken, teamId).then((page) => {
            if (!live) return;
            setEvents(page ? page.events : null);
            setNextBefore(page ? page.nextBefore : null);
        });
        return () => {
            live = false;
        };
    }, [accessToken, teamId]);

    const loadMore = useCallback(async () => {
        if (nextBefore === null) return;
        setBusy(true);
        setMoreFailed(false);
        const page = await listTeamSecurityEvents(accessToken, teamId, nextBefore);
        setBusy(false);
        if (!page) {
            setMoreFailed(true);
            return;
        }
        setEvents((prev) => [...(prev ?? []), ...page.events]);
        setNextBefore(page.nextBefore);
    }, [accessToken, teamId, nextBefore]);

    if (events === null) return null;

    return (
        <Stack spacing={1.5}>
            <Stack alignItems="center" direction="row" spacing={1}>
                <ShieldRoundedIcon sx={{ fontSize: 18 }} />
                <Typography level="title-md">{s.title}</Typography>
            </Stack>
            <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                {s.blurb}
            </Typography>
            {events.length === 0 && (
                <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                    {s.empty}
                </Typography>
            )}
            {events.map((e) => (
                <SecurityEventRow event={e} key={e.id} />
            ))}
            {moreFailed && (
                <Typography color="danger" level="body-xs">
                    {s.loadFailed}
                </Typography>
            )}
            {nextBefore !== null && (
                <Button
                    loading={busy}
                    size="sm"
                    sx={{ alignSelf: "flex-start" }}
                    variant="plain"
                    onClick={loadMore}
                >
                    {moreFailed ? s.retry : s.loadMore}
                </Button>
            )}
        </Stack>
    );
};
