import { useEffect, useMemo, useState } from "react";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import { Box, Chip, Sheet, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../context/authState";
import { fmt, useTranslation } from "../../i18n";
import { AgentUseRow, listTeamAgentUse } from "../../services/developerApi";
import { EmptyState } from "../ui/feedback/EmptyState";

type Props = {
    teamId: string;
};

type Week = { weekStart: string; rows: AgentUseRow[] };

/** Rows arrive newest week first; keep that order and group by week. */
const groupByWeek = (rows: AgentUseRow[]): Week[] => {
    const weeks: Week[] = [];
    for (const row of rows) {
        const last = weeks[weeks.length - 1];
        if (last && last.weekStart === row.weekStart) last.rows.push(row);
        else weeks.push({ weekStart: row.weekStart, rows: [row] });
    }
    return weeks;
};

/**
 * Settings → Developer: what the team's members' AI apps did, as counts per
 * member per app per week (MIP-2011). Owner only; hidden, not shown empty, for
 * everyone else (the server answers 404, which `listTeamAgentUse` returns as
 * `null`). The server sends sums only, never what was read or searched, so
 * there is nothing finer to show. The API key's own name ("Claude Code") is
 * in the rows only because the caller is the owner (D7).
 */
export const AgentUseSection = ({ teamId }: Props) => {
    const { t, locale } = useTranslation();
    const { accessToken } = useAuth();
    const s = t.settings.developer.agentUse;

    // `null` = not the owner (or the load failed): hidden.
    const [rows, setRows] = useState<AgentUseRow[] | null>(null);

    useEffect(() => {
        let live = true;
        setRows(null);
        void listTeamAgentUse(accessToken, teamId).then((r) => {
            if (live) setRows(r);
        });
        return () => {
            live = false;
        };
    }, [accessToken, teamId]);

    const weeks = useMemo(() => groupByWeek(rows ?? []), [rows]);

    if (rows === null) return null;

    const appLabel = (r: AgentUseRow) => {
        const app = (s.apps as Record<string, string>)[r.app] ?? r.app;
        return r.keyName ? fmt(s.keyNamed, { app, key: r.keyName }) : app;
    };

    return (
        <Stack spacing={1.5}>
            <Stack alignItems="center" direction="row" spacing={1}>
                <SmartToyRoundedIcon sx={{ fontSize: 18 }} />
                <Typography level="title-md">{s.title}</Typography>
            </Stack>
            <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                {s.blurb}
            </Typography>
            {weeks.length === 0 ? (
                <EmptyState body={s.empty} size="xs" />
            ) : (
                weeks.map((w) => (
                    <Stack key={w.weekStart} data-testid="agent-use-week" spacing={0.75}>
                        <Typography level="title-sm">
                            {fmt(s.weekOf, {
                                date: new Date(`${w.weekStart}T00:00:00Z`).toLocaleDateString(
                                    locale,
                                    { timeZone: "UTC", month: "short", day: "numeric" }
                                ),
                            })}
                        </Typography>
                        {w.rows.map((r) => (
                            <Sheet
                                key={`${r.userId}-${r.app}-${r.keyName ?? r.credentialKind}`}
                                data-testid="agent-use-row"
                                sx={{ borderRadius: 8, p: 1.25, minWidth: 0 }}
                                variant="soft"
                            >
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    flexWrap="wrap"
                                    gap={1}
                                    sx={{ minWidth: 0 }}
                                >
                                    <Box sx={{ minWidth: 0, flex: "1 1 12rem" }}>
                                        <Typography level="title-sm" noWrap>
                                            {r.username || s.unknownMember}
                                        </Typography>
                                        <Typography level="body-xs" sx={{ opacity: 0.7 }} noWrap>
                                            {appLabel(r)}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                                        <Chip size="sm" variant="soft">
                                            {fmt(s.calls, { n: r.calls })}
                                        </Chip>
                                        <Chip size="sm" variant="soft">
                                            {fmt(s.changes, { n: r.changes })}
                                        </Chip>
                                        {r.refused > 0 && (
                                            <Chip color="warning" size="sm" variant="soft">
                                                {fmt(s.refused, { n: r.refused })}
                                            </Chip>
                                        )}
                                    </Stack>
                                </Stack>
                            </Sheet>
                        ))}
                    </Stack>
                ))
            )}
        </Stack>
    );
};
