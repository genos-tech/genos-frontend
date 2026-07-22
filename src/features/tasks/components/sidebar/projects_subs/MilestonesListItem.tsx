import { useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import {
    Avatar,
    AvatarGroup,
    Box,
    Chip,
    List,
    ListItem,
    ListItemContent,
    Stack,
    Typography,
} from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { Milestone, MilestoneStatus } from "../../../sprint-milestone/types";
import {
    getMilestoneStatusChipColor,
    selectVisibleMilestones,
} from "../../../sprint-milestone/utils/sortMilestones";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type Props = {
    currentProjectId: number;
    usePM: ProjectManagementState;
    useSM: SprintMilestoneManagementState;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
};

export const MilestonesListItem = ({
    currentProjectId,
    usePM,
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
    const { t } = useTranslation();

    const sprints = useSM.projectSprints[currentProjectId] ?? [];

    const milestones: Milestone[] = useMemo(
        () => selectVisibleMilestones(useSM.projectMilestones[currentProjectId] ?? [], sprints),
        [useSM.projectMilestones, currentProjectId, sprints]
    );

    const handleOpen = async (milestoneId: number) => {
        // If the clicked milestone belongs to a different project than the
        // one currently in focus, switch projects first. MilestonePreviewInner
        // resolves the milestone via `useSM.projectMilestones[currentProject.projectId]`
        // (TaskPreview.tsx:913-919), so without the switch it would never find
        // the milestone and would fall back to the "Loading milestone…" branch
        // that auto-closes after 3s.
        const needsProjectSwitch = currentProjectId !== usePM.currentProject?.projectId;
        if (needsProjectSwitch) {
            const target = usePM.teamProjects?.find((p) => p.projectId === currentProjectId);
            if (!target) return;
            // Close the existing preview first: while `isTaskPreviewVisible`
            // is true, useTaskRouting's URL-update effect skips its navigate(),
            // which leaves `targetUrlProjectId.current` stale and lets the
            // enforce-match effect revert the project switch.
            useTM.closeTaskPreview();
            useTM.setTableMilestoneFilterId(null);
            useTM.setAllTasks([]);
            await usePM.loadProjectsAndTasks(currentProjectId);
            usePM.setCurrentProject({
                projectId: target.projectId,
                projectName: target.projectName,
                projectTags: target.projectTags || [],
                isPrivate: target.isPrivate,
                systemUserId: target.systemUserId,
            });
        }

        // Open the milestone preview AND scope the task table to this
        // milestone (its backing task as the root + its children).
        // Re-clicking a milestone in the same project toggles the
        // table-scope off again; a cross-project click always scopes-on.
        const isAlreadyScoped =
            !needsProjectSwitch && useTM.tableMilestoneFilterId === milestoneId;
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
        useTM.setIsTaskTableVisible(false);
    };

    if (milestones.length === 0) {
        return (
            <List sx={{ gap: 0.25 }}>
                <AddMilestoneRow isDark={isDark} onClick={handleAddMilestone} />
            </List>
        );
    }

    return (
        <List sx={{ gap: 0.25 }}>
            {milestones.map((m) => {
                const sprintName =
                    m.sprintId == null
                        ? t.tasks.sidebar.noSprint
                        : (sprints.find((s) => s.sprintId === m.sprintId)?.name ??
                          t.tasks.sidebar.sprintFallback);
                return (
                    <ListItem key={m.milestoneId} sx={{ pl: 0, pr: 1 }}>
                        <ListItemButton
                            sx={{ borderRadius: 8, ml: 5, py: 0.5, pr: 0.5 }}
                            selected={
                                useTM.currentPreviewKind === "milestone" &&
                                useTM.currentPreviewMilestoneId === m.milestoneId
                            }
                            onClick={() => handleOpen(m.milestoneId)}
                        >
                            <FlagRoundedIcon sx={{ fontSize: 14, color: "#f97316", mr: 0.75 }} />
                            <ListItemContent>
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    spacing={0.5}
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
                                    alignItems="center"
                                    direction="row"
                                    spacing={0.5}
                                    sx={{ mt: 0.25 }}
                                >
                                    <Chip size="sm" variant="outlined">
                                        {sprintName}
                                    </Chip>
                                    {(() => {
                                        const tone = getMilestoneStatusChipColor(m.status);
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
                                                    showPulseDot={false}
                                                    socket={socket}
                                                    useCM={useCM}
                                                    useUISM={useUISM}
                                                />
                                            ) : (
                                                <Avatar
                                                    key={userIdKey || `idx-${a.username}`}
                                                    sx={{ fontSize: 10 }}
                                                    src={
                                                        a.profileImageUrl
                                                            ? `${media_url}/${a.profileImageUrl}`
                                                            : undefined
                                                    }
                                                >
                                                    {(a.username?.[0] || "?").toUpperCase()}
                                                </Avatar>
                                            );
                                        })}
                                    </AvatarGroup>
                                </Stack>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>
                );
            })}
            <AddMilestoneRow isDark={isDark} onClick={handleAddMilestone} />
        </List>
    );
};

const AddMilestoneRow = ({ onClick, isDark }: { onClick: () => void; isDark: boolean }) => {
    const { t } = useTranslation();
    return (
        <ListItem sx={{ pl: 0 }}>
            <ListItemButton sx={{ borderRadius: 8, ml: 5, py: 0.5 }} onClick={onClick}>
                <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />
                <Typography
                    level="body-sm"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                    }}
                >
                    {t.tasks.sidebar.addMilestone}
                </Typography>
            </ListItemButton>
        </ListItem>
    );
};
