import { useEffect, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import {
    Box,
    Button,
    Chip,
    Input,
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
import { DataState } from "../../../../../components/ui/feedback/DataState";
import { ErrorState } from "../../../../../components/ui/feedback/ErrorState";
import { Spinner } from "../../../../../components/ui/feedback/Skeleton";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../../../../hooks/common/UrlLinkModalContext";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { TaskProps } from "../../../../../types/tasks";
import { joinOpenLanding, useTaskOpenLanding } from "../../../hooks/TaskOpenLandingContext";
import { createQuickTask } from "../../../services/createQuickTask";
import { loadSpecificChildTasks } from "../../../services/loadSpecificChildTasks";
import {
    emitTasksBulkChanged,
    emitTaskTouched,
    onTasksBulkChanged,
    onTaskTouched,
} from "../../../services/taskEvents";
import { TaskIdText } from "../../card";
import { StatusLabel } from "../../meta/StatusLabel";

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
    // Set when rendering inside the UrlLinkModal (threaded from
    // ModalTaskView / ModalMilestoneView via TaskPreview). Child rows
    // then re-target the modal via openModalByHref instead of setting
    // the host page's global preview id — which the modal ignores, so
    // without this, clicking a sub-task in the modal did nothing.
    hostZIndex?: number;
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
        hostZIndex,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const urlLinkModal = useUrlLinkModal();
    const [childTasks, setChildTasks] = useState<TaskProps[]>([]);
    // What the last child-list request said, and for which task: "ok" (the list, possibly
    // empty) or "failed". Until the current task has an answer the block is LOADING, and
    // only an answer of "ok" with no rows may say "No sub tasks yet": a failed request is
    // not an empty list (MIP-1308).
    const [childLoad, setChildLoad] = useState<{ key: string; failed: boolean } | null>(null);
    // The task the rows in `childTasks` belong to: a failure never keeps another task's rows,
    // and another task's rows are not drawn while this one's list is loading.
    const [childrenOf, setChildrenOf] = useState<string | null>(null);
    const childrenOfRef = useRef<string | null>(null);
    const openLanding = useTaskOpenLanding();

    // Inline quick-create state. The button up top toggles `isQuickAdding`;
    // when on, an inline title input takes its place. Enter on a non-empty
    // trimmed value POSTs a title-only task, refetches the child list, and
    // keeps focus so the user can type-Enter-type-Enter through several
    // sub-tasks without re-clicking. Escape (or blur with an empty value)
    // hides the input and restores the button.
    const [isQuickAdding, setIsQuickAdding] = useState(false);
    const [quickTitle, setQuickTitle] = useState("");
    const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
    const [quickError, setQuickError] = useState<string | null>(null);

    // Mirror the loaded child ids so the touched-event listener can tell
    // whether an "update" concerns a subtask we're currently showing,
    // without re-subscribing every time the list changes.
    const childTaskIdsRef = useRef<Set<number>>(new Set());
    useEffect(() => {
        childTaskIdsRef.current = new Set(
            childTasks.map((c) => c.id).filter((id): id is number => id != null)
        );
    }, [childTasks]);

    // External refresh signal via the `genos:task-touched` bus; the local
    // quick-add path refetches directly and doesn't need this.
    const [childRefreshNonce, setChildRefreshNonce] = useState(0);
    useEffect(() => {
        const parentTaskId = currentTaskContent.id;
        if (parentTaskId == null) return;
        return onTaskTouched(({ taskId, kind }) => {
            // A subtask was added / moved / reparented under this parent.
            if (kind === "children" && taskId === parentTaskId) {
                setChildRefreshNonce((n) => n + 1);
                return;
            }
            // A subtask currently shown here was edited elsewhere (its own
            // preview, a modal task view, or another client) — refetch so
            // its row (status, title, assignee) reflects the change right
            // away instead of after a reload. The load path's cache is
            // invalidated on "update" too (see loadSpecificChildTasks), so
            // this refetch hits fresh data.
            if (kind === "update" && childTaskIdsRef.current.has(taskId)) {
                setChildRefreshNonce((n) => n + 1);
            }
        });
    }, [currentTaskContent.id]);

    // A project move is the one change this block cannot hear about on
    // the touched bus: that event names a single task, and which tasks
    // travelled with a move is known only to the server. The bulk signal
    // fires for the source and the destination once the move has landed —
    // which is exactly when the list this block loaded mid-move (empty,
    // because it asked under the destination project before the server had
    // moved anything there) has to be asked for again. Scoped to our own
    // project so the two emits of a single move cost one refetch.
    useEffect(() => {
        const ownProjectId = currentTaskContent.project?.projectId;
        return onTasksBulkChanged(({ projectId }) => {
            if (projectId != null && ownProjectId != null && projectId !== ownProjectId) return;
            setChildRefreshNonce((n) => n + 1);
        });
    }, [currentTaskContent.project?.projectId]);

    useEffect(() => {
        // Cancelled-flag guard: slow child-task responses for an old
        // taskId must not overwrite the freshly-selected task's
        // sub-tree when the user click-storms cards faster than the
        // backend round-trip.
        let cancelled = false;
        // Load when either the row is the active task preview, or
        // the parent explicitly opted in via `forceLoad` (milestone
        // preview, where `currentPreviewTaskId` is intentionally
        // -1).
        const shouldLoad =
            currentTaskContent.project != null &&
            currentTaskContent.id != null &&
            (forceLoad || useTM.currentPreviewTaskId === currentTaskContent.id);
        // Inside a task preview the list lands together with the preview's
        // other loaders (see taskOpenLanding.ts); anywhere else the ticket
        // writes at once.
        const ticket = shouldLoad
            ? joinOpenLanding(openLanding, Number(currentTaskContent.id), "children")
            : null;
        (async () => {
            if (!ticket) return;
            const key = `${currentTaskContent.id}:${currentTaskContent.project!.projectId}`;
            const result = await loadSpecificChildTasks(
                myself,
                currentTaskContent.project!.projectId,
                currentTaskContent.id!,
                accessToken
            );
            ticket.land(() => {
                if (cancelled) return;
                if (result === undefined) {
                    // The request failed (the loader says so with `undefined`; a real
                    // answer is an array). Keep this task's rows, drop another task's.
                    if (childrenOfRef.current !== key) {
                        childrenOfRef.current = key;
                        setChildrenOf(key);
                        setChildTasks([]);
                    }
                    setChildLoad({ key, failed: true });
                    return;
                }
                childrenOfRef.current = key;
                setChildrenOf(key);
                setChildTasks(result?.length ? result : []);
                setChildLoad({ key, failed: false });
            });
        })();
        return () => {
            cancelled = true;
            ticket?.cancel();
        };
        // Depend on the task/project ids, not the `currentTaskContent`
        // object: regular mode passes `tmpCurrentTaskContent`, whose
        // identity changes on every keystroke, and milestone mode
        // rebuilds `taskContentLike` on team-roster polls — both caused
        // a /task/childTasks/ refetch storm for an unchanged task.
    }, [
        currentTaskContent.id,
        currentTaskContent.project?.projectId,
        forceLoad,
        childRefreshNonce,
    ]);

    // Reset the quick-add UI when the user navigates between preview
    // cards. Without this, an open input on task A would survive a click
    // to task B and dump the next Enter into B's child set.
    useEffect(() => {
        setIsQuickAdding(false);
        setQuickTitle("");
        setQuickError(null);
    }, [currentTaskContent.id]);

    // Mirrors the load effect's own gate, so "loading" is only claimed for a task that loads.
    const loadsChildren =
        currentTaskContent.project != null &&
        currentTaskContent.id != null &&
        (forceLoad || useTM.currentPreviewTaskId === currentTaskContent.id);
    const loadKey = loadsChildren
        ? `${currentTaskContent.id}:${currentTaskContent.project!.projectId}`
        : null;
    const childAnswer = loadKey !== null && childLoad?.key === loadKey ? childLoad : null;
    const loadingChildren = loadKey !== null && childAnswer === null;
    const childrenFailed = childAnswer?.failed === true;
    // Rows only count as "something to show" for the task they belong to.
    const hasChildRows = childTasks.length > 0 && (loadKey === null || childrenOf === loadKey);

    const submitQuickTask = async () => {
        const trimmed = quickTitle.trim();
        if (trimmed === "") return;
        if (
            currentTaskContent.id == null ||
            currentTaskContent.rootTaskId == null ||
            currentTaskContent.project == null
        ) {
            return;
        }
        // Same milestone-inheritance the legacy onClick used: a quick
        // sub-task under a milestone backing row inherits that milestone's
        // id; a sub-task under a regular task in a milestone chain inherits
        // the chain's milestoneId (null when outside a milestone).
        const inheritedMilestoneId: number | null =
            (currentTaskContent as any).milestoneId ?? null;

        setIsSubmittingQuick(true);
        setQuickError(null);
        try {
            await createQuickTask({
                myself,
                accessToken,
                projectId: currentTaskContent.project.projectId,
                title: trimmed,
                parentTaskId: currentTaskContent.id,
                rootTaskId: currentTaskContent.rootTaskId,
                milestoneId: inheritedMilestoneId,
            });
            // Refetch through the load effect (children event → nonce
            // bump) so the appended row carries every server-derived
            // field (displayId, project_task_number, etc.) without a
            // manual snake→camel map — and any other mounted sub-task
            // block for the same parent refreshes too.
            emitTaskTouched(currentTaskContent.id, "children");
            // Refresh the task's own project so an open table/board picks up
            // the new row too (cheap: the Redis-cached GetProjectTasksView is
            // invalidated by signal). Not through `isNewTaskCreated`: that
            // reload follows `localStorage.lastProjectId`, which can name
            // another project (MIP-1335).
            emitTasksBulkChanged(currentTaskContent.project.projectId);
            // Clear the input but keep it open + focused for the next
            // rapid add. Power-user pattern.
            setQuickTitle("");
        } catch (err) {
            setQuickError(t.tasks.subTasks.quickAddError);
        } finally {
            setIsSubmittingQuick(false);
        }
    };

    const cancelQuickAdd = () => {
        setIsQuickAdding(false);
        setQuickTitle("");
        setQuickError(null);
    };

    return (
        <>
            <Stack
                direction="row"
                spacing={0}
                sx={{ alignItems: "center", justifyContent: "space-between", pb: 0.5 }}
            >
                <SectionHeader isDark={isDark}>{title}</SectionHeader>
                <Button
                    size="sm"
                    startDecorator={<AddIcon sx={{ fontSize: "18px" }} />}
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
                    {buttonLabel}
                </Button>
            </Stack>

            <DataState
                error={childrenFailed}
                hasData={hasChildRows}
                loading={loadingChildren}
                size="xs"
                skeleton={null}
                errorState={{
                    title: t.tasks.subTasks.loadFailed,
                    onRetry: () => {
                        setChildLoad(null);
                        setChildRefreshNonce((n) => n + 1);
                    },
                    "data-error": "sub-tasks",
                }}
            >
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
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    showPulseDot={false}
                                                    socket={socket}
                                                    useCM={useCM}
                                                    useUISM={useUISM}
                                                    // Sub-tasks can be unassigned —
                                                    // fall back to the empty avatar
                                                    // that AvatarWithStatus renders
                                                    // when `avatarUser` is undefined.
                                                    avatarUser={
                                                        assignee
                                                            ? useTEM.teamMemberProfiles[
                                                                  assignee.userId
                                                              ]
                                                            : undefined
                                                    }
                                                    isYou={
                                                        !!assignee &&
                                                        myself.userId === assignee.userId
                                                    }
                                                />
                                                <ListItemButton
                                                    sx={{
                                                        marginLeft: "10px",
                                                    }}
                                                    onClick={() => {
                                                        if (!project?.projectId || !id) {
                                                            console.error(
                                                                "Failed to set the current project"
                                                            );
                                                            return;
                                                        }
                                                        // Modal-hosted → re-target
                                                        // the modal; the global
                                                        // preview id would change
                                                        // the page BEHIND it.
                                                        if (hostZIndex != null && urlLinkModal) {
                                                            urlLinkModal.openModalByHref(
                                                                `/workspace/tasks/project/${project.projectId}/task/${id}`
                                                            );
                                                            return;
                                                        }
                                                        useTM.setCurrentPreviewTaskId(id);
                                                    }}
                                                >
                                                    <TaskIdText
                                                        key={`id-chip-${id}-${index}`}
                                                        copyable={false}
                                                        task={{ id, displayId }}
                                                    />
                                                    <Box
                                                        key={`status-chip-${id}-${index}`}
                                                        sx={{ mx: "5px" }}
                                                    >
                                                        <StatusLabel status={status.status} />
                                                    </Box>
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
                                                        {tags.map(
                                                            ({ tagName, tagColor }, index) => (
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
                                                                            mode === "dark"
                                                                                ? 0.5
                                                                                : 0.75
                                                                        ),
                                                                    }}
                                                                >
                                                                    {`${tagName}`}
                                                                </Chip>
                                                            )
                                                        )}
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
            </DataState>
            {/* A refresh that failed after rows were shown keeps them (DataState ignores the
                error then): say the list may be stale, with a way to ask again. */}
            {childrenFailed && hasChildRows && (
                <ErrorState
                    data-error="sub-tasks-stale"
                    size="xs"
                    title={t.tasks.subTasks.loadFailed}
                    onRetry={() => {
                        setChildLoad(null);
                        setChildRefreshNonce((n) => n + 1);
                    }}
                />
            )}

            {/* Quick Task row. Always visible at the bottom regardless of
                whether the list above has items or is empty. Collapsed:
                a subtle "+ Quick Task" row that mirrors the look of the
                child task rows above. Expanded: an inline title input
                that creates a title-only task on Enter and immediately
                refetches the list so the new row appears above. */}
            <Box sx={{ mt: 1 }}>
                {!isQuickAdding ? (
                    <ListItemButton
                        sx={{
                            borderRadius: "8px",
                            border: "1px dashed",
                            borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)",
                            color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.6)",
                            gap: 1,
                            py: 0.75,
                            px: 1.25,
                            transition: "all 0.15s ease",
                            "&:hover": {
                                borderColor: isDark
                                    ? "rgba(var(--gp-brandalt-400-rgb), 0.6)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.5)",
                                color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                                backgroundColor: isDark
                                    ? "rgba(var(--gp-brand-700-rgb), 0.06)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.04)",
                            },
                        }}
                        onClick={() => {
                            if (
                                currentTaskContent.id == null ||
                                currentTaskContent.rootTaskId == null
                            ) {
                                console.error("Task ID not defined error.");
                                return;
                            }
                            setQuickError(null);
                            setQuickTitle("");
                            setIsQuickAdding(true);
                        }}
                    >
                        <AddIcon sx={{ fontSize: "18px" }} />
                        <Typography level="body-sm" sx={{ fontWeight: 500, color: "inherit" }}>
                            {t.tasks.subTasks.quickAddLabel}
                        </Typography>
                    </ListItemButton>
                ) : (
                    <Stack direction="column" spacing={0.5}>
                        <Input
                            disabled={isSubmittingQuick}
                            endDecorator={isSubmittingQuick ? <Spinner /> : null}
                            placeholder={t.tasks.subTasks.quickAddPlaceholder}
                            size="sm"
                            sx={{ borderRadius: "8px" }}
                            value={quickTitle}
                            slotProps={{
                                input: {
                                    "aria-label": t.tasks.subTasks.quickAddPlaceholder,
                                },
                            }}
                            autoFocus
                            onBlur={() => {
                                // Blur with an empty input cancels. If the
                                // user typed something, keep the input open
                                // so a misclick doesn't drop their draft.
                                if (quickTitle.trim() === "" && !isSubmittingQuick) {
                                    cancelQuickAdd();
                                }
                            }}
                            onChange={(e) => {
                                setQuickTitle(e.target.value);
                                if (quickError) setQuickError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isSubmittingQuick) {
                                    e.preventDefault();
                                    void submitQuickTask();
                                } else if (e.key === "Escape" && !isSubmittingQuick) {
                                    e.preventDefault();
                                    cancelQuickAdd();
                                }
                            }}
                        />
                        {quickError && (
                            <Typography level="body-xs" sx={{ color: "danger.500", px: 0.5 }}>
                                {quickError}
                            </Typography>
                        )}
                    </Stack>
                )}
            </Box>
        </>
    );
};
