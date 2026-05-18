import { useMemo } from "react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Avatar, AvatarGroup, Box, Card, Chip, LinearProgress, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { Milestone, Sprint } from "../types";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

const STATUS_COLOR: Record<string, string> = {
    Open: "#0044c2",
    WIP: "#ff8c00",
    Pending: "#b900ff",
    Closed: "#1dc200",
    Deleted: "#94a3b8",
};

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
    isDark: boolean;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
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
    isDark,
    textPrimary,
    textSecondary,
    textMuted,
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
                <FlagRoundedIcon sx={{ fontSize: 18, color: isDark ? "#a78bfa" : "#7c3aed" }} />
                <Typography
                    level="title-sm"
                    sx={{
                        fontWeight: 600,
                        color: textPrimary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}
                >
                    {selectedSprint
                        ? fmt(t.tasks.milestones.sectionInSprint, { name: selectedSprint.name })
                        : t.tasks.milestones.sectionNoSprint}
                </Typography>
                <Chip size="sm" variant="soft">
                    {milestones.length}
                </Chip>
            </Stack>
            {milestones.length === 0 ? (
                <Typography level="body-sm" sx={{ color: textMuted }}>
                    {t.tasks.milestones.noMilestones}
                </Typography>
            ) : (
                <Stack spacing={1.25}>
                    {milestones.map((m) => {
                        const total = m.tasksTotal ?? 0;
                        const closed = m.tasksClosed ?? 0;
                        const pct = total > 0 ? Math.round((closed / total) * 100) : 0;
                        const statusColor = STATUS_COLOR[m.status as string] ?? "#94a3b8";
                        return (
                            <Card
                                key={m.milestoneId}
                                variant="outlined"
                                sx={{
                                    p: 1.5,
                                    cursor: "pointer",
                                    "&:hover": {
                                        backgroundColor: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.03)",
                                    },
                                }}
                                onClick={() => handleOpenMilestone(m.milestoneId)}
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
                                        spacing={1}
                                        sx={{ flex: 1, minWidth: 0 }}
                                    >
                                        <Box
                                            sx={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: "50%",
                                                backgroundColor: statusColor,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Typography
                                            level="title-sm"
                                            sx={{
                                                fontWeight: 600,
                                                color: textPrimary,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {m.title || t.tasks.milestones.untitled}
                                        </Typography>
                                        <Chip
                                            size="sm"
                                            variant="soft"
                                            sx={{
                                                color: statusColor,
                                                backgroundColor: `${statusColor}1A`,
                                            }}
                                        >
                                            {m.status}
                                        </Chip>
                                    </Stack>
                                    <Stack alignItems="center" direction="row" spacing={1.5}>
                                        <Typography level="body-xs" sx={{ color: textSecondary }}>
                                            {closed}/{total}
                                        </Typography>
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
                                                        avatarSize={26}
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
                                                        key={userIdKey || `idx-${idx}`}
                                                        alt={a.username ?? ""}
                                                        src={
                                                            a.profileImageUrl
                                                                ? `${media_url}${a.profileImageUrl}`
                                                                : undefined
                                                        }
                                                    >
                                                        {(a.username ?? "?")
                                                            .slice(0, 1)
                                                            .toUpperCase()}
                                                    </Avatar>
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
                            </Card>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
};
