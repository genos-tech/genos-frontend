import { useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import {
    Avatar,
    AvatarGroup,
    Box,
    Chip,
    Dropdown,
    IconButton,
    List,
    ListItem,
    ListItemContent,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Typography,
} from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../types/admin";
import { Milestone } from "../../../sprint-milestone/types";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// Mirror of the table's `statusOptions` palette in
// DraggableTaskTable.tsx so the milestone status chip looks identical
// to the row's status chip (avoids a runtime cross-import for what is
// essentially a small, slow-changing color map).
const STATUS_CHIP: Record<string, { color: string; textColor: string }> = {
    Open: { color: "#0044c2", textColor: "#ffffff" },
    WIP: { color: "#ff8c00", textColor: "#ffffff" },
    Pending: { color: "#b900ff", textColor: "#ffffff" },
    Closed: { color: "#1dc200", textColor: "#ffffff" },
    Deleted: { color: "#ff2323", textColor: "#ffffff" },
};

type Props = {
    currentProjectId: number;
    useSM: SprintMilestoneManagementState;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
};

const VISIBLE_STATUSES = new Set(["Open", "WIP", "Pending"]);

export const MilestonesListItem = ({
    currentProjectId,
    useSM,
    useTM,
    useTEM,
    useCM,
    useUISM,
    myself,
    setMyself,
    socket,
}: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const milestones: Milestone[] = useMemo(() => {
        const list = useSM.projectMilestones[currentProjectId] ?? [];
        return list.filter((m) => !m.isDeleted && VISIBLE_STATUSES.has(m.status));
    }, [useSM.projectMilestones, currentProjectId]);

    const sprints = useSM.projectSprints[currentProjectId] ?? [];

    const handleOpen = (milestoneId: number) => {
        // Open the milestone preview AND scope the task table to this
        // milestone (its backing task as the root + its children).
        // Re-clicking a milestone toggles the table-scope off again so
        // users can quickly bounce between scoped / unscoped views.
        const isAlreadyScoped = useTM.tableMilestoneFilterId === milestoneId;
        useTM.setCurrentPreviewKind("milestone");
        useTM.setCurrentPreviewMilestoneId(milestoneId);
        useTM.setIsTaskPreviewVisible(true);
        useTM.setTableMilestoneFilterId(isAlreadyScoped ? null : milestoneId);
    };

    const handleAddMilestone = () => {
        useTM.setIsCreatingTask({
            flag: true,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "milestone",
            milestoneId: null,
        });
        useTM.setIsTaskHomeVisible(false);
    };

    if (milestones.length === 0) {
        return (
            <List sx={{ gap: 0.25 }}>
                <AddMilestoneRow onClick={handleAddMilestone} isDark={isDark} />
            </List>
        );
    }

    return (
        <List sx={{ gap: 0.25 }}>
            {milestones.map((m) => {
                const sprintName =
                    m.sprintId == null
                        ? "No sprint"
                        : (sprints.find((s) => s.sprintId === m.sprintId)?.name ?? "Sprint");
                return (
                    <ListItem key={m.milestoneId} sx={{ pl: 0, pr: 1 }}>
                        <ListItemButton
                            sx={{ borderRadius: 8, ml: 5, py: 0.5, pr: 0.5 }}
                            onClick={() => handleOpen(m.milestoneId)}
                            selected={
                                useTM.currentPreviewKind === "milestone" &&
                                useTM.currentPreviewMilestoneId === m.milestoneId
                            }
                        >
                            <FlagRoundedIcon sx={{ fontSize: 14, color: "#f97316", mr: 0.75 }} />
                            <ListItemContent>
                                <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="center"
                                    sx={{ minWidth: 0 }}
                                >
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            flex: 1,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            color: isDark
                                                ? "rgba(255,255,255,0.85)"
                                                : "rgba(0,0,0,0.8)",
                                        }}
                                    >
                                        {m.title}
                                    </Typography>
                                    <Chip size="sm" variant="soft">
                                        {m.tasksClosed ?? 0}/{m.tasksTotal ?? 0}
                                    </Chip>
                                </Stack>
                                <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="center"
                                    sx={{ mt: 0.25 }}
                                >
                                    <Chip size="sm" variant="outlined">
                                        {sprintName}
                                    </Chip>
                                    {(() => {
                                        const tone =
                                            STATUS_CHIP[m.status as string] ?? STATUS_CHIP.Open;
                                        return (
                                            <Chip
                                                size="sm"
                                                variant="solid"
                                                sx={{
                                                    backgroundColor: tone.color,
                                                    color: tone.textColor,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {m.status}
                                            </Chip>
                                        );
                                    })()}
                                    <Box sx={{ flex: 1 }} />
                                    <AvatarGroup size="sm" sx={{ "--Avatar-size": "18px" }}>
                                        {m.assignees.slice(0, 4).map((a) => {
                                            const userIdKey =
                                                a.userId != null ? String(a.userId) : "";
                                            const profile = userIdKey
                                                ? useTEM.teamMemberProfiles[userIdKey]
                                                : undefined;
                                            // Use AvatarWithStatus when we
                                            // can resolve the team member
                                            // profile (gives us online
                                            // pulse + click-to-profile);
                                            // fall back to a plain Avatar
                                            // for legacy assignees that
                                            // aren't in the team profile
                                            // map (e.g. recently removed
                                            // members).
                                            return profile ? (
                                                <AvatarWithStatus
                                                    key={userIdKey}
                                                    avatarSize={18}
                                                    avatarUser={profile}
                                                    isYou={String(myself.userId) === userIdKey}
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    socket={socket}
                                                    useCM={useCM}
                                                    useUISM={useUISM}
                                                />
                                            ) : (
                                                <Avatar
                                                    key={userIdKey || `idx-${a.username}`}
                                                    src={
                                                        a.profileImageUrl
                                                            ? `${media_url}/${a.profileImageUrl}`
                                                            : undefined
                                                    }
                                                    sx={{ fontSize: 10 }}
                                                >
                                                    {(a.username?.[0] || "?").toUpperCase()}
                                                </Avatar>
                                            );
                                        })}
                                    </AvatarGroup>
                                </Stack>
                            </ListItemContent>
                            <Dropdown>
                                <MenuButton
                                    slots={{ root: IconButton }}
                                    slotProps={{
                                        root: {
                                            variant: "plain",
                                            size: "sm",
                                            onClick: (e: any) => e.stopPropagation(),
                                        },
                                    }}
                                >
                                    <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
                                </MenuButton>
                                <Menu placement="bottom-end">
                                    <MenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            useSM.moveMilestone(
                                                m.milestoneId,
                                                null,
                                                currentProjectId
                                            );
                                        }}
                                    >
                                        Move to: No sprint
                                    </MenuItem>
                                    {sprints
                                        .filter((s) => s.sprintId !== m.sprintId)
                                        .map((s) => (
                                            <MenuItem
                                                key={s.sprintId}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    useSM.moveMilestone(
                                                        m.milestoneId,
                                                        s.sprintId,
                                                        currentProjectId
                                                    );
                                                }}
                                            >
                                                Move to: {s.name}
                                            </MenuItem>
                                        ))}
                                </Menu>
                            </Dropdown>
                        </ListItemButton>
                    </ListItem>
                );
            })}
            <AddMilestoneRow onClick={handleAddMilestone} isDark={isDark} />
        </List>
    );
};

const AddMilestoneRow = ({ onClick, isDark }: { onClick: () => void; isDark: boolean }) => (
    <ListItem sx={{ pl: 0 }}>
        <ListItemButton sx={{ borderRadius: 8, ml: 5, py: 0.5 }} onClick={onClick}>
            <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />
            <Typography
                level="body-sm"
                sx={{
                    color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                }}
            >
                Add milestone
            </Typography>
        </ListItemButton>
    </ListItem>
);
