import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import {
    Box,
    Chip,
    IconButton,
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
import { loadSpecificChildTasks } from "../../../services/loadSpecificChildTasks";
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
    }, [currentTaskContent, forceLoad]);

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
                                                useCM={useCM}
                                                myself={myself}
                                                setMyself={setMyself}
                                                socket={socket}
                                                useUISM={useUISM}
                                                avatarUser={
                                                    useTEM.teamMemberProfiles[assignee.userId]
                                                }
                                                isYou={
                                                    myself.userId === assignee.userId
                                                        ? true
                                                        : false
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
        </>
    );
};
