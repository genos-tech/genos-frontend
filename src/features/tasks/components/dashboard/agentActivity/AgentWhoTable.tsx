import { useMemo, useState } from "react";
import { Box, Button, Table, Typography } from "@mui/joy";

import { useTranslation } from "../../../../../i18n";
import { fmt } from "../../../../../i18n/interpolate";
import { g } from "../../../../../theme/tokens";
import { AgentWorkUserAgentRow } from "../../../services/loadAgentWork";
import { AgentChip } from "./agentActivityParts";

const SHOWN_PROJECTS = 3;

/**
 * "Who uses which agent": one row per person and agent, with the number of changes and
 * the top projects. Sorted by the change count only (the spec's one sort), most first.
 */
export const AgentWhoTable = ({ rows }: { rows: AgentWorkUserAgentRow[] }) => {
    const { t } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    const [descending, setDescending] = useState(true);
    const sorted = useMemo(
        () => [...rows].sort((x, y) => (descending ? y.count - x.count : x.count - y.count)),
        [rows, descending]
    );

    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography component="h3" level="title-md" sx={{ mb: 1 }}>
                {a.who.title}
            </Typography>
            <Box
                sx={{
                    overflowX: "auto",
                    minWidth: 0,
                    borderRadius: g.radius.md,
                    border: `1px solid ${g.border.subtle}`,
                }}
            >
                <Table
                    aria-label={a.who.title}
                    size="sm"
                    sx={{ minWidth: 520, "& th, & td": { verticalAlign: "middle" } }}
                >
                    <thead>
                        <tr>
                            <th scope="col">{a.who.person}</th>
                            <th scope="col">{a.who.agent}</th>
                            <th
                                aria-sort={descending ? "descending" : "ascending"}
                                scope="col"
                                style={{ textAlign: "right" }}
                            >
                                <Button
                                    aria-label={a.who.sortByCount}
                                    color="neutral"
                                    size="sm"
                                    sx={{ fontWeight: 600 }}
                                    variant="plain"
                                    onClick={() => setDescending((d) => !d)}
                                >
                                    {a.who.count} {descending ? "↓" : "↑"}
                                </Button>
                            </th>
                            <th scope="col">{a.who.projects}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row) => {
                            const extra = row.projects.length - SHOWN_PROJECTS;
                            return (
                                <tr key={`${row.user.id}-${row.agent}`}>
                                    <td>
                                        <Typography
                                            level="body-sm"
                                            sx={{ color: g.text.primary, fontWeight: 500 }}
                                        >
                                            {row.user.name}
                                        </Typography>
                                    </td>
                                    <td>
                                        <AgentChip
                                            agent={{ kind: row.agent }}
                                            label={a.agents[row.agent] ?? a.agents.other_app}
                                        />
                                    </td>
                                    <td
                                        style={{
                                            textAlign: "right",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {row.count}
                                    </td>
                                    <td>
                                        <Typography
                                            level="body-sm"
                                            sx={{ color: g.text.secondary }}
                                        >
                                            {row.projects
                                                .slice(0, SHOWN_PROJECTS)
                                                .map((p) => p.name)
                                                .join(", ")}
                                            {extra > 0 &&
                                                ` ${fmt(a.who.moreProjects, { count: extra })}`}
                                        </Typography>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            </Box>
        </Box>
    );
};
