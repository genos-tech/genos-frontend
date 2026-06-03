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
    // Milestone preview deep link: `/workspace/tasks/project/:projectId/milestone/:milestoneId`.
    // Mutually exclusive with `taskId` in practice — the URL only ever
    // carries one of the two — but we parse them independently so a
    // malformed URL with both segments still surfaces something usable
    // instead of silently picking one.
    milestoneId: number | undefined;
    // Optional deep-link target inside the task's "Comments" tab. When
    // present the task panel highlights / scrolls to this comment id.
    commentId: number | undefined;
};

export const useTaskRouting = ({ usePM, useTM }: UseTaskRoutingProps) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Ref to track if we're currently navigating from URL (to avoid circular updates)
    const isNavigatingFromUrl = useRef(false);
    // Ref to track the last URL we navigated to
    const lastNavigatedPath = useRef("");
    // Ref to track the intended project ID from the URL (survives race conditions with loadProjectsAndTasks)
    const targetUrlProjectId = useRef<number | undefined>(undefined);

    // Parse the current URL to extract task routing info
    const parseCurrentRoute = useCallback((): TaskRouteInfo => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        // Expected formats:
        //   /workspace/tasks/project/:projectId
        //   /workspace/tasks/project/:projectId/task/:taskId(/comment/:commentId)?
        //   /workspace/tasks/project/:projectId/milestone/:milestoneId

        const result: TaskRouteInfo = {
            projectId: undefined,
            taskId: undefined,
            milestoneId: undefined,
            commentId: undefined,
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

        // Look for milestone
        const milestoneIndex = pathParts.indexOf("milestone");
        if (milestoneIndex !== -1 && pathParts[milestoneIndex + 1]) {
            const parsed = Number(pathParts[milestoneIndex + 1]);
            if (!isNaN(parsed)) result.milestoneId = parsed;
        }

        // Optional task-comment deep link (PM "Comments" tab)
        const commentIndex = pathParts.indexOf("comment");
        if (commentIndex !== -1 && pathParts[commentIndex + 1]) {
            const parsed = Number(pathParts[commentIndex + 1]);
            if (!isNaN(parsed)) result.commentId = parsed;
        }

        return result;
    }, [location.pathname]);

    // Navigate to tasks home
    const navigateToTasks = useCallback(() => {
        navigate("/workspace/tasks");
    }, [navigate]);

    // Navigate to a specific project
    const navigateToProject = useCallback(
        (projectId: number) => {
            navigate(`/workspace/tasks/project/${projectId}`);
        },
        [navigate]
    );

    // Navigate to a specific task
    const navigateToTask = useCallback(
        (projectId: number, taskId: number) => {
            navigate(`/workspace/tasks/project/${projectId}/task/${taskId}`);
        },
        [navigate]
    );

    // Navigate to a specific milestone
    const navigateToMilestone = useCallback(
        (projectId: number, milestoneId: number) => {
            navigate(`/workspace/tasks/project/${projectId}/milestone/${milestoneId}`);
        },
        [navigate]
    );

    // Sync URL with task state on initial load or URL change
    useEffect(() => {
        const { projectId, taskId, milestoneId } = parseCurrentRoute();

        // Keep the state→URL effects' dedup ref in sync with the actual
        // URL. After a browser Back/Forward this effect drives state from
        // the new URL but never updated `lastNavigatedPath`; without this
        // line, re-selecting a previously-visited item would compare equal
        // to the stale `lastNavigatedPath` and silently skip the navigate,
        // leaving the URL out of sync with the visible task.
        lastNavigatedPath.current = location.pathname;

        if (projectId) {
            targetUrlProjectId.current = projectId;
        }

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

        // If there's a milestoneId in the URL, open the milestone preview.
        // Unlike the task branch we don't have to pre-load anything here —
        // the milestone preview hydrates itself from `useSM` once
        // `currentPreviewKind` flips to "milestone" (see TaskPreview's
        // milestone branch). `setCurrentPreviewMilestoneId` flips the
        // kind for us and clears any lingering task selection so the
        // pane can't get stuck on a stale task.
        if (milestoneId && projectId) {
            const needsKindFlip = useTM.currentPreviewKind !== "milestone";
            const needsIdSet = useTM.currentPreviewMilestoneId !== milestoneId;
            if (needsKindFlip || needsIdSet) {
                isNavigatingFromUrl.current = true;
                useTM.setCurrentPreviewMilestoneId(milestoneId);
                setTimeout(() => {
                    isNavigatingFromUrl.current = false;
                    useTM.setIsTaskPreviewVisible(true);
                }, 100);
            } else if (!useTM.isTaskPreviewVisible) {
                useTM.setIsTaskPreviewVisible(true);
            }
        }
    }, [location.pathname, usePM.teamProjects.length]);

    // Update URL when task preview opens/closes
    useEffect(() => {
        // Skip if we're currently navigating from URL
        if (isNavigatingFromUrl.current) {
            return;
        }

        // Milestone preview takes precedence — when the user opens a
        // milestone row, `currentPreviewKind` flips to "milestone" and
        // `currentPreviewTask` is intentionally cleared, so the task
        // branch below would otherwise no-op and leave the URL stuck on
        // the bare project path. Mirror the task branch but write the
        // milestone segment instead.
        if (
            useTM.isTaskPreviewVisible &&
            useTM.currentPreviewKind === "milestone" &&
            useTM.currentPreviewMilestoneId !== -1 &&
            usePM.currentProject
        ) {
            const projectId = usePM.currentProject.projectId;
            const milestoneId = useTM.currentPreviewMilestoneId;
            const newPath = `/workspace/tasks/project/${projectId}/milestone/${milestoneId}`;
            if (newPath !== location.pathname && newPath !== lastNavigatedPath.current) {
                targetUrlProjectId.current = projectId;
                lastNavigatedPath.current = newPath;
                // Push (not replace) so each opened milestone is its own
                // history entry — browser Back/Forward steps between items.
                navigate(newPath);
            }
            return;
        }

        if (
            useTM.isTaskPreviewVisible &&
            useTM.currentPreviewTask &&
            useTM.currentPreviewTask.project
        ) {
            const projectId = useTM.currentPreviewTask.project.projectId;
            const taskId = useTM.currentPreviewTask.id;

            // Preserve a `comment/:commentId` deep-link segment if it
            // happens to belong to this same task. Without this, any
            // re-render that retriggers this effect (e.g. preview
            // toggling visible after comment click) would replace the
            // path with the bare task URL and the focus would be lost.
            const { commentId, taskId: urlTaskId } = parseCurrentRoute();
            const preserveComment = commentId !== undefined && urlTaskId === taskId;
            const newPath = preserveComment
                ? `/workspace/tasks/project/${projectId}/task/${taskId}/comment/${commentId}`
                : `/workspace/tasks/project/${projectId}/task/${taskId}`;
            if (newPath !== location.pathname && newPath !== lastNavigatedPath.current) {
                targetUrlProjectId.current = projectId;
                lastNavigatedPath.current = newPath;
                // Push (not replace) so each opened task is its own history
                // entry — browser Back/Forward steps between tasks.
                navigate(newPath);
            }
        } else if (!useTM.isTaskPreviewVisible && usePM.currentProject) {
            // Preview closed, scrub any task / milestone segment from
            // the URL so the back-stack doesn't reopen the same entity
            // the next time the user lands on this route.
            const { taskId, milestoneId } = parseCurrentRoute();
            if (taskId || milestoneId) {
                targetUrlProjectId.current = usePM.currentProject.projectId;
                const newPath = `/workspace/tasks/project/${usePM.currentProject.projectId}`;
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
        useTM.currentPreviewKind,
        useTM.currentPreviewMilestoneId,
    ]);

    // Update URL when project changes
    useEffect(() => {
        // Skip if we're currently navigating from URL
        if (isNavigatingFromUrl.current) {
            return;
        }

        if (usePM.currentProject && !useTM.isTaskPreviewVisible) {
            const newPath = `/workspace/tasks/project/${usePM.currentProject.projectId}`;
            const { projectId: urlProjId } = parseCurrentRoute();

            if (
                urlProjId !== usePM.currentProject.projectId &&
                newPath !== lastNavigatedPath.current
            ) {
                targetUrlProjectId.current = usePM.currentProject.projectId;
                lastNavigatedPath.current = newPath;
                navigate(newPath, { replace: true });
            }
        }
    }, [usePM.currentProject?.projectId]);

    // Enforce project match: if currentProject drifts from the URL target
    // (e.g. loadProjectsAndTasks overrides it with localStorage's lastProjectId),
    // correct it back to the URL's project.
    useEffect(() => {
        const targetId = targetUrlProjectId.current;
        if (
            targetId !== undefined &&
            usePM.teamProjects.length > 0 &&
            usePM.currentProject?.projectId !== targetId
        ) {
            const project = usePM.teamProjects.find((p) => p.projectId === targetId);
            if (project) {
                isNavigatingFromUrl.current = true;
                usePM.setCurrentProject(project);
                setTimeout(() => {
                    isNavigatingFromUrl.current = false;
                }, 100);
            }
        }
    }, [usePM.currentProject?.projectId, usePM.teamProjects]);

    return {
        parseCurrentRoute,
        navigateToTasks,
        navigateToProject,
        navigateToTask,
        navigateToMilestone,
    };
};
