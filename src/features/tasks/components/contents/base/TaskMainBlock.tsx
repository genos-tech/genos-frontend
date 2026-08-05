import { useCallback, useEffect, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { Box, Chip, Grid, IconButton, List, ListItem, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../../../../hooks/common/UrlLinkModalContext";
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
import { getCachedOrFetchPrStatus } from "../../../../integrations/services/prStatusCache";
import { extractPrUrlsFromBlocks } from "../../../../integrations/utils/extractPrUrls";
import { parsePrUrl } from "../../../../integrations/utils/parsePrUrl";
import { loadSpecificTask } from "../../../services/loadSpecificTask";
import { SprintMilestonePicker } from "../../../sprint-milestone/components/SprintMilestonePicker";
import { ACProjectTags } from "../../autocompletes/ACProjectTags";
import { ACTaskEffortLevel } from "../../autocompletes/ACTaskEffortLevel";
import { ACTaskPriority } from "../../autocompletes/ACTaskPriority";
import { StatusChip } from "../../autocompletes/ACTaskSelector";
import { ACTaskStatus } from "../../autocompletes/ACTaskStatus";
import { ACTeamProjects } from "../../autocompletes/ACTeamProjects";
import { ACTeamUsers } from "../../autocompletes/ACTeamUsers";
import { MultiMemberPicker } from "../../autocompletes/MultiMemberPicker";
import { CopyableTaskIdChip } from "../../CopyableTaskId";
import { ModalManageTags } from "../../modals/ModalManageTags";
import { CustomFieldsBlock } from "./CustomFieldsBlock";
import { DynamicURLManager } from "./sub/DynamicURLManager";
import { TaskDueDateInput } from "./sub/TaskDueDateInput";
import { TaskStartDateInput } from "./sub/TaskStartDateInput";
import { isCurrentlyBlocked, TaskDependenciesBlock } from "./TaskDependenciesBlock";

// Single shared label for every row. Pinned width keeps the data
// column flush across rows, the muted color reads as "metadata key"
// without competing with the value next to it.
const FIELD_LABEL_MIN_WIDTH = 96;

const FieldLabel = ({
    children,
    isDark,
    required = false,
}: {
    children: React.ReactNode;
    isDark: boolean;
    // Project-owner rule marks this field required at creation — render
    // the conventional asterisk. Preview mounts never set it.
    required?: boolean;
}) => (
    <Typography
        level="body-sm"
        sx={{
            minWidth: `${FIELD_LABEL_MIN_WIDTH}px`,
            fontWeight: 500,
            fontSize: "0.825rem",
            letterSpacing: "0.01em",
            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
        }}
    >
        {children}
        {required && (
            <Typography component="span" sx={{ color: "#ef4444", ml: 0.25 }}>
                *
            </Typography>
        )}
    </Typography>
);

// Tiny, low-contrast icon button used for actions that should stay
// out of the way (refresh, manage). Lifts opacity + background on
// hover so users still see them respond.
const subtleIconButtonSx = (isDark: boolean) =>
    ({
        "--IconButton-size": "24px",
        minHeight: "24px",
        minWidth: "24px",
        p: 0,
        borderRadius: "6px",
        color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
        opacity: 0.7,
        transition: "opacity 0.15s ease, background 0.15s ease, color 0.15s ease",
        "&:hover": {
            opacity: 1,
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
        },
    }) as const;

// Card surface used for clickable relation rows (Parent task today,
// open for future relations). Centralizes the hover/border treatment
// that was previously inlined in three places with subtly different
// values.
const softCardSx = (isDark: boolean) =>
    ({
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)",
        border: "1px solid",
        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
        borderRadius: "10px",
        transition: "background 0.15s ease, border-color 0.15s ease",
        "&:hover": {
            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        },
    }) as const;

type TaskMainBlockProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    projectTags: TagListProps[];
    setProjectTags: (tags: TagListProps[]) => void;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    assignee: UserProps | null;
    setAssignee: (value: UserProps | null) => void;
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
    // Set when this block renders inside the UrlLinkModal (threaded
    // from ModalTaskView / ModalMilestoneView via TaskPreview). Relation
    // clicks (parent task, dependency chips) then RE-TARGET the modal
    // via openModalByHref instead of mutating the host page's global
    // preview state — which the modal ignores, so without this the
    // clicks silently did nothing.
    hostZIndex?: number;
    // Create-form only: field keys the project owner marked required
    // (already filtered to the rules ACTIVE for this project — e.g. a
    // tags-required rule with zero project tags is excluded). Renders
    // the asterisk on the matching row labels. Preview mounts omit it.
    requiredFields?: string[];
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
        hostZIndex,
        requiredFields,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const urlLinkModal = useUrlLinkModal();
    const isRequired = (field: string) => requiredFields?.includes(field) === true;
    // Only a milestone or a top-level task picks a project; a sub-task's
    // project IS its parent's. See the Project row for why. Create mounts
    // are exempt — the row doesn't exist to the user yet.
    const projectLocked = isSubTask === true && isPreviewMode;

    const [openManageTags, setOpenManageTags] = useState(false);
    const [parentTask, setParentTask] = useState<TaskProps>();
    // Start date is collapsed by default — the user opts in via the `+`
    // affordance in the Due Date row. Reset when switching tasks so each
    // task opens in its own "collapsed unless `startDate` is set" state.
    const [explicitlyShowStartDate, setExplicitlyShowStartDate] = useState(false);
    useEffect(() => {
        setExplicitlyShowStartDate(false);
    }, [taskContent.id]);
    const showStartDate = !!taskContent.startDate || explicitlyShowStartDate;
    const [linkedBranches, setLinkedBranches] = useState<LinkedBranch[]>([]);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (taskContent.project && taskContent.parentTaskId != null) {
                const parentTaskResult: TaskProps[] = await loadSpecificTask(
                    myself,
                    taskContent.project.projectId,
                    taskContent.parentTaskId,
                    accessToken
                );
                if (cancelled) return;
                if (parentTaskResult.length === 1) {
                    setParentTask(parentTaskResult[0]);
                } else {
                    setParentTask(undefined);
                }
            } else {
                setParentTask(undefined);
            }
        })();
        return () => {
            cancelled = true;
        };
        // Depend on the ids the lookup actually uses, not the
        // `taskContent` object: regular mode passes
        // `tmpCurrentTaskContent`, whose identity changes on every
        // edit/autosave cycle — each change re-fired this effect and,
        // whenever the IDB entry had just been invalidated by a save,
        // sent another /task/getTask/ for an unchanged parent.
    }, [taskContent.id, taskContent.parentTaskId, taskContent.project?.projectId]);

    // Auto-discover branches whose name contains this task's display ID
    // (e.g. "feature/GEN-42-foo" for task GEN-42). Only meaningful once
    // the task has a project-scoped ID — orphan tasks fall back to
    // "#<id>" which would alias every task in the team. Scan once per
    // task open; refresh is implicit on re-open.
    // Race guard: any in-flight branches fetch whose token doesn't match
    // the latest one is discarded — covers fast task switches, focus
    // refetches, and manual refresh clicks all overlapping.
    const branchesFetchTokenRef = useRef(0);
    const [branchesRefreshing, setBranchesRefreshing] = useState(false);
    const fetchLinkedBranches = useCallback(
        async (opts?: { bypassCache?: boolean }) => {
            const displayId = taskContent.displayId;
            if (!taskContent.id || !displayId || displayId.startsWith("#")) {
                setLinkedBranches([]);
                return;
            }
            const token = ++branchesFetchTokenRef.current;
            if (opts?.bypassCache) setBranchesRefreshing(true);
            try {
                const branches = await loadLinkedBranches(accessToken, taskContent.id, opts);
                if (token !== branchesFetchTokenRef.current) return;
                setLinkedBranches(branches);
            } finally {
                if (token === branchesFetchTokenRef.current && opts?.bypassCache) {
                    setBranchesRefreshing(false);
                }
            }
        },
        [accessToken, taskContent.id, taskContent.displayId]
    );

    useEffect(() => {
        void fetchLinkedBranches();
    }, [fetchLinkedBranches]);

    // Refetch when the user returns to the window — typical workflow is
    // create a branch on GitHub → alt-tab back → expect to see it here.
    // The server still caches for 60s, so a bare focus doesn't bypass
    // the cache; users can click the refresh icon for an immediate fresh
    // fetch.
    useEffect(() => {
        const onFocus = () => {
            void fetchLinkedBranches();
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [fetchLinkedBranches]);

    // Mirror auto-linked PR URLs (PRs whose head branch matches this
    // task's display ID) into `taskContent.links`. Parallels the body-
    // mirror effect below, but the source is the `pulls-for-task`
    // endpoint instead of the BlockNote document. Two paths:
    //
    //   • **Append** — PR URL isn't in links yet → push a new entry
    //     flagged `isAutoLinked: true`.
    //   • **Upgrade** — PR URL is already in links (because the user
    //     pasted it into the body or Links, OR a manual entry pre-dated
    //     auto-discovery) but lacks the flag → set `isAutoLinked: true`
    //     in place. Without this, a PR whose branch matches the
    //     display_id would lose its PR-column badge once the branch is
    //     deleted post-merge (Source 2 in `pulls-for-task` filters on
    //     the flag).
    //
    // Add/upgrade-only — if the user deletes the entry from the Links
    // section, it stays deleted until the task is re-opened. The ref
    // below tracks every URL we touched this mount (append OR upgrade)
    // so back-to-back fetches (focus refetch, refresh icon, render
    // churn) don't undo user deletions or thrash on the same entry.
    const appendedPrUrlsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        // Reset the touched set when the previewed task changes — a
        // fresh task open should re-evaluate its own auto-link set.
        appendedPrUrlsRef.current = new Set();
    }, [taskContent.id]);

    // Race guard + spinner state for PR discovery, mirroring the
    // branches pattern. The fetch closure is held in a ref and rebuilt
    // each render so it always sees the latest `taskContent.links` —
    // critical because focus refetches can fire long after the initial
    // task-open render and naively closing over `taskContent` would
    // wipe out user-added links on the next setTaskContent.
    const pullsFetchTokenRef = useRef(0);
    const [pullsRefreshing, setPullsRefreshing] = useState(false);
    const fetchLinkedPullsRef = useRef<(opts?: { bypassCache?: boolean }) => Promise<void>>(
        async () => {}
    );
    fetchLinkedPullsRef.current = async (opts?: { bypassCache?: boolean }) => {
        const displayId = taskContent.displayId;
        if (!taskContent.id || !displayId || displayId.startsWith("#")) return;
        const token = ++pullsFetchTokenRef.current;
        if (opts?.bypassCache) setPullsRefreshing(true);
        try {
            const pulls = await loadLinkedPulls(accessToken, taskContent.id, opts);
            if (token !== pullsFetchTokenRef.current) return;
            if (pulls.length === 0) return;
            const existingLinks = taskContent.links ?? [];
            const existingByUrl = new Map(existingLinks.map((l) => [l.url, l]));

            // Split the response into entries to upgrade (already in
            // links but flag-less) and entries to append (not in links
            // at all). Skip anything we've already touched this mount
            // so user deletions stay sticky across focus refetches.
            const toUpgradeUrls = new Set<string>();
            const toAppend: typeof pulls = [];
            for (const p of pulls) {
                if (appendedPrUrlsRef.current.has(p.html_url)) continue;
                const existing = existingByUrl.get(p.html_url);
                if (existing) {
                    if (!existing.isAutoLinked) toUpgradeUrls.add(p.html_url);
                } else {
                    toAppend.push(p);
                }
            }
            if (toUpgradeUrls.size === 0 && toAppend.length === 0) return;

            // The backend's `pulls-for-task` response already carries
            // `title` — prefer it over the synthetic `owner/repo#number`
            // fallback so the Link entry shows the actual PR subject.
            const titleFor = (p: (typeof pulls)[number]): string =>
                p.title || `${p.owner}/${p.repo}#${p.number}`;
            const titleByUrl = new Map(pulls.map((p) => [p.html_url, titleFor(p)]));

            const newLinks = toAppend.map((p) => ({
                id: `link-pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                url: p.html_url,
                title: titleFor(p),
                isGitHub: true,
                isAutoLinked: true,
            }));
            for (const p of toAppend) appendedPrUrlsRef.current.add(p.html_url);
            for (const u of toUpgradeUrls) appendedPrUrlsRef.current.add(u);

            // Upgrade: also refresh the title from the live PR data —
            // catches the case where the body-mirror inserted the entry
            // earlier with the synthetic `owner/repo#number` placeholder.
            const upgradedExisting = existingLinks.map((l) =>
                toUpgradeUrls.has(l.url)
                    ? { ...l, isAutoLinked: true, title: titleByUrl.get(l.url) || l.title }
                    : l
            );

            setTaskContent({
                ...taskContent,
                links: [...upgradedExisting, ...newLinks],
            });
            setTaskUpdated?.(true);
        } finally {
            if (token === pullsFetchTokenRef.current && opts?.bypassCache) {
                setPullsRefreshing(false);
            }
        }
    };

    // Initial discovery on task open.
    useEffect(() => {
        void fetchLinkedPullsRef.current();
    }, [taskContent.id, taskContent.displayId, accessToken]);

    // Refetch when the user returns to the window — covers "open a PR
    // on GitHub for an already-linked branch → alt-tab back → expect to
    // see the PR card here". Server cache is respected on focus; the
    // refresh icon next to the "Links" label bypasses it for an
    // immediate fresh fetch.
    useEffect(() => {
        const onFocus = () => {
            void fetchLinkedPullsRef.current();
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

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
    //
    // We do NOT mark these as `isAutoLinked` — the flag is reserved for
    // PRs whose head branch matches the task's display ID (set only by
    // the auto-discovery effect above). Body-pasted PRs are usually
    // references to *other* tasks' work; flagging them would pollute
    // the PR column with unrelated PRs.
    useEffect(() => {
        let cancelled = false;
        const handle = setTimeout(async () => {
            const prUrls = extractPrUrlsFromBlocks(taskContent.body);
            if (prUrls.length === 0) return;
            const existing = new Set((taskContent.links ?? []).map((l) => l.url));
            const newUrls = prUrls.filter((u) => !existing.has(u));
            if (newUrls.length === 0) return;

            // Resolve the real PR title via `prStatusCache` so the Link
            // entry shows the PR's subject instead of the synthetic
            // `owner/repo#number` placeholder. Fetches are parallel and
            // cached (60s module-scope TTL) — re-pasting the same URL
            // doesn't hit the network. Falls back to the placeholder on
            // any failure (no auth, PR not accessible, etc.).
            const titles = await Promise.all(
                newUrls.map(async (url): Promise<string> => {
                    const ref = parsePrUrl(url);
                    const fallback = ref ? `${ref.owner}/${ref.repo}#${ref.number}` : url;
                    if (!ref || !accessToken) return fallback;
                    const r = await getCachedOrFetchPrStatus(accessToken, url);
                    return r.kind === "ok" ? r.payload.pull.title || fallback : fallback;
                })
            );
            if (cancelled) return;

            const newLinks = newUrls.map((url, i) => ({
                id: `link-pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                url,
                title: titles[i],
                isGitHub: true,
            }));
            setTaskContent({
                ...taskContent,
                links: [...(taskContent.links ?? []), ...newLinks],
            });
            setTaskUpdated?.(true);
        }, 1000);
        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
        // Watch the body only — we read links inside the effect to
        // dedupe, but listing links in deps would loop (we mutate them
        // here, that re-triggers the effect, infinite).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskContent.body]);

    const taskIdNum = taskContent.id ?? null;
    const blocked = isCurrentlyBlocked(taskIdNum, useTM);

    // Collaborators — additional members beside the single assignee.
    // Rides the same setTaskContent + setTaskUpdated contract as every
    // other field, so preview / create / milestone mounts all persist it
    // through the shared save path with no extra wiring.
    const handleCollaboratorsChange = (next: UserProps[]) => {
        setTaskContent({ ...taskContent, collaborators: next });
        setTaskUpdated?.(true);
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
            }}
        >
            {/* Blocked badge — only when at least one blocker is still
                open (i.e. not Closed). Sits above the metadata list so
                it's visible the moment the task opens. */}
            {blocked && (
                <Box sx={{ mb: 1 }}>
                    <AppTooltip title={t.tasks.dependencies.blockedTooltip}>
                        <Chip
                            color="warning"
                            size="sm"
                            startDecorator={<BlockRoundedIcon sx={{ fontSize: 14 }} />}
                            variant="soft"
                            sx={{
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                fontSize: "0.7rem",
                                borderRadius: "5px",
                            }}
                        >
                            {t.tasks.dependencies.blockedBadge}
                        </Chip>
                    </AppTooltip>
                </Box>
            )}
            <List
                sx={{
                    gap: 0.5,
                    p: 0,
                    "--ListItem-paddingY": "8px",
                    "--ListItem-paddingX": "0px",
                }}
            >
                {/* Assignee and Reporter Row — the two owner fields share
                    one row (mirrors the Project/Tags grid below). Each half
                    keeps its avatar + picker; `minWidth: 0` lets the picker
                    shrink inside the half-column instead of pushing the row
                    past a narrowed preview pane. */}
                <Grid spacing={1} container>
                    <Grid sm={6} xs={12}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <FieldLabel isDark={isDark} required={isRequired("assignee")}>
                                {t.tasks.fields.assignee}
                            </FieldLabel>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    flex: 1,
                                    minWidth: 0,
                                }}
                            >
                                <AvatarWithStatus
                                    showPulseDot={false}
                                    // `assignee` is now nullable (a task can
                                    // be unassigned). When null, render the
                                    // empty placeholder avatar —
                                    // `AvatarWithStatus` already handles
                                    // `avatarUser=undefined`.
                                    isYou={!!assignee && myself.userId === assignee.userId}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useCM={useCM}
                                    useUISM={useUISM}
                                    avatarUser={
                                        assignee
                                            ? useTEM.teamMemberProfiles[assignee.userId]
                                            : undefined
                                    }
                                />
                                <ACTeamUsers
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
                                    useCM={useCM}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
                                />
                            </Box>
                        </ListItem>
                    </Grid>
                    <Grid sm={6} xs={12}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <FieldLabel isDark={isDark} required={isRequired("reporter")}>
                                {t.tasks.fields.reporter}
                            </FieldLabel>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    flex: 1,
                                    minWidth: 0,
                                }}
                            >
                                <AvatarWithStatus
                                    avatarUser={useTEM.teamMemberProfiles[reporter.userId]}
                                    isYou={myself.userId === reporter.userId}
                                    myself={myself}
                                    setMyself={setMyself}
                                    showPulseDot={false}
                                    socket={socket}
                                    useCM={useCM}
                                    useUISM={useUISM}
                                />
                                <ACTeamUsers
                                    initialUser={taskContent.reporter}
                                    isAssignee={false}
                                    isOpenTeamMembersList={isOpenTeamMembersList}
                                    myself={myself}
                                    setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                                    setMyself={setMyself}
                                    setTaskContent={setTaskContent}
                                    socket={socket}
                                    setTaskUpdated={setTaskUpdated}
                                    // Adapt the non-nullable reporter setter
                                    // to the wider `setUser: UserProps | null`
                                    // signature ACTeamUsers needs. The picker
                                    // only emits null for the assignee branch
                                    // (isAssignee=true), so this null is
                                    // unreachable in practice.
                                    taskContent={taskContent}
                                    useCM={useCM}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
                                    setUser={(value) => {
                                        if (value) setReporter(value);
                                    }}
                                />
                            </Box>
                        </ListItem>
                    </Grid>
                </Grid>

                {/* Collaborators — additional members beside the assignee.
                    Shown for both tasks and milestones (a milestone stores
                    them on its backing task, same as its other metadata). */}
                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                    <FieldLabel isDark={isDark}>{t.tasks.fields.collaborators}</FieldLabel>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <MultiMemberPicker
                            myself={myself}
                            placeholder={t.tasks.picker.addCollaborators}
                            selected={taskContent.collaborators ?? []}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            onChange={handleCollaboratorsChange}
                        />
                    </Box>
                </ListItem>

                {/* Project and Tags Row */}
                <Grid spacing={1} sx={{ mt: 0.5 }} container>
                    <Grid sm={6} xs={12}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <FieldLabel isDark={isDark} required={isRequired("project")}>
                                {t.tasks.fields.project}
                            </FieldLabel>
                            {/* Only a milestone or a top-level task picks a
                                project. A sub-task's project IS its parent's:
                                letting one move alone stranded it under a
                                parent in the project it came from, so the
                                destination's table — which nests rows under
                                their parent — had nowhere to draw it and the
                                row was invisible in both projects. Moving the
                                top-level task takes its whole sub-tree along.

                                Create mounts stay editable: the row doesn't
                                exist to the user yet, and a sub-task being
                                created inherits the project it's created
                                under anyway. */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <AppTooltip
                                    disableHoverListener={!projectLocked}
                                    maxWidth={280}
                                    title={
                                        projectLocked ? t.tasks.tooltips.subTaskProjectLocked : ""
                                    }
                                >
                                    {/* The disabled input swallows its own
                                        pointer events, so the tooltip needs a
                                        wrapper that still receives them. */}
                                    <Box sx={{ minWidth: 0 }}>
                                        <ACTeamProjects
                                            disabled={projectLocked}
                                            isOpenProjectList={isOpenProjectList}
                                            // Create mounts only (see the prop doc). Sub-task
                                            // creation is excluded: its parentTaskId comes from
                                            // `isCreatingTask`, not the milestone picker, and
                                            // must survive a project switch.
                                            resetMilestoneOnChange={!isPreviewMode && !isSubTask}
                                            setIsOpenProjectList={setIsOpenProjectList}
                                            setTaskContent={setTaskContent}
                                            setTaskUpdated={setTaskUpdated}
                                            taskContent={taskContent}
                                            // Resolves each option's avatar from
                                            // its PM chat.
                                            useCM={useCM}
                                            usePM={usePM}
                                        />
                                    </Box>
                                </AppTooltip>
                            </Box>
                        </ListItem>
                    </Grid>
                    <Grid sm={6} xs={12}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <FieldLabel isDark={isDark} required={isRequired("tags")}>
                                {t.tasks.fields.tags}
                            </FieldLabel>
                            {/* minWidth: 0 lets the autocomplete actually
                                shrink inside the flex row — its own
                                width:100% otherwise pins the row wider
                                than a narrowed preview pane and pushes
                                everything out of the block frame. */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <ACProjectTags
                                    isOpenTagList={isOpenTagList}
                                    projectTags={projectTags}
                                    setIsOpenTagList={setIsOpenTagList}
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                />
                            </Box>
                            {/* Create/Manage sit AFTER the autocomplete so
                                they read as actions on it, and never
                                shrink away. */}
                            <AppTooltip title={t.tasks.tooltips.createNewTag}>
                                <IconButton
                                    size="sm"
                                    sx={{ ...subtleIconButtonSx(isDark), flexShrink: 0, ml: 0.5 }}
                                    variant="plain"
                                    onClick={() => useTM.setOpenCreateTag(true)}
                                >
                                    <AddRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </AppTooltip>
                            <AppTooltip title={t.tasks.tooltips.manageTags}>
                                <IconButton
                                    size="sm"
                                    sx={{ ...subtleIconButtonSx(isDark), flexShrink: 0 }}
                                    variant="plain"
                                    onClick={() => setOpenManageTags(true)}
                                >
                                    <SettingsRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </AppTooltip>
                            <ModalManageTags
                                myself={myself}
                                open={openManageTags}
                                projectTags={projectTags}
                                setProjectTags={setProjectTags}
                                usePM={usePM}
                                useTM={useTM}
                                onClose={() => setOpenManageTags(false)}
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
                            {isMilestone ? t.tasks.fields.sprint : t.tasks.fields.milestone}
                        </FieldLabel>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <SprintMilestonePicker
                                milestoneId={(taskContent as any)?.milestoneId ?? null}
                                projectId={taskContent?.project?.projectId}
                                showMilestone={isMilestone !== true}
                                showSprint={isMilestone === true}
                                sprintId={(taskContent as any)?.sprintId ?? null}
                                useSM={useSM}
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
                            />
                        </Box>
                    </ListItem>
                )}

                {/* Priority and Effort Level Row */}
                <Grid spacing={1} container>
                    <Grid sm={6} xs={12}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <FieldLabel isDark={isDark} required={isRequired("priority")}>
                                {t.tasks.fields.priority}
                            </FieldLabel>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <ACTaskPriority
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                />
                            </Box>
                        </ListItem>
                    </Grid>
                    <Grid sm={6} xs={12}>
                        <ListItem sx={{ display: "flex", alignItems: "center", p: 0 }}>
                            <FieldLabel isDark={isDark} required={isRequired("effortLevel")}>
                                {t.tasks.fields.effortLevel}
                            </FieldLabel>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <ACTaskEffortLevel
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                />
                            </Box>
                        </ListItem>
                    </Grid>
                </Grid>

                {/* Status (only in preview mode) */}
                {isPreviewMode && (
                    <ListItem
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            width: { xs: "100%", sm: "49%" },
                        }}
                    >
                        <FieldLabel isDark={isDark}>{t.tasks.fields.status}</FieldLabel>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <ACTaskStatus
                                setTaskContent={setTaskContent}
                                setTaskStatusUpdated={setTaskStatusUpdated}
                                setTaskUpdated={setTaskUpdated}
                                socket={socket}
                                taskContent={taskContent}
                            />
                        </Box>
                    </ListItem>
                )}

                {/* Due Date — the only date field shown by default.
                    Start Date is a secondary, opt-in attribute: a small
                    `+` button on the right reveals the start input
                    inline to the left, separated by a `→` arrow. Once
                    a start date is set, the row stays expanded across
                    re-renders; the inline `Clear` button inside
                    TaskStartDateInput resets the value. The dedicated
                    Start Date row is gone — chronologically less
                    important than Due Date, so it didn't deserve its
                    own labelled slot in every task. */}
                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                    <FieldLabel isDark={isDark} required={isRequired("dueDate")}>
                        {t.tasks.fields.dueDate}
                    </FieldLabel>
                    <Stack
                        alignItems="center"
                        direction="row"
                        spacing={1}
                        sx={{ flex: 1, minWidth: 0, flexWrap: "wrap" }}
                    >
                        {showStartDate && (
                            <>
                                <TaskStartDateInput
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                />
                                <Typography level="body-sm" sx={{ opacity: 0.5 }}>
                                    →
                                </Typography>
                            </>
                        )}
                        <TaskDueDateInput
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            taskContent={taskContent}
                        />
                        {!showStartDate && (
                            <AppTooltip title={t.tasks.tooltips.addStartDate}>
                                <IconButton
                                    size="sm"
                                    sx={subtleIconButtonSx(isDark)}
                                    variant="plain"
                                    onClick={() => setExplicitlyShowStartDate(true)}
                                >
                                    <AddRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </AppTooltip>
                        )}
                    </Stack>
                </ListItem>

                {/* Links */}
                <ListItem sx={{ display: "flex", alignItems: "flex-start" }}>
                    <Stack
                        alignItems="center"
                        direction="row"
                        spacing={0.25}
                        sx={{ minWidth: `${FIELD_LABEL_MIN_WIDTH}px` }}
                    >
                        <FieldLabel isDark={isDark}>{t.tasks.fields.links}</FieldLabel>
                        {/* {(taskContent.links?.length ?? 0) > 0 && (
                            <AppTooltip title={t.tasks.tooltips.refreshPullRequests}>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="neutral"
                                    disabled={pullsRefreshing}
                                    onClick={() => {
                                        void fetchLinkedPullsRef.current({ bypassCache: true });
                                    }}
                                    sx={subtleIconButtonSx(isDark)}
                                >
                                    <RefreshRoundedIcon
                                        sx={{
                                            fontSize: "1rem",
                                            animation: pullsRefreshing
                                                ? "spin 0.9s linear infinite"
                                                : "none",
                                            "@keyframes spin": {
                                                "0%": { transform: "rotate(0deg)" },
                                                "100%": { transform: "rotate(360deg)" },
                                            },
                                        }}
                                    />
                                </IconButton>
                            </AppTooltip>
                        )} */}
                    </Stack>
                    {/* minWidth: 0 so long link titles/URLs truncate
                        inside the block instead of pushing the row (and
                        the edit/delete icons) past the pane edge. */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <DynamicURLManager
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            taskContent={taskContent}
                        />
                    </Box>
                </ListItem>

                {/* Linked branches — auto-discovered branches whose names
                    contain the task's display ID. Read-only chips that
                    open the branch on GitHub. Hidden when none match. */}
                {linkedBranches.length > 0 && (
                    <ListItem sx={{ display: "flex", alignItems: "flex-start" }}>
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={0.25}
                            sx={{ minWidth: `${FIELD_LABEL_MIN_WIDTH}px` }}
                        >
                            <FieldLabel isDark={isDark}>{t.tasks.fields.branches}</FieldLabel>
                            <AppTooltip title={t.tasks.tooltips.refreshBranches}>
                                <IconButton
                                    color="neutral"
                                    disabled={branchesRefreshing}
                                    size="sm"
                                    sx={subtleIconButtonSx(isDark)}
                                    variant="plain"
                                    onClick={() => {
                                        void fetchLinkedBranches({ bypassCache: true });
                                    }}
                                >
                                    <RefreshRoundedIcon
                                        sx={{
                                            fontSize: "1rem",
                                            animation: branchesRefreshing
                                                ? "spin 0.9s linear infinite"
                                                : "none",
                                            "@keyframes spin": {
                                                "0%": { transform: "rotate(0deg)" },
                                                "100%": { transform: "rotate(360deg)" },
                                            },
                                        }}
                                    />
                                </IconButton>
                            </AppTooltip>
                        </Stack>
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 0.5,
                                flex: 1,
                            }}
                        >
                            {linkedBranches.map((b) => (
                                <AppTooltip
                                    key={`${b.owner}/${b.repo}/${b.name}`}
                                    title={`${b.owner}/${b.repo}`}
                                >
                                    <Chip
                                        component="a"
                                        href={b.url}
                                        rel="noopener noreferrer"
                                        size="sm"
                                        target="_blank"
                                        variant="outlined"
                                        sx={{
                                            borderRadius: "5px",
                                            fontFamily: "monospace",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                            background: isDark
                                                ? "rgba(255,255,255,0.04)"
                                                : "rgba(0,0,0,0.03)",
                                            borderColor: isDark
                                                ? "rgba(255,255,255,0.1)"
                                                : "rgba(0,0,0,0.1)",
                                            transition:
                                                "background 0.15s ease, border-color 0.15s ease",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(255,255,255,0.08)"
                                                    : "rgba(0,0,0,0.06)",
                                                borderColor: isDark
                                                    ? "rgba(255,255,255,0.16)"
                                                    : "rgba(0,0,0,0.14)",
                                            },
                                        }}
                                    >
                                        {b.name}
                                    </Chip>
                                </AppTooltip>
                            ))}
                        </Box>
                    </ListItem>
                )}

                {/* Dependencies (blocking / blocked-by). Hidden in
                    create mode by the block itself — empty-task rows
                    pre-persistence shouldn't accept dependencies. */}
                <TaskDependenciesBlock
                    hostZIndex={hostZIndex}
                    isPreviewMode={isPreviewMode}
                    myself={myself}
                    taskContent={taskContent}
                    usePM={usePM}
                    useTM={useTM}
                />

                {/* Custom fields — the project's owner/editor-defined
                    metadata (tag / text / date / member). Values ride on
                    `taskContent.customFieldValues` and persist through
                    the same setTaskContent + setTaskUpdated contract as
                    every built-in field, so preview, create form and
                    milestone mounts all work without extra wiring. */}
                <CustomFieldsBlock
                    hostZIndex={hostZIndex}
                    isDark={isDark}
                    setTaskContent={setTaskContent}
                    setTaskUpdated={setTaskUpdated}
                    taskContent={taskContent}
                    useTEM={useTEM}
                />

                {/* Parent Task (only if exists). Uses the same chip
                    vocabulary as the dependency rows (monospace ID +
                    StatusChip + title) so all cross-task relations
                    look like a single family. */}
                {parentTask !== undefined && (
                    <ListItem sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                        <FieldLabel isDark={isDark}>{t.tasks.fields.parentTask}</FieldLabel>
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1}
                            sx={{
                                ...softCardSx(isDark),
                                cursor: "pointer",
                                px: 1.25,
                                py: 0.85,
                                flex: 1,
                                minWidth: 0,
                            }}
                            onClick={() => {
                                if (
                                    !parentTask.project ||
                                    !parentTask.project.projectId ||
                                    !parentTask.id
                                ) {
                                    return;
                                }
                                const projectId = parentTask.project.projectId;
                                // A milestone's backing task must open as the
                                // MILESTONE preview, not a bare task wrapping
                                // the backing row (agent-created plans made
                                // this path common: every top-level plan task
                                // has the milestone backing task as parent).
                                const parentMilestoneId =
                                    (parentTask as any).isMilestone === true &&
                                    (parentTask as any).milestoneId != null
                                        ? Number((parentTask as any).milestoneId)
                                        : null;
                                // Modal-hosted → re-target the modal (keeps
                                // its stacking level; see
                                // useUrlLinkModalState). Global setters would
                                // change the page BEHIND the modal instead.
                                if (hostZIndex != null && urlLinkModal) {
                                    urlLinkModal.openModalByHref(
                                        parentMilestoneId != null
                                            ? `/workspace/tasks/project/${projectId}/milestone/${parentMilestoneId}`
                                            : `/workspace/tasks/project/${projectId}/task/${parentTask.id}`
                                    );
                                    return;
                                }
                                usePM.setCurrentProject({
                                    projectId,
                                    projectName: parentTask.project.projectName,
                                    projectTags: parentTask.tags,
                                    systemUserId: parentTask.project.systemUserId,
                                });
                                if (parentMilestoneId != null) {
                                    useTM.setCurrentPreviewKind("milestone");
                                    useTM.setCurrentPreviewMilestoneId(parentMilestoneId);
                                } else {
                                    useTM.setCurrentPreviewTaskId(parentTask.id);
                                }
                            }}
                        >
                            <AvatarWithStatus
                                myself={myself}
                                setMyself={setMyself}
                                showPulseDot={false}
                                socket={socket}
                                useCM={useCM}
                                useUISM={useUISM}
                                avatarUser={
                                    parentTask.assignee
                                        ? useTEM.teamMemberProfiles[parentTask.assignee.userId]
                                        : undefined
                                }
                                isYou={
                                    !!parentTask.assignee &&
                                    myself.userId === parentTask.assignee.userId
                                }
                            />
                            <CopyableTaskIdChip
                                size="sm"
                                task={parentTask}
                                variant="outlined"
                                sx={{
                                    fontFamily: "monospace",
                                    fontWeight: 600,
                                    borderRadius: "5px",
                                }}
                            />
                            <StatusChip isDark={isDark} meta={parentTask.status} />
                            <Typography
                                level="body-sm"
                                sx={{
                                    fontWeight: 500,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    flex: 1,
                                    minWidth: 0,
                                }}
                                noWrap
                            >
                                {parentTask.title}
                            </Typography>
                        </Stack>
                    </ListItem>
                )}
            </List>
        </Box>
    );
};
