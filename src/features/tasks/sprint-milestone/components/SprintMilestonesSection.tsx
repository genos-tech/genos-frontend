import { useMemo } from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { AvatarGroup, BaseAvatar } from "../../../../components/ui/avatars/BaseAvatar";
import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { MilestoneFlag, TaskCardFrame, TaskIdText, TaskTitle } from "../../components/card";
import { StatusLabel } from "../../components/meta/StatusLabel";
import { Milestone, Sprint } from "../types";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type Props = {
    selectedSprint: Sprint | null;
    projectId: number | undefined;
    useSM: SprintMilestoneManagementState;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
};

export const SprintMilestonesSection = ({
    selectedSprint,
    projectId,
    useSM,
    useTM,
    useTEM,
    useCM,
    useUISM,
    myself,
    setMyself,
    socket,
}: Props) => {
    const { t } = useTranslation();
    const milestones: Milestone[] = useMemo(() => {
        if (!projectId) return [];
        const all = useSM.projectMilestones[projectId] ?? [];
        return all.filter((m) =>
            selectedSprint ? m.sprintId === selectedSprint.sprintId : m.sprintId == null
        );
    }, [projectId, selectedSprint?.sprintId, useSM.projectMilestones]);

    const handleOpenMilestone = (milestoneId: number) => {
        useTM.setCurrentPreviewKind("milestone");
        useTM.setCurrentPreviewMilestoneId(milestoneId);
        useTM.setIsTaskPreviewVisible(true);
    };

    return (
        <Box>
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 2 }}>
                <MilestoneFlag size={18} />
                <Typography
                    level="title-sm"
                    sx={{
                        fontWeight: 600,
                        color: g.text.primary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}
                >
                    {selectedSprint
                        ? fmt(t.tasks.milestones.sectionInSprint, { name: selectedSprint.name })
                        : t.tasks.milestones.sectionNoSprint}
                </Typography>
                <Box
                    component="span"
                    data-testid="sprint-milestones-count"
                    sx={{ ...type("body-sm"), color: g.text.tertiary }}
                >
                    {milestones.length}
                </Box>
            </Stack>
            {milestones.length === 0 ? (
                <EmptyState
                    data-empty="sprint-milestones"
                    size="xs"
                    title={t.tasks.milestones.noMilestones}
                />
            ) : (
                <Stack spacing={1.25}>
                    {milestones.map((m) => {
                        const total = m.tasksTotal ?? 0;
                        const closed = m.tasksClosed ?? 0;
                        const pct = total > 0 ? Math.round((closed / total) * 100) : 0;
                        return (
                            <TaskCardFrame
                                key={m.milestoneId}
                                label={m.title || t.tasks.milestones.untitled}
                                onOpen={() => handleOpenMilestone(m.milestoneId)}
                            >
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    justifyContent="space-between"
                                    spacing={1.5}
                                >
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        spacing={0.75}
                                        sx={{ flex: 1, minWidth: 0 }}
                                    >
                                        <MilestoneFlag size={14} />
                                        <TaskIdText
                                            copyable={false}
                                            text={m.displayId ?? `#${m.milestoneId}`}
                                        />
                                        <Box sx={{ display: "flex", minWidth: 0 }}>
                                            <TaskTitle>
                                                {m.title || t.tasks.milestones.untitled}
                                            </TaskTitle>
                                        </Box>
                                        <StatusLabel status={m.status} />
                                    </Stack>
                                    <Stack alignItems="center" direction="row" spacing={1.5}>
                                        <Box
                                            component="span"
                                            sx={{
                                                ...type("body-xs"),
                                                color: g.text.tertiary,
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {closed}/{total}
                                        </Box>
                                        <AvatarGroup size="sm">
                                            {m.assignees.slice(0, 4).map((a, idx) => {
                                                const userIdKey =
                                                    a.userId != null ? String(a.userId) : "";
                                                const profile = userIdKey
                                                    ? useTEM.teamMemberProfiles[userIdKey]
                                                    : undefined;
                                                // Prefer AvatarWithStatus when we
                                                // can resolve the team-member
                                                // profile (online pulse +
                                                // click-to-profile, and uses the
                                                // freshest avatar URL from the
                                                // team store). Fall back to a
                                                // plain Joy Avatar for legacy
                                                // assignees missing from the
                                                // map (e.g. recently removed
                                                // members).
                                                return profile ? (
                                                    <AvatarWithStatus
                                                        key={userIdKey || `idx-${idx}`}
                                                        avatarSize={32}
                                                        avatarUser={profile}
                                                        isYou={String(myself.userId) === userIdKey}
                                                        myself={myself}
                                                        setMyself={setMyself}
                                                        socket={socket}
                                                        useCM={useCM}
                                                        useUISM={useUISM}
                                                        showPulseDot={false}
                                                    />
                                                ) : (
                                                    <BaseAvatar
                                                        key={userIdKey || `idx-${idx}`}
                                                        alt={a.username ?? ""}
                                                        name={a.username}
                                                        src={
                                                            a.profileImageUrl
                                                                ? `${media_url}${a.profileImageUrl}`
                                                                : undefined
                                                        }
                                                    />
                                                );
                                            })}
                                        </AvatarGroup>
                                    </Stack>
                                </Stack>
                                <Box sx={{ mt: 1 }}>
                                    <LinearProgress
                                        color={pct >= 100 ? "success" : "primary"}
                                        value={pct}
                                        sx={{
                                            "--LinearProgress-thickness": "6px",
                                            "--LinearProgress-radius": "3px",
                                            "--LinearProgress-progressRadius": "3px",
                                        }}
                                        determinate
                                    />
                                </Box>
                            </TaskCardFrame>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
};
