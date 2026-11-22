import { Box, Button, Typography } from "@mui/joy";

import { requestOpenSettings } from "../../../../../components/layout/settingsEvents";
import { DashboardCard, useNumberFormat } from "../../../../../components/ui/dashboard";
import { useTranslation } from "../../../../../i18n";
import { fmt } from "../../../../../i18n/interpolate";
import { g, type } from "../../../../../theme/tokens";
import { AppStripRow } from "../../../agentActivity/agentSessions";
import { formatAgentWhen } from "./agentActivityLinks";
import { AgentChip } from "./agentActivityParts";

const Metric = ({
    label,
    value,
    danger,
    testId,
}: {
    label: string;
    value: string;
    danger?: boolean;
    testId?: string;
}) => (
    <Box sx={{ minWidth: 0 }}>
        <Typography
            data-testid={testId}
            level="title-sm"
            sx={{ color: danger ? g.danger.text : g.text.primary, fontWeight: 600 }}
        >
            {value}
        </Typography>
        <Typography sx={{ ...type("caption"), color: g.text.secondary }}>{label}</Typography>
    </Box>
);

/**
 * The app strip (MIP-2003): one row per connected AI app with its last use, today's calls,
 * changes and refusals, and a way to Settings to disconnect it. Counts only; the figures come
 * from the viewer's own sessions, so a teammate's app never appears here.
 */
export const AgentAppStrip = ({ rows }: { rows: AppStripRow[] }) => {
    const { t, locale } = useTranslation();
    const nf = useNumberFormat();
    const a = t.tasks.dashboard.agentActivity;
    if (rows.length === 0) return null;
    return (
        <DashboardCard
            subtitle={a.strip.subtitle}
            title={a.strip.title}
            actions={
                <Button
                    color="neutral"
                    size="sm"
                    variant="plain"
                    onClick={() => requestOpenSettings("developer")}
                >
                    {a.strip.manage}
                </Button>
            }
        >
            <Box
                component="ul"
                data-testid="agent-app-strip"
                sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0 }}
            >
                {rows.map((row) => (
                    <Box
                        key={row.kind}
                        component="li"
                        data-testid="agent-app-strip-row"
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "repeat(2, minmax(0, 1fr))",
                                md: "minmax(150px, 1.4fr) repeat(4, minmax(0, 1fr))",
                            },
                            alignItems: "start",
                            gap: 1.5,
                            py: 1.25,
                            borderBottom: `1px solid ${g.border.subtle}`,
                            "&:last-child": { borderBottom: "none" },
                            minWidth: 0,
                        }}
                    >
                        <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minWidth: 0 }}>
                            <AgentChip agent={{ kind: row.kind }} label={a.agents[row.kind]} />
                            <Typography
                                sx={{ ...type("caption"), color: g.text.secondary, mt: 0.5 }}
                            >
                                {row.lastUsedAt
                                    ? fmt(a.connections.lastUsed, {
                                          when: formatAgentWhen(row.lastUsedAt, locale),
                                      })
                                    : a.connections.noWrites}
                            </Typography>
                        </Box>
                        <Metric
                            label={a.strip.callsToday}
                            testId="agent-strip-calls"
                            value={nf.number(row.callsToday)}
                        />
                        <Metric
                            label={a.strip.changesToday}
                            testId="agent-strip-changes"
                            value={nf.number(row.changesToday)}
                        />
                        <Metric
                            danger={row.refusedToday > 0}
                            label={a.strip.refusedToday}
                            testId="agent-strip-refused"
                            value={nf.number(row.refusedToday)}
                        />
                        <Metric
                            danger={row.failedToday > 0}
                            label={a.strip.failedToday}
                            testId="agent-strip-failed"
                            value={nf.number(row.failedToday)}
                        />
                    </Box>
                ))}
            </Box>
        </DashboardCard>
    );
};
