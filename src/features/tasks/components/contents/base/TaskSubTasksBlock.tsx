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
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../types/admin";
import { TaskProps } from "../../../../../types/tasks";
import { loadSpecificChildTasks } from "../../../services/loadSpecificChildTasks";

// Modern theme-aware styling
const HEADER_STYLES = {
    dark: {
        containerBg: "linear-gradient(135deg, rgba(30,32,44,0.9) 0%, rgba(20,22,34,0.95) 100%)",
        containerBorder: "rgba(99,102,241,0.2)",
        titleGradient: "linear-gradient(90deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%)",
        buttonBg: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.35) 100%)",
        buttonBorder: "rgba(99,102,241,0.3)",
        createButtonBg: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        createButtonHover: "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(220,38,38,0.25) 100%)",
        dangerBorder: "rgba(239,68,68,0.3)",
        menuBg: "linear-gradient(180deg, rgba(30,32,44,0.98) 0%, rgba(20,22,34,0.99) 100%)",
        menuBorder: "rgba(99,102,241,0.15)",
        textColor: "#f1f5f9",
        mutedText: "rgba(148,163,184,0.9)",
        lockColor: "#fbbf24",
    },
    light: {
        containerBg:
            "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%)",
        containerBorder: "rgba(99,102,241,0.12)",
        titleGradient: "linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)",
        buttonBg: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)",
        buttonBorder: "rgba(99,102,241,0.2)",
        createButtonBg: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        createButtonHover: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.08) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
        dangerBorder: "rgba(239,68,68,0.2)",
        menuBg: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.99) 100%)",
        menuBorder: "rgba(99,102,241,0.1)",
        textColor: "#1e293b",
        mutedText: "rgba(71,85,105,0.9)",
        lockColor: "#d97706",
    },
};

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
        title = "Sub Tasks",
        buttonLabel = "Sub Task",
        emptyText = "No sub tasks yet",
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? HEADER_STYLES.dark : HEADER_STYLES.light;
    const [childTasks, setChildTasks] = useState<TaskProps[]>([]);

    useEffect(() => {
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
            setChildTasks(loaded?.length ? loaded : []);
        })();
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
                            ? "0 2px 8px rgba(99,102,241,0.4)"
                            : "0 2px 8px rgba(79,70,229,0.3)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            background: styles.createButtonHover,
                            transform: "translateY(-1px)",
                            boxShadow: isDark
                                ? "0 4px 12px rgba(99,102,241,0.5)"
                                : "0 4px 12px rgba(79,70,229,0.4)",
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
                        maxHeight: "200px",
                        overflowY: "scroll",
                    }}
                >
                    <ListItem sx={{ width: "100%" }} nested>
                        <List sx={{ gap: 0.5 }}>
                            {childTasks.map(
                                ({ assignee, project, id, title, status, tags }, index) => {
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
                                                    {`#${id}`}
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
