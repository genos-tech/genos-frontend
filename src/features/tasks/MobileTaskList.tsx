import { useMemo } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Box, Stack, Typography } from "@mui/joy";

import { TaskCard } from "./components/card";
import { effectiveStatusOf, selectAncestorVerdicts } from "./utils/closedByAncestor";

import { DataState } from "../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../components/ui/feedback/Skeleton";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../i18n";
import { useSyncFailure } from "../../services/syncStatus";
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
    const sync = useSyncFailure("tasks");
    const projectsSync = useSyncFailure("projects");
    const projectId = usePM.currentProject?.projectId;

    // Project-scoped, top-level rows. Closed and Deleted are hidden —
    // an "active work" view by default; reopening or re-listing is a
    // desktop concern. A row whose milestone is Closed or Deleted is hidden
    // too, whatever its own status says (MIP-1389).
    const tasks = useMemo<TaskTableProps[]>(() => {
        if (!projectId) return [];
        const verdicts = selectAncestorVerdicts(useTM.allTasks);
        return useTM.allTasks.filter(
            (t) =>
                t.projectId === projectId &&
                t.parentTaskId == null &&
                effectiveStatusOf(t, verdicts) !== "Deleted" &&
                effectiveStatusOf(t, verdicts) !== "Closed"
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
        // The project list never loaded: "pick a project" would send them to an empty list (MIP-1298).
        if (projectsSync.failed) {
            return (
                <DataState
                    hasData={false}
                    loading={projectsSync.retrying}
                    skeleton={<SkeletonRows count={5} />}
                    errorState={{
                        "data-error": "mobile-no-project",
                        onRetry: projectsSync.retry,
                        title: t.common.feedback.sync.projectsFailed,
                    }}
                    error
                />
            );
        }
        return (
            <Box sx={{ p: 3, textAlign: "center" }}>
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                    {t.tasks.mobile.pickProject}
                </Typography>
            </Box>
        );
    }

    if (tasks.length === 0) {
        // A failed refresh is not "no open tasks" (MIP-1298).
        return (
            <DataState
                error={sync.failed}
                hasData={false}
                loading={sync.retrying}
                skeleton={<SkeletonRows count={5} />}
                empty={{
                    "data-empty": "mobile-tasks",
                    icon: <AssignmentRoundedIcon />,
                    title: t.tasks.mobile.noOpenTasks,
                }}
                errorState={{
                    "data-error": "mobile-tasks",
                    onRetry: sync.retry,
                    title: t.common.feedback.sync.tasksFailed,
                }}
            />
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
