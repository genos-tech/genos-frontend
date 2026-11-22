import { useState } from "react";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Button, Typography } from "@mui/joy";

import { DashboardCard, useNumberFormat } from "../../../../../components/ui/dashboard";
import { useTranslation } from "../../../../../i18n";
import { fmt } from "../../../../../i18n/interpolate";
import { focusRing, g, type } from "../../../../../theme/tokens";
import { refusedOrFailed } from "../../../agentActivity/agentSessions";
import type { AgentWorkSession } from "../../../services/loadAgentWork";
import { formatAgentWhen } from "./agentActivityLinks";
import { AgentChip } from "./agentActivityParts";

const FIRST_PAGE = 8;

type Props = {
    sessions: AgentWorkSession[];
    total: number;
    /** The session whose changes the list below is narrowed to, if any. */
    activeRunId: string | null;
    onPick: (runId: string | null) => void;
};

/** "no completion comment" warning: text plus an icon, never colour alone. */
const NoCommentFlag = () => {
    const { t } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    return (
        <Box
            data-testid="agent-session-no-comment"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 0.75,
                py: 0.125,
                borderRadius: g.radius.full,
                bgcolor: g.warning.subtle,
                border: `1px solid ${g.warning.border}`,
                color: g.warning.text,
                ...type("caption"),
                fontWeight: 500,
            }}
        >
            <WarningAmberRoundedIcon sx={{ fontSize: 14 }} aria-hidden />
            {a.sessions.noComment}
        </Box>
    );
};

const SessionRow = ({
    session,
    active,
    onPick,
}: {
    session: AgentWorkSession;
    active: boolean;
    onPick: (runId: string | null) => void;
}) => {
    const { t, locale } = useTranslation();
    const nf = useNumberFormat();
    const a = t.tasks.dashboard.agentActivity;
    const counts: { key: string; label: string; value: number; danger?: boolean }[] = [
        { key: "opened", label: a.sessions.opened, value: session.opened },
        { key: "searched", label: a.sessions.searched, value: session.searched },
        { key: "changed", label: a.sessions.changed, value: session.changed },
        { key: "decided", label: a.sessions.decided, value: session.decided },
        { key: "refused", label: a.sessions.refused, value: session.refused, danger: true },
        { key: "failed", label: a.sessions.failed, value: session.failed, danger: true },
    ];
    return (
        <Box
            component="li"
            data-active={active || undefined}
            data-testid="agent-session-row"
            sx={{
                display: "grid",
                gap: 0.75,
                py: 1.25,
                borderBottom: `1px solid ${g.border.subtle}`,
                "&:last-child": { borderBottom: "none" },
                minWidth: 0,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    columnGap: 1,
                    rowGap: 0.5,
                    minWidth: 0,
                }}
            >
                <AgentChip agent={{ kind: session.agent }} label={a.agents[session.agent]} />
                <Typography level="body-sm" sx={{ color: g.text.primary, fontWeight: 600 }}>
                    {fmt(a.sessions.span, {
                        from: formatAgentWhen(session.started_at, locale) || "—",
                        to: formatAgentWhen(session.ended_at, locale) || "—",
                    })}
                </Typography>
                {session.no_completion_comment && <NoCommentFlag />}
            </Box>
            <Box
                component="dl"
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    columnGap: 2,
                    rowGap: 0.25,
                    m: 0,
                    minWidth: 0,
                }}
            >
                {counts.map((c) => (
                    <Box key={c.key} sx={{ display: "flex", gap: 0.5, alignItems: "baseline" }}>
                        <Box
                            component="dd"
                            sx={{
                                m: 0,
                                order: 1,
                                ...type("body-sm"),
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                                color: c.danger && c.value > 0 ? g.danger.text : g.text.primary,
                            }}
                        >
                            {nf.number(c.value)}
                        </Box>
                        <Box
                            component="dt"
                            sx={{ order: 2, ...type("caption"), color: g.text.secondary }}
                        >
                            {c.label}
                        </Box>
                    </Box>
                ))}
            </Box>
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                }}
            >
                <Typography sx={{ ...type("caption"), color: g.text.secondary }}>
                    {fmt(a.sessions.items, {
                        changed: session.items_changed,
                        touched: session.items_touched,
                    })}
                </Typography>
                <Button
                    aria-pressed={active}
                    color="neutral"
                    disabled={session.changed === 0 && !active}
                    size="sm"
                    sx={{ "&:focus-visible": focusRing }}
                    variant={active ? "solid" : "soft"}
                    onClick={() => onPick(active ? null : session.run_id)}
                >
                    {active ? a.sessions.showAll : a.sessions.showChanges}
                </Button>
            </Box>
        </Box>
    );
};

/**
 * The Sessions view (MIP-2003): the viewer's own agent runs, newest first, each with what the
 * run opened, searched, changed, decided and was refused, and a warning when it changed items
 * without leaving a completion comment. "Show changes" narrows the change list below to that
 * run. The refused and failed calls are one click away, on demand. Counts only, never a line
 * per read.
 */
export const AgentSessionsView = ({ sessions, total, activeRunId, onPick }: Props) => {
    const { t } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    const [shown, setShown] = useState(FIRST_PAGE);
    const [showProblems, setShowProblems] = useState(false);
    const problems = sessions.filter((s) => refusedOrFailed(s) > 0);
    const list = showProblems ? problems : sessions;
    const visible = list.slice(0, shown);

    return (
        <DashboardCard
            count={fmt(a.sessions.count, { count: total })}
            data-testid="agent-sessions"
            emptyBody={a.sessions.emptyBody}
            emptyTitle={a.sessions.emptyTitle}
            state={sessions.length === 0 ? "empty" : "ready"}
            subtitle={a.sessions.subtitle}
            title={a.sessions.title}
            actions={
                problems.length > 0 ? (
                    <Button
                        aria-pressed={showProblems}
                        color="neutral"
                        data-testid="agent-sessions-problems-toggle"
                        size="sm"
                        sx={{ "&:focus-visible": focusRing }}
                        variant={showProblems ? "solid" : "soft"}
                        onClick={() => {
                            setShowProblems((v) => !v);
                            setShown(FIRST_PAGE);
                        }}
                    >
                        {fmt(a.sessions.problemsToggle, { count: problems.length })}
                    </Button>
                ) : undefined
            }
        >
            {showProblems && (
                <Typography sx={{ ...type("caption"), color: g.text.secondary, mb: 0.5 }}>
                    {a.sessions.problemsNote}
                </Typography>
            )}
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                {visible.map((s) => (
                    <SessionRow
                        key={s.run_id}
                        active={s.run_id === activeRunId}
                        session={s}
                        onPick={onPick}
                    />
                ))}
            </Box>
            {list.length > shown && (
                <Button
                    color="neutral"
                    size="sm"
                    sx={{ mt: 1 }}
                    variant="soft"
                    onClick={() => setShown((n) => n + FIRST_PAGE)}
                >
                    {a.sessions.showMore}
                </Button>
            )}
        </DashboardCard>
    );
};
