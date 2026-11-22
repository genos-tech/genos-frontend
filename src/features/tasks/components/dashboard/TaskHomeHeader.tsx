import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import { IconButton, Option, Select, Stack } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { DataState } from "../../../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { useTranslation } from "../../../../i18n";
import { projectAvatarSrc } from "../../utils/projectAvatar";
import { ProjectIdentityRow } from "../ProjectIdentityRow";
import type { TaskDashboardTab, TaskHomeContentProps } from "./taskHomeTypes";
import type { TaskHomeData } from "./useTaskHomeData";

/** The tabs whose numbers follow the picked project and sprint. Today and Agent activity do not. */
const PROJECT_SCOPED_TABS: readonly TaskDashboardTab[] = ["project", "milestones", "people"];

type TaskHomeHeaderProps = Pick<
    TaskHomeData,
    | "activeTab"
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
    activeTab,
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
            {/* The project and sprint toolbar: one flat row, only on the tabs they change. Today
                and Agent activity cover every project, so no project is shown there (MIP-1963). */}
            {usePM.currentProject ? (
                PROJECT_SCOPED_TABS.includes(activeTab) && (
                    <Stack
                        alignItems={{ xs: "stretch", sm: "center" }}
                        data-testid="task-dashboard-toolbar"
                        direction={{ xs: "column", sm: "row" }}
                        flexWrap="wrap"
                        gap={1}
                    >
                        <Select
                            aria-label={t.tasks.dashboard.currentProject}
                            indicator={<KeyboardArrowDownRoundedIcon />}
                            // The listbox rows carry the full project identity (avatar, labels,
                            // lock, name); the closed control shows the name, hence `renderValue`
                            // reading each Option's `label` rather than its rich children.
                            renderValue={(selected) => selected?.label ?? ""}
                            size="sm"
                            value={usePM.currentProject.projectId}
                            startDecorator={
                                pmChat ? (
                                    <ProjectAvatar
                                        avatarSize={20}
                                        myself={myself}
                                        pmChat={pmChat}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useCM={useCM}
                                        useTEM={useTEM}
                                        useUISM={useUISM}
                                    />
                                ) : (
                                    <WorkRoundedIcon sx={{ fontSize: 18 }} />
                                )
                            }
                            sx={{
                                minWidth: { xs: 0, sm: 200 },
                                maxWidth: { sm: 280 },
                                width: { xs: "100%", sm: "auto" },
                                fontWeight: 600,
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
                                            project.projectId === usePM.currentProject?.projectId
                                                ? 600
                                                : 500
                                        }
                                    />
                                </Option>
                            ))}
                        </Select>

                        <Select<number | string>
                            aria-label={t.tasks.dashboard.pickASprint}
                            indicator={<KeyboardArrowDownRoundedIcon />}
                            size="sm"
                            startDecorator={<CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />}
                            value={selectedSprint?.sprintId ?? null}
                            placeholder={
                                projectSprints.length === 0
                                    ? t.tasks.dashboard.noSprintsConfigure
                                    : t.tasks.dashboard.pickASprint
                            }
                            sx={{
                                minWidth: { xs: 0, sm: 220 },
                                width: { xs: "100%", sm: "auto" },
                                fontWeight: 600,
                            }}
                            onChange={(_, value) => {
                                if (value === null || value === undefined) {
                                    useSM.setCurrentSprint(null);
                                    return;
                                }
                                if (typeof value === "string") return;
                                const found = projectSprints.find((s) => s.sprintId === value);
                                if (found) useSM.setCurrentSprint(found);
                            }}
                        >
                            {(["current", "upcoming", "past"] as const).map((bucket) => {
                                const list = groupedSprints[bucket];
                                if (list.length === 0) return null;
                                return [
                                    <Option
                                        key={`hdr-${bucket}`}
                                        sx={{ opacity: 0.6, fontSize: "0.75rem" }}
                                        value={`__hdr_${bucket}`}
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
                        <Stack alignItems="center" direction="row" spacing={0.5}>
                            <AppTooltip title={t.tasks.dashboard.sprintSettingsTooltip}>
                                <IconButton
                                    aria-label={t.tasks.dashboard.sprintSettingsTooltip}
                                    disabled={!usePM.currentProject?.projectId}
                                    size="sm"
                                    variant="plain"
                                    onClick={() => setSprintConfigOpen(true)}
                                >
                                    <SettingsRoundedIcon />
                                </IconButton>
                            </AppTooltip>
                            <AppTooltip title={t.tasks.dashboard.manageSprintsTooltip}>
                                <IconButton
                                    aria-label={t.tasks.dashboard.manageSprintsTooltip}
                                    disabled={!usePM.currentProject?.projectId}
                                    size="sm"
                                    variant="plain"
                                    onClick={() => setSprintManagerOpen(true)}
                                >
                                    <TuneRoundedIcon />
                                </IconButton>
                            </AppTooltip>
                        </Stack>
                    </Stack>
                )
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
