import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Button, Chip, Divider, IconButton, Input, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Socket } from "socket.io-client";

import { useInitialTabIndex } from "./utils/useInitialTabIndex";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { TaskHeaderStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useSendUpdatedTask } from "../../../../hooks/tasks/useSendUpdatedTask";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { useTaskEditState } from "../../../../hooks/tasks/useTaskEditState";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../types/chat";
import { TaskNoteProps } from "../../../../types/notes";
import {
    TagListProps,
    TaskActivityProps,
    TaskCommentProps,
    TaskProps,
} from "../../../../types/tasks";
import { getServiceShortcutModifierKeys } from "../../../../utils/platform";
import { LinkedPrCard } from "../../../integrations/components/LinkedPrCard";
import { parsePrUrl } from "../../../integrations/utils/parsePrUrl";
import { loadTaskNotes } from "../../../notes/task-notes/services/loadTaskNotes";
import { ModalTaskDiagram } from "../../diagram/components/ModalTaskDiagram";
import { loadSpecificTask } from "../../services/loadSpecificTask";
import { loadTaskActivities } from "../../services/loadTaskActivities";
import { loadTaskComments } from "../../services/loadTaskComments";
import {
    updateProjectOptions,
    updateTagOptions,
    updateTeamMembersOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { uploadTaskAttachments } from "../../services/uploadTaskAttachments";
import { Milestone } from "../../sprint-milestone/types";
import { MILESTONE_STATUS_CHIP_COLORS } from "../../sprint-milestone/utils/sortMilestones";
import { getTaskKind } from "../../utils/taskKind";
import { effortLevels, priorities } from "../../utils/taskMeta";
import { TaskBodyBlock } from "./base/TaskBodyBlock";
import { TaskCustomBarBlock } from "./base/TaskCustomBarBlock";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskPreviewLayout } from "./base/TaskPreviewLayout";
import { TaskSubTasksBlock } from "./base/TaskSubTasksBlock";
import { TaskTabBlock } from "./base/TaskTabBlock";
import { TaskTitleBlock } from "./base/TaskTitleBlock";

// Section divider component
const SectionDivider = ({ isDark }: { isDark: boolean }) => (
    <Divider
        sx={{
            my: 2,
            opacity: isDark ? 0.08 : 0.12,
        }}
    />
);

// Section header component
const SectionHeader = ({ children, isDark }: { children: React.ReactNode; isDark: boolean }) => (
    <Typography
        level="body-xs"
        sx={{
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: 10,
            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
            mb: 1,
        }}
    >
        {children}
    </Typography>
);

type TaskPreviewProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    usePM: ProjectManagementState;
    useUISM: UIStateManagementState;
    useTM: TaskManagementState;
    useSM?: SprintMilestoneManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
    setTodoFromMessageBubble?: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

export const TaskPreview = (props: TaskPreviewProps) => {
    const {
        socket,
        myself,
        setMyself,
        usePM,
        useNM,
        useTM,
        useSM,
        useUISM,
        useTEM,
        useCM,
        setTodoFromMessageBubble,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const [taskClosed, setTaskClosed] = useState(false);
    // Mirror the actual task: `null` means unassigned. Don't silently
    // substitute `myself` here — that would mislead the user into
    // thinking they were the assignee of an unassigned task.
    const [assignee, setAssignee] = useState<UserProps | null>(
        useTM.currentPreviewTask?.assignee ?? null
    );
    const [reporter, setReporter] = useState<UserProps>(
        useTM.currentPreviewTask?.reporter || myself
    );
    // For task comments
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();

    // Consolidated task edit state
    const taskEditState = useTaskEditState(useTM.currentPreviewTask);

    const previewTaskKind = getTaskKind(useTM.currentPreviewTask, useTM.allTasks);

    // Tab index is initialized once per opened task based on the first
    // comments+notes loads (attachments arrive synchronously with the
    // task). Subsequent comment / note / attachment changes don't move
    // the user — only the user's tab click does (TaskTabBlock onChange).
    const { tabIndex, setTabIndex, markCommentsLoaded, markNotesLoaded, reportFileCount } =
        useInitialTabIndex(taskEditState.currentTaskId);

    // Set the current preview task when the component is mounted
    useEffect(() => {
        taskEditState.setTmpCurrentTaskContent(useTM.currentPreviewTask || ({} as TaskProps));
    }, []);

    // Single-callback replacement for the older two-flag deletion
    // pattern (`isAttachmentDeleted` / `deletedAttachmentId`). Updates
    // both the persisted list and the working copy in one shot so
    // there's no window where one side knows about the delete and the
    // other doesn't.
    const handleAttachmentDeleted = useCallback(
        (attachmentId: number) => {
            taskEditState.setUploadedFiles((prev) =>
                prev.filter((a) => a.attachment_id !== attachmentId)
            );
            taskEditState.setTmpCurrentTaskContent((prev) => ({
                ...prev,
                attachments: (prev.attachments ?? []).filter(
                    (a) => a.attachment_id !== attachmentId
                ),
            }));
        },
        [taskEditState]
    );

    // Use the custom hook to get the sendUpdatedTask function
    const sendUpdatedTask = useSendUpdatedTask({
        socket,
        myself,
        accessToken,
        currentPreviewTask: useTM.currentPreviewTask,
        setCurrentPreviewTask: useTM.setCurrentPreviewTask,
        taskEditState,
    });

    useEffect(() => {
        // Save updated task (title, assignee, status, ..., but not task body)
        if (taskEditState.taskUpdated === true) {
            sendUpdatedTask(false);
        }
    }, [taskEditState.taskUpdated]);

    // Re-trigger the save when the attachment list still contains
    // negative-id rows after a save just completed. This handles the
    // case where the user dropped file B *during* file A's POST: the
    // duplicate `setTaskUpdated(true)` call gets coalesced by React
    // while the flag is already true, so B would otherwise sit pending
    // forever until something else flipped the flag. After A's save
    // flips the flag back to false, this effect notices B's negative
    // id and kicks off the next save.
    useEffect(() => {
        if (taskEditState.taskUpdated) return;
        const hasPending = (taskEditState.tmpCurrentTaskContent?.attachments ?? []).some(
            (a) => a.attachment_id < 0
        );
        if (hasPending) {
            taskEditState.setTaskUpdated(true);
        }
    }, [taskEditState.taskUpdated, taskEditState.tmpCurrentTaskContent?.attachments]);

    useEffect(() => {
        if (taskEditState.startIntervalUpdatingTask) {
            sendUpdatedTask(false);
        }
    }, [taskEditState.startIntervalUpdatingTask]);

    // Authoritative "dirty" signal for the body. `taskBodyEdited`
    // alone is unreliable because the collaborative BlockNote editor's
    // `onChange` fires once on Yjs initial-sync after every task
    // load (see [bnTaskPreview.tsx:334-344]), falsely flipping the
    // flag even when the user never typed.
    //
    // Two refs cooperate here:
    //
    //  * `currentBodyRef` mirrors `taskEditState.body` in real time.
    //    The autosave interval's closure captures `taskEditState` at
    //    setup time and would otherwise miss every keystroke that
    //    follows. Reading through this ref gives the interval a live
    //    view of the body without forcing it to re-create on every
    //    keystroke.
    //
    //  * `lastLoadedBodyRef` holds the *canonical* baseline for the
    //    current task. We capture it 100 ms after each task load so
    //    the editor's Yjs initial-sync echo has settled — the raw
    //    server JSON and the editor's canonical form often differ
    //    (id assignment, property reordering), and comparing
    //    raw-vs-canonical would mark every view-only switch as dirty
    //    and fire a spurious autosave. 100 ms is comfortably below
    //    human typing rhythm so the baseline catches the canonical
    //    form before any real edit.
    const lastLoadedBodyRef = useRef<string>("");
    const prevTaskIdRef = useRef<number | null>(null);
    const currentBodyRef = useRef<PartialBlock[]>([]);

    useEffect(() => {
        currentBodyRef.current = taskEditState.body;
    }, [taskEditState.body]);

    useEffect(() => {
        const id = window.setTimeout(() => {
            lastLoadedBodyRef.current = JSON.stringify(currentBodyRef.current ?? []);
        }, 100);
        return () => window.clearTimeout(id);
    }, [taskEditState.currentTaskId]);

    const isBodyDirty = (): boolean => {
        return JSON.stringify(currentBodyRef.current ?? []) !== lastLoadedBodyRef.current;
    };

    // Auto save task body every Nms if needed. The interval used to
    // fire `sendUpdatedTask(false)` whenever `taskBodyEdited` was
    // truthy — but as noted above, that flag is unreliable, so on
    // every view-only click sequence the interval would PUT the task
    // back to the server every 3 s with no user edit involved. We
    // gate the trigger on a real body-content diff instead, so the
    // interval only fires when there are genuine unsaved edits.
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (taskEditState.taskBodyEdited === true && isBodyDirty()) {
                taskEditState.setStartIntervalUpdatingTask(true);
            }
        }, 3000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [taskEditState.taskBodyEdited]);

    // Race guard for the "stale load reverts a fresh edit" bug:
    // `useProjectTaskManagement` fires `loadTask` on every preview-open. If
    // the user clicks Start Task / Complete Task / etc. before that load
    // returns, the load's response (pre-edit) lands AFTER our save and the
    // sync effect below would clobber the local edit. We track the time of
    // the most recent local edit (taskUpdated flip) and suppress same-task
    // overwrites in a short window after it.
    const lastLocalEditAtRef = useRef<number>(0);
    useEffect(() => {
        if (taskEditState.taskUpdated) {
            lastLocalEditAtRef.current = Date.now();
        }
    }, [taskEditState.taskUpdated]);
    // Reset the guard when the user switches to a different task so the new
    // task's first sync isn't suppressed.
    useEffect(() => {
        lastLocalEditAtRef.current = 0;
    }, [taskEditState.currentTaskId]);

    // Update variables when the user changes the target task.
    //
    // Critical correctness fix: only PUT the outgoing task if its body
    // actually differs from what we last loaded into the editor.
    // The collaborative BlockNote editor's `onChange` fires once on
    // Yjs initial-sync after a task switch — that fire flips
    // `taskBodyEdited` to true even though the user never typed.
    // Without the body-diff check, every view-only click sequence
    // generated spurious PUTs that could clobber legitimate edits
    // (the PUT carries the *previous* task's state, so the "card
    // jumps back to id=5" symptom was real data corruption, not UI
    // drift).
    useEffect(() => {
        const next = useTM.currentPreviewTask;
        if (!next) return;

        const nextId = Number(next.id);
        const prevId = prevTaskIdRef.current;
        const isSwitch = prevId != null && prevId !== nextId;

        if (isSwitch) {
            // Switching to a different task. Save the outgoing one
            // only if the body really changed since we loaded it.
            if (taskEditState.taskBodyEdited && isBodyDirty()) {
                sendUpdatedTask(true);
            }
            // Reset the unreliable flag for the incoming task — the
            // editor's initial-sync onChange will flip it back, but
            // we now ignore it until the body actually diverges from
            // the canonical baseline captured 100 ms later.
            taskEditState.setTaskBodyEdited(false);
            taskEditState.setTmpCurrentTaskContent(next);
            taskEditState.setCurrentTaskId(next.id);
            taskEditState.setTaskTitle(next.title);
            taskEditState.setBody(next.body || []);
            taskEditState.setUploadedFiles(next.attachments || []);
            prevTaskIdRef.current = nextId;
            return;
        }

        // Same task refresh (e.g. a stale `loadTask` landing after
        // our own save's echo). Keep the existing local-edit
        // suppression window — without it a 5 s old fetch can
        // overwrite content the user just typed.
        const LOCAL_EDIT_SUPPRESS_MS = 5000;
        const recentLocalEdit = Date.now() - lastLocalEditAtRef.current < LOCAL_EDIT_SUPPRESS_MS;
        if (prevId === nextId && recentLocalEdit) return;

        taskEditState.setTmpCurrentTaskContent(next);
        taskEditState.setCurrentTaskId(next.id);
        taskEditState.setTaskTitle(next.title);
        taskEditState.setBody(next.body || []);
        taskEditState.setUploadedFiles(next.attachments || []);
        prevTaskIdRef.current = nextId;
    }, [useTM.currentPreviewTask]);

    // Update task title/attachments when the visible task Id is changed
    useEffect(() => {
        if (taskEditState.currentTaskId) {
            taskEditState.setTaskTitle(useTM.currentPreviewTask?.title || "");
            taskEditState.setInitTaskTitle(useTM.currentPreviewTask?.title || "");
            taskEditState.setUploadedFiles(useTM.currentPreviewTask?.attachments || []);
        }
    }, [taskEditState.currentTaskId]);

    useEffect(() => {
        // Save task before the opening task preview is closed.
        if (taskClosed)
            if (taskEditState.taskBodyEdited) {
                const execute = async () => {
                    await sendUpdatedTask(false);
                    if (useTM.setIsTaskPreviewVisible) {
                        useTM.setIsTaskPreviewVisible(false);
                    }
                };
                execute();
            } else {
                if (useTM.setIsTaskPreviewVisible) {
                    useTM.setIsTaskPreviewVisible(false);
                }
            }
    }, [taskClosed]);

    // Keep the file-count badge in sync with the persisted attachments
    // list. The old cyclical sync that mirrored `uploadedFiles` back
    // into `tmpCurrentTaskContent.attachments` is gone — the upload
    // pipeline now writes the merged result straight into
    // `tmpCurrentTaskContent` (see useSendUpdatedTask), and additions /
    // deletions both update the two stores together via the add path in
    // `TaskTabBlock` and `handleAttachmentDeleted` respectively.
    useEffect(() => {
        reportFileCount(taskEditState.uploadedFiles.length);
    }, [taskEditState.uploadedFiles.length, reportFileCount]);

    useEffect(() => {
        if (useTM.isTaskUpdated === false) {
            useTM.setCurrentPreviewTask(taskEditState.tmpCurrentTaskContent);
            useTM.setIsTaskUpdated(true);
            setAssignee(taskEditState.tmpCurrentTaskContent?.assignee ?? null);
            setReporter(taskEditState.tmpCurrentTaskContent?.reporter || myself);
        }
    }, [taskEditState.tmpCurrentTaskContent]);

    // Get Task Notes. Cancelled-flag guard ensures a slow response
    // for an old taskId can't overwrite the fresh task's notes — the
    // race is real when the user clicks cards faster than the request
    // round-trip and the last-finished-wins ordering would otherwise
    // land them on the wrong card's data.
    const [taskNotes, setTaskNotes] = useState<TaskNoteProps[]>([]);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (useTM.currentPreviewTask?.project) {
                const loadedTaskNotes: TaskNoteProps[] = await loadTaskNotes(
                    myself,
                    Number(useTM.currentPreviewTask.project.projectId),
                    Number(useTM.currentPreviewTask.id),
                    accessToken
                );
                if (cancelled) return;
                const notes = loadedTaskNotes ?? [];
                setTaskNotes(notes);
                markNotesLoaded(notes.length);
            } else {
                if (cancelled) return;
                setTaskNotes([]);
                markNotesLoaded(0);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [taskEditState.currentTaskId, useNM.taskNoteMeta]);

    // Pull this task's dependency edges (blocking / blocked-by) on
    // open. TaskMainBlock reads from `useTM.taskDependencies` so no
    // prop plumbing is needed — just trigger the fetch.
    useEffect(() => {
        const id = Number(useTM.currentPreviewTask?.id);
        if (!Number.isFinite(id) || id <= 0) return;
        void useTM.loadTaskDependenciesFor(id);
    }, [taskEditState.currentTaskId]);

    // Task comments are hoisted into `useTM` (shared with the chat
    // thread's new "Comments" tab so both views read the same list).
    // We keep the load effect here because TaskPreview is the path
    // through which a regular task's comments get refreshed — when
    // the chat thread is open standalone (no preview pane), the
    // ThreadCommentsView component runs its own load.
    const taskComments = useTM.taskComments;
    const setTaskComments = useTM.setTaskComments;
    useEffect(() => {
        const previewTaskId = Number(useTM.currentPreviewTask?.id);
        if (!Number.isFinite(previewTaskId) || previewTaskId <= 0) {
            setTaskComments([]);
            markCommentsLoaded(0);
            return;
        }
        // Cancelled-flag guard: stale comment loads must not clobber
        // the freshly-selected task's data when clicks outrun fetches.
        let cancelled = false;
        (async () => {
            const loadedTaskComments: TaskCommentProps[] = await loadTaskComments(
                myself,
                previewTaskId,
                accessToken
            );
            if (cancelled) return;
            const comments = loadedTaskComments ?? [];
            setTaskComments(comments);
            markCommentsLoaded(comments.length);
        })();
        return () => {
            cancelled = true;
        };
    }, [useTM.isTaskCommentUpdated, taskEditState.currentTaskId]);

    // Get Task Activities. The fetch lives here (rather than inside
    // `TaskActivityFeed`) so the data survives Activity tab unmounts.
    // JoyUI's TabPanel unmounts hidden children by default, so loading
    // inside the feed caused a re-fetch + brief loading flash on every
    // visit to the Activity tab — visually indistinguishable from the
    // preview "refreshing". Hoisting matches the existing pattern for
    // `taskComments` / `taskNotes` and makes Activity tab switching
    // feel as snappy as the others.
    //
    // Refetch triggers mirror the previous in-component logic:
    //   - currentTaskId changes (different task selected)
    //   - isTaskUpdated / isTaskCommentUpdated / isTaskUpdatedBySomeone
    //     flip (something elsewhere in the preview reported a change)
    const [taskActivities, setTaskActivities] = useState<TaskActivityProps[]>([]);
    const [isLoadingTaskActivities, setIsLoadingTaskActivities] = useState(false);
    const taskActivitiesRefetchKey = `${useTM.isTaskUpdated ? "u" : ""}${
        useTM.isTaskCommentUpdated.isUpdate ? "c" : ""
    }${useTM.isTaskUpdatedBySomeone ? "s" : ""}`;
    useEffect(() => {
        const previewTaskId = Number(useTM.currentPreviewTask?.id);
        if (!Number.isFinite(previewTaskId) || previewTaskId <= 0) {
            setTaskActivities([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setIsLoadingTaskActivities(true);
            const rows = await loadTaskActivities(myself, previewTaskId, accessToken);
            if (cancelled) return;
            setTaskActivities(rows);
            setIsLoadingTaskActivities(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [taskEditState.currentTaskId, taskActivitiesRefetchKey]);

    // Get team members
    const [isOpenTeamMembersList, setIsOpenTeamMembersList] = useState(false);
    useEffect(() => {
        updateTeamMembersOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamMembers: useTEM.setTeamMembers,
        });
    }, [isOpenTeamMembersList]);

    // Get team projects
    const [isOpenProjectList, setIsOpenProjectList] = useState(false);
    useEffect(() => {
        updateProjectOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamProjects: usePM.setTeamProjects,
        });
    }, [isOpenProjectList]);

    // Get Project tags
    const [projectTags, setProjectTags] = useState<TagListProps[]>([]);
    const [isOpenTagList, setIsOpenTagList] = useState(false);
    useEffect(() => {
        if (taskEditState.tmpCurrentTaskContent?.project) {
            updateTagOptions({
                myself: myself,
                accessToken: accessToken,
                projectId: taskEditState.tmpCurrentTaskContent.project.projectId,
                setProjectTags: setProjectTags,
            });
        }
    }, [isOpenTagList]);

    // Scroll management — `taskCommentLines` is hoisted via `useTM`
    // (same rationale as `taskComments`) so the chat-thread editor
    // and the task-preview editor agree on line count without an
    // extra prop bridge.
    const taskCommentLines = useTM.taskCommentLines;
    const setTaskCommentLines = useTM.setTaskCommentLines;
    const sheetRef = useRef<HTMLDivElement | null>(null);

    // Scroll to top when the task preview is initially opened
    useEffect(() => {
        setTimeout(() => {
            const sheet = sheetRef.current;
            if (sheet) {
                sheet.scrollTop = 0;
            }
        }, 100);
    }, []);

    // Scroll to top when another task is opened
    useEffect(() => {
        setTimeout(() => {
            const sheet = sheetRef.current;
            if (sheet) {
                sheet.scrollTop = 0;
            }
        }, 100);
    }, [useTM.currentPreviewTaskId]);

    // NOTE: two earlier effects that scrolled `sheetRef` to its bottom
    // (on every `taskCommentLines` change and on every `tabIndex`
    // change) were removed. They forced the outer task-preview sheet to
    // jump to its bottom on every newline while composing a multi-line
    // comment AND on any tab-index state cascade (e.g. the post-send
    // refetch path through `setTabIndexBasedOnContent`), which produced
    // the "page moves a lot" feel users reported on send. The Virtuoso
    // list now uses `followOutput="auto"` to handle its own
    // scroll-to-newest, so we don't need a parallel outer-sheet scroll.

    // Milestone preview takes over when `currentPreviewKind` is set to
    // 'milestone'. We bail out early so the task-edit machinery below
    // doesn't try to load a task that doesn't exist in milestone mode.
    // The milestone branch reuses TaskMainBlock + TaskBodyBlock so the
    // visual language matches a regular task; only the persistence layer
    // differs (it routes through `useSM.updateExistingMilestone` instead
    // of the task-update pipeline).
    //
    // Second branch: when navigating from a task-note's "Open Task" chip
    // into a milestone's backing task, the system seeds
    // `currentPreviewTask` directly without going through the milestone
    // routing. We detect that here and reroute so the user lands on the
    // milestone preview, not the task preview that wraps the backing
    // row.
    const fromNoteMilestoneId =
        useTM.currentPreviewTask?.isMilestone === true &&
        useTM.currentPreviewTask?.milestoneId != null
            ? Number(useTM.currentPreviewTask.milestoneId)
            : null;
    // Third branch (defensive fallback): the chat thread header's
    // "Open Task" button only sets `currentPreviewTaskId` and relies on
    // a downstream load to hydrate `currentPreviewTask`. Two failure
    // modes are possible:
    //   1) The hydration endpoint (e.g. `getTaskByThreadId`) historically
    //      didn't carry `isMilestone`/`milestoneId` — even after the
    //      backend fix, older sessions may serve stale shapes.
    //   2) `currentPreviewTask` is just stale from a previous selection.
    // Look up the id in `useTM.allTasks` (which we keep populated with
    // milestone metadata after milestone create / project task load) as
    // a second source of truth. This catches every "open task by id"
    // entry point — including future ones — without each caller having
    // to manually decide between `setCurrentPreviewTaskId` and
    // `setCurrentPreviewMilestoneId`.
    const fromAllTasksMilestoneId = (() => {
        if (useTM.currentPreviewTaskId == null || useTM.currentPreviewTaskId === -1) {
            return null;
        }
        const match = useTM.allTasks.find((t) => Number(t.id) === useTM.currentPreviewTaskId);
        return match?.isMilestone === true && match.milestoneId != null
            ? Number(match.milestoneId)
            : null;
    })();
    const reroutedMilestoneId = fromNoteMilestoneId ?? fromAllTasksMilestoneId;
    if (
        useSM &&
        ((useTM.currentPreviewKind === "milestone" && useTM.currentPreviewMilestoneId !== -1) ||
            reroutedMilestoneId != null)
    ) {
        const milestoneId =
            useTM.currentPreviewKind === "milestone" && useTM.currentPreviewMilestoneId !== -1
                ? useTM.currentPreviewMilestoneId
                : (reroutedMilestoneId as number);
        return (
            <MilestonePreviewInner
                milestoneId={milestoneId}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useNM={useNM}
                usePM={usePM}
                useSM={useSM}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />
        );
    }

    return (
        <>
            {taskEditState.tmpCurrentTaskContent?.id && (
                <TaskPreviewLayout
                    ref={sheetRef}
                    isDark={isDark}
                    accent={
                        <Box
                            sx={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: "3px",
                                background: isDark
                                    ? "linear-gradient(90deg, #6d28d9 0%, #7c3aed 50%, #9333ea 100%)"
                                    : "linear-gradient(90deg, #a78bfa 0%, #8b5cf6 50%, #c084fc 100%)",
                                borderRadius: "16px 16px 0 0",
                                opacity: 0.8,
                            }}
                        />
                    }
                    header={
                        <TaskTitleBlock
                            isMilestone={previewTaskKind === "milestone"}
                            isPreviewMode={true}
                            isSubTask={previewTaskKind === "subtask"}
                            myself={myself}
                            setTaskClosed={setTaskClosed}
                            setTaskContent={taskEditState.setTmpCurrentTaskContent}
                            setTaskStatusUpdated={taskEditState.setTaskStatusUpdated}
                            setTaskTitle={taskEditState.setTaskTitle}
                            setTaskUpdated={taskEditState.setTaskUpdated}
                            taskContent={taskEditState.tmpCurrentTaskContent}
                            taskTitle={taskEditState.taskTitle}
                            useCM={useCM}
                            useNM={useNM}
                            usePM={usePM}
                            useTM={useTM}
                            useSM={useSM}
                            useUISM={useUISM}
                        />
                    }
                    mainContent={
                        <>
                            <SectionHeader isDark={isDark}>
                                {t.tasks.preview.taskDetails}
                            </SectionHeader>
                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: "12px",
                                    background: isDark
                                        ? "rgba(255,255,255,0.02)"
                                        : "rgba(0,0,0,0.015)",
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(0,0,0,0.04)",
                                }}
                            >
                                <TaskMainBlock
                                    assignee={assignee}
                                    isMilestone={previewTaskKind === "milestone"}
                                    isOpenProjectList={isOpenProjectList}
                                    isOpenTagList={isOpenTagList}
                                    isOpenTeamMembersList={isOpenTeamMembersList}
                                    isPreviewMode={true}
                                    isSubTask={previewTaskKind === "subtask"}
                                    myself={myself}
                                    projectTags={projectTags}
                                    reporter={reporter}
                                    setAssignee={setAssignee}
                                    setIsOpenProjectList={setIsOpenProjectList}
                                    setIsOpenTagList={setIsOpenTagList}
                                    setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                                    setMyself={setMyself}
                                    setProjectTags={setProjectTags}
                                    setReporter={setReporter}
                                    setTaskContent={taskEditState.setTmpCurrentTaskContent}
                                    setTaskStatusUpdated={taskEditState.setTaskStatusUpdated}
                                    setTaskUpdated={taskEditState.setTaskUpdated}
                                    socket={socket}
                                    taskContent={taskEditState.tmpCurrentTaskContent}
                                    useCM={useCM}
                                    usePM={usePM}
                                    useSM={useSM}
                                    useTEM={useTEM}
                                    useTM={useTM}
                                    useUISM={useUISM}
                                />
                            </Box>

                            {(() => {
                                // Auto-detect PR URLs in the task's Links list and
                                // surface a rich card per PR. Source of truth is
                                // `links`; no separate column / input.
                                const prUrls = (taskEditState.tmpCurrentTaskContent.links ?? [])
                                    .map((l) => l.url)
                                    .filter((u) => parsePrUrl(u) !== null);
                                if (prUrls.length === 0) return null;
                                return (
                                    <>
                                        <SectionDivider isDark={isDark} />
                                        <SectionHeader isDark={isDark}>
                                            {t.tasks.linkedPr.header}
                                        </SectionHeader>
                                        <Stack spacing={1}>
                                            {prUrls.map((url) => (
                                                <LinkedPrCard
                                                    key={url}
                                                    accessToken={accessToken ?? ""}
                                                    url={url}
                                                />
                                            ))}
                                        </Stack>
                                    </>
                                );
                            })()}

                            <SectionDivider isDark={isDark} />

                            <Stack direction="row">
                                {/* Body Section */}
                                <SectionHeader isDark={isDark}>
                                    {t.tasks.preview.description}
                                </SectionHeader>
                                {/* Custom Bar */}
                                <TaskCustomBarBlock taskBodySaved={taskEditState.taskBodySaved} />
                            </Stack>
                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: "12px",
                                    background: isDark
                                        ? "rgba(255,255,255,0.02)"
                                        : "rgba(0,0,0,0.015)",
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(0,0,0,0.04)",
                                    minHeight: 150,
                                }}
                            >
                                <TaskBodyBlock
                                    key={`TaskBodyBlock-${taskEditState.tmpCurrentTaskContent.id}`}
                                    body={taskEditState.body}
                                    myself={myself}
                                    setBody={taskEditState.setBody}
                                    setMyself={setMyself}
                                    setTaskBodyEdited={taskEditState.setTaskBodyEdited}
                                    setTaskBodySaved={taskEditState.setTaskBodySaved}
                                    socket={socket}
                                    taskId={taskEditState.tmpCurrentTaskContent.id}
                                    useCM={useCM}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
                                />
                            </Box>

                            <SectionDivider isDark={isDark} />

                            {/* Subtasks Section */}
                            <TaskSubTasksBlock
                                currentTaskContent={taskEditState.tmpCurrentTaskContent}
                                myself={myself}
                                SectionHeader={SectionHeader}
                                setMyself={setMyself}
                                socket={socket}
                                useCM={useCM}
                                useTEM={useTEM}
                                useTM={useTM}
                                useUISM={useUISM}
                            />
                        </>
                    }
                    tabs={
                        <TaskTabBlock
                            editTargetComment={editTargetComment}
                            isInEdit={isInEdit}
                            isLoadingTaskActivities={isLoadingTaskActivities}
                            myself={myself}
                            onAttachmentDeleted={handleAttachmentDeleted}
                            setEditTargetComment={setEditTargetComment}
                            setIsInEdit={setIsInEdit}
                            setMyself={setMyself}
                            setTabIndex={setTabIndex}
                            setTaskCommentLines={setTaskCommentLines}
                            setTaskComments={setTaskComments}
                            setTaskContent={taskEditState.setTmpCurrentTaskContent}
                            setTaskUpdated={taskEditState.setTaskUpdated}
                            setTodoFromMessageBubble={setTodoFromMessageBubble}
                            socket={socket}
                            tabIndex={tabIndex}
                            taskActivities={taskActivities}
                            taskCommentLines={taskCommentLines}
                            taskComments={taskComments}
                            taskContent={taskEditState.tmpCurrentTaskContent}
                            taskNotes={taskNotes}
                            tmpCurrentTaskContent={taskEditState.tmpCurrentTaskContent}
                            useCM={useCM}
                            useNM={useNM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    }
                />
            )}
        </>
    );
};

const STATUS_COLOR: Record<string, string> = {
    Open: "#0044c2",
    WIP: "#ff8c00",
    Pending: "#b900ff",
    Closed: "#1dc200",
    Deleted: "#94a3b8",
};

type MilestonePreviewInnerProps = {
    milestoneId: number;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    usePM: ProjectManagementState;
    useSM: SprintMilestoneManagementState;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useNM: NoteManagementState;
};

// Build a TaskProps-shaped wrapper around a milestone so we can reuse
// `TaskMainBlock`/`TaskBodyBlock`/`TaskTabBlock` directly. The milestone's
// backing TaskMaster row (`m.taskId`) becomes `id` so all task plumbing
// (comments, notes, attachments, body) routes through the existing task
// endpoints. Fields that don't apply to milestones are filled with safe
// defaults.
const milestoneToTaskProps = (
    m: Milestone,
    project: ProjectManagementState["currentProject"],
    fallbackUser: UserProps,
    attachments: TaskProps["attachments"] = [],
    assignee?: UserProps,
    reporter?: UserProps
): TaskProps => {
    const backingTaskId = (m.taskId ?? m.milestoneId) as number;
    // Milestones store only the priority / effort label + numeric code,
    // not the chip colors. Look the colors up from the master tables so
    // the chips in TaskMainBlock render with the same styling as the
    // dropdown options (instead of falling back to transparent).
    const priorityMeta = priorities.find((p) => p.priority === m.priority);
    const effortMeta = effortLevels.find((e) => e.level === m.effortLevel);
    return {
        // Backing task id; falls back to the milestone id if the
        // backend hasn't backfilled yet (extremely rare on fresh data).
        id: backingTaskId,
        project: project,
        title: m.title,
        body: (m.description as PartialBlock[]) ?? [],
        assignee: assignee ?? fallbackUser,
        reporter: reporter ?? fallbackUser,
        chatType: null,
        chatId: null,
        threadId: null,
        startDate: m.startDate ?? null,
        dueDate: m.dueDate ?? "",
        status: {
            code: 0,
            status: m.status as string,
            color: STATUS_COLOR[m.status as string] ?? "#94a3b8",
            textColor: "white",
        },
        priority: {
            code: m.priorityCode ?? -1,
            priority: m.priority ?? "",
            color: priorityMeta?.color ?? "",
            textColor: priorityMeta?.textColor ?? "",
        },
        effortLevel: {
            code: m.effortLevelCode ?? -1,
            level: m.effortLevel ?? "",
            color: effortMeta?.color ?? "",
            textColor: effortMeta?.textColor ?? "",
        },
        tags: (m.tags as TagListProps[]) ?? [],
        // Milestones now persist their own `links` (mirrors
        // `TaskMaster.links`). Reading from `m.links` ensures the
        // URL/Link section in the milestone preview survives a
        // milestone refresh — the previous hard-coded `[]` would
        // wipe a freshly-added link the moment any field on the
        // milestone bumped `tsUpdatedAt`.
        links: (m.links as TaskProps["links"]) ?? [],
        attachments,
        parentTaskId: null,
        // The backing task is itself the root, so children created
        // beneath it inherit `rootTaskId = backingTaskId`. This makes
        // `TaskSubTasksBlock`'s "+ Sub Task" button work out of the
        // box for milestones (it requires `rootTaskId != null`).
        rootTaskId: backingTaskId,
        isMilestone: true,
        // Sprint id is exposed via the SprintMilestonePicker in
        // TaskMainBlock; we attach it as a loose extra field so the
        // picker can read it without TS gymnastics on the official
        // TaskProps shape.
        sprintId: m.sprintId ?? null,
        milestoneId: m.milestoneId,
    } as TaskProps;
};

const milestoneAssigneesToUserProps = (m: Milestone, teamMembers: UserProps[]): UserProps[] => {
    return m.assignees
        .map<UserProps | null>((a) => {
            if (!a.userId) return null;
            const found = teamMembers.find((u) => String(u.userId) === String(a.userId));
            if (found) return found;
            return {
                userId: String(a.userId),
                userName: a.username || a.email || "",
                userEmail: a.email || "",
                avatarImgPath: a.profileImageUrl || "",
                teamId: "",
                teamName: "",
                tsLastSeen: "",
                tsJoined: "",
            } as unknown as UserProps;
        })
        .filter((u): u is UserProps => u != null);
};

// Resolve the milestone's reporter (FK on the milestone) to a UserProps,
// preferring a hit in the team-members list so fields like avatar /
// status are populated. Falls back to a synthesised UserProps from the
// embedded payload, then to the supplied fallback (e.g. `myself`).
const milestoneReporterToUserProps = (
    m: Milestone | null | undefined,
    teamMembers: UserProps[],
    fallback: UserProps
): UserProps => {
    if (!m) return fallback;
    const reporterId = m.reporter?.userId ?? m.reporterId ?? null;
    if (reporterId == null) return fallback;
    const found = teamMembers.find((u) => String(u.userId) === String(reporterId));
    if (found) return found;
    if (m.reporter) {
        return {
            userId: String(m.reporter.userId),
            userName: m.reporter.username || m.reporter.email || "",
            userEmail: m.reporter.email || "",
            avatarImgPath: m.reporter.profileImageUrl || "",
            teamId: "",
            teamName: "",
            tsLastSeen: "",
            tsJoined: "",
        } as unknown as UserProps;
    }
    return fallback;
};

const MilestonePreviewInner = ({
    milestoneId,
    socket,
    myself,
    setMyself,
    usePM,
    useSM,
    useTM,
    useTEM,
    useCM,
    useUISM,
    useNM,
}: MilestonePreviewInnerProps) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? TaskHeaderStyles.dark : TaskHeaderStyles.light;
    const { t } = useTranslation();

    const milestone: Milestone | null = useMemo(() => {
        const projectId = usePM.currentProject?.projectId;
        if (!projectId) return null;
        return (
            useSM.projectMilestones[projectId]?.find((m) => m.milestoneId === milestoneId) ?? null
        );
    }, [usePM.currentProject?.projectId, useSM.projectMilestones, milestoneId]);

    // Per-status task counts for this milestone, computed from
    // `useTM.allTasks` (the Milestone payload only carries `tasksTotal`
    // / `tasksClosed`, not the per-status breakdown). Statuses outside
    // the four headline ones are silently dropped — the strip is a
    // quick at-a-glance breakdown, not a reconciliation against
    // `total`. Excludes the milestone's own backing task row.
    const milestoneTaskCounts = useMemo(() => {
        if (!milestone) return null;
        const counts = { Open: 0, WIP: 0, Pending: 0, Closed: 0 };
        let total = 0;
        for (const task of useTM.allTasks) {
            if (task.milestoneId !== milestone.milestoneId) continue;
            if (task.isMilestone) continue;
            total += 1;
            const s = task.status;
            if (s && s in counts) counts[s as keyof typeof counts] += 1;
        }
        return { counts, total };
    }, [milestone, useTM.allTasks]);

    // Pull the latest copy from the server when this milestone is
    // first opened so child-task aggregates and assignees are fresh.
    useEffect(() => {
        if (milestoneId !== -1) {
            useSM.refreshMilestone(milestoneId);
        }
    }, [milestoneId]);

    // The milestone's backing task carries comments / notes /
    // attachments / body. We hold a fresh copy in local state because
    // those tabs need a `TaskProps` (with attachments expanded) which
    // the lightweight `Milestone` shape doesn't carry.
    const [backingTask, setBackingTask] = useState<TaskProps | null>(null);

    // Load the backing task whenever the milestone (or its taskId)
    // changes so attachments + tags + assignee info are accurate.
    useEffect(() => {
        const taskId = milestone?.taskId;
        const projectId = milestone?.projectId;
        if (taskId == null || projectId == null) {
            setBackingTask(null);
            return;
        }
        let cancelled = false;
        (async () => {
            const loaded: TaskProps[] = await loadSpecificTask(
                myself,
                projectId,
                taskId,
                accessToken
            );
            if (!cancelled && loaded?.length) {
                setBackingTask(loaded[0]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [milestone?.taskId, milestone?.projectId, milestone?.tsUpdatedAt]);

    // Edit state. We mirror the milestone fields locally and persist on
    // change events (debounced for body, immediate for everything else).
    const [titleDraft, setTitleDraft] = useState<string>(milestone?.title ?? "");
    const [bodyDraft, setBodyDraft] = useState<PartialBlock[]>(
        (milestone?.description as PartialBlock[]) ?? []
    );
    const [bodyEdited, setBodyEdited] = useState(false);
    const [bodySaved, setBodySaved] = useState(false);
    const [taskContentLike, setTaskContentLike] = useState<TaskProps>(() =>
        milestoneToTaskProps(milestone ?? ({} as Milestone), usePM.currentProject, myself)
    );
    // Opens the React Flow task-graph modal anchored on this milestone.
    const [openTaskDiagram, setOpenTaskDiagram] = useState(false);
    // Single-assignee state mirrors the normal-task UX. Milestones
    // still use the multi-assignee API under the hood, but the picker
    // is restricted to a single user for parity with regular tasks.
    // Starts unassigned (`null`) so a freshly-opened milestone preview
    // doesn't briefly show "myself" as the assignee before the actual
    // milestone data resolves; the assignee sync effect below populates
    // it from the loaded milestone.
    const [assignee, setAssignee] = useState<UserProps | null>(null);
    // Reporter follows the same lookup pattern as assignee but resolves
    // from the milestone's FK reporter (single user, like normal tasks).
    const [reporter, setReporter] = useState<UserProps>(myself);
    const [uploadedFiles, setUploadedFiles] = useState<TaskProps["attachments"]>([]);

    // Same one-shot tab-index init the regular-task branch uses, keyed
    // off the milestone's backing taskId so opening / re-opening a
    // milestone initializes once and subsequent comment / note /
    // attachment edits don't relocate the user's tab.
    const { tabIndex, setTabIndex, markCommentsLoaded, markNotesLoaded, reportFileCount } =
        useInitialTabIndex(milestone?.taskId);

    // Reset the title / body drafts ONLY when the milestone identity
    // itself changes (i.e. the user switched to a different milestone).
    // Re-running on every `tsUpdatedAt` bump or `backingTask` arrival
    // would clobber an in-progress local edit — e.g. typing into the
    // title input right after mount, while the initial
    // `refreshMilestone` / `loadSpecificTask` calls are still in
    // flight, would otherwise revert the user's keystrokes the moment
    // those async loads resolve. Title is persisted on blur via
    // `saveTitle`; body is auto-saved on a 3s loop and additionally
    // gated by `bodyEdited` so a refresh-driven reset can't wipe an
    // unsaved body either.
    useEffect(() => {
        if (!milestone) return;
        setTitleDraft(milestone.title);
        if (!bodyEdited) {
            setBodyDraft((milestone.description as PartialBlock[]) ?? []);
        }
    }, [milestone?.milestoneId]);

    // Sync the derived UI state (assignee / reporter / task-shaped
    // mirror used by the shared sub-blocks, plus attachments + tab
    // index) whenever the milestone refreshes, the team roster
    // updates, or the backing task finishes loading. These slots are
    // not driven by a free-text input, so re-running here is safe and
    // is in fact required so external changes propagate into the
    // preview.
    useEffect(() => {
        if (!milestone) return;
        const firstAssignee =
            milestoneAssigneesToUserProps(milestone, useTEM.teamMembers)[0] ?? myself;
        setAssignee(firstAssignee);
        const resolvedReporter = milestoneReporterToUserProps(
            milestone,
            useTEM.teamMembers,
            myself
        );
        setReporter(resolvedReporter);
        setTaskContentLike(
            milestoneToTaskProps(
                milestone,
                usePM.currentProject,
                myself,
                backingTask?.attachments ?? [],
                firstAssignee,
                resolvedReporter
            )
        );
        setUploadedFiles(backingTask?.attachments ?? []);
    }, [
        milestone?.milestoneId,
        milestone?.tsUpdatedAt,
        useTEM.teamMembers,
        backingTask?.id,
        backingTask?.attachments,
    ]);

    // Comments + notes for the backing task (not the milestone id).
    // Comments are read from `useTM` (shared shape with the chat
    // thread's Comments tab) but the load effect lives below — the
    // milestone preview keys off `milestone.taskId` directly because
    // `currentPreviewTask` is undefined in milestone mode.
    const taskComments = useTM.taskComments;
    const setTaskComments = useTM.setTaskComments;
    const [taskNotes, setTaskNotes] = useState<TaskNoteProps[]>([]);
    const taskCommentLines = useTM.taskCommentLines;
    const setTaskCommentLines = useTM.setTaskCommentLines;
    const [isInEdit, setIsInEdit] = useState(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();

    useEffect(() => {
        const taskId = milestone?.taskId;
        if (taskId == null) {
            setTaskComments([]);
            markCommentsLoaded(0);
            return;
        }
        (async () => {
            const loaded = await loadTaskComments(myself, taskId, accessToken);
            const comments = loaded ?? [];
            setTaskComments(comments);
            markCommentsLoaded(comments.length);
        })();
    }, [milestone?.taskId, useTM.isTaskCommentUpdated]);

    useEffect(() => {
        const taskId = milestone?.taskId;
        const projectId = milestone?.projectId;
        if (taskId == null || projectId == null) {
            setTaskNotes([]);
            markNotesLoaded(0);
            return;
        }
        (async () => {
            const loaded = await loadTaskNotes(myself, projectId, taskId, accessToken);
            const notes = loaded ?? [];
            setTaskNotes(notes);
            markNotesLoaded(notes.length);
        })();
    }, [milestone?.taskId, milestone?.projectId, useNM.taskNoteMeta]);

    useEffect(() => {
        reportFileCount((uploadedFiles ?? []).length);
    }, [uploadedFiles, reportFileCount]);

    // Mirror the regular-task hoist for activities so milestone previews
    // get the same snappy Activity-tab switching (see comment above the
    // sibling effect in `TaskPreview`).
    const [taskActivities, setTaskActivities] = useState<TaskActivityProps[]>([]);
    const [isLoadingTaskActivities, setIsLoadingTaskActivities] = useState(false);
    const milestoneActivitiesRefetchKey = `${useTM.isTaskUpdated ? "u" : ""}${
        useTM.isTaskCommentUpdated.isUpdate ? "c" : ""
    }${useTM.isTaskUpdatedBySomeone ? "s" : ""}`;
    useEffect(() => {
        const taskId = milestone?.taskId;
        if (taskId == null) {
            setTaskActivities([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setIsLoadingTaskActivities(true);
            const rows = await loadTaskActivities(myself, taskId, accessToken);
            if (cancelled) return;
            setTaskActivities(rows);
            setIsLoadingTaskActivities(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [milestone?.taskId, milestoneActivitiesRefetchKey]);

    // Single-callback replacement for the older two-flag deletion
    // pattern (`isAttachmentDeleted` / `deletedAttachmentId`). Both the
    // persisted list and the milestone's working copy are updated
    // together so there's no observable in-between state.
    const handleAttachmentDeleted = useCallback((attachmentId: number) => {
        setUploadedFiles((prev) => prev.filter((a) => a.attachment_id !== attachmentId));
        setTaskContentLike((prev) => ({
            ...prev,
            attachments: (prev.attachments ?? []).filter((a) => a.attachment_id !== attachmentId),
        }));
    }, []);

    // Project tags / autocomplete options follow the same loading
    // pattern as TaskPreview so the row dropdowns render correctly.
    const [projectTags, setProjectTags] = useState<TagListProps[]>([]);
    const [isOpenTeamMembersList, setIsOpenTeamMembersList] = useState(false);
    const [isOpenProjectList, setIsOpenProjectList] = useState(false);
    const [isOpenTagList, setIsOpenTagList] = useState(false);
    useEffect(() => {
        updateTeamMembersOptions({
            myself,
            accessToken,
            setTeamMembers: useTEM.setTeamMembers,
        });
    }, [isOpenTeamMembersList]);
    useEffect(() => {
        updateProjectOptions({
            myself,
            accessToken,
            setTeamProjects: usePM.setTeamProjects,
        });
    }, [isOpenProjectList]);
    useEffect(() => {
        if (taskContentLike?.project) {
            updateTagOptions({
                myself,
                accessToken,
                projectId: taskContentLike.project.projectId,
                setProjectTags,
            });
        }
    }, [isOpenTagList]);

    // Mirror a freshly-updated milestone onto its backing-task row in
    // `useTM.allTasks` so `DraggableTaskTable` (and anything else
    // reading the table-shaped task list, like the sprint board)
    // re-renders without a full page reload.
    //
    // The table cares about a flattened `TaskTableProps` shape, not
    // the rich `Milestone` shape, so we patch matching fields directly.
    // We always rebuild the row from the server response (rather than
    // diffing per-call-site) so:
    //   - Title saves, body auto-saves and the multi-field
    //     `persistFromTaskContent` path all stay in sync through a
    //     single function.
    //   - Clearing the assignee (`assignees: []`) properly nukes the
    //     row's assignee fields instead of leaving the previous
    //     assignee dangling.
    //   - `tags`/`concatTags` are recomputed together so the tag
    //     column doesn't drift away from the chip list.
    const syncMilestoneToAllTasks = (updated: Milestone) => {
        const backingId = updated.taskId;
        if (backingId == null) return;
        const firstAssignee = updated.assignees?.[0];
        const hasAssignee = firstAssignee?.userId != null;
        const tags = (updated.tags as TagListProps[] | null) ?? [];
        // Match the backend's `concatTags` format ("/tag1/tag2/")
        // exactly so the table's tag-search filter keeps working.
        const concatTags =
            tags.length > 0 ? "/" + tags.map((tg) => tg.tagName).join("/") + "/" : null;
        useTM.setAllTasks((prev) =>
            prev.map((t) =>
                String(t.id) === String(backingId)
                    ? {
                          ...t,
                          title: updated.title ?? t.title,
                          status: updated.status ?? t.status,
                          priority: updated.priority ?? t.priority,
                          effortLevel: updated.effortLevel ?? t.effortLevel,
                          dueDate: updated.dueDate ?? t.dueDate,
                          tags,
                          concatTags,
                          updatedAt: updated.tsUpdatedAt ?? t.updatedAt,
                          assigneeId: hasAssignee ? String(firstAssignee.userId) : null,
                          assigneeName: hasAssignee
                              ? firstAssignee.username || firstAssignee.email || ""
                              : null,
                          assigneeEmail: hasAssignee ? firstAssignee.email || "" : null,
                          assigneeImgPath: hasAssignee
                              ? firstAssignee.profileImageUrl || ""
                              : null,
                          milestoneId: updated.milestoneId,
                          sprintId: updated.sprintId ?? t.sprintId,
                      }
                    : t
            )
        );
    };

    // Persist non-body field changes (sprint, due date, tags, ...) by
    // diffing the synthetic taskContentLike against the server-side
    // milestone whenever we get a "taskUpdated" signal. We keep this
    // handler intentionally narrow: only fields that the milestone API
    // accepts are forwarded.
    const persistFromTaskContent = async (next: TaskProps) => {
        if (!milestone) return;
        const projectId = milestone.projectId;

        // Attachments staged in TaskTabBlock arrive here with negative
        // client-side ids. The regular-task save path uploads these in
        // `sendUpdatedSpecificTask`, but milestone metadata is patched
        // through a different endpoint (PATCH /milestone/<id>/) that
        // doesn't accept files — so without this pass, picking files in
        // the Attachments tab silently went nowhere. We route uploads
        // through the milestone's *backing* task id so the persisted row
        // is reachable via the same `/task/attachment/` listing the
        // backing task already uses.
        const backingTaskId = milestone.taskId;
        if (backingTaskId != null) {
            const pending = next.attachments?.filter((a) => a.attachment_id < 0) ?? [];
            if (pending.length > 0) {
                // Snapshot the negative ids we're about to persist so
                // the post-upload merge only strips THESE rows from
                // `taskContentLike` — any new negative ids added during
                // the round-trip survive and ride the next save cycle
                // (see the matching pattern in useSendUpdatedTask).
                const sentNegativeIds = new Set(pending.map((a) => a.attachment_id));
                try {
                    const uploaded = await uploadTaskAttachments(
                        backingTaskId,
                        pending,
                        accessToken
                    );
                    if (uploaded.length > 0) {
                        const uploadedAttachments = uploaded.map((a: any) => ({
                            attachment_id: a.attachment_id,
                            file: a.attached_file,
                            file_base64: a.file_base64,
                            name: a.name,
                            type: a.attached_type,
                        }));
                        const merge = (prev: TaskProps["attachments"]) => [
                            ...prev.filter((a) => !sentNegativeIds.has(a.attachment_id)),
                            ...uploadedAttachments,
                        ];
                        setUploadedFiles((prev) => merge(prev));
                        setTaskContentLike((prev) => ({
                            ...prev,
                            attachments: merge(prev.attachments ?? []),
                        }));
                    }
                } catch (err) {
                    // Don't block the metadata diff below on an upload
                    // failure — the user's tag / sprint / status edits
                    // are independent of the attachment payload.
                    console.error("Milestone attachment upload failed:", err);
                }
            }
        }

        const patch: Parameters<typeof useSM.updateExistingMilestone>[0] = {
            milestoneId: milestone.milestoneId,
        };
        if (next.startDate !== undefined && next.startDate !== milestone.startDate) {
            patch.startDate = next.startDate || null;
        }
        if (next.dueDate !== undefined && next.dueDate !== milestone.dueDate) {
            patch.dueDate = next.dueDate || null;
        }
        if (
            (next.priority?.priority ?? null) !== (milestone.priority ?? null) ||
            (next.priority?.code ?? null) !== (milestone.priorityCode ?? null)
        ) {
            patch.priority = next.priority?.priority ?? null;
            patch.priorityCode = next.priority?.code ?? null;
        }
        // Effort level mirrors priority: a string label + its numeric
        // code. Only diff when either side actually changed so the
        // network roundtrip stays minimal.
        if (
            (next.effortLevel?.level ?? null) !== (milestone.effortLevel ?? null) ||
            (next.effortLevel?.code ?? null) !== (milestone.effortLevelCode ?? null)
        ) {
            patch.effortLevel = next.effortLevel?.level || null;
            patch.effortLevelCode =
                next.effortLevel?.code != null && next.effortLevel.code >= 0
                    ? next.effortLevel.code
                    : null;
        }
        // Status update from ACTaskStatus picker.
        if ((next.status?.status ?? null) !== (milestone.status ?? null)) {
            patch.status = next.status?.status || undefined;
            patch.statusCode = next.status?.code ?? null;
        }
        if (JSON.stringify(next.tags ?? []) !== JSON.stringify(milestone.tags ?? [])) {
            patch.tags = next.tags ?? [];
        }
        // Links diff: persist `DynamicURLManager` edits the same way
        // tags do. Without this, adding a link in the milestone
        // preview would update local state but the very next
        // server-driven reset (e.g. another field's PATCH bumping
        // `tsUpdatedAt`) would wipe it back to `[]`.
        if (
            JSON.stringify(next.links ?? []) !==
            JSON.stringify(((milestone.links as TaskProps["links"]) ?? []) as unknown[])
        ) {
            patch.links = next.links ?? [];
        }
        const nextSprintId = (next as unknown as { sprintId?: number | null }).sprintId;
        if (nextSprintId !== undefined && nextSprintId !== milestone.sprintId) {
            patch.sprintId = nextSprintId ?? null;
        }
        // Single-assignee: persist as a single-element list against the
        // milestone's multi-assignee API. An empty list clears it.
        const nextAssigneeId = next.assignee?.userId ? String(next.assignee.userId) : null;
        const currentAssigneeId = milestone.assignees?.[0]?.userId
            ? String(milestone.assignees[0].userId)
            : null;
        if (nextAssigneeId !== currentAssigneeId) {
            patch.assigneeIds = nextAssigneeId ? [nextAssigneeId] : [];
        }
        // Reporter diff (single-user FK on the milestone). Mirrors the
        // assignee diff above so a swap from picker -> server is sent
        // exactly once and only when something actually changed.
        const nextReporterId = next.reporter?.userId ? String(next.reporter.userId) : null;
        const currentReporterId = milestone.reporter?.userId
            ? String(milestone.reporter.userId)
            : milestone.reporterId != null
              ? String(milestone.reporterId)
              : null;
        if (nextReporterId !== currentReporterId) {
            patch.reporterId = nextReporterId;
        }
        // No actual changes worth a network round-trip.
        if (Object.keys(patch).length <= 1) return;
        const updated = await useSM.updateExistingMilestone(patch, projectId);
        if (updated) syncMilestoneToAllTasks(updated);
    };

    // Title save on blur / Enter.
    const saveTitle = async () => {
        if (!milestone) return;
        if (titleDraft.trim() === milestone.title) return;
        const updated = await useSM.updateExistingMilestone(
            { milestoneId: milestone.milestoneId, title: titleDraft.trim() },
            milestone.projectId
        );
        if (updated) syncMilestoneToAllTasks(updated);
    };

    // One-click status transition triggered by the header buttons
    // ("Start Milestone" / "Complete Milestone"). Mirrors the task-side
    // pattern in `TaskTitleBlock` but routes through the milestone API
    // (`PATCH /api/v2/milestone/<id>/`) so the authoritative milestone
    // record is updated; `syncMilestoneToAllTasks` then mirrors the new
    // status onto the backing task row so the table / sprint board /
    // dashboard re-render without a refresh.
    const handleMilestoneStatusChange = async (newStatus: string) => {
        if (!milestone) return;
        if (milestone.status === newStatus) return;
        const updated = await useSM.updateExistingMilestone(
            { milestoneId: milestone.milestoneId, status: newStatus },
            milestone.projectId
        );
        if (updated) syncMilestoneToAllTasks(updated);
    };

    // Auto-save body every 3s when edited (mirrors TaskPreview's loop).
    useEffect(() => {
        const id = setInterval(async () => {
            if (!milestone) return;
            if (!bodyEdited) return;
            const updated = await useSM.updateExistingMilestone(
                {
                    milestoneId: milestone.milestoneId,
                    description: bodyDraft,
                },
                milestone.projectId
            );
            // Body changes don't show in the table, but we still want
            // tsUpdatedAt to bump there so any "Updated" column / sort
            // stays correct after a description-only edit.
            if (updated) syncMilestoneToAllTasks(updated);
            setBodyEdited(false);
            setBodySaved(true);
        }, 3000);
        return () => clearInterval(id);
    }, [bodyEdited, bodyDraft, milestone?.milestoneId]);

    // When TaskMainBlock signals taskUpdated, propagate.
    const [taskUpdated, setTaskUpdated] = useState(false);
    useEffect(() => {
        if (!taskUpdated) return;
        persistFromTaskContent(taskContentLike);
        setTaskUpdated(false);
    }, [taskUpdated]);

    // Re-trigger the save when attachments still contain negative-id
    // rows after a save just completed. Matches the regular-task
    // sibling — without it, a file dropped during an in-flight upload
    // would coalesce its `setTaskUpdated(true)` into the already-true
    // flag and never get POSTed.
    useEffect(() => {
        if (taskUpdated) return;
        const hasPending = (taskContentLike.attachments ?? []).some((a) => a.attachment_id < 0);
        if (hasPending) setTaskUpdated(true);
    }, [taskUpdated, taskContentLike.attachments]);

    // Auto-close the preview after 3s when the milestone can't be
    // resolved (e.g. landed on a stale URL after a hard refresh while
    // the store is still hydrating). Lives in a `useEffect` rather than
    // inline in the `if (!milestone)` render branch so:
    //   - We don't schedule a fresh timeout on every render of the
    //     loading state (the inline `setTimeout` would queue dozens of
    //     redundant `setIsTaskPreviewVisible(false)` calls).
    //   - And, critically, we keep the hook-call order stable across
    //     renders. The previous layout had a `useEffect` *after* the
    //     `if (!milestone)` early return, so on the first render
    //     (milestone still loading → null) React saw fewer hooks than
    //     on the next render (milestone resolved → all hooks run),
    //     tripping "change in the order of Hooks" after a hard refresh.
    useEffect(() => {
        if (milestone) return;
        const id = setTimeout(() => {
            useTM.setIsTaskPreviewVisible(false);
        }, 3000);
        return () => clearTimeout(id);
    }, [milestone]);

    if (!milestone) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography level="body-sm">{t.tasks.preview.loadingMilestone}</Typography>
            </Box>
        );
    }

    const previewLayout = (
        <TaskPreviewLayout
            isDark={isDark}
            accent={
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background:
                            "linear-gradient(90deg, #6d28d9 0%, #7c3aed 50%, #9333ea 100%)",
                        borderRadius: "16px 16px 0 0",
                    }}
                />
            }
            header={
                <>
                    <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1.5 }}>
                        <FlagRoundedIcon sx={{ color: "#f97316", fontSize: 18 }} />
                        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                            Milestone
                        </Typography>
                        {/* Status Transition Buttons — mirror the task-
                        header buttons (TaskTitleBlock.tsx:135) so the
                        milestone preview gets the same one-click
                        Open/Pending → WIP → Closed flow. */}
                        {(milestone.status === "Open" || milestone.status === "Pending") && (
                            <Button
                                size="sm"
                                startDecorator={<PlayArrowRoundedIcon sx={{ fontSize: 16 }} />}
                                variant="soft"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                    background:
                                        "linear-gradient(135deg, #ff9500 0%, #ff6b00 100%)",
                                    color: "white",
                                    boxShadow: "0 2px 8px rgba(255, 140, 0, 0.25)",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        background:
                                            "linear-gradient(135deg, #ffa726 0%, #ff7043 100%)",
                                        boxShadow: "0 4px 12px rgba(255, 140, 0, 0.35)",
                                        transform: "translateY(-1px)",
                                    },
                                    "&:active": {
                                        transform: "translateY(0)",
                                        boxShadow: "0 2px 6px rgba(255, 140, 0, 0.2)",
                                    },
                                }}
                                onClick={() => handleMilestoneStatusChange("WIP")}
                            >
                                Start Milestone
                            </Button>
                        )}
                        {milestone.status === "WIP" && (
                            <Button
                                size="sm"
                                startDecorator={<TaskAltRoundedIcon sx={{ fontSize: 16 }} />}
                                variant="soft"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                    background:
                                        "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)",
                                    color: "white",
                                    boxShadow: "0 2px 8px rgba(76, 175, 80, 0.25)",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        background:
                                            "linear-gradient(135deg, #66bb6a 0%, #388e3c 100%)",
                                        boxShadow: "0 4px 12px rgba(76, 175, 80, 0.35)",
                                        transform: "translateY(-1px)",
                                    },
                                    "&:active": {
                                        transform: "translateY(0)",
                                        boxShadow: "0 2px 6px rgba(76, 175, 80, 0.2)",
                                    },
                                }}
                                onClick={() => handleMilestoneStatusChange("Closed")}
                            >
                                Complete Milestone
                            </Button>
                        )}
                        <Chip
                            key={`milestone-status-${milestone.status}`}
                            size="md"
                            variant="soft"
                            sx={{
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                px: 1.5,
                                backgroundColor: alpha(
                                    STATUS_COLOR[milestone.status as string] ?? "#666",
                                    isDark ? 0.25 : 0.65
                                ),
                                color: "#ffffff",
                                border: "1px solid",
                                borderColor: alpha(
                                    STATUS_COLOR[milestone.status as string] ?? "#666",
                                    isDark ? 0.3 : 0.25
                                ),
                            }}
                        >
                            {milestone.status}
                        </Chip>
                        <Box sx={{ flex: 1 }} />
                        {/* Diagram trigger — opens the React Flow task
                            graph anchored on this milestone. Gated on
                            `taskId` (the backing TaskMaster row) because
                            the diagram walks the parent_task_id tree
                            from there. */}
                        {milestone.taskId != null && milestone.projectId != null && (
                            <AppTooltip
                                title={fmt(t.tasks.tooltips.openTaskGraphWithShortcut, {
                                    shortcut: `${getServiceShortcutModifierKeys().join(
                                        " + "
                                    )} + G`,
                                })}
                            >
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        background: styles.buttonBg,
                                        border: `1px solid ${styles.buttonBorder}`,
                                        borderRadius: "10px",
                                        width: "36px",
                                        height: "36px",
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            background: styles.buttonHover,
                                            transform: "translateY(-1px)",
                                        },
                                    }}
                                    onClick={() => setOpenTaskDiagram(true)}
                                >
                                    <AccountTreeRoundedIcon
                                        sx={{ fontSize: 20, color: styles.textColor }}
                                    />
                                </IconButton>
                            </AppTooltip>
                        )}
                        {(() => {
                            const items: MoreMenuItem[] = [
                                {
                                    id: "copyMilestoneLink",
                                    label: t.tasks.preview.menu.copyMilestoneLink,
                                    icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
                                    onClick: async () => {
                                        if (milestone.projectId && milestone.milestoneId) {
                                            const milestoneUrl = `${window.location.origin}/workspace/tasks/project/${milestone.projectId}/milestone/${milestone.milestoneId}`;
                                            try {
                                                await navigator.clipboard.writeText(milestoneUrl);
                                            } catch (err) {
                                                console.error("Failed to copy link:", err);
                                            }
                                        }
                                    },
                                },
                                {
                                    id: "newTask",
                                    label: t.tasks.preview.menu.newTask,
                                    icon: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />,
                                    onClick: () => {
                                        if (milestone.taskId == null) return;
                                        useTM.setIsCreatingTask({
                                            flag: true,
                                            parentTaskId: milestone.taskId,
                                            rootTaskId: milestone.taskId,
                                            creationKind: "task",
                                            milestoneId: milestone.milestoneId,
                                        });
                                        useTM.setIsTaskTableVisible(false);
                                    },
                                },
                                {
                                    id: "openNote",
                                    label: t.tasks.preview.menu.openNote,
                                    icon: <NoteAltRoundedIcon sx={{ fontSize: 18 }} />,
                                    onClick: () => {
                                        if (
                                            useNM.setIsTaskNoteVisible &&
                                            milestone.projectId &&
                                            milestone.taskId != null
                                        ) {
                                            useTM.setIsTaskTableVisible(false);
                                            useNM.setIsTaskNoteVisible(true);
                                            if (useNM.taskNoteMeta.length > 0) {
                                                const meta = useNM
                                                    .taskNoteMeta[0] as TaskNoteProps;
                                                useNM.tabsApi.openTab({
                                                    kind: "task",
                                                    noteType: 2,
                                                    noteId: meta.noteId,
                                                    projectId: meta.projectId,
                                                    taskId: meta.taskId,
                                                    id: `task-${meta.noteId}`,
                                                    title: meta.title,
                                                    teamId: myself.teamId,
                                                });
                                            } else {
                                                useNM.handleCreateNewTaskNote(
                                                    null,
                                                    milestone.projectId,
                                                    milestone.taskId,
                                                    milestone.title
                                                );
                                            }
                                        }
                                    },
                                },
                                {
                                    id: "newTag",
                                    label: t.tasks.preview.menu.newTag,
                                    icon: <LocalOfferRoundedIcon sx={{ fontSize: 18 }} />,
                                    onClick: () => {
                                        useTM.setOpenCreateTag(true);
                                    },
                                },
                                {
                                    id: "newProject",
                                    label: t.tasks.preview.menu.newProject,
                                    icon: <AddIcon sx={{ fontSize: 18 }} />,
                                    onClick: () => {
                                        usePM.setOpenCreateProject(true);
                                    },
                                },
                                {
                                    id: "deleteMilestone",
                                    label: t.tasks.preview.menu.deleteMilestone,
                                    icon: <DeleteRoundedIcon sx={{ fontSize: 18 }} />,
                                    danger: true,
                                    onClick: async () => {
                                        if (!confirm(t.tasks.preview.confirmDeleteMilestone))
                                            return;
                                        await useSM.removeMilestone(
                                            milestone.milestoneId,
                                            milestone.projectId
                                        );
                                        useTM.setCurrentPreviewKind("task");
                                        useTM.setCurrentPreviewMilestoneId(-1);
                                        useTM.setIsTaskPreviewVisible(false);
                                        // Same dual-gate trap as the milestone Close
                                        // button: when the preview was opened from a
                                        // task note, the surrounding `TaskPreviewPanel`
                                        // is mounted by `useNM.isTaskVisibleInNote`
                                        // rather than `useTM`, so flipping `useTM`
                                        // alone leaves the panel showing a now-deleted
                                        // milestone. Clear the NM flag too.
                                        if (useNM.setIsTaskVisibleInNote) {
                                            useNM.setIsTaskVisibleInNote(false);
                                        }
                                    },
                                },
                            ];
                            return (
                                <MoreMenu
                                    iconFontSize={20}
                                    items={items}
                                    menuMinWidth={220}
                                    placement="bottom-end"
                                    triggerSize={36}
                                    triggerSx={{
                                        background: styles.buttonBg,
                                        border: `1px solid ${styles.buttonBorder}`,
                                        borderRadius: "10px",
                                    }}
                                />
                            );
                        })()}

                        <AppTooltip title={t.tasks.preview.closeTooltip}>
                            <IconButton
                                size="sm"
                                variant="plain"
                                sx={{
                                    background: styles.dangerBg,
                                    border: `1px solid ${styles.dangerBorder}`,
                                    borderRadius: "10px",
                                    width: "36px",
                                    height: "36px",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: styles.dangerHover,
                                        transform: "translateY(-1px)",
                                    },
                                }}
                                onClick={() => {
                                    useTM.setIsTaskPreviewVisible(false);
                                    useTM.setCurrentPreviewKind("task");
                                    useTM.setCurrentPreviewMilestoneId(-1);
                                    useTM.setTableMilestoneFilterId(null);
                                    if (
                                        useTM.isTaskTableVisible === false &&
                                        useTM.isSprintBoardVisible === false &&
                                        useTM.isTaskDashboardVisible === false
                                    ) {
                                        useTM.setIsTaskTableVisible(true);
                                    }

                                    // When the milestone preview was opened from a
                                    // task note (NoteHeaderActions → onOpenTask
                                    // flips `useNM.isTaskVisibleInNote=true`), the
                                    // surrounding `TaskPreviewPanel` is gated by
                                    // that NM flag rather than by `useTM`. So the
                                    // `setIsTaskPreviewVisible(false)` above has no
                                    // visible effect — the panel only unmounts
                                    // when we also clear the NM flag. Mirror the
                                    // close path in `TaskTitleBlock.tsx`.
                                    if (useNM.setIsTaskVisibleInNote) {
                                        useNM.setIsTaskVisibleInNote(false);
                                    }
                                }}
                            >
                                <CancelIcon
                                    sx={{
                                        fontSize: "20px",
                                        color: isDark ? "#f87171" : "#dc2626",
                                    }}
                                />
                            </IconButton>
                        </AppTooltip>
                    </Stack>

                    {/* Per-status task progress for this milestone.
                        Hidden when the milestone has no child tasks so
                        empty milestones don't show a row of zeros.
                        Colors mirror the milestone status palette used
                        on the sidebar / picker (Open=blue, WIP=orange,
                        Pending=purple, Closed=green) so the chips read
                        consistently across the app. */}
                    {milestoneTaskCounts && milestoneTaskCounts.total > 0 && (
                        <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{
                                flexWrap: "wrap",
                                alignItems: "center",
                                rowGap: 0.75,
                                mb: 1.5,
                            }}
                        >
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                                    mr: 0.25,
                                }}
                            >
                                Task progress
                            </Typography>
                            {(["Open", "WIP", "Pending", "Closed"] as const).map((s) => {
                                const tone = MILESTONE_STATUS_CHIP_COLORS[s];
                                return (
                                    <Chip
                                        key={s}
                                        size="sm"
                                        variant="soft"
                                        sx={{
                                            backgroundColor: alpha(
                                                tone.color,
                                                isDark ? 0.28 : 0.14
                                            ),
                                            color: isDark ? "rgba(255,255,255,0.92)" : tone.color,
                                            border: "1px solid",
                                            borderColor: alpha(tone.color, isDark ? 0.4 : 0.3),
                                            fontWeight: 600,
                                            fontSize: "0.72rem",
                                            borderRadius: "6px",
                                            px: 1,
                                        }}
                                    >
                                        {s}: {milestoneTaskCounts.counts[s]}
                                    </Chip>
                                );
                            })}
                            <Typography
                                level="body-xs"
                                sx={{
                                    opacity: 0.6,
                                    color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                                    ml: 0.5,
                                }}
                            >
                                · {milestoneTaskCounts.total} total
                            </Typography>
                        </Stack>
                    )}

                    <Input
                        size="lg"
                        sx={{ fontSize: 18, fontWeight: 600 }}
                        value={titleDraft}
                        onBlur={saveTitle}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                    />
                </>
            }
            mainContent={
                <>
                    <SectionHeader isDark={isDark}>
                        {t.tasks.preview.milestoneDetails}
                    </SectionHeader>
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: "12px",
                            background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                        }}
                    >
                        <TaskMainBlock
                            assignee={assignee}
                            isMilestone={true}
                            isOpenProjectList={isOpenProjectList}
                            isOpenTagList={isOpenTagList}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            isPreviewMode={true}
                            myself={myself}
                            projectTags={projectTags}
                            reporter={reporter}
                            setAssignee={setAssignee}
                            setIsOpenProjectList={setIsOpenProjectList}
                            setIsOpenTagList={setIsOpenTagList}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            setMyself={setMyself}
                            setProjectTags={setProjectTags}
                            setReporter={setReporter}
                            setTaskUpdated={setTaskUpdated}
                            socket={socket}
                            taskContent={taskContentLike}
                            useCM={useCM}
                            usePM={usePM}
                            useSM={useSM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                            setTaskContent={(next) => {
                                setTaskContentLike(next);
                                setTaskUpdated(true);
                            }}
                        />
                    </Box>

                    <SectionDivider isDark={isDark} />

                    <Stack direction="row">
                        <SectionHeader isDark={isDark}>
                            {t.tasks.preview.description}
                        </SectionHeader>
                        <TaskCustomBarBlock taskBodySaved={bodySaved} />
                    </Stack>
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: "12px",
                            background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                            minHeight: 150,
                        }}
                    >
                        <TaskBodyBlock
                            key={`MilestoneBody-${milestone.milestoneId}`}
                            body={bodyDraft}
                            myself={myself}
                            setMyself={setMyself}
                            setTaskBodyEdited={setBodyEdited}
                            setTaskBodySaved={setBodySaved}
                            taskId={milestone.taskId ?? milestone.milestoneId}
                            useCM={useCM}
                            socket={socket}
                            // Body-attachment uploads (`POST /task/body/attachment/`)
                            // resolve through `TaskBodyAttachmentFact.task` →
                            // `TaskMaster.task_id`. Milestones don't have their
                            // own row in TaskMaster, but each one is backed by
                            // a real task row whose id is `milestone.taskId`.
                            // Passing `milestoneId` here used to make the FK
                            // lookup fail (silently-broken image / file
                            // uploads in the milestone body editor); the
                            // backing task id is what the server actually
                            // accepts. We fall back to `milestoneId` only as a
                            // belt-and-suspenders for partial server payloads
                            // where `taskId` hasn't been backfilled yet.
                            useTEM={useTEM}
                            useUISM={useUISM}
                            setBody={(next) => {
                                setBodyDraft(next);
                            }}
                        />
                    </Box>

                    <SectionDivider isDark={isDark} />

                    {/* Tasks-in-this-milestone. Structurally identical to
                        a normal task's "Sub Tasks" block — the only
                        difference is that the parent here is the
                        milestone's backing task (taskContentLike.id =
                        milestone.taskId), so children created via the "+
                        Task" button are persisted with that as their
                        parent_task_id. */}
                    <TaskSubTasksBlock
                        buttonLabel={t.tasks.preview.taskButton}
                        currentTaskContent={taskContentLike}
                        emptyText={t.tasks.preview.emptyMilestoneTasks}
                        forceLoad={true}
                        myself={myself}
                        SectionHeader={SectionHeader}
                        setMyself={setMyself}
                        socket={socket}
                        title={t.tasks.preview.tasksInThisMilestone}
                        useCM={useCM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                </>
            }
            tabs={
                // Comments / notes / attachments — same as a normal task.
                // The milestone's backing task id flows through
                // `taskContentLike.id`, so all task-* endpoints operate
                // transparently on the milestone. Suppress the entire
                // tabs wrapper while the backing task id is missing.
                milestone.taskId != null ? (
                    <TaskTabBlock
                        editTargetComment={editTargetComment}
                        isInEdit={isInEdit}
                        isLoadingTaskActivities={isLoadingTaskActivities}
                        myself={myself}
                        onAttachmentDeleted={handleAttachmentDeleted}
                        setEditTargetComment={setEditTargetComment}
                        setIsInEdit={setIsInEdit}
                        setMyself={setMyself}
                        setTabIndex={setTabIndex}
                        setTaskCommentLines={setTaskCommentLines}
                        setTaskComments={setTaskComments}
                        setTaskContent={setTaskContentLike}
                        setTaskUpdated={setTaskUpdated}
                        socket={socket}
                        tabIndex={tabIndex}
                        taskActivities={taskActivities}
                        taskCommentLines={taskCommentLines}
                        taskComments={taskComments}
                        taskContent={taskContentLike}
                        taskNotes={taskNotes}
                        tmpCurrentTaskContent={taskContentLike}
                        useCM={useCM}
                        useNM={useNM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                ) : null
            }
        />
    );

    // Modal portals to body, so it lives as a sibling of the
    // TaskPreviewLayout. Gated on `taskId` (the milestone's backing
    // TaskMaster row) because that's the diagram's root.
    return (
        <>
            {previewLayout}
            {milestone.taskId != null && milestone.projectId != null && (
                <ModalTaskDiagram
                    open={openTaskDiagram}
                    onClose={() => setOpenTaskDiagram(false)}
                    myself={myself}
                    rootTaskId={milestone.taskId}
                    projectId={milestone.projectId}
                    rootLabel={`${milestone.title || "Milestone"} · diagram`}
                    useTM={useTM}
                    usePM={usePM}
                    useSM={useSM}
                />
            )}
        </>
    );
};
