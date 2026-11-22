import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Box, Typography } from "@mui/joy";

import { useNumberFormat } from "../../components/ui/dashboard";
import { useTranslation } from "../../i18n";
import { requestAppNavigate } from "../../services/appNavigate";
import { focusRing, g } from "../../theme/tokens";
import { AGENT_VIEW_PARAM, AGENT_VIEW_VALUE } from "../tasks/agentActivity/agentActivityFilters";
import type { AgentsToday } from "./agentsToday";

const AGENT_TAB_HREF = `/workspace/tasks?${AGENT_VIEW_PARAM}=${AGENT_VIEW_VALUE}`;

type Props = {
    /** `null` hides the card: no activity, still loading, or the answer failed. */
    data: AgentsToday | null;
};

/**
 * "Your agents today" (MIP-2004): one small card in the Today tab's section style, one click to
 * the Agent Activity tab. It shows only counts and app names (what the viewer's own agents did in
 * the last day), never text, and does not exist at all on a day with no agent activity.
 */
export const TodayAgentsCard = ({ data }: Props) => {
    const { t } = useTranslation();
    const nf = useNumberFormat();
    if (!data || data.sessions <= 0) return null;
    const a = t.tasks.dashboard.today.agents;
    const names = t.tasks.dashboard.agentActivity.agents as Record<string, string>;
    const apps = data.agents.map((agent) => names[agent] ?? names.other_app).join(", ");
    const stats: { key: string; label: string; value: number; warn?: boolean }[] = [
        { key: "sessions", label: a.sessions, value: data.sessions },
        { key: "changes", label: a.changes, value: data.changes },
        { key: "decisions", label: a.decisions, value: data.decisions },
        { key: "refused", label: a.refused, value: data.refused, warn: true },
    ].filter((s) => s.key === "sessions" || s.value > 0);
    return (
        <Box
            aria-label={a.title}
            component="section"
            data-testid="today-agents"
            sx={{
                minWidth: 0,
                border: `1px solid ${g.border.subtle}`,
                borderRadius: g.radius.md,
                bgcolor: g.surface.default,
                py: 1,
            }}
        >
            <Box
                component="button"
                data-testid="today-agents-open"
                title={a.open}
                type="button"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    width: "100%",
                    minWidth: 0,
                    minHeight: 44,
                    px: 1.25,
                    py: 0.75,
                    border: 0,
                    background: "transparent",
                    borderRadius: g.radius.sm,
                    font: "inherit",
                    textAlign: "start",
                    cursor: "pointer",
                    "&:hover": { background: g.hover },
                    "&:focus-visible": focusRing,
                }}
                onClick={() => requestAppNavigate(AGENT_TAB_HREF)}
            >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm" sx={{ color: g.text.primary }}>
                        {a.title}
                        {apps ? (
                            <Box
                                component="span"
                                sx={{ ml: 0.75, color: g.text.secondary, fontWeight: 400 }}
                            >
                                {apps}
                            </Box>
                        ) : null}
                    </Typography>
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            columnGap: 1.5,
                            rowGap: 0.25,
                            mt: 0.25,
                        }}
                    >
                        {stats.map((s) => (
                            <Typography
                                key={s.key}
                                data-testid={`today-agents-${s.key}`}
                                level="body-sm"
                                sx={{ color: s.warn ? g.warning.text : g.text.secondary }}
                            >
                                {s.label}{" "}
                                <Box
                                    component="span"
                                    sx={{
                                        color: s.warn ? "inherit" : g.text.primary,
                                        fontWeight: 600,
                                    }}
                                >
                                    {nf.number(s.value)}
                                </Box>
                            </Typography>
                        ))}
                    </Box>
                </Box>
                <ArrowForwardRoundedIcon
                    sx={{ color: g.text.secondary, flexShrink: 0, fontSize: 18 }}
                    aria-hidden
                />
            </Box>
        </Box>
    );
};
