import { Box, Button, Typography } from "@mui/joy";

import { requestOpenSettings } from "../../../../../components/layout/settingsEvents";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { useTranslation } from "../../../../../i18n";
import { fmt } from "../../../../../i18n/interpolate";
import { g } from "../../../../../theme/tokens";
import { AGENT_KINDS, AgentKind, AgentWorkConnection } from "../../../services/loadAgentWork";
import { formatAgentWhen } from "./agentActivityLinks";
import { AgentChip } from "./agentActivityParts";

/** The AI apps the viewer has connected, and when each last wrote or was used. */
export const AgentConnectionsList = ({ connections }: { connections: AgentWorkConnection[] }) => {
    const { t, locale } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography component="h3" level="title-md" sx={{ mb: 1 }}>
                {a.connections.title}
            </Typography>
            {connections.length === 0 ? (
                <EmptyState body={a.connections.empty} data-empty="agent-connections" size="xs" />
            ) : (
                <Box
                    component="ul"
                    sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.75 }}
                >
                    {connections.map((c, i) => {
                        const known = (AGENT_KINDS as readonly string[]).includes(c.family);
                        const label = known ? a.agents[c.family as AgentKind] : c.family;
                        return (
                            <Box
                                key={`${c.family}-${i}`}
                                component="li"
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 1,
                                    alignItems: "center",
                                    minWidth: 0,
                                }}
                            >
                                <AgentChip
                                    agent={{ kind: known ? (c.family as AgentKind) : "other_app" }}
                                    label={label}
                                />
                                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                    {c.last_used_at
                                        ? fmt(a.connections.lastUsed, {
                                              when: formatAgentWhen(c.last_used_at, locale),
                                          })
                                        : a.connections.noWrites}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            )}
            {connections.length > 0 && (
                <Button
                    color="neutral"
                    size="sm"
                    sx={{ mt: 1.5 }}
                    variant="soft"
                    onClick={() => requestOpenSettings("developer")}
                >
                    {a.states.connect}
                </Button>
            )}
        </Box>
    );
};
