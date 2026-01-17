import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";

type UseTaskRoutingProps = {
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
};

type TaskRouteInfo = {
    projectId: number | undefined;
    taskId: number | undefined;
};

export const useTaskRouting = ({ usePM, useTM }: UseTaskRoutingProps) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Ref to track if we're currently navigating from URL (to avoid circular updates)
    const isNavigatingFromUrl = useRef(false);
    // Ref to track the last URL we navigated to
    const lastNavigatedPath = useRef("");

    // Parse the current URL to extract task routing info
    const parseCurrentRoute = useCallback((): TaskRouteInfo => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        // Expected format: /Home/tasks/project/:projectId/task/:taskId

        const result: TaskRouteInfo = {
            projectId: undefined,
            taskId: undefined,
        };

        const tasksIndex = pathParts.indexOf("tasks");
        if (tasksIndex === -1) return result;

        // Look for project
        const projectIndex = pathParts.indexOf("project");
        if (projectIndex !== -1 && pathParts[projectIndex + 1]) {
            result.projectId = Number(pathParts[projectIndex + 1]);
        }

        // Look for task
        const taskIndex = pathParts.indexOf("task");
        if (taskIndex !== -1 && pathParts[taskIndex + 1]) {
            result.taskId = Number(pathParts[taskIndex + 1]);
        }

        return result;
    }, [location.pathname]);

    // Navigate to tasks home
    const navigateToTasks = useCallback(() => {
        navigate("/Home/tasks");
    }, [navigate]);

    // Navigate to a specific project
    const navigateToProject = useCallback(
        (projectId: number) => {
            navigate(`/Home/tasks/project/${projectId}`);
        },
        [navigate]
    );

    // Navigate to a specific task
    const navigateToTask = useCallback(
        (projectId: number, taskId: number) => {
            navigate(`/Home/tasks/project/${projectId}/task/${taskId}`);
        },
        [navigate]
    );

    // Sync URL with task state on initial load or URL change
    useEffect(() => {
        const { projectId, taskId } = parseCurrentRoute();

        // If there's a projectId in the URL, set it
        if (projectId && usePM.teamProjects.length > 0) {
            const project = usePM.teamProjects.find((p) => p.projectId === projectId);
            if (project && usePM.currentProject?.projectId !== projectId) {
                isNavigatingFromUrl.current = true;
                usePM.setCurrentProject(project);

                setTimeout(() => {
                    isNavigatingFromUrl.current = false;
                }, 100);
            }
        }

        // If there's a taskId in the URL, open task preview using loadTask
        if (taskId && projectId) {
            if (useTM.currentPreviewTaskId !== taskId) {
                isNavigatingFromUrl.current = true;
                useTM.setCurrentPreviewTaskId(taskId);

                // Use loadTask which will properly fetch and set the task
                useTM.loadTask(projectId, taskId).finally(() => {
                    setTimeout(() => {
                        isNavigatingFromUrl.current = false;
                        useTM.setIsTaskPreviewVisible(true);
                    }, 100);
                });
            }
        }
    }, [location.pathname, usePM.teamProjects.length]);

    // Update URL when task preview opens/closes
    useEffect(() => {
        // Skip if we're currently navigating from URL
        if (isNavigatingFromUrl.current) {
            return;
        }

        if (
            useTM.isTaskPreviewVisible &&
            useTM.currentPreviewTask &&
            useTM.currentPreviewTask.project
        ) {
            const projectId = useTM.currentPreviewTask.project.projectId;
            const taskId = useTM.currentPreviewTask.id;

            const newPath = `/Home/tasks/project/${projectId}/task/${taskId}`;
            if (newPath !== location.pathname && newPath !== lastNavigatedPath.current) {
                lastNavigatedPath.current = newPath;
                navigate(newPath, { replace: true });
            }
        } else if (!useTM.isTaskPreviewVisible && usePM.currentProject) {
            // Task preview closed, go back to project view
            const { taskId } = parseCurrentRoute();
            if (taskId) {
                const newPath = `/Home/tasks/project/${usePM.currentProject.projectId}`;
                if (newPath !== lastNavigatedPath.current) {
                    lastNavigatedPath.current = newPath;
                    navigate(newPath, { replace: true });
                }
            }
        }
    }, [
        useTM.isTaskPreviewVisible,
        useTM.currentPreviewTask?.id,
        useTM.currentPreviewTask?.project?.projectId,
    ]);

    // Update URL when project changes
    useEffect(() => {
        // Skip if we're currently navigating from URL
        if (isNavigatingFromUrl.current) {
            return;
        }

        if (usePM.currentProject && !useTM.isTaskPreviewVisible) {
            const newPath = `/Home/tasks/project/${usePM.currentProject.projectId}`;
            const { projectId: urlProjectId } = parseCurrentRoute();

            if (
                urlProjectId !== usePM.currentProject.projectId &&
                newPath !== lastNavigatedPath.current
            ) {
                lastNavigatedPath.current = newPath;
                navigate(newPath, { replace: true });
            }
        }
    }, [usePM.currentProject?.projectId]);

    return {
        parseCurrentRoute,
        navigateToTasks,
        navigateToProject,
        navigateToTask,
    };
};
