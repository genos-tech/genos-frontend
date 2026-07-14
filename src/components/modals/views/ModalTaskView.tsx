import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { TaskPreview } from "../../../features/tasks/components/contents/TaskPreview";
import { loadSpecificTask } from "../../../features/tasks/services/loadSpecificTask";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { TaskTarget } from "../../../utils/parseInternalUrl";
import { useModalLocalTaskComments } from "./useModalLocalTaskComments";

type ModalTaskViewProps = {
    target: TaskTarget;
    onClose: () => void;
    /** Stacking level of the hosting UrlLinkModal. Forwarded to
     *  TaskPreview so modal-hosted header actions render and the task
     *  diagram lifts above this dialog (see diagramZIndex.ts). */
    hostZIndex?: number;
    accessToken: string | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
    useSM?: SprintMilestoneManagementState;
};

// Renders TaskPreview against a modal-local TaskProps slot so the host
// page's `useTM.currentPreviewTask` / `currentPreviewTaskId` stay put.
//
// `setCurrentPreviewTask` is overridden to update the local slot only —
// edits inside the modal still hit the backend through
// `useSendUpdatedTask` (which calls the API directly), but the global
// preview state is left alone. `setIsTaskPreviewVisible` is overridden
// to close the modal when TaskPreview's own close path fires.
//
// Known limitation: same as the chat view — the modal is a snapshot at
// load time. WebSocket updates to the task that arrive while the modal
// is open won't refresh the modal's view; close + reopen to refetch.
export const ModalTaskView = (props: ModalTaskViewProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const {
        target,
        onClose,
        hostZIndex,
        accessToken,
        myself,
        setMyself,
        socket,
        useTEM,
        useUISM,
        useCM,
        useTM,
        usePM,
        useNM,
        useSM,
    } = props;

    const { t } = useTranslation();
    const [modalTask, setModalTask] = useState<TaskProps | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Modal-local comment slots — see the hook's doc comment. Declared
    // unconditionally (before the early returns) per rules-of-hooks.
    const localTaskComments = useModalLocalTaskComments();

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setErrorMessage(null);
        setModalTask(null);

        (async () => {
            try {
                const result = await loadSpecificTask(
                    myself,
                    target.projectId,
                    target.taskId,
                    accessToken
                );
                if (cancelled) return;
                const loaded = Array.isArray(result) ? result[0] : undefined;
                if (!loaded) {
                    setErrorMessage(t.common.modalView.taskUnavailable);
                    setIsLoading(false);
                    return;
                }
                setModalTask(loaded as TaskProps);
                setIsLoading(false);
            } catch (e) {
                if (!cancelled) {
                    console.error("ModalTaskView load failed:", e);
                    setErrorMessage(t.common.modalView.taskLoadFailed);
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [target.projectId, target.taskId, accessToken, myself]);

    if (errorMessage) {
        return (
            <Box
                sx={{
                    alignItems: "center",
                    display: "flex",
                    height: "100%",
                    justifyContent: "center",
                    p: 4,
                    width: "100%",
                }}
            >
                <Typography level="body-md" sx={{ color: "neutral.500" }}>
                    {errorMessage}
                </Typography>
            </Box>
        );
    }

    if (isLoading || !modalTask) {
        return (
            <Box
                sx={{
                    alignItems: "center",
                    display: "flex",
                    height: "100%",
                    justifyContent: "center",
                    p: 4,
                    width: "100%",
                }}
            >
                <Typography level="body-md" sx={{ color: "neutral.500" }}>
                    {t.common.modalView.loadingTask}
                </Typography>
            </Box>
        );
    }

    // Override the preview-task slot + the two setters that would
    // otherwise leak into the host page's global state, plus the
    // comment slots: the modal's TaskPreview loads ITS task's comments
    // through `setTaskComments`, and the global slot is shared with the
    // host page's preview — passing it through overwrote the host
    // task's Comments tab with this modal's comments. Everything else
    // (allTasks, isTaskCommentUpdated…) passes through, so adding a
    // comment in the modal still updates the underlying task on the
    // main page.
    const useTMOverride: TaskManagementState = {
        ...useTM,
        ...localTaskComments,
        currentPreviewTask: modalTask,
        currentPreviewTaskId: target.taskId,
        // Pin the preview router to task mode. TaskPreview renders
        // MilestonePreviewInner whenever `currentPreviewKind` is
        // "milestone" with a real milestone id — and without this
        // override those come from the HOST page's global state. A task
        // link opened while a milestone preview is active behind the
        // modal (e.g. the task diagram launched from a milestone) would
        // hijack this modal into that unrelated milestone instead of
        // the clicked task. A target that IS a milestone-backing task
        // still reroutes to its own milestone via the
        // `currentPreviewTask.isMilestone` branch, which reads the
        // modal-local task above — that behavior is correct and kept.
        currentPreviewKind: "task",
        currentPreviewMilestoneId: -1,
        setCurrentPreviewTask: (next) => {
            const resolved = typeof next === "function" ? next(modalTask ?? undefined) : next;
            if (resolved) setModalTask(resolved);
        },
        setIsTaskPreviewVisible: (visible: boolean) => {
            if (!visible) onClose();
        },
    };

    return (
        <Box
            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
            sx={{ height: "100%", overflow: "auto", width: "100%" }}
        >
            <TaskPreview
                hostZIndex={hostZIndex}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useNM={useNM}
                usePM={usePM}
                useSM={useSM}
                useTEM={useTEM}
                useTM={useTMOverride}
                useUISM={useUISM}
            />
        </Box>
    );
};
