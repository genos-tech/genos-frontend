import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import { Box, Card, IconButton, Option, Select, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { DataState } from "../../../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { useTranslation } from "../../../../i18n";
import { projectAvatarSrc } from "../../utils/projectAvatar";
import { ProjectIdentityRow } from "../ProjectIdentityRow";
import type { TaskHomeContentProps } from "./taskHomeTypes";
import type { TaskHomeData } from "./useTaskHomeData";

type TaskHomeHeaderProps = Pick<
    TaskHomeData,
    | "isDark"
    | "projectsSync"
    | "setSprintConfigOpen"
    | "setSprintManagerOpen"
    | "projectSprints"
    | "groupedSprints"
    | "selectedSprint"
    | "joinedProjects"
    | "handleProjectChange"
> &
    Pick<
        TaskHomeContentProps,
        "usePM" | "useTEM" | "useSM" | "myself" | "setMyself" | "useCM" | "useUISM" | "socket"
    >;

export const TaskHomeHeader = ({
    isDark,
    projectsSync,
    setSprintConfigOpen,
    setSprintManagerOpen,
    projectSprints,
    groupedSprints,
    selectedSprint,
    joinedProjects,
    handleProjectChange,
    usePM,
    useTEM,
    useSM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
}: TaskHomeHeaderProps) => {
    const { t } = useTranslation();
    // Find the PM chat mirroring the focused project so its avatar renders
    // (else the generic WorkRoundedIcon fallback below shows). Post
    // v3-migration `chat.chatId` is the Channel UUID, not the numeric
    // project id, so the old `chatId === String(projectId)` match never hit.
    // Match on `chat.project.projectId` like `HistoryModal` /
    // `notificationRouter` / the task header.
    const pmChat = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            usePM.currentProject != null &&
            chat.project?.projectId === usePM.currentProject.projectId
    );

    return (
        <>
            {/* ════════ Section A: Sprint Summary Header ════════ */}
            {usePM.currentProject ? (
                <Card
                    variant="soft"
                    sx={{
                        p: 3,
                        background: isDark
                            ? "linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(234,88,12,0.08) 100%)"
                            : "linear-gradient(135deg, rgba(251,146,60,0.06) 0%, rgba(234,88,12,0.06) 100%)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(251,146,60,0.2)" : "rgba(251,146,60,0.15)",
                    }}
                >
                    <Stack spacing={2.5}>
                        {/* Project selector + sprint selector row */}
                        <Stack
                            alignItems="center"
                            direction="row"
                            flexWrap="wrap"
                            gap={2}
                            justifyContent="space-between"
                        >
                            <Stack alignItems="center" direction="row" spacing={1.5}>
                                <Box
                                    sx={{
                                        width: 50,
                                        height: 50,
                                        borderRadius: "10px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: isDark
                                            ? "rgba(251,146,60,0.15)"
                                            : "rgba(251,146,60,0.12)",
                                    }}
                                >
                                    {pmChat && (
                                        <ProjectAvatar
                                            avatarSize={46}
                                            myself={myself}
                                            pmChat={pmChat}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useCM={useCM}
                                            useTEM={useTEM}
                                            useUISM={useUISM}
                                        />
                                    )}
                                    {!pmChat && (
                                        <WorkRoundedIcon
                                            sx={{
                                                fontSize: 22,
                                                color: isDark ? "#fb923c" : "#ea580c",
                                            }}
                                        />
                                    )}
                                </Box>
                                <Box>
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            color: isDark
                                                ? "rgba(255,255,255,0.5)"
                                                : "rgba(0,0,0,0.5)",
                                            fontWeight: 500,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            mb: 0.5,
                                        }}
                                    >
                                        {t.tasks.dashboard.currentProject}
                                    </Typography>
                                    <Select
                                        indicator={<KeyboardArrowDownRoundedIcon />}
                                        // The listbox rows carry the full project
                                        // identity (avatar, labels, lock, name),
                                        // but the CLOSED control keeps showing just
                                        // the name in its accent styling — hence
                                        // `renderValue` reading each Option's
                                        // `label` rather than its rich children.
                                        renderValue={(selected) => selected?.label ?? ""}
                                        value={usePM.currentProject.projectId}
                                        slotProps={{
                                            listbox: {
                                                sx: {
                                                    backgroundColor: isDark
                                                        ? "rgba(30,30,32,0.98)"
                                                        : "rgba(255,255,255,0.98)",
                                                    border: "1px solid",
                                                    borderColor: isDark
                                                        ? "rgba(255,255,255,0.1)"
                                                        : "rgba(0,0,0,0.1)",
                                                },
                                            },
                                        }}
                                        startDecorator={
                                            <SwapHorizRoundedIcon sx={{ fontSize: 18 }} />
                                        }
                                        sx={{
                                            minWidth: 180,
                                            maxWidth: 280,
                                            fontWeight: 700,
                                            fontSize: "1rem",
                                            color: isDark ? "#fb923c" : "#ea580c",
                                            backgroundColor: isDark
                                                ? "rgba(251,146,60,0.1)"
                                                : "rgba(251,146,60,0.08)",
                                            border: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(251,146,60,0.3)"
                                                : "rgba(251,146,60,0.2)",
                                            "&:hover": {
                                                backgroundColor: isDark
                                                    ? "rgba(251,146,60,0.15)"
                                                    : "rgba(251,146,60,0.12)",
                                            },
                                            "& .MuiSelect-indicator": {
                                                color: isDark ? "#fb923c" : "#ea580c",
                                            },
                                        }}
                                        onChange={(_, value) => {
                                            if (value) handleProjectChange(value as number);
                                        }}
                                    >
                                        {joinedProjects.map((project) => (
                                            <Option
                                                key={project.projectId}
                                                label={project.projectName}
                                                value={project.projectId}
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    minWidth: 0,
                                                }}
                                            >
                                                <ProjectIdentityRow
                                                    maxLabels={2}
                                                    project={project}
                                                    avatarSrc={projectAvatarSrc(
                                                        project.projectId,
                                                        useCM.allChats
                                                    )}
                                                    nameWeight={
                                                        project.projectId ===
                                                        usePM.currentProject?.projectId
                                                            ? 700
                                                            : 500
                                                    }
                                                />
                                            </Option>
                                        ))}
                                    </Select>
                                </Box>
                            </Stack>

                            {/* Sprint period selector — on mobile
                    the Select takes a full row and
                    the action icons + progress chip
                    wrap onto the next row so a
                    390px viewport doesn't clip them. */}
                            <Stack
                                alignItems={{ xs: "stretch", sm: "center" }}
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                sx={{ width: "100%" }}
                            >
                                <Select<number | string>
                                    indicator={<KeyboardArrowDownRoundedIcon />}
                                    size="sm"
                                    value={selectedSprint?.sprintId ?? null}
                                    placeholder={
                                        projectSprints.length === 0
                                            ? t.tasks.dashboard.noSprintsConfigure
                                            : t.tasks.dashboard.pickASprint
                                    }
                                    slotProps={{
                                        listbox: {
                                            sx: {
                                                backgroundColor: isDark
                                                    ? "rgba(30,30,32,0.98)"
                                                    : "rgba(255,255,255,0.98)",
                                                border: "1px solid",
                                                borderColor: isDark
                                                    ? "rgba(255,255,255,0.1)"
                                                    : "rgba(0,0,0,0.1)",
                                            },
                                        },
                                    }}
                                    startDecorator={
                                        <CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />
                                    }
                                    sx={{
                                        minWidth: { xs: 0, sm: 220 },
                                        width: { xs: "100%", sm: "auto" },
                                        fontWeight: 600,
                                        color: isDark
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)",
                                        backgroundColor: isDark
                                            ? "rgba(var(--gp-brand-700-rgb), 0.1)"
                                            : "rgba(var(--gp-brand-700-rgb), 0.08)",
                                        border: "1px solid",
                                        borderColor: isDark
                                            ? "rgba(var(--gp-brand-700-rgb), 0.3)"
                                            : "rgba(var(--gp-brand-700-rgb), 0.2)",
                                        "&:hover": {
                                            backgroundColor: isDark
                                                ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                                : "rgba(var(--gp-brand-700-rgb), 0.12)",
                                        },
                                        "& .MuiSelect-indicator": {
                                            color: isDark
                                                ? "var(--gp-brandalt-400)"
                                                : "var(--gp-brand-700)",
                                        },
                                    }}
                                    onChange={(_, value) => {
                                        if (value === null || value === undefined) {
                                            useSM.setCurrentSprint(null);
                                            return;
                                        }
                                        if (typeof value === "string") return;
                                        const found = projectSprints.find(
                                            (s) => s.sprintId === value
                                        );
                                        if (found) useSM.setCurrentSprint(found);
                                    }}
                                >
                                    {(["current", "upcoming", "past"] as const).map((bucket) => {
                                        const list = groupedSprints[bucket];
                                        if (list.length === 0) return null;
                                        return [
                                            <Option
                                                key={`hdr-${bucket}`}
                                                value={`__hdr_${bucket}`}
                                                sx={{
                                                    opacity: 0.6,
                                                    fontSize: "0.75rem",
                                                }}
                                                disabled
                                            >
                                                {bucket === "current"
                                                    ? t.tasks.dashboard.sprintBuckets.current
                                                    : bucket === "upcoming"
                                                      ? t.tasks.dashboard.sprintBuckets.upcoming
                                                      : t.tasks.dashboard.sprintBuckets.past}
                                            </Option>,
                                            ...list.map((s) => (
                                                <Option key={s.sprintId} value={s.sprintId}>
                                                    {s.name} · {s.startDate} → {s.endDate}
                                                </Option>
                                            )),
                                        ];
                                    })}
                                </Select>
                                <Stack alignItems="center" direction="row" spacing={1}>
                                    <AppTooltip title={t.tasks.dashboard.sprintSettingsTooltip}>
                                        <IconButton
                                            disabled={!usePM.currentProject?.projectId}
                                            size="sm"
                                            variant="soft"
                                            onClick={() => setSprintConfigOpen(true)}
                                        >
                                            <SettingsRoundedIcon />
                                        </IconButton>
                                    </AppTooltip>
                                    <AppTooltip title={t.tasks.dashboard.manageSprintsTooltip}>
                                        <IconButton
                                            disabled={!usePM.currentProject?.projectId}
                                            size="sm"
                                            variant="soft"
                                            onClick={() => setSprintManagerOpen(true)}
                                        >
                                            <TuneRoundedIcon />
                                        </IconButton>
                                    </AppTooltip>
                                </Stack>
                            </Stack>
                        </Stack>
                    </Stack>
                </Card>
            ) : (
                /* No Project selected */
                // A project list that failed to load is not "no project selected"
                // (MIP-1298): say so, with Retry.
                <DataState
                    error={projectsSync.failed}
                    hasData={false}
                    loading={projectsSync.retrying}
                    skeleton={<SkeletonRows count={4} />}
                    empty={{
                        body: t.tasks.dashboard.selectProjectForAnalytics,
                        "data-empty": "home-no-project",
                        icon: <WorkRoundedIcon />,
                        title: t.tasks.dashboard.noProjectSelected,
                    }}
                    errorState={{
                        "data-error": "home-no-project",
                        onRetry: projectsSync.retry,
                        title: t.common.feedback.sync.projectsFailed,
                    }}
                />
            )}
        </>
    );
};
