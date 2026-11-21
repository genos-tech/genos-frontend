import { Box, Typography } from "@mui/joy";

import { useTranslation } from "../../../../../i18n";
import { g, type } from "../../../../../theme/tokens";
import { AGENT_KINDS, AgentWorkTotals } from "../../../services/loadAgentWork";
import { AgentChip } from "./agentActivityParts";

/** Totals by agent (five tiles) and the decisions recorded in the window. */
export const AgentSummaryRow = ({ totals }: { totals: AgentWorkTotals }) => {
    const { t } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    return (
        <Box
            aria-label={a.summary.changes}
            role="list"
            sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(6, minmax(0, 1fr))",
                },
                minWidth: 0,
            }}
        >
            {AGENT_KINDS.map((kind) => (
                <Box
                    key={kind}
                    role="listitem"
                    sx={{
                        minWidth: 0,
                        p: 1.25,
                        borderRadius: g.radius.md,
                        border: `1px solid ${g.border.subtle}`,
                        bgcolor: g.surface.default,
                    }}
                >
                    <AgentChip agent={{ kind }} label={a.agents[kind]} />
                    <Typography
                        component="p"
                        data-testid={`agent-total-${kind}`}
                        level="h3"
                        sx={{
                            mt: 0.75,
                            mb: 0,
                            color: g.text.primary,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {totals.by_agent[kind] ?? 0}
                    </Typography>
                </Box>
            ))}
            <Box
                role="listitem"
                sx={{
                    minWidth: 0,
                    p: 1.25,
                    borderRadius: g.radius.md,
                    border: `1px solid ${g.border.subtle}`,
                    bgcolor: g.surface.default,
                }}
            >
                <Typography
                    component="p"
                    level="title-sm"
                    sx={{ ...type("title-sm"), color: g.text.secondary }}
                >
                    {a.summary.decisions}
                </Typography>
                <Typography
                    component="p"
                    data-testid="agent-total-decisions"
                    level="h3"
                    sx={{
                        mt: 0.75,
                        mb: 0,
                        color: g.text.primary,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {totals.decisions ?? 0}
                </Typography>
            </Box>
        </Box>
    );
};
