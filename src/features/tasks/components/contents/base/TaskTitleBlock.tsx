import { useRef, useState } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {
    Box,
    Button,
    Chip,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    IconButton,
    Input,
    Modal,
    ModalDialog,
    Snackbar,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { useLocation } from "react-router-dom";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { MoreMenu, MoreMenuItem } from "../../../../../components/ui/MoreMenu";
import { TaskHeaderStyles } from "../../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { TaskNoteProps } from "../../../../../types/notes";
import { TaskProps } from "../../../../../types/tasks";
import { ModalTaskDiagram } from "../../../diagram/components/ModalTaskDiagram";
import { deleteEmptyTask } from "../../../services/deleteEmptyTask";
import { CopyableTaskIdChip } from "../../CopyableTaskId";
import { ModalDeleteTask } from "../../modals/ModalDeleteTask";

type TaskTitleBlockProps = {
    myself: UserProps;
    taskContent: TaskProps;
    taskTitle: string;
    setTaskTitle: (value: string) => void;
    setTaskClosed?: (value: boolean) => void;
    titleError?: string;
    titleErrorOpen?: boolean;
    setTitleErrorOpen?: (value: boolean) => void;
    setTaskUpdated?: (value: boolean) => void;
    isPreviewMode: boolean;
    setTaskContent?: (value: TaskProps) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useTM: TaskManagementState;
    useNM: NoteManagementState;
    usePM: ProjectManagementState;
    /** Optional. Forwarded to the diagram modal so the canvas can
     *  show sprint info on milestone nodes + the header overview. */
    useSM?: SprintMilestoneManagementState;
    // When true, the create-mode badge reads "Milestone" instead of
    // "New Task". Only meaningful when `isPreviewMode` is false.
    isMilestone?: boolean;
    isSubTask?: boolean;
    // True when the user has entered title / body / attachment content.
    // The X (close) button asks for confirmation only when this is true
    // AND we're in create mode — preview mode and untouched-create both
    // close immediately.
    isDirty?: boolean;
};

export const TaskTitleBlock = (props: TaskTitleBlockProps) => {
    const {
        myself,
        taskContent,
        taskTitle,
        setTaskTitle,
        setTaskUpdated,
        titleError,
        titleErrorOpen,
        setTitleErrorOpen,
        isPreviewMode,
        setTaskContent,
        setTaskStatusUpdated,
        setTaskClosed,
        useCM,
        useUISM,
        useTM,
        useNM,
        usePM,
        useSM,
        isMilestone,
        isSubTask,
        isDirty = false,
    } = props;

    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? TaskHeaderStyles.dark : TaskHeaderStyles.light;
    const { t } = useTranslation();
    const location = useLocation();
    // True when the user is currently inside the Tasks service (any URL
    // under `/workspace/tasks`). Mirrors the active-route detection used by the
    // sidebar so we don't depend on `openingService` for a check the URL
    // already encodes.
    const isOnTasksRoute = location.pathname.includes("/workspace/tasks");
    const [openDeleteTask, setOpenDeleteTask] = useState<boolean>(false);
    const [showCloseDiscardConfirm, setShowCloseDiscardConfirm] = useState(false);
    // Opens the React Flow task-graph modal anchored on this task.
    const [openTaskDiagram, setOpenTaskDiagram] = useState(false);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    // Teardown actually invoked by the X (close) button. Extracted from
    // the inline onClick so the discard-confirm modal can call it after
    // the user picks "Discard draft".
    const performClose = () => {
        if (isPreviewMode === false && useTM.setIsCreatingTask) {
            useTM.setIsCreatingTask({
                flag: false,
                parentTaskId: null,
                rootTaskId: useTM.currentPreviewTask?.rootTaskId || null,
                creationKind: "task",
                milestoneId: null,
            });
        }
        if (isPreviewMode === true && setTaskClosed) {
            setTaskClosed(true);
        }

        useCM.setIsMainChatVisible(true);

        if (useTM.setIsTaskPreviewVisible) {
            if (isPreviewMode === true) {
                useTM.setIsTaskPreviewVisible(false);
                useTM.setCurrentPreviewTaskId(-1);
            }
            if (useTM.isCreatingTask.flag === false && useNM.isTaskNoteVisible === false) {
                if (useTM.isTaskTableVisible === false) {
                    if (useTM.isSprintBoardVisible === false) {
                        useTM.setIsTaskTableVisible(true);
                    } else {
                        useTM.setIsSprintBoardVisible(true);
                    }
                }
            }
        }

        useTM.setIsCreatingTask({
            flag: false,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "task",
            milestoneId: null,
        });

        if (useTM.isTaskPreviewVisible === false) {
            if (useTM.isTaskTableVisible === false) {
                if (useTM.isSprintBoardVisible === false) {
                    if (useTM.isTaskDashboardVisible === false) {
                        useTM.setIsTaskTableVisible(true);
                    } else {
                        useTM.setIsTaskDashboardVisible(true);
                    }
                } else {
                    useTM.setIsSprintBoardVisible(true);
                }
            }
        }

        if (useNM.setIsTaskVisibleInNote) {
            useNM.setIsTaskVisibleInNote(false);
        }

        if (useTM.isCreatingTask.flag === true && taskContent.id !== undefined) {
            // Create-mode close = discard the in-progress task. Clear the
            // persisted draft alongside the backend empty-task so the next
            // form open starts clean.
            useTM.setTaskDraft(null);
            deleteEmptyTask({
                myself: myself,
                taskId: taskContent.id,
                accessToken: accessToken,
                setInitialEmptyTaskId: useTM.setInitialEmptyTaskId,
            });
        }
    };

    // "Hide" is the close-but-keep-draft variant offered alongside
    // "Discard" in the confirm modal. Same visibility teardown as
    // `performClose`, but deliberately skips both `setTaskDraft(null)`
    // AND `deleteEmptyTask` — the user gets their form state back on
    // re-open via the localStorage draft. Note: the backend empty-task
    // for this session is now orphaned; a fresh one is created on the
    // next mount and the draft hydrates onto it. demo-user-cleanup
    // sweeps the orphan in due course.
    const performHide = () => {
        if (isPreviewMode === false && useTM.setIsCreatingTask) {
            useTM.setIsCreatingTask({
                flag: false,
                parentTaskId: null,
                rootTaskId: useTM.currentPreviewTask?.rootTaskId || null,
                creationKind: "task",
                milestoneId: null,
            });
        }

        useCM.setIsMainChatVisible(true);

        // Surface a default main panel if everything else is hidden, mirroring
        // the same fallback logic in `performClose`. We skip the
        // `setIsTaskPreviewVisible` branch performClose has — Hide never
        // closes a preview pane (there isn't one in create mode).
        if (useTM.isTaskPreviewVisible === false) {
            if (useTM.isTaskTableVisible === false) {
                if (useTM.isSprintBoardVisible === false) {
                    if (useTM.isTaskDashboardVisible === false) {
                        useTM.setIsTaskTableVisible(true);
                    } else {
                        useTM.setIsTaskDashboardVisible(true);
                    }
                } else {
                    useTM.setIsSprintBoardVisible(true);
                }
            }
        }

        if (useNM.setIsTaskVisibleInNote) {
            useNM.setIsTaskVisibleInNote(false);
        }
    };

    // Dirty drafts confirm via modal; untouched create-mode and any
    // preview-mode close fire `performClose` directly.
    const handleCloseClick = () => {
        if (isPreviewMode === false && isDirty) {
            setShowCloseDiscardConfirm(true);
        } else {
            performClose();
        }
    };

    const handleStatusChange = (newStatus: string, color: string) => {
        if (setTaskContent) {
            setTaskContent({
                ...taskContent,
                status: {
                    code: 0,
                    status: newStatus,
                    color: color,
                    textColor: "white",
                },
            });
        }
        if (setTaskUpdated) {
            setTaskUpdated(true);
        }
        if (setTaskStatusUpdated) {
            setTaskStatusUpdated(true);
        }
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
            }}
        >
            {/* Top row: Chips and Actions */}
            <Stack
                direction="row"
                sx={{
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                {/* Left side: ID and Status chips (preview mode) or New Task badge (create mode) */}
                {isPreviewMode ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {/* Status Transition Buttons */}
                        {isPreviewMode &&
                            (taskContent.status.status === "Open" ||
                                taskContent.status.status === "Pending") && (
                                <Button
                                    size="sm"
                                    startDecorator={<PlayArrowRoundedIcon sx={{ fontSize: 16 }} />}
                                    variant="soft"
                                    sx={{
                                        fontWeight: 600,
                                        fontSize: "12px",
                                        borderRadius: "8px",
                                        px: 1.5,
                                        py: 0.5,
                                        background:
                                            "linear-gradient(135deg, #ff9500 0%, #ff6b00 100%)",
                                        color: "white",
                                        boxShadow: "0 2px 8px rgba(255, 140, 0, 0.25)",
                                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                        "&:hover": {
                                            background:
                                                "linear-gradient(135deg, #ffa726 0%, #ff7043 100%)",
                                            boxShadow: "0 4px 12px rgba(255, 140, 0, 0.35)",
                                            transform: "translateY(-1px)",
                                        },
                                        "&:active": {
                                            transform: "translateY(0)",
                                            boxShadow: "0 2px 6px rgba(255, 140, 0, 0.2)",
                                        },
                                    }}
                                    onClick={() => handleStatusChange("WIP", "#ff8c00")}
                                >
                                    Start Task
                                </Button>
                            )}

                        {isPreviewMode && taskContent.status.status === "WIP" && (
                            <Button
                                size="sm"
                                startDecorator={<TaskAltRoundedIcon sx={{ fontSize: 16 }} />}
                                variant="soft"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                    background:
                                        "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)",
                                    color: "white",
                                    boxShadow: "0 2px 8px rgba(76, 175, 80, 0.25)",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        background:
                                            "linear-gradient(135deg, #66bb6a 0%, #388e3c 100%)",
                                        boxShadow: "0 4px 12px rgba(76, 175, 80, 0.35)",
                                        transform: "translateY(-1px)",
                                    },
                                    "&:active": {
                                        transform: "translateY(0)",
                                        boxShadow: "0 2px 6px rgba(76, 175, 80, 0.2)",
                                    },
                                }}
                                onClick={() => handleStatusChange("Closed", "#1dc200")}
                            >
                                Complete Task
                            </Button>
                        )}
                        <CopyableTaskIdChip
                            key={`task-title-block-${taskContent.id}`}
                            fallback="N/A"
                            size="md"
                            task={taskContent}
                            variant="soft"
                            sx={{
                                borderRadius: "8px",
                                fontWeight: 700,
                                fontSize: "0.75rem",
                                px: 1.5,
                                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.06)",
                                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)",
                            }}
                        />
                        <Chip
                            key={`task-title-block-status-${taskContent.status.status}`}
                            size="md"
                            variant="soft"
                            sx={{
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                px: 1.5,
                                backgroundColor: taskContent.status.color
                                    ? alpha(taskContent.status.color, isDark ? 0.25 : 0.65)
                                    : "transparent",
                                color: taskContent.status.textColor || "#ffffff",
                                border: "1px solid",
                                borderColor: alpha(
                                    taskContent.status.color || "#666",
                                    isDark ? 0.3 : 0.25
                                ),
                            }}
                        >
                            {taskContent.status.status || "Open"}
                        </Chip>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 1,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: "8px",
                            background: isDark
                                ? "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(139,92,246,0.1) 100%)"
                                : "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(124,58,237,0.06) 100%)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(139,92,246,0.2)" : "rgba(124,58,237,0.15)",
                        }}
                    >
                        <Box
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: isDark
                                    ? isMilestone
                                        ? "linear-gradient(135deg, #ff8c00 0%, #ff6b00 100%)"
                                        : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
                                    : isMilestone
                                      ? "linear-gradient(135deg, #ff8c00 0%, #ff6b00 100%)"
                                      : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                animation: "pulse 2s infinite",
                                "@keyframes pulse": {
                                    "0%, 100%": { opacity: 1 },
                                    "50%": { opacity: 0.5 },
                                },
                            }}
                        />
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 700,
                                fontSize: "0.7rem",
                                color: isDark
                                    ? isMilestone
                                        ? "#ff8c00"
                                        : "#a78bfa"
                                    : isMilestone
                                      ? "#ff6b00"
                                      : "#7c3aed",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            {isMilestone
                                ? t.tasks.titleBlock.milestoneBadge
                                : isSubTask
                                  ? t.tasks.titleBlock.subTaskBadge
                                  : t.tasks.titleBlock.newTaskBadge}
                        </Typography>
                    </Box>
                )}

                {/* Right side: Action buttons */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
                    {isOnTasksRoute &&
                        taskContent.threadId !== null &&
                        taskContent.chatType !== null &&
                        taskContent.chatId !== null && (
                            <AppTooltip title={t.tasks.titleBlock.checkThread}>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        background: styles.buttonBg,
                                        border: `1px solid ${styles.buttonBorder}`,
                                        borderRadius: "10px",
                                        width: "36px",
                                        height: "36px",
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            background: styles.buttonHover,
                                            transform: "translateY(-1px)",
                                        },
                                    }}
                                    onClick={() => {
                                        // Ensure the project is set so the
                                        // App-level auto-loader can fetch the
                                        // preview task on the chat page. The
                                        // thread's own project may be null for
                                        // DM/GM threads (no message carries a
                                        // project); taskContent.project is the
                                        // reliable source here.
                                        if (taskContent.project) {
                                            usePM.setCurrentProject(taskContent.project);
                                        }
                                        useCM.moveToSpecificChat(
                                            taskContent.chatType!,
                                            taskContent.chatId!,
                                            taskContent.threadId!,
                                            false,
                                            true,
                                            useTM.setCurrentPreviewTaskId,
                                            usePM.setCurrentProject,
                                            undefined,
                                            // Open the task preview ON THE CHAT
                                            // PAGE — this entry point is the one
                                            // the bug names. Distinct from the
                                            // legacy flag above (deep-link
                                            // callers pass that true and must
                                            // not open the chat-page preview).
                                            true
                                        );
                                    }}
                                >
                                    <QuestionAnswerRoundedIcon
                                        sx={{ fontSize: 20, color: styles.textColor }}
                                    />
                                </IconButton>
                            </AppTooltip>
                        )}

                    {/* Diagram trigger — only meaningful for persisted
                        tasks with a project (the diagram fetches
                        project tasks to assemble the descendant tree).
                        Styled to match the milestone preview's trigger
                        treatment (36×36 padded button on tinted surface
                        with a translateY hover) so the affordance reads
                        consistently across both surfaces. */}
                    {isOnTasksRoute &&
                        isPreviewMode &&
                        taskContent.id != null &&
                        taskContent.project?.projectId != null && (
                            <AppTooltip title={t.tasks.tooltips.openTaskGraph}>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        background: styles.buttonBg,
                                        border: `1px solid ${styles.buttonBorder}`,
                                        borderRadius: "10px",
                                        width: "36px",
                                        height: "36px",
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            background: styles.buttonHover,
                                            transform: "translateY(-1px)",
                                        },
                                    }}
                                    onClick={() => setOpenTaskDiagram(true)}
                                >
                                    <AccountTreeRoundedIcon
                                        sx={{ fontSize: 20, color: styles.textColor }}
                                    />
                                </IconButton>
                            </AppTooltip>
                        )}

                    {isOnTasksRoute &&
                        (() => {
                            const items: MoreMenuItem[] = [
                                {
                                    id: "copyTaskLink",
                                    label: t.tasks.titleBlock.menu.copyTaskLink,
                                    icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
                                    onClick: async () => {
                                        if (taskContent.project && taskContent.id) {
                                            const taskUrl = `${window.location.origin}/workspace/tasks/project/${taskContent.project.projectId}/task/${taskContent.id}`;
                                            try {
                                                await navigator.clipboard.writeText(taskUrl);
                                            } catch (err) {
                                                console.error("Failed to copy link:", err);
                                            }
                                        }
                                    },
                                },
                                {
                                    id: "openThread",
                                    label: t.tasks.titleBlock.menu.openThread,
                                    icon: <QuestionAnswerRoundedIcon sx={{ fontSize: 18 }} />,
                                    visible:
                                        taskContent.threadId !== null &&
                                        taskContent.chatType !== null &&
                                        taskContent.chatId !== null,
                                    onClick: () => {
                                        // See the "Check Thread" button above:
                                        // seed the project so the chat-page
                                        // auto-loader can fetch the preview task
                                        // even for DM/GM threads whose own
                                        // project is null.
                                        if (taskContent.project) {
                                            usePM.setCurrentProject(taskContent.project);
                                        }
                                        useCM.moveToSpecificChat(
                                            taskContent.chatType!,
                                            taskContent.chatId!,
                                            taskContent.threadId!,
                                            false,
                                            true,
                                            useTM.setCurrentPreviewTaskId,
                                            usePM.setCurrentProject,
                                            undefined,
                                            // Open the task preview ON THE CHAT
                                            // PAGE (see the "Check Thread"
                                            // button above for why this is a
                                            // dedicated flag, not the legacy
                                            // openThreadTaskPreview).
                                            true
                                        );
                                    },
                                },
                                {
                                    id: "newTask",
                                    label: t.tasks.titleBlock.menu.newTask,
                                    icon: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />,
                                    onClick: () => {
                                        useTM.handleCreateTask();
                                    },
                                },
                                {
                                    id: "newSubTask",
                                    label: t.tasks.titleBlock.menu.newSubTask,
                                    icon: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />,
                                    onClick: () => {
                                        if (
                                            taskContent.id !== undefined &&
                                            taskContent.rootTaskId != null
                                        ) {
                                            if (useTM.setIsCreatingTask) {
                                                useTM.setIsCreatingTask({
                                                    flag: true,
                                                    parentTaskId: taskContent.id,
                                                    rootTaskId: taskContent.rootTaskId,
                                                    creationKind: "task",
                                                    milestoneId:
                                                        (taskContent as any).milestoneId ?? null,
                                                });
                                            }
                                            useTM.setIsTaskTableVisible(false);
                                        } else {
                                            console.error("Task ID not defined error.");
                                        }
                                    },
                                },
                                {
                                    id: "openNote",
                                    label: t.tasks.titleBlock.menu.openNote,
                                    icon: <NoteAltRoundedIcon sx={{ fontSize: 18 }} />,
                                    onClick: () => {
                                        if (useNM.setIsTaskNoteVisible && taskContent.project) {
                                            useTM.setIsTaskTableVisible(false);
                                            useNM.setIsTaskNoteVisible(true);
                                            if (useNM.taskNoteMeta.length > 0) {
                                                const meta = useNM
                                                    .taskNoteMeta[0] as TaskNoteProps;
                                                useNM.tabsApi.openTab({
                                                    kind: "task",
                                                    noteType: 2,
                                                    noteId: meta.noteId,
                                                    projectId: meta.projectId,
                                                    taskId: meta.taskId,
                                                    id: `task-${meta.noteId}`,
                                                    title: meta.title,
                                                    teamId: myself.teamId,
                                                });
                                            } else {
                                                if (taskContent.project && taskContent.id) {
                                                    useNM.handleCreateNewTaskNote(
                                                        null,
                                                        taskContent.project.projectId,
                                                        taskContent.id,
                                                        taskContent.title
                                                    );
                                                }
                                            }
                                        }
                                    },
                                },
                                {
                                    id: "newTag",
                                    label: t.tasks.titleBlock.menu.newTag,
                                    icon: <LocalOfferRoundedIcon sx={{ fontSize: 18 }} />,
                                    onClick: () => {
                                        useTM.setOpenCreateTag(true);
                                    },
                                },
                                {
                                    id: "newProject",
                                    label: t.tasks.titleBlock.menu.newProject,
                                    icon: <AddIcon sx={{ fontSize: 18 }} />,
                                    onClick: () => {
                                        usePM.setOpenCreateProject(true);
                                    },
                                },
                                {
                                    id: "deleteTask",
                                    label: t.tasks.titleBlock.menu.deleteTask,
                                    icon: <DeleteRoundedIcon sx={{ fontSize: 18 }} />,
                                    visible: taskContent.status.status !== "Closed",
                                    danger: true,
                                    onClick: () => {
                                        setOpenDeleteTask(true);
                                    },
                                },
                            ];
                            return (
                                <MoreMenu
                                    iconFontSize={20}
                                    items={items}
                                    placement="bottom-end"
                                    triggerSize={36}
                                    triggerSx={{
                                        background: styles.buttonBg,
                                        border: `1px solid ${styles.buttonBorder}`,
                                        borderRadius: "10px",
                                    }}
                                />
                            );
                        })()}

                    <AppTooltip title={t.tasks.titleBlock.closeTooltip}>
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={{
                                background: styles.dangerBg,
                                border: `1px solid ${styles.dangerBorder}`,
                                borderRadius: "10px",
                                width: "36px",
                                height: "36px",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    background: styles.dangerHover,
                                    transform: "translateY(-1px)",
                                },
                            }}
                            onClick={handleCloseClick}
                        >
                            <CancelIcon
                                sx={{
                                    fontSize: "20px",
                                    color: isDark ? "#f87171" : "#dc2626",
                                }}
                            />
                        </IconButton>
                    </AppTooltip>
                </Box>
            </Stack>

            {/* Close-button discard confirmation. Only shown in create
                mode when the form is dirty — preview-mode close skips
                this entirely via `handleCloseClick`.
                Three exits, in order of destructiveness:
                  - Discard draft → wipe everything (`performClose`)
                  - Hide → close the form but keep the draft so the user
                    can resume on next open (`performHide`)
                  - Keep editing → cancel the modal, stay in the form */}
            <Modal
                open={showCloseDiscardConfirm}
                onClose={() => setShowCloseDiscardConfirm(false)}
            >
                <ModalDialog role="alertdialog" variant="outlined">
                    <DialogTitle>
                        <WarningRoundedIcon sx={{ color: "#f59e0b" }} />
                        Close this draft?
                    </DialogTitle>
                    <Divider />
                    <DialogContent>
                        You can discard your changes, hide the form (your draft is saved so you can
                        resume later), or keep editing.
                    </DialogContent>
                    <DialogActions>
                        <Button
                            color="danger"
                            startDecorator={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
                            variant="solid"
                            onClick={() => {
                                setShowCloseDiscardConfirm(false);
                                performClose();
                            }}
                        >
                            Discard draft
                        </Button>
                        <Button
                            color="primary"
                            startDecorator={<VisibilityOffRoundedIcon sx={{ fontSize: 16 }} />}
                            variant="soft"
                            onClick={() => {
                                setShowCloseDiscardConfirm(false);
                                performHide();
                            }}
                        >
                            Hide (save draft)
                        </Button>
                        <Button
                            color="neutral"
                            variant="plain"
                            onClick={() => setShowCloseDiscardConfirm(false)}
                        >
                            Keep editing
                        </Button>
                    </DialogActions>
                </ModalDialog>
            </Modal>

            {/* Title Input */}
            <FormControl sx={{ width: "100%" }} required>
                <Input
                    key={"taskTitle"}
                    placeholder={t.tasks.titleBlock.titlePlaceholder}
                    value={taskTitle}
                    variant="plain"
                    slotProps={{
                        input: {
                            ref: titleInputRef,
                            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    titleInputRef.current?.blur();
                                }
                            },
                        },
                    }}
                    sx={{
                        width: "100%",
                        fontSize: "1.35rem",
                        fontWeight: 700,
                        backgroundColor: "transparent",
                        p: 0,
                        "--Input-focusedInset": "none",
                        "--Input-focusedThickness": "0",
                        "&::before": { display: "none" },
                        color: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(0,0,0,0.02)",
                        },
                        "&:focus-within": {
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.03)"
                                : "rgba(0,0,0,0.02)",
                        },
                        "& input::placeholder": {
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            fontWeight: 500,
                        },
                    }}
                    onBlur={() => {
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    }}
                    onChange={(e) => {
                        setTaskTitle(e.target.value);
                    }}
                />
            </FormControl>

            <ModalDeleteTask
                currentTaskContent={taskContent}
                openDeleteTask={openDeleteTask}
                setCurrentTaskContent={setTaskContent}
                setOpenDeleteTask={setOpenDeleteTask}
                setTaskStatusUpdated={setTaskStatusUpdated}
                setTaskUpdated={setTaskUpdated}
            />

            {taskContent.id != null && taskContent.project?.projectId != null && (
                <ModalTaskDiagram
                    open={openTaskDiagram}
                    projectId={Number(taskContent.project.projectId)}
                    myself={myself}
                    // Always anchor the diagram on the WHOLE hierarchy
                    // the task lives in. `rootTaskId` walks up to the
                    // top of the parent chain (or self for unparented
                    // tasks). Without this fallback, opening the
                    // diagram from a leaf sub-task would only show
                    // that single node — the user expects to see the
                    // milestone / parent + all siblings + sub-tree.
                    rootLabel={`${taskContent.displayId ?? `#${taskContent.id}`} · ${taskContent.title || "Untitled"}`}
                    rootTaskId={Number(taskContent.rootTaskId ?? taskContent.id)}
                    usePM={usePM}
                    useSM={useSM}
                    useTM={useTM}
                    onClose={() => setOpenTaskDiagram(false)}
                />
            )}

            {isPreviewMode === false && titleError && titleErrorOpen !== undefined && (
                <Snackbar
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                    autoHideDuration={5000}
                    color="danger"
                    open={titleErrorOpen}
                    variant="soft"
                    onClose={(event, reason) => {
                        if (reason === "clickaway") {
                            return;
                        }
                        if (setTitleErrorOpen) {
                            setTitleErrorOpen(false);
                        }
                    }}
                >
                    {titleError}
                </Snackbar>
            )}
        </Box>
    );
};
