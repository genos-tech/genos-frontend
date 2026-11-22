import { Box, Link, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { DashboardCard } from "../../../../../components/ui/dashboard";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { useTranslation } from "../../../../../i18n";
import { fmt } from "../../../../../i18n/interpolate";
import { g } from "../../../../../theme/tokens";
import { AgentWorkDecision } from "../../../services/loadAgentWork";
import { agentDecisionPath, agentKindOf, formatAgentWhen } from "./agentActivityLinks";
import { AgentChip } from "./agentActivityParts";

/** Notes titled "Decision: …" in the window, the viewer's own or shared with them. */
export const AgentDecisionsList = ({ decisions }: { decisions: AgentWorkDecision[] }) => {
    const { t, locale } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    const navigate = useNavigate();
    return (
        <DashboardCard title={a.decisions.title}>
            {decisions.length === 0 ? (
                <EmptyState body={a.decisions.empty} data-empty="agent-decisions" size="xs" />
            ) : (
                <Box
                    component="ul"
                    sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.5 }}
                >
                    {decisions.map((d) => {
                        const path = agentDecisionPath(d);
                        const title = d.title || a.untitled;
                        return (
                            <Box
                                key={`${String(d.note_type ?? "")}:${String(d.note_id)}`}
                                component="li"
                                sx={{ minWidth: 0, py: 0.5 }}
                            >
                                {path ? (
                                    <Link
                                        aria-label={fmt(a.openTarget, { title })}
                                        component="button"
                                        level="body-sm"
                                        type="button"
                                        sx={{
                                            fontWeight: 600,
                                            textAlign: "left",
                                            maxWidth: "100%",
                                        }}
                                        onClick={() => navigate(path)}
                                    >
                                        {title}
                                    </Link>
                                ) : (
                                    <Typography
                                        level="body-sm"
                                        sx={{ fontWeight: 600, color: g.text.primary }}
                                    >
                                        {title}
                                    </Typography>
                                )}
                                <Typography
                                    component="div"
                                    level="body-xs"
                                    sx={{
                                        color: g.text.secondary,
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 0.75,
                                        alignItems: "center",
                                        mt: 0.25,
                                    }}
                                >
                                    <time dateTime={d.at}>{formatAgentWhen(d.at, locale)}</time>
                                    {d.user && <span>{d.user.name}</span>}
                                    <AgentChip
                                        agent={d.agent}
                                        label={a.agents[agentKindOf(d.agent)]}
                                    />
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            )}
        </DashboardCard>
    );
};
