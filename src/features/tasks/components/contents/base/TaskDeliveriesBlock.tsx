import CallMergeRoundedIcon from "@mui/icons-material/CallMergeRounded";
import { Box, Chip, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../../../i18n";
import { TaskDeliveryProps, TaskDeliveryState } from "../../../../../types/tasks";
import { prStateColor } from "../../../../integrations/utils/prState";

// GitHub's PR palette for the three states GitHub itself has; grey for
// the two only Genos has (no PR yet / state never read).
const stateColor = (state: TaskDeliveryState): string =>
    state === "open" || state === "merged" || state === "closed"
        ? prStateColor(state)
        : prStateColor("draft");

// Same rule as `get_my_focus_tasks(delivery="merged_pr")`: the work is
// in, the task isn't done. Deleted tasks are out of scope there too.
const INACTIVE_STATUSES = new Set(["Closed", "Deleted"]);

type Props = {
    deliveries: TaskDeliveryProps[];
    taskStatus: string | null | undefined;
    isDark: boolean;
};

/**
 * One line per branch / PR delivering the task (MIP-687 `TaskDelivery`,
 * kept current by the GitHub webhook): a state chip, the repo, the
 * branch, and the PR linked to GitHub. A merged PR on a task that isn't
 * Closed gets a warning line — that mismatch is what the table exists
 * to surface.
 *
 * Read-only: rows are written by the webhook and `add_task_delivery`,
 * never from this pane. Renders nothing when there are no rows.
 */
export const TaskDeliveriesBlock = ({ deliveries, taskStatus, isDark }: Props) => {
    const { t } = useTranslation();
    if (deliveries.length === 0) return null;

    const stateLabel: Record<TaskDeliveryState, string> = {
        branch: t.tasks.delivery.stateBranch,
        open: t.tasks.delivery.stateOpen,
        merged: t.tasks.delivery.stateMerged,
        closed: t.tasks.delivery.stateClosed,
        unknown: t.tasks.delivery.stateUnknown,
    };
    const mergedButOpen =
        !!taskStatus &&
        !INACTIVE_STATUSES.has(taskStatus) &&
        deliveries.some((d) => d.state === "merged");
    const muted = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";

    return (
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            {deliveries.map((d) => {
                const color = stateColor(d.state);
                return (
                    <Stack
                        key={d.delivery_id}
                        alignItems="center"
                        data-testid="task-delivery-row"
                        direction="row"
                        spacing={1}
                        sx={{ minWidth: 0, flexWrap: "wrap", rowGap: 0.5 }}
                    >
                        <Chip
                            size="sm"
                            variant="soft"
                            sx={{
                                flexShrink: 0,
                                borderRadius: "5px",
                                fontWeight: 600,
                                color,
                                backgroundColor: `${color}1f`,
                            }}
                        >
                            {stateLabel[d.state] ?? stateLabel.unknown}
                        </Chip>
                        <Typography level="body-sm" sx={{ color: muted, flexShrink: 0 }}>
                            {d.repo}
                        </Typography>
                        <Typography
                            level="body-sm"
                            sx={{
                                fontFamily: d.branch ? "monospace" : undefined,
                                fontStyle: d.branch ? undefined : "italic",
                                color: d.branch ? undefined : muted,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {d.branch ?? t.tasks.delivery.noBranch}
                        </Typography>
                        {d.pr_url && (
                            <AppTooltip title={d.pr_title ?? d.pr_url}>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    <a href={d.pr_url} rel="noopener noreferrer" target="_blank">
                                        {d.pr_number != null ? `#${d.pr_number}` : d.pr_url}
                                        {d.pr_title ? ` ${d.pr_title}` : ""}
                                    </a>
                                </Typography>
                            </AppTooltip>
                        )}
                    </Stack>
                );
            })}
            {mergedButOpen && (
                <Box
                    data-testid="task-delivery-merged-not-closed"
                    role="status"
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        alignSelf: "flex-start",
                        px: 0.75,
                        py: 0.25,
                        borderRadius: "6px",
                        color: isDark ? "#e3b341" : "#9a6700",
                        backgroundColor: isDark ? "rgba(187,128,9,0.15)" : "rgba(212,167,44,0.15)",
                    }}
                >
                    <CallMergeRoundedIcon sx={{ fontSize: 16 }} />
                    <Typography level="body-xs" sx={{ color: "inherit", fontWeight: 600 }}>
                        {fmt(t.tasks.delivery.mergedNotClosed, { status: taskStatus ?? "" })}
                    </Typography>
                </Box>
            )}
        </Stack>
    );
};
