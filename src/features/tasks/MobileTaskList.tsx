import { useMemo } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Box, Stack, Typography } from "@mui/joy";

import { TaskCard } from "./components/card";

import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../i18n";
import { TaskTableProps } from "../../types/tasks";

type MobileTaskListProps = {
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
};

// Vertical card list — mobile replacement for the desktop
// DraggableTaskTable (16 sortable/draggable columns). Each card is the shared
// TaskCard (MIP-1124), which shows the most-load-bearing fields only: title,
// status, priority, assignee, due date, milestone flag, tags. Tapping a card
// opens the task preview overlay.
export const MobileTaskList = ({ usePM, useTM }: MobileTaskListProps) => {
    const { t } = useTranslation();
    const projectId = usePM.currentProject?.projectId;

    // Project-scoped, top-level rows. Closed and Deleted are hidden —
    // an "active work" view by default; reopening or re-listing is a
    // desktop concern.
    const tasks = useMemo<TaskTableProps[]>(() => {
        if (!projectId) return [];
        return useTM.allTasks.filter(
            (t) =>
                t.projectId === projectId &&
                t.status !== "Deleted" &&
                t.status !== "Closed" &&
                t.parentTaskId == null
        );
    }, [useTM.allTasks, projectId]);

    const openTask = (taskId: string | null) => {
        if (!taskId) return;
        const idNum = Number(taskId);
        if (!Number.isFinite(idNum)) return;
        useTM.setCurrentPreviewTaskId(idNum);
        useTM.setIsTaskPreviewVisible(true);
    };

    if (!projectId) {
        return (
            <Box sx={{ p: 3, textAlign: "center" }}>
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                    {t.tasks.mobile.pickProject}
                </Typography>
            </Box>
        );
    }

    if (tasks.length === 0) {
        return (
            <Box sx={{ p: 3, textAlign: "center" }}>
                <AssignmentRoundedIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                    {t.tasks.mobile.noOpenTasks}
                </Typography>
            </Box>
        );
    }

    return (
        <Stack
            spacing={1}
            sx={{
                p: 1,
                overflowY: "auto",
                flex: 1,
                minHeight: 0,
            }}
        >
            {tasks.map((task) => (
                <TaskCard
                    key={task.id ?? task.title}
                    dueWhenEmpty={false}
                    task={task}
                    showStatus
                    onOpen={() => openTask(task.id)}
                />
            ))}
        </Stack>
    );
};
