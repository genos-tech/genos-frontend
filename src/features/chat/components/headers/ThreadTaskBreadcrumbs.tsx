import { ReactNode } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { useTranslation } from "../../../../i18n";
import { TaskProps } from "../../../../types/tasks";
import { buildTaskContextCrumbs, TaskNoteCrumbKind } from "../../../../utils/note";
import { NoteBreadcrumbs } from "../../../notes/common/components/NoteBreadcrumbs";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";

// Per-level glyphs — same mapping the task-note header uses.
const TASK_CRUMB_ICON: Record<TaskNoteCrumbKind, ReactNode> = {
    project: <AccountTreeRoundedIcon />,
    milestone: <FlagRoundedIcon />,
    task: <AssignmentRoundedIcon />,
};

type ThreadTaskBreadcrumbsProps = {
    /** Full task (or milestone backing task) behind the open thread. */
    task: TaskProps;
    /** Open the task/milestone preview — wired to the tail crumb. */
    onOpen: () => void;
};

/**
 * The thread header's task-info strip: the same `NoteBreadcrumbs`
 * component the task-note header renders, showing the thread task's
 * container ancestry (Project → Milestone → parent Task) with the task
 * itself as the clickable tail node, plus its status chip.
 *
 * Rendered in every thread flavor that carries a task — DM/GM/MDM
 * threads once a task was created from them, and PM threads (which are
 * task threads by construction).
 */
export const ThreadTaskBreadcrumbs = ({ task, onOpen }: ThreadTaskBreadcrumbsProps) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const isMilestone = task.isMilestone === true;

    const contextCrumbs = buildTaskContextCrumbs(task).map((c) => ({
        key: c.key,
        label: c.label,
        icon: TASK_CRUMB_ICON[c.kind],
    }));

    const status = task.status;

    return (
        <Box sx={{ alignItems: "center", display: "flex", gap: 1, minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
                <NoteBreadcrumbs
                    color="success"
                    contextCrumbs={contextCrumbs}
                    icon={isMilestone ? <FlagRoundedIcon /> : <AssignmentRoundedIcon />}
                    label={
                        formatTaskDisplayId(task) ||
                        (isMilestone
                            ? t.chat.headers.threadMilestoneBadge
                            : t.chat.headers.threadTaskBadge)
                    }
                    noteChain={
                        task.id != null
                            ? [{ noteId: Number(task.id), title: task.title || "…" }]
                            : []
                    }
                    onNodeClick={() => onOpen()}
                />
            </Box>
            {status?.status ? (
                <Box
                    sx={{
                        alignItems: "center",
                        borderRadius: "6px",
                        background: status.color
                            ? alpha(status.color, isDark ? 0.4 : 0.6)
                            : "transparent",
                        color: status.textColor,
                        display: { xs: "none", md: "flex" },
                        flexShrink: 0,
                        gap: 0.5,
                        px: 0.75,
                        py: 0.125,
                    }}
                >
                    <Box
                        sx={{
                            background: status.color || "currentColor",
                            borderRadius: "50%",
                            height: 6,
                            width: 6,
                        }}
                    />
                    <Typography
                        level="body-xs"
                        sx={{
                            color: "inherit",
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                        }}
                    >
                        {status.status}
                    </Typography>
                </Box>
            ) : null}
        </Box>
    );
};
