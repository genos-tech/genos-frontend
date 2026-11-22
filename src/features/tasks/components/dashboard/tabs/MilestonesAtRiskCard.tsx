import { useMemo } from "react";
import { Box, Button, Stack, Typography } from "@mui/joy";

import {
    DashboardCard,
    ProportionBar,
    useNumberFormat,
} from "../../../../../components/ui/dashboard";
import { fmt, useTranslation } from "../../../../../i18n";
import { g, type } from "../../../../../theme/tokens";
import { STATUS_TONE, StatusName } from "../../../meta/taskTone";
import type { Milestone } from "../../../sprint-milestone/types";
import type { EffectiveTask } from "../../../utils/effectiveTasks";
import {
    compareMilestoneRisk,
    isMilestoneAtRisk,
    summarizeMilestoneProgress,
} from "../../../utils/milestoneProgressSummary";
import { statusText } from "../taskHomeHelpers";

const SHOWN = 3;

type Props = {
    /** The selected sprint's milestones (or the backlog's), as the old "Milestones in sprint" list. */
    milestones: Milestone[];
    effectiveTasks: EffectiveTask[];
    onOpenMilestone: (milestoneId: number) => void;
    onShowAll: () => void;
};

/**
 * The Project tab's milestone card (MIP-1963): the three most at-risk milestones of the sprint,
 * each opening its preview, and a link to the Milestones tab, which lists every one. It replaces
 * the Sprint tab's "Milestones in sprint" list, now one place with the Milestones tab.
 */
export const MilestonesAtRiskCard = ({
    milestones,
    effectiveTasks,
    onOpenMilestone,
    onShowAll,
}: Props) => {
    const { t } = useTranslation();
    const nf = useNumberFormat();
    const d = t.tasks.dashboard;
    const risky = useMemo(() => {
        const now = new Date();
        return milestones
            .filter((m) => !m.isDeleted && m.status !== "Closed" && m.status !== "Deleted")
            .map((milestone) => ({
                milestone,
                summary: summarizeMilestoneProgress(milestone, effectiveTasks, now),
            }))
            .filter((x) => isMilestoneAtRisk(x.summary))
            .sort((a, b) => compareMilestoneRisk(a.summary, b.summary));
    }, [milestones, effectiveTasks]);
    const shown = risky.slice(0, SHOWN);
    const statusLabels = d.statusLabels;
    const showAll = (
        <Button size="sm" variant="plain" onClick={onShowAll}>
            {d.project.allMilestones}
        </Button>
    );

    return (
        <DashboardCard
            actions={showAll}
            count={nf.number(risky.length)}
            data-testid="milestones-at-risk"
            emptyTitle={d.project.noMilestonesAtRisk}
            state={shown.length === 0 ? "empty" : "ready"}
            title={d.project.milestonesAtRiskTitle}
        >
            <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", m: 0, p: 0 }}>
                {shown.map(({ milestone, summary }) => (
                    <Box key={milestone.milestoneId} component="li" sx={{ minWidth: 0 }}>
                        <Stack
                            alignItems="baseline"
                            direction="row"
                            justifyContent="space-between"
                            spacing={1}
                        >
                            <Button
                                size="sm"
                                variant="plain"
                                aria-label={fmt(d.project.openMilestoneFor, {
                                    title: milestone.title,
                                })}
                                sx={{
                                    minWidth: 0,
                                    px: 0,
                                    justifyContent: "flex-start",
                                    color: g.text.primary,
                                    fontWeight: 600,
                                    "&:hover": { background: "transparent" },
                                }}
                                onClick={() => onOpenMilestone(milestone.milestoneId)}
                            >
                                <Box
                                    component="span"
                                    sx={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {milestone.title}
                                </Box>
                            </Button>
                            <Typography
                                sx={{
                                    ...type("body-xs"),
                                    color: g.text.secondary,
                                    fontVariantNumeric: "tabular-nums",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {fmt(d.milestoneProgress.closedOfTotal, {
                                    closed: nf.number(summary.closed),
                                    total: nf.number(summary.total),
                                })}
                            </Typography>
                        </Stack>
                        {summary.total > 0 && (
                            <ProportionBar
                                legend={false}
                                ariaLabel={fmt(d.milestoneProgress.closedOfTotal, {
                                    closed: nf.number(summary.closed),
                                    total: nf.number(summary.total),
                                })}
                                segments={summary.entries.map((e) => ({
                                    key: e.status,
                                    label: statusText(
                                        e.status,
                                        statusLabels,
                                        d.milestoneProgress.otherStatus
                                    ),
                                    value: e.count,
                                    display: nf.number(e.count),
                                    tone:
                                        e.status === "Other"
                                            ? "muted"
                                            : (STATUS_TONE[e.status as StatusName] ?? "muted"),
                                }))}
                            />
                        )}
                    </Box>
                ))}
            </Stack>
        </DashboardCard>
    );
};
