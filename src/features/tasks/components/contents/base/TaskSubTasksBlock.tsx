import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import {
    Box,
    Chip,
    CircularProgress,
    IconButton,
    Input,
    List,
    ListItem,
    ListItemButton,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { ActionButtonStyles } from "../../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { TaskProps } from "../../../../../types/tasks";
import { createQuickTask } from "../../../services/createQuickTask";
import { loadSpecificChildTasks } from "../../../services/loadSpecificChildTasks";
import { emitTaskTouched, onTaskTouched } from "../../../services/taskEvents";
import { formatTaskDisplayId } from "../../../utils/taskDisplayId";

type TaskSubTasksBlockProps = {
    SectionHeader: React.ComponentType<{ children: React.ReactNode; isDark: boolean }>;
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    currentTaskContent: TaskProps;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useTM: TaskManagementState;
    // When true, child tasks are loaded regardless of whether
    // `useTM.currentPreviewTaskId` matches `currentTaskContent.id`.
    // Use this for milestone preview where the milestone state lives
    // under `currentPreviewMilestoneId` instead.
    forceLoad?: boolean;
    // Section title and button label override. Milestones render this
    // as "Tasks in this milestone" / "Task" while normal tasks keep
    // the default "Sub Tasks" / "Sub Task".
    title?: string;
    buttonLabel?: string;
    emptyText?: string;
};
export const TaskSubTasksBlock = (props: TaskSubTasksBlockProps) => {
    const { t } = useTranslation();
    const {
        SectionHeader,
        useTEM,
        socket,
        myself,
        setMyself,
        currentTaskContent,
        useUISM,
        useCM,
        useTM,
        forceLoad = false,
        title = t.tasks.subTasks.title,
        buttonLabel = t.tasks.subTasks.buttonLabel,
        emptyText = t.tasks.subTasks.emptyText,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? ActionButtonStyles.dark : ActionButtonStyles.light;
    const [childTasks, setChildTasks] = useState<TaskProps[]>([]);

    // Inline quick-create state. The button up top toggles `isQuickAdding`;
    // when on, an inline title input takes its place. Enter on a non-empty
    // trimmed value POSTs a title-only task, refetches the child list, and
    // keeps focus so the user can type-Enter-type-Enter through several
    // sub-tasks without re-clicking. Escape (or blur with an empty value)
    // hides the input and restores the button.
    const [isQuickAdding, setIsQuickAdding] = useState(false);
    const [quickTitle, setQuickTitle] = useState("");
    const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
    const [quickError, setQuickError] = useState<string | null>(null);

    // External refresh signal: another client added/moved a subtask.
    // Scoped by task id via the `genos:task-touched` bus; the local
    // quick-add path refetches directly and doesn't need this.
    const [childRefreshNonce, setChildRefreshNonce] = useState(0);
    useEffect(() => {
        const parentTaskId = currentTaskContent.id;
        if (parentTaskId == null) return;
        return onTaskTouched(({ taskId, kind }) => {
            if (kind === "children" && taskId === parentTaskId) {
                setChildRefreshNonce((n) => n + 1);
            }
        });
    }, [currentTaskContent.id]);

    useEffect(() => {
        // Cancelled-flag guard: slow child-task responses for an old
        // taskId must not overwrite the freshly-selected task's
        // sub-tree when the user click-storms cards faster than the
        // backend round-trip.
        let cancelled = false;
        (async () => {
            // Load when either the row is the active task preview, or
            // the parent explicitly opted in via `forceLoad` (milestone
            // preview, where `currentPreviewTaskId` is intentionally
            // -1).
            const shouldLoad =
                currentTaskContent.project != null &&
                currentTaskContent.id != null &&
                (forceLoad || useTM.currentPreviewTaskId === currentTaskContent.id);
            if (!shouldLoad) return;
            const loaded: TaskProps[] = await loadSpecificChildTasks(
                myself,
                currentTaskContent.project!.projectId,
                currentTaskContent.id!,
                accessToken
            );
            if (cancelled) return;
            setChildTasks(loaded?.length ? loaded : []);
        })();
        return () => {
            cancelled = true;
        };
        // Depend on the task/project ids, not the `currentTaskContent`
        // object: regular mode passes `tmpCurrentTaskContent`, whose
        // identity changes on every keystroke, and milestone mode
        // rebuilds `taskContentLike` on team-roster polls — both caused
        // a /task/childTasks/ refetch storm for an unchanged task.
    }, [
        currentTaskContent.id,
        currentTaskContent.project?.projectId,
        forceLoad,
        childRefreshNonce,
    ]);

    // Reset the quick-add UI when the user navigates between preview
    // cards. Without this, an open input on task A would survive a click
    // to task B and dump the next Enter into B's child set.
    useEffect(() => {
        setIsQuickAdding(false);
        setQuickTitle("");
        setQuickError(null);
    }, [currentTaskContent.id]);

    const submitQuickTask = async () => {
        const trimmed = quickTitle.trim();
        if (trimmed === "") return;
        if (
            currentTaskContent.id == null ||
            currentTaskContent.rootTaskId == null ||
            currentTaskContent.project == null
        ) {
            return;
        }
        // Same milestone-inheritance the legacy onClick used: a quick
        // sub-task under a milestone backing row inherits that milestone's
        // id; a sub-task under a regular task in a milestone chain inherits
        // the chain's milestoneId (null when outside a milestone).
        const inheritedMilestoneId: number | null =
            (currentTaskContent as any).milestoneId ?? null;

        setIsSubmittingQuick(true);
        setQuickError(null);
        try {
            await createQuickTask({
                myself,
                accessToken,
                projectId: currentTaskContent.project.projectId,
                title: trimmed,
                parentTaskId: currentTaskContent.id,
                rootTaskId: currentTaskContent.rootTaskId,
                milestoneId: inheritedMilestoneId,
            });
            // Refetch through the load effect (children event → nonce
            // bump) so the appended row carries every server-derived
            // field (displayId, project_task_number, etc.) without a
            // manual snake→camel map — and any other mounted sub-task
            // block for the same parent refreshes too.
            emitTaskTouched(currentTaskContent.id, "children");
            // Trigger the project-wide refresh so an open table/board picks
            // up the new row too. Now cheap thanks to the Redis-cached
            // GetProjectTasksView + signal-driven invalidation.
            useTM.setIsNewTaskCreated(true);
            // Clear the input but keep it open + focused for the next
            // rapid add. Power-user pattern.
            setQuickTitle("");
        } catch (err) {
            setQuickError(t.tasks.subTasks.quickAddError);
        } finally {
            setIsSubmittingQuick(false);
        }
    };

    const cancelQuickAdd = () => {
        setIsQuickAdding(false);
        setQuickTitle("");
        setQuickError(null);
    };

    return (
        <>
            <Stack
                direction="row"
                spacing={0}
                sx={{ alignItems: "center", justifyContent: "space-between", pb: 0.5 }}
            >
                <SectionHeader isDark={isDark}>{title}</SectionHeader>
                <IconButton
                    size="sm"
                    sx={{
                        background: styles.createButtonBg,
                        color: "#fff",
                        borderRadius: "10px",
                        px: 1.5,
                        py: 0.75,
                        fontSize: "13px",
                        fontWeight: 600,
                        gap: 0.5,
                        boxShadow: isDark
                            ? "0 2px 8px rgba(124,58,237,0.4)"
                            : "0 2px 8px rgba(124,58,237,0.3)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            background: styles.createButtonHover,
                            transform: "translateY(-1px)",
                            boxShadow: isDark
                                ? "0 4px 12px rgba(124,58,237,0.5)"
                                : "0 4px 12px rgba(124,58,237,0.4)",
                        },
                    }}
                    onClick={() => {
                        if (
                            currentTaskContent.id !== undefined &&
                            currentTaskContent.rootTaskId != null
                        ) {
                            // When the parent is a milestone (or a task
                            // already inside a milestone chain), inherit
                            // its milestoneId so the child task lands in
                            // the same milestone context. The CreateTaskForm
                            // uses this to hide the Milestone toggle and
                            // pre-select the milestone in the picker.
                            const inheritedMilestoneId: number | null =
                                (currentTaskContent as any).isMilestone === true
                                    ? ((currentTaskContent as any).milestoneId ?? null)
                                    : ((currentTaskContent as any).milestoneId ?? null);
                            useTM.setIsCreatingTask({
                                flag: true,
                                parentTaskId: currentTaskContent.id,
                                rootTaskId: currentTaskContent.rootTaskId,
                                creationKind: "task",
                                milestoneId: inheritedMilestoneId,
                            });

                            // Close task-home when creating a sub task.
                            useTM.setIsTaskTableVisible(false);
                        } else {
                            console.error("Task ID nod defined error.");
                        }
                    }}
                >
                    <AddIcon sx={{ fontSize: "18px" }} />
                    {buttonLabel}
                </IconButton>
            </Stack>

            {childTasks.length > 0 && (
                <Stack
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    direction="row"
                    sx={{
                        width: "100%",
                        minHeight: "40px",
                        maxHeight: "300px",
                        overflowY: "scroll",
                    }}
                >
                    <ListItem sx={{ width: "100%" }} nested>
                        <List sx={{ gap: 0.5 }}>
                            {childTasks.map(
                                (
                                    { assignee, project, id, displayId, title, status, tags },
                                    index
                                ) => {
                                    return (
                                        <ListItem key={`listitem-${id}-${index}`}>
                                            <AvatarWithStatus
                                                myself={myself}
                                                setMyself={setMyself}
                                                socket={socket}
                                                useCM={useCM}
                                                useUISM={useUISM}
                                                // Sub-tasks can be unassigned —
                                                // fall back to the empty avatar
                                                // that AvatarWithStatus renders
                                                // when `avatarUser` is undefined.
                                                avatarUser={
                                                    assignee
                                                        ? useTEM.teamMemberProfiles[
                                                              assignee.userId
                                                          ]
                                                        : undefined
                                                }
                                                isYou={
                                                    !!assignee && myself.userId === assignee.userId
                                                }
                                            />
                                            <ListItemButton
                                                sx={{
                                                    marginLeft: "10px",
                                                }}
                                                onClick={() => {
                                                    if (project && project.projectId && id) {
                                                        // setCurrentProject({
                                                        //     projectId: project.projectId,
                                                        //     projectName: project.projectName,
                                                        //     projectTags: project.projectTags || [],
                                                        //     systemUserId: project.systemUserId,
                                                        // });
                                                        useTM.setCurrentPreviewTaskId(id);
                                                    } else {
                                                        console.error(
                                                            "Failed to set the current project"
                                                        );
                                                    }
                                                }}
                                            >
                                                <Chip
                                                    key={`id-chip-${id}-${index}`} // pass the key directly
                                                    color="neutral"
                                                    size="md"
                                                    variant="outlined"
                                                    sx={{
                                                        fontWeight: "bold",
                                                        borderRadius: "5px",
                                                    }}
                                                >
                                                    {formatTaskDisplayId({ id, displayId })}
                                                </Chip>
                                                <Chip
                                                    key={`status-chip-${id}-${index}`} // pass the key directly
                                                    size="md"
                                                    variant="soft"
                                                    sx={{
                                                        marginX: "5px",
                                                        backgroundColor: status.color
                                                            ? alpha(
                                                                  status.color,
                                                                  mode === "dark" ? 0.5 : 0.75
                                                              )
                                                            : "transparent",
                                                        color: status.textColor,
                                                        fontWeight: "bold",
                                                        borderRadius: "5px",
                                                    }}
                                                >
                                                    {`${status.status}`}
                                                </Chip>
                                                <Typography
                                                    sx={{
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        width: "100%", // take full width of button
                                                    }}
                                                    noWrap
                                                >
                                                    {`${title}`}
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        marginLeft: "auto",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    {tags.map(({ tagName, tagColor }, index) => (
                                                        <Chip
                                                            key={`${id}-${index}-${tagName}`}
                                                            size="md"
                                                            variant="outlined"
                                                            sx={{
                                                                marginX: "2px",
                                                                color:
                                                                    mode === "dark"
                                                                        ? "white"
                                                                        : "black",
                                                                fontWeight: "bold",
                                                                borderRadius: "5px",
                                                                borderWidth: "3px",
                                                                borderColor: alpha(
                                                                    tagColor,
                                                                    mode === "dark" ? 0.5 : 0.75
                                                                ),
                                                            }}
                                                        >
                                                            {`${tagName}`}
                                                        </Chip>
                                                    ))}
                                                </Box>
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                }
                            )}
                        </List>
                    </ListItem>
                </Stack>
            )}

            {childTasks.length === 0 && (
                <Typography level="body-sm" sx={{ mb: 2, textAlign: "center" }}>
                    {emptyText}
                </Typography>
            )}

            {/* Quick Task row. Always visible at the bottom regardless of
                whether the list above has items or is empty. Collapsed:
                a subtle "+ Quick Task" row that mirrors the look of the
                child task rows above. Expanded: an inline title input
                that creates a title-only task on Enter and immediately
                refetches the list so the new row appears above. */}
            <Box sx={{ mt: 1 }}>
                {!isQuickAdding ? (
                    <ListItemButton
                        sx={{
                            borderRadius: "8px",
                            border: "1px dashed",
                            borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)",
                            color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.6)",
                            gap: 1,
                            py: 0.75,
                            px: 1.25,
                            transition: "all 0.15s ease",
                            "&:hover": {
                                borderColor: isDark
                                    ? "rgba(167,139,250,0.6)"
                                    : "rgba(124,58,237,0.5)",
                                color: isDark ? "#a78bfa" : "#7c3aed",
                                backgroundColor: isDark
                                    ? "rgba(124,58,237,0.06)"
                                    : "rgba(124,58,237,0.04)",
                            },
                        }}
                        onClick={() => {
                            if (
                                currentTaskContent.id == null ||
                                currentTaskContent.rootTaskId == null
                            ) {
                                console.error("Task ID not defined error.");
                                return;
                            }
                            setQuickError(null);
                            setQuickTitle("");
                            setIsQuickAdding(true);
                        }}
                    >
                        <AddIcon sx={{ fontSize: "18px" }} />
                        <Typography level="body-sm" sx={{ fontWeight: 500, color: "inherit" }}>
                            {t.tasks.subTasks.quickAddLabel}
                        </Typography>
                    </ListItemButton>
                ) : (
                    <Stack direction="column" spacing={0.5}>
                        <Input
                            disabled={isSubmittingQuick}
                            placeholder={t.tasks.subTasks.quickAddPlaceholder}
                            size="sm"
                            sx={{ borderRadius: "8px" }}
                            value={quickTitle}
                            endDecorator={
                                isSubmittingQuick ? (
                                    <CircularProgress
                                        size="sm"
                                        sx={{ "--CircularProgress-size": "16px" }}
                                    />
                                ) : null
                            }
                            slotProps={{
                                input: {
                                    "aria-label": t.tasks.subTasks.quickAddPlaceholder,
                                },
                            }}
                            autoFocus
                            onBlur={() => {
                                // Blur with an empty input cancels. If the
                                // user typed something, keep the input open
                                // so a misclick doesn't drop their draft.
                                if (quickTitle.trim() === "" && !isSubmittingQuick) {
                                    cancelQuickAdd();
                                }
                            }}
                            onChange={(e) => {
                                setQuickTitle(e.target.value);
                                if (quickError) setQuickError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isSubmittingQuick) {
                                    e.preventDefault();
                                    void submitQuickTask();
                                } else if (e.key === "Escape" && !isSubmittingQuick) {
                                    e.preventDefault();
                                    cancelQuickAdd();
                                }
                            }}
                        />
                        {quickError && (
                            <Typography level="body-xs" sx={{ color: "danger.500", px: 0.5 }}>
                                {quickError}
                            </Typography>
                        )}
                    </Stack>
                )}
            </Box>
        </>
    );
};
