import { forwardRef, useImperativeHandle, useState } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {
    Button,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Modal,
    ModalDialog,
    Stack,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { consumeYjsPersistenceFailure } from "../../../../../db/utils/yjsPersistence";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { getMessages } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { TaskProps } from "../../../../../types/tasks";
import { isMac } from "../../../../../utils/platform";
import { deleteEmptyTask } from "../../../services/deleteEmptyTask";
import { uploadNewTask } from "../../../services/uploadNewTask";

// Imperative handle so `CreateTaskForm` can trigger the same submit
// path the button uses from a global Cmd/Ctrl+Enter keydown listener.
// Exposing a method (instead of lifting `DoUploadNewTask` up) keeps
// all the upload-orchestration state — `isCreatingTask`, disabled
// gating, snackbar messages — local to this component.
export interface TaskCreateFooterHandle {
    submit: () => void;
}

type TaskCreateFooterProps = {
    socket: Socket | null;
    myself: UserProps;
    accessToken: string | null;
    useCM: ChatManagementState;
    taskContent: TaskProps;
    taskTitle: string;
    useTM: TaskManagementState;
    /** Lifted into `CreateTaskForm` so the attachment block can render
     *  its overlay during the same upload window the button is locked. */
    isCreatingTask?: boolean;
    setIsCreatingTask?: (value: boolean) => void;
    setIsSubmitted: (value: boolean) => void;
    setTitleError: (value: string) => void;
    setTitleErrorOpen: (value: boolean) => void;
    usePM: ProjectManagementState;
    /** True when the user has entered title / body / attachment content.
     *  Cancel asks for confirmation only when this is true — clicking
     *  Cancel on an untouched form proceeds straight to teardown so we
     *  don't pester the user with a modal for a no-op. */
    isDirty?: boolean;
    /** Display labels of project-rule-required fields still unset (from
     *  `getMissingRequiredFields`). Non-empty disables Create — the
     *  form renders the matching "Required: …" hint beside this footer. */
    missingRequiredFields?: string[];
    /** Reads the body editor's CURRENT document at submit time. `taskContent.body`
     *  lags — it's synced from the collaborative editor on a debounce (flushed
     *  only on blur) — so a quick click, and every Cmd/Ctrl+Enter submit (which
     *  never blurs the editor), sent the pre-edit body and dropped the user's
     *  typing. When provided, its result overrides `taskContent.body`. */
    getLatestBody?: () => TaskProps["body"];
};

export const TaskCreateFooter = forwardRef<TaskCreateFooterHandle, TaskCreateFooterProps>(
    (props, ref) => {
        const {
            socket,
            myself,
            accessToken,
            useCM,
            taskContent,
            taskTitle,
            useTM,
            isCreatingTask = false,
            setIsCreatingTask,
            setIsSubmitted,
            setTitleError,
            setTitleErrorOpen,
            usePM,
            isDirty = false,
            missingRequiredFields = [],
            getLatestBody,
        } = props;

        const { mode } = useColorScheme();
        const isDark = mode === "dark";
        const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

        const isDisabled =
            isCreatingTask ||
            taskTitle === "" ||
            taskContent.project?.projectId === null ||
            missingRequiredFields.length > 0;

        const DoUploadNewTask = async () => {
            // Guard against a double-click sending two creates in parallel
            // (the button is also visually locked via `isDisabled`).
            if (isCreatingTask) return;

            // The description lives in a collaborative Yjs document. If its
            // local cache threw, edits made while it was broken never
            // reached the document, so submitting now would persist a body
            // missing whatever the user typed — the silent "task created,
            // description empty" outcome. Stop and say so. `consume` clears
            // the flag: the cache has detached by now, so the retry this
            // message asks for runs against a healthy editor.
            if (consumeYjsPersistenceFailure(`task-body:${taskContent.id}`)) {
                setTitleError(getMessages().tasks.errors.bodyEditorUnavailable);
                setTitleErrorOpen(true);
                return;
            }

            setIsCreatingTask?.(true);
            try {
                // Snapshot the editor's live body at submit time — `taskContent.body`
                // can lag the last keystrokes (see `getLatestBody`).
                const liveBody = getLatestBody?.();
                const submittedTaskContent =
                    liveBody !== undefined ? { ...taskContent, body: liveBody } : taskContent;

                const result = await uploadNewTask({
                    socket: socket,
                    myself: myself,
                    taskContent: submittedTaskContent,
                    useCM: useCM,
                    accessToken: accessToken || "",
                    setTitleError: setTitleError,
                    setTitleErrorOpen: setTitleErrorOpen,
                    setCurrentPreviewTaskId: useTM.setCurrentPreviewTaskId,
                });

                // Bail BEFORE any of the success side effects. `setIsSubmitted`
                // closes the form and wipes the draft, so running it on a
                // failed create destroyed the user's title/body/attachments
                // and left them staring at a task that was never created —
                // `uploadNewTask` used to swallow its own throw, so every
                // backend rejection looked exactly like success from here.
                // It has already put the reason in the form's snackbar; keep
                // everything on screen so the Create button IS the retry.
                if (!result.ok) return;

                if (taskContent.project && taskContent.project.projectId) {
                    localStorage.setItem("lastProjectId", String(taskContent.project.projectId));
                    usePM.setCurrentProject(taskContent.project);
                } else {
                    console.error("Failed to set the current project");
                }

                // Reveal the panels the new task lands in only once it exists
                // — a failed create shouldn't swap the user's view out from
                // under the form they're still editing.
                if (window.location.pathname.includes("/workspace/tasks")) {
                    useTM.setIsTaskTableVisible(true);
                }
                useTM.setIsTaskPreviewVisible(true);

                setIsSubmitted(true);
            } finally {
                // Always release the lock — failures are reported through
                // `setTitleError`, so leaving the form wedged on a transient
                // backend hiccup would be worse than letting the user retry.
                setIsCreatingTask?.(false);
            }
        };

        // One entry point for both submit surfaces — click and
        // Cmd/Ctrl+Enter — so gating and side effects fire identically. The
        // shortcut respects `isDisabled` so an empty title or an in-flight
        // create doesn't slip through. The table/preview reveals live inside
        // `DoUploadNewTask` because they're success-only.
        const triggerSubmit = () => {
            if (isDisabled) return;
            DoUploadNewTask();
        };

        useImperativeHandle(ref, () => ({
            submit: triggerSubmit,
        }));

        const shortcutLabel = isMac() ? "⌘ + Enter" : "Ctrl + Enter";

        const handleCancel = () => {
            // Cancel = "throw away anything in progress" — wipe the persisted
            // draft alongside the backend empty-task so the next form open is
            // a clean slate.
            useTM.setTaskDraft(null);
            if (useTM.setIsCreatingTask) {
                useTM.setIsCreatingTask({
                    flag: false,
                    parentTaskId: null,
                    rootTaskId: useTM.currentPreviewTask?.rootTaskId || null,
                    creationKind: "task",
                    milestoneId: null,
                });
            }

            if (taskContent.id !== undefined) {
                // Fire-and-forget cleanup: the form is already tearing down,
                // so a failure here must be logged, never an uncaught
                // rejection (and never blocks the close).
                void deleteEmptyTask({
                    myself: myself,
                    taskId: taskContent.id,
                    accessToken: accessToken,
                    setInitialEmptyTaskId: useTM.setInitialEmptyTaskId,
                }).catch((err) =>
                    console.error("[TaskCreateFooter] deleteEmptyTask failed:", err)
                );
            }
        };

        // Two-step cancel: dirty drafts confirm via modal, untouched drafts
        // (user clicked into the form, did nothing, clicked Cancel) tear
        // down immediately so we don't nag.
        const handleCancelClick = () => {
            if (isDirty) {
                setShowDiscardConfirm(true);
            } else {
                handleCancel();
            }
        };

        const confirmDiscard = () => {
            setShowDiscardConfirm(false);
            handleCancel();
        };

        return (
            <Stack direction="row" sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
                <Button
                    disabled={isCreatingTask}
                    size="sm"
                    startDecorator={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
                    variant="plain"
                    sx={{
                        fontWeight: 600,
                        fontSize: "13px",
                        borderRadius: "10px",
                        px: 2,
                        py: 0.75,
                        color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": {
                            background: isDark
                                ? "rgba(var(--gp-tint-danger-rgb), 0.12)"
                                : "rgba(var(--gp-tint-danger-rgb), 0.08)",
                            borderColor: isDark
                                ? "rgba(var(--gp-tint-danger-rgb), 0.3)"
                                : "rgba(var(--gp-tint-danger-rgb), 0.25)",
                            color: "#ef4444",
                        },
                        "&:active": {
                            transform: "scale(0.98)",
                        },
                    }}
                    onClick={handleCancelClick}
                >
                    Cancel
                </Button>

                <Modal open={showDiscardConfirm} onClose={() => setShowDiscardConfirm(false)}>
                    <ModalDialog role="alertdialog" variant="outlined">
                        <DialogTitle>
                            <WarningRoundedIcon sx={{ color: "#f59e0b" }} />
                            Discard this draft?
                        </DialogTitle>
                        <Divider />
                        <DialogContent>
                            Your title, body, and attachments will be lost. This can&apos;t be
                            undone.
                        </DialogContent>
                        <DialogActions>
                            <Button
                                color="danger"
                                startDecorator={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
                                variant="solid"
                                onClick={confirmDiscard}
                            >
                                Discard draft
                            </Button>
                            <Button
                                color="neutral"
                                variant="plain"
                                onClick={() => setShowDiscardConfirm(false)}
                            >
                                Keep editing
                            </Button>
                        </DialogActions>
                    </ModalDialog>
                </Modal>
                <AppTooltip title={isDisabled ? "Create Task" : `Create Task (${shortcutLabel})`}>
                    <Button
                        disabled={isDisabled}
                        loading={isCreatingTask}
                        loadingPosition="start"
                        size="sm"
                        startDecorator={<AddTaskRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="solid"
                        sx={{
                            fontWeight: 600,
                            fontSize: "13px",
                            borderRadius: "10px",
                            px: 2.5,
                            py: 0.75,
                            background: isDisabled
                                ? isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.08)"
                                : "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)",
                            color: isDisabled
                                ? isDark
                                    ? "rgba(255,255,255,0.3)"
                                    : "rgba(0,0,0,0.3)"
                                : "white",
                            boxShadow: isDisabled
                                ? "none"
                                : "0 2px 8px rgba(var(--gp-brand-700-rgb), 0.3)",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                                background: isDisabled
                                    ? isDark
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(0,0,0,0.08)"
                                    : "linear-gradient(135deg, var(--gp-brandalt-400) 0%, var(--gp-brand-400) 100%)",
                                boxShadow: isDisabled
                                    ? "none"
                                    : "0 4px 12px rgba(var(--gp-brand-700-rgb), 0.4)",
                                transform: isDisabled ? "none" : "translateY(-1px)",
                            },
                            "&:active": {
                                transform: isDisabled ? "none" : "translateY(0)",
                                boxShadow: isDisabled
                                    ? "none"
                                    : "0 2px 6px rgba(var(--gp-brand-700-rgb), 0.25)",
                            },
                            "&:disabled": {
                                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                                color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                            },
                        }}
                        onClick={triggerSubmit}
                    >
                        {isCreatingTask ? "Creating…" : "Create Task"}
                    </Button>
                </AppTooltip>
            </Stack>
        );
    }
);

TaskCreateFooter.displayName = "TaskCreateFooter";
