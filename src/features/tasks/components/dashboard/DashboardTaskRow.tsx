import { Box } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { TaskTableProps } from "../../../../types/tasks";
import { computeTaskWeight, MAX_TASK_WEIGHT, weightBand } from "../../utils/taskWeight";
import { TaskListItem } from "../card";

// Structural, so both `EffectiveTask` (dashboard) and any future caller
// holding a plain task + a resolved status can pass one in without this
// module depending on `TaskHomeContent`.
export type DashboardRowTask = TaskTableProps & { effectiveStatus: string };

type DashboardTaskRowProps = {
    task: DashboardRowTask;
    /**
     * Resolved sprint name for `task.sprintId`; the caller owns the lookup.
     * Null / undefined renders `SprintChip`'s muted "No Sprint" state.
     */
    sprintName: string | null | undefined;
    onClick: () => void;
};

/**
 * One task row on the dashboard: the shared `TaskListItem` (MIP-1124) with the
 * Task Weight badge in front.
 *
 * Shared by "Up Next" (My Tasks / Member's Tasks) and "Top by Weight"
 * (Overall Insights), which had drifted apart as two copies; they are one
 * component so they cannot again.
 *
 * Layout: weight · status · id · title … priority · due · sprint · assignee.
 */
export const DashboardTaskRow = ({ task, sprintName, onClick }: DashboardTaskRowProps) => {
    const { t } = useTranslation();
    const weight = computeTaskWeight(task);
    const wb = weightBand(weight);
    return (
        <TaskListItem
            sprintName={sprintName ?? null}
            status={task.effectiveStatus}
            task={task}
            untitled={t.tasks.dashboard.untitledTask}
            leading={
                // Squared heat chip: its fill is DATA (the weight band), the only
                // colored thing in the row.
                <AppTooltip
                    title={`${fmt(t.tasks.table.weightTooltip, {
                        weight,
                        max: MAX_TASK_WEIGHT,
                    })} · ${t.tasks.table.weightBands[wb.band]}`}
                >
                    <Box
                        data-testid="weight-badge"
                        sx={{
                            ...type("title-sm"),
                            width: 24,
                            height: 24,
                            borderRadius: g.radius.sm,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            backgroundColor: wb.color,
                        }}
                    >
                        {weight}
                    </Box>
                </AppTooltip>
            }
            onOpen={onClick}
        />
    );
};
