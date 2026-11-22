import { ReactNode, useId } from "react";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Box, Typography } from "@mui/joy";

import { DashboardCard, useNumberFormat } from "../../../../components/ui/dashboard";
import { formatRelativeTime } from "../../../../components/ui/dashboard/relativeTime";
import { useTranslation } from "../../../../i18n";
import { focusRing, g, type } from "../../../../theme/tokens";
import { TaskListItem, TaskListPanel } from "../card";
import type { TaskHomeData } from "./useTaskHomeData";

const RECENT_ROWS = 5;

/**
 * "More analytics" at the bottom of the Project tab (MIP-1963): collapsed by default, the open
 * state remembered per user. Its body renders only while open, so the extra reads (team load)
 * wait until someone asks. Holds the status / priority / effort bars, team capacity and workload,
 * tag insights, and the five most recently updated tasks of the selected sprint.
 */
export const MoreAnalytics = ({
    open,
    onToggle,
    recentTasks,
    onOpenTask,
    children,
}: {
    onOpenTask: (taskId: number) => void;
    open: boolean;
    onToggle: (open: boolean) => void;
    recentTasks: TaskHomeData["recentTasks"];
    children: ReactNode;
}) => {
    const { t, locale } = useTranslation();
    const nf = useNumberFormat();
    const regionId = useId();
    return (
        <Box sx={{ minWidth: 0 }}>
            <Box
                aria-controls={regionId}
                aria-expanded={open}
                component="button"
                type="button"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    width: "100%",
                    minHeight: g.control.md,
                    background: "none",
                    border: 0,
                    borderTop: `1px solid ${g.border.subtle}`,
                    color: g.text.primary,
                    cursor: "pointer",
                    font: "inherit",
                    p: 0,
                    textAlign: "start",
                    "&:focus-visible": focusRing,
                }}
                onClick={() => onToggle(!open)}
            >
                <ExpandMoreRoundedIcon
                    sx={{
                        fontSize: 20,
                        color: g.text.secondary,
                        transform: open ? "none" : "rotate(-90deg)",
                        "[dir=rtl] &": { transform: open ? "none" : "rotate(90deg)" },
                        "@media (prefers-reduced-motion: no-preference)": {
                            transition: "transform 120ms",
                        },
                    }}
                />
                <Typography component="span" sx={{ ...type("title-md"), color: g.text.primary }}>
                    {t.tasks.dashboard.project.moreAnalytics}
                </Typography>
            </Box>
            <Box
                aria-label={t.tasks.dashboard.project.moreAnalytics}
                hidden={!open}
                id={regionId}
                role="region"
                sx={{ display: open ? "flex" : "none", flexDirection: "column", gap: 3, pt: 1.5 }}
            >
                {open && (
                    <>
                        {children}
                        {recentTasks.length > 0 && (
                            <DashboardCard
                                count={nf.number(recentTasks.length)}
                                title={t.tasks.dashboard.recentlyUpdated}
                                variant="flush"
                            >
                                <TaskListPanel>
                                    {recentTasks.slice(0, RECENT_ROWS).map((task) => (
                                        <TaskListItem
                                            key={task.id}
                                            status={task.effectiveStatus}
                                            task={task}
                                            untitled={t.tasks.dashboard.untitledTask}
                                            leading={
                                                <Typography
                                                    component="span"
                                                    sx={{
                                                        ...type("body-xs"),
                                                        color: g.text.secondary,
                                                        minWidth: 72,
                                                    }}
                                                >
                                                    {formatRelativeTime(
                                                        task.updatedAt
                                                            ? new Date(task.updatedAt).getTime()
                                                            : null,
                                                        locale
                                                    )}
                                                </Typography>
                                            }
                                            onOpen={() => onOpenTask(Number(task.id))}
                                        />
                                    ))}
                                </TaskListPanel>
                            </DashboardCard>
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
};
