import { useEffect, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { Box, Chip, Grid, IconButton, List, ListItem, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { TagListProps, TaskProps } from "../../../../../types/tasks";
import {
    LinkedBranch,
    loadLinkedBranches,
    loadLinkedPulls,
} from "../../../../integrations/services/github";
import { extractPrUrlsFromBlocks } from "../../../../integrations/utils/extractPrUrls";
import { parsePrUrl } from "../../../../integrations/utils/parsePrUrl";
import { loadSpecificTask } from "../../../services/loadSpecificTask";
import { SprintMilestonePicker } from "../../../sprint-milestone/components/SprintMilestonePicker";
import { ACProjectTags } from "../../autocompletes/ACProjectTags";
import { ACTaskEffortLevel } from "../../autocompletes/ACTaskEffortLevel";
import { ACTaskPriority } from "../../autocompletes/ACTaskPriority";
import { ACTaskStatus } from "../../autocompletes/ACTaskStatus";
import { ACTeamProjects } from "../../autocompletes/ACTeamProjects";
import { ACTeamUsers } from "../../autocompletes/ACTeamUsers";
import { CopyableTaskIdChip } from "../../CopyableTaskId";
import { ModalManageTags } from "../../modals/ModalManageTags";
import { DynamicURLManager } from "./sub/DynamicURLManager";
import { TaskDueDateInput } from "./sub/TaskDueDateInput";

// Label component for consistent styling
const FieldLabel = ({ children, isDark }: { children: React.ReactNode; isDark: boolean }) => (
    <Typography
        level="body-sm"
        sx={{
            minWidth: "85px",
            fontWeight: 500,
            fontSize: "0.8rem",
            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
        }}
    >
        {children}
    </Typography>
);

type TaskMainBlockProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    projectTags: TagListProps[];
    setProjectTags: (tags: TagListProps[]) => void;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    assignee: UserProps;
    setAssignee: (value: UserProps) => void;
    reporter: UserProps;
    setReporter: (value: UserProps) => void;
    isOpenTeamMembersList: boolean;
    setIsOpenTeamMembersList: (value: boolean) => void;
    isOpenProjectList: boolean;
    setIsOpenProjectList: (value: boolean) => void;
    isOpenTagList: boolean;
    setIsOpenTagList: (value: boolean) => void;
    isPreviewMode: boolean;
    setTaskUpdated?: (value: boolean) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    setTaskStatusUpdated?: (value: boolean) => void;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useSM?: SprintMilestoneManagementState;
    // When true, this block is rendering a milestone (preview or
    // create). The sprint picker takes over (a milestone _picks_ a
    // sprint) and the milestone picker is hidden. Picking a sprint
    // also propagates the sprint end date onto the due-date field so
    // milestone deadlines stay aligned with the sprint window.
    //
    // When false (a regular task), only the milestone picker is shown;
    // the sprint is implicit because a task always inherits the sprint
    // from its parent milestone.
    isMilestone?: boolean;
    // When true, this block is rendering a sub-task (a child of a
    // regular, non-milestone task). The Sprint/Milestone row is hidden
    // entirely because a sub-task always inherits both from its parent
    // chain — there's nothing meaningful for the user to pick here.
    isSubTask?: boolean;
};

export const TaskMainBlock = (props: TaskMainBlockProps) => {
    const {
        useTEM,
        socket,
        taskContent,
        setTaskContent,
        projectTags,
        setProjectTags,
        myself,
        setMyself,
        assignee,
        setAssignee,
        reporter,
        setReporter,
        isOpenTeamMembersList,
        setIsOpenTeamMembersList,
        isOpenProjectList,
        setIsOpenProjectList,
        isOpenTagList,
        setIsOpenTagList,
        isPreviewMode,
        setTaskUpdated,
        useUISM,
        useCM,
        useTM,
        setTaskStatusUpdated,
        usePM,
        useSM,
        isMilestone,
        isSubTask,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const [openManageTags, setOpenManageTags] = useState(false);
    const [parentTask, setParentTask] = useState<TaskProps>();
    const [linkedBranches, setLinkedBranches] = useState<LinkedBranch[]>([]);
    useEffect(() => {
        (async () => {
            if (taskContent.project && taskContent.parentTaskId != null) {
                const parentTaskResult: TaskProps[] = await loadSpecificTask(
                    myself,
                    taskContent.project.projectId,
                    taskContent.parentTaskId,
                    accessToken
                );
                if (parentTaskResult.length === 1) {
                    setParentTask(parentTaskResult[0]);
                } else {
                    setParentTask(undefined);
                }
            } else {
                setParentTask(undefined);
            }
        })();
    }, [taskContent]);

    // Auto-discover branches whose name contains this task's display ID
    // (e.g. "feature/GEN-42-foo" for task GEN-42). Only meaningful once
    // the task has a project-scoped ID — orphan tasks fall back to
    // "#<id>" which would alias every task in the team. Scan once per
    // task open; refresh is implicit on re-open.
    useEffect(() => {
        let cancelled = false;
        const displayId = taskContent.displayId;
        if (!taskContent.id || !displayId || displayId.startsWith("#")) {
            setLinkedBranches([]);
            return;
        }
        (async () => {
            const branches = await loadLinkedBranches(accessToken, taskContent.id!);
            if (!cancelled) setLinkedBranches(branches);
        })();
        return () => {
            cancelled = true;
        };
    }, [taskContent.id, taskContent.displayId, accessToken]);

    // Mirror auto-linked PR URLs (PRs whose head branch matches this
    // task's display ID) into `taskContent.links`. Parallels the body-
    // mirror effect below, but the source is the `pulls-for-task`
    // endpoint instead of the BlockNote document. Add-only: if the user
    // deletes the auto-appended link from the Links section, it stays
    // deleted until the task is re-opened (matching the existing
    // body-mirror's "add-only" semantics — silently re-adding deletes
    // would be surprising).
    //
    // We use a ref to track URLs we've already appended in this mount
    // so back-to-back fetches (e.g. due to render churn) don't re-add
    // the same URL after a user deletion within the same task open.
    const appendedPrUrlsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        // Reset the dedup set when the previewed task changes — a fresh
        // task open should re-evaluate its own auto-link set.
        appendedPrUrlsRef.current = new Set();
    }, [taskContent.id]);
    useEffect(() => {
        let cancelled = false;
        const displayId = taskContent.displayId;
        if (!taskContent.id || !displayId || displayId.startsWith("#")) return;
        (async () => {
            const pulls = await loadLinkedPulls(accessToken, taskContent.id!);
            if (cancelled || pulls.length === 0) return;
            const existingUrls = new Set((taskContent.links ?? []).map((l) => l.url));
            const newPulls = pulls.filter(
                (p) => !existingUrls.has(p.html_url) && !appendedPrUrlsRef.current.has(p.html_url)
            );
            if (newPulls.length === 0) return;
            const newLinks = newPulls.map((p) => ({
                id: `link-pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                url: p.html_url,
                title: `${p.owner}/${p.repo}#${p.number}`,
                isGitHub: true,
            }));
            for (const p of newPulls) appendedPrUrlsRef.current.add(p.html_url);
            setTaskContent({
                ...taskContent,
                links: [...(taskContent.links ?? []), ...newLinks],
            });
            setTaskUpdated?.(true);
        })();
        return () => {
            cancelled = true;
        };
        // Watch taskContent.id / displayId / accessToken — re-running
        // when `links` changes would loop (we mutate it inside).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskContent.id, taskContent.displayId, accessToken]);

    // Mirror PR URLs from the BlockNote task body into the Links list so
    // the LinkedPrCard appears in the metadata panel automatically — no
    // double-entry.
    //
    // Debounced: the body changes on every keystroke and we don't want
    // to re-render the entire task panel that often. The timer resets
    // each keystroke, so the scan + setTaskContent only fire ~1s after
    // typing pauses. Add-only — deleting a PR URL from the body leaves
    // the link entry intact (silent removal would be surprising; the
    // existing DynamicURLManager handles deletes).
    useEffect(() => {
        const handle = setTimeout(() => {
            const prUrls = extractPrUrlsFromBlocks(taskContent.body);
            if (prUrls.length === 0) return;
            const existing = new Set((taskContent.links ?? []).map((l) => l.url));
            const newUrls = prUrls.filter((u) => !existing.has(u));
            if (newUrls.length === 0) return;
            const newLinks = newUrls.map((url) => {
                const ref = parsePrUrl(url);
                const title = ref ? `${ref.owner}/${ref.repo}#${ref.number}` : url;
                return {
                    id: `link-pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    url,
                    title,
                    isGitHub: true,
                };
            });
            setTaskContent({
                ...taskContent,
                links: [...(taskContent.links ?? []), ...newLinks],
            });
            setTaskUpdated?.(true);
        }, 1000);
        return () => clearTimeout(handle);
        // Watch the body only — we read links inside the effect to
        // dedupe, but listing links in deps would loop (we mutate them
        // here, that re-triggers the effect, infinite).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskContent.body]);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
            }}
        >
            <List
                sx={{
                    gap: 0.5,
                    p: 0,
                    "--ListItem-paddingY": "6px",
                    "--ListItem-paddingX": "0px",
                }}
            >
                {/* Assignee */}
                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                    <FieldLabel isDark={isDark}>{t.tasks.fields.assignee}</FieldLabel>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            width: "40%",
                        }}
                    >
                        <AvatarWithStatus
                            avatarUser={useTEM.teamMemberProfiles[assignee.userId]}
                            useCM={useCM}
                            isYou={myself.userId === assignee.userId}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useUISM={useUISM}
                        />
                        <ACTeamUsers
                            useCM={useCM}
                            initialUser={taskContent.assignee}
                            isAssignee={true}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            myself={myself}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            setMyself={setMyself}
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            setUser={setAssignee}
                            socket={socket}
                            taskContent={taskContent}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                </ListItem>

                {/* Reporter */}
                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                    <FieldLabel isDark={isDark}>{t.tasks.fields.reporter}</FieldLabel>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "40%" }}>
                        <AvatarWithStatus
                            avatarUser={useTEM.teamMemberProfiles[reporter.userId]}
                            useCM={useCM}
                            isYou={myself.userId === reporter.userId}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useUISM={useUISM}
                        />
                        <ACTeamUsers
                            useCM={useCM}
                            initialUser={taskContent.reporter}
                            isAssignee={false}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            myself={myself}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            setMyself={setMyself}
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            setUser={setReporter}
                            socket={socket}
                            taskContent={taskContent}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                </ListItem>

                {/* Project and Tags Row */}
                <Grid spacing={1} container sx={{ mt: 0.5 }}>
                    <Grid xs={6}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <FieldLabel isDark={isDark}>{t.tasks.fields.project}</FieldLabel>
                            <ACTeamProjects
                                isOpenProjectList={isOpenProjectList}
                                setIsOpenProjectList={setIsOpenProjectList}
                                setTaskContent={setTaskContent}
                                setTaskUpdated={setTaskUpdated}
                                taskContent={taskContent}
                                usePM={usePM}
                            />
                        </ListItem>
                    </Grid>
                    <Grid xs={6}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <Typography
                                level="body-sm"
                                sx={{
                                    minWidth: "40px",
                                    fontWeight: 500,
                                    fontSize: "0.8rem",
                                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                                }}
                            >
                                Tags
                            </Typography>
                            <Tooltip
                                size="sm"
                                title={t.tasks.tooltips.createNewTag}
                                variant="outlined"
                            >
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        borderRadius: "8px",
                                        minWidth: 28,
                                        minHeight: 28,
                                        color: isDark
                                            ? "rgba(255,255,255,0.5)"
                                            : "rgba(0,0,0,0.45)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(255,255,255,0.08)"
                                                : "rgba(0,0,0,0.06)",
                                            color: isDark
                                                ? "rgba(255,255,255,0.8)"
                                                : "rgba(0,0,0,0.7)",
                                        },
                                    }}
                                    onClick={() => useTM.setOpenCreateTag(true)}
                                >
                                    <AddRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Tooltip>
                            <Tooltip
                                size="sm"
                                title={t.tasks.tooltips.manageTags}
                                variant="outlined"
                            >
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        borderRadius: "8px",
                                        minWidth: 28,
                                        minHeight: 28,
                                        color: isDark
                                            ? "rgba(255,255,255,0.5)"
                                            : "rgba(0,0,0,0.45)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(255,255,255,0.08)"
                                                : "rgba(0,0,0,0.06)",
                                            color: isDark
                                                ? "rgba(255,255,255,0.8)"
                                                : "rgba(0,0,0,0.7)",
                                        },
                                    }}
                                    onClick={() => setOpenManageTags(true)}
                                >
                                    <SettingsRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Tooltip>
                            <ModalManageTags
                                myself={myself}
                                usePM={usePM}
                                useTM={useTM}
                                open={openManageTags}
                                onClose={() => setOpenManageTags(false)}
                                projectTags={projectTags}
                                setProjectTags={setProjectTags}
                            />
                            <ACProjectTags
                                isOpenTagList={isOpenTagList}
                                projectTags={projectTags}
                                setIsOpenTagList={setIsOpenTagList}
                                setTaskContent={setTaskContent}
                                setTaskUpdated={setTaskUpdated}
                                taskContent={taskContent}
                            />
                        </ListItem>
                    </Grid>
                </Grid>

                {/* Sprint / Milestone Row.
                    - Milestones pick a Sprint (and inherit the sprint
                      end date as their due date).
                    - Tasks pick a Milestone (and the milestone is the
                      source of truth for the sprint linkage).
                    - Sub-tasks hide this row entirely: they always
                      inherit sprint/milestone from the parent chain,
                      so there's nothing for the user to pick. */}
                {useSM && !isSubTask && (
                    <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                        <FieldLabel isDark={isDark}>
                            {isMilestone ? "Sprint" : "Milestone"}
                        </FieldLabel>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <SprintMilestonePicker
                                projectId={taskContent?.project?.projectId}
                                useSM={useSM}
                                sprintId={(taskContent as any)?.sprintId ?? null}
                                milestoneId={(taskContent as any)?.milestoneId ?? null}
                                showSprint={isMilestone === true}
                                showMilestone={isMilestone !== true}
                                onChangeSprint={(sid) => {
                                    // For milestones, syncing the
                                    // sprint also pushes its end date
                                    // onto the due-date field so the
                                    // two stay aligned without manual
                                    // bookkeeping.
                                    let nextDueDate = taskContent.dueDate;
                                    if (isMilestone && sid != null) {
                                        const projectId = taskContent?.project?.projectId;
                                        const sprint = projectId
                                            ? (useSM.projectSprints[projectId] ?? []).find(
                                                  (s) => s.sprintId === sid
                                              )
                                            : undefined;
                                        if (sprint) nextDueDate = sprint.endDate;
                                    }
                                    setTaskContent({
                                        ...(taskContent as any),
                                        sprintId: sid,
                                        dueDate: nextDueDate,
                                    } as TaskProps);
                                    setTaskUpdated?.(true);
                                }}
                                onChangeMilestone={(mid, taskId, autoSyncedSprint) => {
                                    // Picking a milestone may also
                                    // auto-sync the sprint linkage —
                                    // both updates MUST land in a
                                    // single `setTaskContent` call so
                                    // they don't clobber each other
                                    // inside the same React batch
                                    // (see the picker's
                                    // `onChangeMilestone` doc).
                                    setTaskContent({
                                        ...(taskContent as any),
                                        milestoneId: mid,
                                        parentTaskId: taskId, // Changing the milestone -> changing the parent task too.
                                        ...(autoSyncedSprint
                                            ? { sprintId: autoSyncedSprint.sprintId }
                                            : {}),
                                    } as TaskProps);
                                    setTaskUpdated?.(true);
                                }}
                            />
                        </Box>
                    </ListItem>
                )}

                {/* Priority and Effort Level Row */}
                <Grid spacing={1} container>
                    <Grid xs={6}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <FieldLabel isDark={isDark}>{t.tasks.fields.priority}</FieldLabel>
                            <ACTaskPriority
                                setTaskContent={setTaskContent}
                                setTaskUpdated={setTaskUpdated}
                                taskContent={taskContent}
                            />
                        </ListItem>
                    </Grid>
                    <Grid xs={6}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <Typography
                                level="body-sm"
                                sx={{
                                    minWidth: "90px",
                                    fontWeight: 500,
                                    fontSize: "0.8rem",
                                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                                }}
                            >
                                Effort Level
                            </Typography>
                            <ACTaskEffortLevel
                                setTaskContent={setTaskContent}
                                setTaskUpdated={setTaskUpdated}
                                taskContent={taskContent}
                            />
                        </ListItem>
                    </Grid>
                </Grid>

                {/* Status (only in preview mode) */}
                {isPreviewMode && (
                    <ListItem sx={{ display: "flex", alignItems: "center", width: "49%" }}>
                        <FieldLabel isDark={isDark}>{t.tasks.fields.status}</FieldLabel>
                        <ACTaskStatus
                            setTaskContent={setTaskContent}
                            setTaskStatusUpdated={setTaskStatusUpdated}
                            setTaskUpdated={setTaskUpdated}
                            socket={socket}
                            taskContent={taskContent}
                        />
                    </ListItem>
                )}

                {/* Due Date */}
                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                    <FieldLabel isDark={isDark}>{t.tasks.fields.dueDate}</FieldLabel>
                    <TaskDueDateInput
                        setTaskContent={setTaskContent}
                        setTaskUpdated={setTaskUpdated}
                        taskContent={taskContent}
                    />
                </ListItem>

                {/* Links */}
                <ListItem sx={{ display: "flex", alignItems: "flex-start" }}>
                    <FieldLabel isDark={isDark}>{t.tasks.fields.links}</FieldLabel>
                    <DynamicURLManager
                        setTaskContent={setTaskContent}
                        setTaskUpdated={setTaskUpdated}
                        taskContent={taskContent}
                    />
                </ListItem>

                {/* Linked branches — auto-discovered branches whose names
                    contain the task's display ID. Read-only chips that
                    open the branch on GitHub. Hidden when none match. */}
                {linkedBranches.length > 0 && (
                    <ListItem sx={{ display: "flex", alignItems: "flex-start" }}>
                        <FieldLabel isDark={isDark}>{t.tasks.fields.branches}</FieldLabel>
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 0.5,
                                flex: 1,
                            }}
                        >
                            {linkedBranches.map((b) => (
                                <Tooltip
                                    key={`${b.owner}/${b.repo}/${b.name}`}
                                    title={`${b.owner}/${b.repo}`}
                                    variant="outlined"
                                    placement="top"
                                    arrow
                                >
                                    <Chip
                                        component="a"
                                        href={b.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        size="sm"
                                        variant="outlined"
                                        sx={{
                                            borderRadius: "6px",
                                            fontFamily: "monospace",
                                            fontSize: "0.7rem",
                                            px: 1,
                                            cursor: "pointer",
                                            background: isDark
                                                ? "rgba(255,255,255,0.04)"
                                                : "rgba(0,0,0,0.03)",
                                            borderColor: isDark
                                                ? "rgba(255,255,255,0.1)"
                                                : "rgba(0,0,0,0.1)",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(255,255,255,0.08)"
                                                    : "rgba(0,0,0,0.06)",
                                            },
                                        }}
                                    >
                                        {b.name}
                                    </Chip>
                                </Tooltip>
                            ))}
                        </Box>
                    </ListItem>
                )}

                {/* Parent Task (only if exists) */}
                {parentTask !== undefined && (
                    <ListItem sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1}
                            sx={{ width: "100%" }}
                        >
                            <FieldLabel isDark={isDark}>{t.tasks.fields.parentTask}</FieldLabel>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    p: 1,
                                    borderRadius: "10px",
                                    background: isDark
                                        ? "rgba(255,255,255,0.03)"
                                        : "rgba(0,0,0,0.025)",
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.05)",
                                    flex: 1,
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(255,255,255,0.05)"
                                            : "rgba(0,0,0,0.04)",
                                        borderColor: isDark
                                            ? "rgba(255,255,255,0.1)"
                                            : "rgba(0,0,0,0.08)",
                                    },
                                }}
                                onClick={() => {
                                    if (
                                        parentTask.project &&
                                        parentTask.project.projectId &&
                                        parentTask.id
                                    ) {
                                        usePM.setCurrentProject({
                                            projectId: parentTask.project.projectId,
                                            projectName: parentTask.project.projectName,
                                            projectTags: parentTask.tags,
                                            systemUserId: parentTask.project.systemUserId,
                                        });
                                        useTM.setCurrentPreviewTaskId(parentTask.id);
                                    }
                                }}
                            >
                                <AvatarWithStatus
                                    avatarUser={useTEM.teamMemberProfiles[assignee.userId]}
                                    useCM={useCM}
                                    isYou={myself.userId === assignee.userId}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useUISM={useUISM}
                                />
                                <CopyableTaskIdChip
                                    task={parentTask}
                                    size="sm"
                                    variant="outlined"
                                    sx={{
                                        borderRadius: "6px",
                                        fontWeight: 600,
                                        fontSize: "0.7rem",
                                        px: 1,
                                        background: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.03)",
                                        borderColor: isDark
                                            ? "rgba(255,255,255,0.1)"
                                            : "rgba(0,0,0,0.1)",
                                    }}
                                />
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        borderRadius: "6px",
                                        fontWeight: 600,
                                        fontSize: "0.7rem",
                                        px: 1,
                                        backgroundColor: parentTask.status.color
                                            ? alpha(parentTask.status.color, isDark ? 0.2 : 0.15)
                                            : "transparent",
                                        color: isDark
                                            ? alpha(parentTask.status.color || "#fff", 0.9)
                                            : parentTask.status.color || "#000",
                                        border: "1px solid",
                                        borderColor: alpha(
                                            parentTask.status.color || "#666",
                                            isDark ? 0.25 : 0.2
                                        ),
                                    }}
                                >
                                    {parentTask.status.status}
                                </Chip>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        flex: 1,
                                    }}
                                    noWrap
                                >
                                    {parentTask.title}
                                </Typography>
                            </Box>
                        </Stack>
                    </ListItem>
                )}
            </List>
        </Box>
    );
};
