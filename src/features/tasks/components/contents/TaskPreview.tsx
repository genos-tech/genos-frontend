import { useEffect, useMemo, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import {
    Box,
    Button,
    Chip,
    Divider,
    Dropdown,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    Sheet,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Socket } from "socket.io-client";

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
import { UserProps } from "../../../../types/admin";
import { TaskNoteProps } from "../../../../types/notes";
import { TagListProps, TaskCommentProps, TaskProps } from "../../../../types/tasks";
import { loadTaskNotes } from "../../../notes/task-notes/services/loadTaskNotes";
import { loadSpecificTask } from "../../services/loadSpecificTask";
import { loadTaskComments } from "../../services/loadTaskComments";
import {
    updateProjectOptions,
    updateTagOptions,
    updateTeamMembersOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { Milestone } from "../../sprint-milestone/types";
import { effortLevels, priorities } from "../../utils/taskMeta";
import { TaskBodyBlock } from "./base/TaskBodyBlock";
import { TaskCustomBarBlock } from "./base/TaskCustomBarBlock";
import { TaskMainBlock } from "./base/TaskMainBlock";
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
};

export const TaskPreview = (props: TaskPreviewProps) => {
    const { socket, myself, setMyself, usePM, useNM, useTM, useSM, useUISM, useTEM, useCM } =
        props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [taskClosed, setTaskClosed] = useState(false);
    const [isAttachmentDeleted, setIsAttachmentDeleted] = useState(false);
    const [deletedAttachmentId, setDeletedAttachmentId] = useState<number>(-1);
    const [assignee, setAssignee] = useState<UserProps>(
        useTM.currentPreviewTask?.assignee || myself
    );
    const [reporter, setReporter] = useState<UserProps>(
        useTM.currentPreviewTask?.reporter || myself
    );
    const [tabIndex, setTabIndex] = useState(0);

    // For task comments
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();

    // Consolidated task edit state
    const taskEditState = useTaskEditState(useTM.currentPreviewTask);

    // Set the current preview task when the component is mounted
    useEffect(() => {
        taskEditState.setTmpCurrentTaskContent(useTM.currentPreviewTask || ({} as TaskProps));
    }, []);

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

    useEffect(() => {
        if (taskEditState.startIntervalUpdatingTask) {
            sendUpdatedTask(false);
        }
    }, [taskEditState.startIntervalUpdatingTask]);

    // Auto save task body every Nms if needed
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (taskEditState.taskBodyEdited === true) {
                taskEditState.setStartIntervalUpdatingTask(true);
            }
        }, 3000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [taskEditState.taskBodyEdited]);

    // Update variables when an user change the target task
    useEffect(() => {
        if (taskEditState.taskBodyEdited) {
            sendUpdatedTask(true);
        } else {
            if (useTM.currentPreviewTask) {
                taskEditState.setTmpCurrentTaskContent(useTM.currentPreviewTask);
                taskEditState.setCurrentTaskId(useTM.currentPreviewTask.id);
                taskEditState.setTaskTitle(useTM.currentPreviewTask.title);
                taskEditState.setBody(useTM.currentPreviewTask.body || []);
                taskEditState.setUploadedFiles(useTM.currentPreviewTask.attachments || []);
            }
        }
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

    // Update attachments
    useEffect(() => {
        if (
            taskEditState.tmpCurrentTaskContent !== null &&
            taskEditState.tmpCurrentTaskContent !== undefined &&
            taskEditState.uploadedFiles.length > 0
        ) {
            (async () => {
                taskEditState.setTmpCurrentTaskContent({
                    ...taskEditState.tmpCurrentTaskContent,
                    attachments: taskEditState.uploadedFiles,
                });
                setAssignee(taskEditState.tmpCurrentTaskContent.assignee);
                setReporter(taskEditState.tmpCurrentTaskContent.reporter);
            })();
        }
    }, [taskEditState.uploadedFiles]);

    useEffect(() => {
        if (useTM.isTaskUpdated === false) {
            useTM.setCurrentPreviewTask(taskEditState.tmpCurrentTaskContent);
            useTM.setIsTaskUpdated(true);
            setAssignee(taskEditState.tmpCurrentTaskContent?.assignee || myself);
            setReporter(taskEditState.tmpCurrentTaskContent?.reporter || myself);
        }
    }, [taskEditState.tmpCurrentTaskContent]);

    useEffect(() => {
        if (deletedAttachmentId !== -1 && isAttachmentDeleted === true) {
            taskEditState.setUploadedFiles((prev) =>
                prev.filter((attachment) => attachment.attachment_id !== deletedAttachmentId)
            );
            setIsAttachmentDeleted(false);
            setDeletedAttachmentId(-1);
        }
    }, [isAttachmentDeleted, deletedAttachmentId]);

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
            return;
        }
        (async () => {
            const loadedTaskComments: TaskCommentProps[] = await loadTaskComments(
                myself,
                previewTaskId,
                accessToken
            );
            if (loadedTaskComments.length > 0) {
                setTaskComments(loadedTaskComments);
            } else {
                setTaskComments([]);
            }
        })();
    }, [useTM.isTaskCommentUpdated, taskEditState.currentTaskId]);

    // Get Task Notes
    const [taskNotes, setTaskNotes] = useState<TaskNoteProps[]>([]);
    useEffect(() => {
        (async () => {
            if (useTM.currentPreviewTask?.project) {
                const loadedTaskNotes: TaskNoteProps[] = await loadTaskNotes(
                    myself,
                    Number(useTM.currentPreviewTask.project.projectId),
                    Number(useTM.currentPreviewTask.id),
                    accessToken
                );
                if (loadedTaskNotes.length > 0) {
                    setTaskNotes(loadedTaskNotes);
                } else {
                    setTaskNotes([]);
                }
            } else {
                setTaskNotes([]);
            }
        })();
    }, [taskEditState.currentTaskId, useNM.taskNoteMeta]);

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

    useEffect(() => {
        const sheet = sheetRef.current;
        if (sheet && taskCommentLines > 1) {
            sheet.scrollTop = sheet.scrollHeight;
        }
    }, [taskCommentLines]);

    useEffect(() => {
        const sheet = sheetRef.current;
        if (sheet) {
            sheet.scrollTop = sheet.scrollHeight;
        }
    }, [tabIndex]);

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
                socket={socket}
                myself={myself}
                setMyself={setMyself}
                usePM={usePM}
                useSM={useSM}
                useTM={useTM}
                useTEM={useTEM}
                useCM={useCM}
                useUISM={useUISM}
                useNM={useNM}
            />
        );
    }

    return (
        <>
            {taskEditState.tmpCurrentTaskContent?.id && (
                <Sheet
                    ref={sheetRef}
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    sx={{
                        minHeight: 500,
                        borderRadius: "16px",
                        p: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        background: isDark
                            ? "linear-gradient(180deg, rgba(22,22,28,0.98) 0%, rgba(18,18,24,1) 100%)"
                            : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,252,255,1) 100%)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                        boxShadow: isDark
                            ? "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)"
                            : "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
                        position: "relative",
                        animation: "slideIn 0.3s ease-out",
                        "@keyframes slideIn": {
                            from: { opacity: 0, transform: "translateY(8px)" },
                            to: { opacity: 1, transform: "translateY(0)" },
                        },
                    }}
                >
                    {/* Gradient accent at top */}
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "3px",
                            background: isDark
                                ? "linear-gradient(90deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)"
                                : "linear-gradient(90deg, #22c55e 0%, #16a34a 50%, #15803d 100%)",
                            borderRadius: "16px 16px 0 0",
                            opacity: 0.8,
                        }}
                    />

                    {/* Header Section */}
                    <Box
                        sx={{
                            p: 2.5,
                            pt: 3,
                            borderBottom: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        }}
                    >
                        <TaskTitleBlock
                            useCM={useCM}
                            isPreviewMode={true}
                            myself={myself}
                            setTaskClosed={setTaskClosed}
                            setTaskContent={taskEditState.setTmpCurrentTaskContent}
                            setTaskStatusUpdated={taskEditState.setTaskStatusUpdated}
                            setTaskTitle={taskEditState.setTaskTitle}
                            setTaskUpdated={taskEditState.setTaskUpdated}
                            taskContent={taskEditState.tmpCurrentTaskContent}
                            taskTitle={taskEditState.taskTitle}
                            useTM={useTM}
                            useUISM={useUISM}
                            useNM={useNM}
                            usePM={usePM}
                        />
                    </Box>

                    {/* Main Content Section */}
                    <Box sx={{ p: 2.5 }}>
                        <SectionHeader isDark={isDark}>Task Details</SectionHeader>
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
                                useCM={useCM}
                                isOpenProjectList={isOpenProjectList}
                                isOpenTagList={isOpenTagList}
                                isOpenTeamMembersList={isOpenTeamMembersList}
                                isPreviewMode={true}
                                myself={myself}
                                projectTags={projectTags}
                                setProjectTags={setProjectTags}
                                reporter={reporter}
                                setAssignee={setAssignee}
                                setIsOpenProjectList={setIsOpenProjectList}
                                setIsOpenTagList={setIsOpenTagList}
                                setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                                setMyself={setMyself}
                                setReporter={setReporter}
                                setTaskContent={taskEditState.setTmpCurrentTaskContent}
                                setTaskStatusUpdated={taskEditState.setTaskStatusUpdated}
                                setTaskUpdated={taskEditState.setTaskUpdated}
                                socket={socket}
                                taskContent={taskEditState.tmpCurrentTaskContent}
                                useTEM={useTEM}
                                useTM={useTM}
                                useSM={useSM}
                                useUISM={useUISM}
                                usePM={usePM}
                            />
                        </Box>

                        <SectionDivider isDark={isDark} />

                        <Stack direction="row">
                            {/* Body Section */}
                            <SectionHeader isDark={isDark}>Description</SectionHeader>
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
                                useCM={useCM}
                                myself={myself}
                                setBody={taskEditState.setBody}
                                setMyself={setMyself}
                                setTaskBodyEdited={taskEditState.setTaskBodyEdited}
                                setTaskBodySaved={taskEditState.setTaskBodySaved}
                                socket={socket}
                                taskId={taskEditState.tmpCurrentTaskContent.id}
                                useTEM={useTEM}
                                useUISM={useUISM}
                            />
                        </Box>

                        <SectionDivider isDark={isDark} />

                        {/* Subtasks Section */}
                        <TaskSubTasksBlock
                            SectionHeader={SectionHeader}
                            useCM={useCM}
                            useTM={useTM}
                            currentTaskContent={taskEditState.tmpCurrentTaskContent}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>

                    {/* Tabs Section */}
                    <Box
                        sx={{
                            borderTop: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                            background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                        }}
                    >
                        <TaskTabBlock
                            useCM={useCM}
                            editTargetComment={editTargetComment}
                            isInEdit={isInEdit}
                            myself={myself}
                            setDeletedAttachmentId={setDeletedAttachmentId}
                            setEditTargetComment={setEditTargetComment}
                            setIsAttachmentDeleted={setIsAttachmentDeleted}
                            setIsInEdit={setIsInEdit}
                            setMyself={setMyself}
                            setTabIndex={setTabIndex}
                            setTaskCommentLines={setTaskCommentLines}
                            setTaskComments={setTaskComments}
                            setTaskContent={taskEditState.setTmpCurrentTaskContent}
                            setTaskUpdated={taskEditState.setTaskUpdated}
                            setUploadedFiles={taskEditState.setUploadedFiles}
                            socket={socket}
                            tabIndex={tabIndex}
                            taskCommentLines={taskCommentLines}
                            taskComments={taskComments}
                            taskContent={taskEditState.tmpCurrentTaskContent}
                            taskNotes={taskNotes}
                            useTEM={useTEM}
                            useTM={useTM}
                            tmpCurrentTaskContent={taskEditState.tmpCurrentTaskContent}
                            useUISM={useUISM}
                            uploadedFiles={taskEditState.uploadedFiles}
                            useNM={useNM}
                        />
                    </Box>
                </Sheet>
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
        links: [],
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

    const milestone: Milestone | null = useMemo(() => {
        const projectId = usePM.currentProject?.projectId;
        if (!projectId) return null;
        return (
            useSM.projectMilestones[projectId]?.find((m) => m.milestoneId === milestoneId) ?? null
        );
    }, [usePM.currentProject?.projectId, useSM.projectMilestones, milestoneId]);

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
    // Single-assignee state mirrors the normal-task UX. Milestones
    // still use the multi-assignee API under the hood, but the picker
    // is restricted to a single user for parity with regular tasks.
    const [assignee, setAssignee] = useState<UserProps>(myself);
    // Reporter follows the same lookup pattern as assignee but resolves
    // from the milestone's FK reporter (single user, like normal tasks).
    const [reporter, setReporter] = useState<UserProps>(myself);
    const [uploadedFiles, setUploadedFiles] = useState<TaskProps["attachments"]>([]);

    // Reset local state when the milestone-id changes or fresh data
    // arrives. Attachments come from the backing task.
    useEffect(() => {
        if (!milestone) return;
        setTitleDraft(milestone.title);
        setBodyDraft((milestone.description as PartialBlock[]) ?? []);
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
    const [tabIndex, setTabIndex] = useState(0);
    const [isInEdit, setIsInEdit] = useState(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();
    const [isAttachmentDeleted, setIsAttachmentDeleted] = useState(false);
    const [deletedAttachmentId, setDeletedAttachmentId] = useState<number>(-1);

    useEffect(() => {
        const taskId = milestone?.taskId;
        if (taskId == null) {
            setTaskComments([]);
            return;
        }
        (async () => {
            const loaded = await loadTaskComments(myself, taskId, accessToken);
            setTaskComments(loaded?.length ? loaded : []);
        })();
    }, [milestone?.taskId, useTM.isTaskCommentUpdated]);

    useEffect(() => {
        const taskId = milestone?.taskId;
        const projectId = milestone?.projectId;
        if (taskId == null || projectId == null) {
            setTaskNotes([]);
            return;
        }
        (async () => {
            const loaded = await loadTaskNotes(myself, projectId, taskId, accessToken);
            setTaskNotes(loaded?.length ? loaded : []);
        })();
    }, [milestone?.taskId, milestone?.projectId, useNM.taskNoteMeta]);

    useEffect(() => {
        if (deletedAttachmentId !== -1 && isAttachmentDeleted) {
            setUploadedFiles((prev) =>
                prev.filter((a) => a.attachment_id !== deletedAttachmentId)
            );
            setIsAttachmentDeleted(false);
            setDeletedAttachmentId(-1);
        }
    }, [isAttachmentDeleted, deletedAttachmentId]);

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
        const patch: Parameters<typeof useSM.updateExistingMilestone>[0] = {
            milestoneId: milestone.milestoneId,
        };
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

    if (!milestone) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography level="body-sm">Loading milestone…</Typography>
            </Box>
        );
    }

    return (
        <Sheet
            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
            sx={{
                minHeight: 500,
                borderRadius: "16px",
                p: 0,
                overflowY: "auto",
                overflowX: "hidden",
                background: isDark
                    ? "linear-gradient(180deg, rgba(22,22,28,0.98) 0%, rgba(18,18,24,1) 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,252,255,1) 100%)",
                border: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                position: "relative",
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: "linear-gradient(90deg, #f97316 0%, #fb923c 50%, #fdba74 100%)",
                    borderRadius: "16px 16px 0 0",
                }}
            />

            {/* Header */}
            <Box
                sx={{
                    p: 2.5,
                    pt: 3,
                    borderBottom: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
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
                            variant="soft"
                            startDecorator={<PlayArrowRoundedIcon sx={{ fontSize: 16 }} />}
                            onClick={() => handleMilestoneStatusChange("WIP")}
                            sx={{
                                fontWeight: 600,
                                fontSize: "12px",
                                borderRadius: "8px",
                                px: 1.5,
                                py: 0.5,
                                background: "linear-gradient(135deg, #ff9500 0%, #ff6b00 100%)",
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
                        >
                            Start Milestone
                        </Button>
                    )}
                    {milestone.status === "WIP" && (
                        <Button
                            size="sm"
                            variant="soft"
                            startDecorator={<TaskAltRoundedIcon sx={{ fontSize: 16 }} />}
                            onClick={() => handleMilestoneStatusChange("Closed")}
                            sx={{
                                fontWeight: 600,
                                fontSize: "12px",
                                borderRadius: "8px",
                                px: 1.5,
                                py: 0.5,
                                background: "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)",
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
                    <Dropdown>
                        <MenuButton
                            slots={{ root: IconButton }}
                            slotProps={{
                                root: {
                                    variant: "plain",
                                    size: "sm",
                                    sx: {
                                        borderRadius: "10px",
                                        color: isDark
                                            ? "rgba(255,255,255,0.7)"
                                            : "rgba(0,0,0,0.6)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(255,255,255,0.06)"
                                                : "rgba(0,0,0,0.04)",
                                        },
                                    },
                                },
                            }}
                        >
                            <MoreHorizRoundedIcon />
                        </MenuButton>
                        <Menu
                            placement="bottom-end"
                            size="sm"
                            sx={{
                                minWidth: 220,
                                py: 0.75,
                                borderRadius: "14px",
                                background: isDark
                                    ? "linear-gradient(145deg, rgba(32,32,42,0.98) 0%, rgba(24,24,34,0.98) 100%)"
                                    : "linear-gradient(145deg, rgba(255,255,255,0.99) 0%, rgba(250,251,253,0.99) 100%)",
                                backdropFilter: "blur(24px) saturate(180%)",
                                boxShadow: isDark
                                    ? "0 12px 48px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)"
                                    : "0 12px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
                                border: "1px solid",
                                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                            }}
                        >
                            {/* Copy Milestone Link */}
                            <MenuItem
                                sx={{
                                    mx: 0.75,
                                    my: 0.25,
                                    borderRadius: "10px",
                                    gap: 1.5,
                                    minHeight: 40,
                                    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                    color: isDark
                                        ? "rgba(255,255,255,0.9)"
                                        : "rgba(15,23,42,0.85)",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(52,211,153,0.18)"
                                            : "rgba(5,150,105,0.12)",
                                        color: isDark ? "#34d399" : "#059669",
                                        transform: "translateX(3px)",
                                    },
                                }}
                                onClick={async () => {
                                    if (milestone.projectId && milestone.milestoneId) {
                                        const milestoneUrl = `${window.location.origin}/Home/tasks/project/${milestone.projectId}/milestone/${milestone.milestoneId}`;
                                        try {
                                            await navigator.clipboard.writeText(milestoneUrl);
                                        } catch (err) {
                                            console.error("Failed to copy link:", err);
                                        }
                                    }
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 30,
                                        height: 30,
                                        borderRadius: "8px",
                                    }}
                                >
                                    <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
                                </Box>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        fontSize: "0.875rem",
                                        color: "inherit",
                                    }}
                                >
                                    Copy milestone link
                                </Typography>
                            </MenuItem>

                            {/* New Task (as a child of this milestone) */}
                            <MenuItem
                                sx={{
                                    mx: 0.75,
                                    my: 0.25,
                                    borderRadius: "10px",
                                    gap: 1.5,
                                    minHeight: 40,
                                    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                    color: isDark
                                        ? "rgba(255,255,255,0.9)"
                                        : "rgba(15,23,42,0.85)",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(129,140,248,0.18)"
                                            : "rgba(79,70,229,0.12)",
                                        color: isDark ? "#818cf8" : "#4f46e5",
                                        transform: "translateX(3px)",
                                    },
                                }}
                                onClick={() => {
                                    if (milestone.taskId == null) return;
                                    useTM.setIsCreatingTask({
                                        flag: true,
                                        parentTaskId: milestone.taskId,
                                        rootTaskId: milestone.taskId,
                                        creationKind: "task",
                                        milestoneId: milestone.milestoneId,
                                    });
                                    useTM.setIsTaskHomeVisible(false);
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 30,
                                        height: 30,
                                        borderRadius: "8px",
                                    }}
                                >
                                    <AssignmentRoundedIcon sx={{ fontSize: 18 }} />
                                </Box>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        fontSize: "0.875rem",
                                        color: "inherit",
                                    }}
                                >
                                    New Task
                                </Typography>
                            </MenuItem>

                            {/* Open Note */}
                            <MenuItem
                                sx={{
                                    mx: 0.75,
                                    my: 0.25,
                                    borderRadius: "10px",
                                    gap: 1.5,
                                    minHeight: 40,
                                    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                    color: isDark
                                        ? "rgba(255,255,255,0.9)"
                                        : "rgba(15,23,42,0.85)",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(251,191,36,0.18)"
                                            : "rgba(245,158,11,0.12)",
                                        color: isDark ? "#fbbf24" : "#f59e0b",
                                        transform: "translateX(3px)",
                                    },
                                }}
                                onClick={() => {
                                    if (
                                        useNM.setIsTaskNoteVisible &&
                                        milestone.projectId &&
                                        milestone.taskId != null
                                    ) {
                                        useTM.setIsTaskHomeVisible(false);
                                        useNM.setIsTaskNoteVisible(true);
                                        if (useNM.taskNoteMeta.length > 0) {
                                            useNM.setCurrentTaskNote(
                                                useNM.taskNoteMeta[0] as TaskNoteProps
                                            );
                                        } else {
                                            useNM.handleCreateNewTaskNote(
                                                null,
                                                milestone.projectId,
                                                milestone.taskId,
                                                milestone.title
                                            );
                                        }
                                    }
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 30,
                                        height: 30,
                                        borderRadius: "8px",
                                    }}
                                >
                                    <NoteAltRoundedIcon sx={{ fontSize: 18 }} />
                                </Box>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        fontSize: "0.875rem",
                                        color: "inherit",
                                    }}
                                >
                                    Open Note
                                </Typography>
                            </MenuItem>

                            {/* New Tag */}
                            <MenuItem
                                sx={{
                                    mx: 0.75,
                                    my: 0.25,
                                    borderRadius: "10px",
                                    gap: 1.5,
                                    minHeight: 40,
                                    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                    color: isDark
                                        ? "rgba(255,255,255,0.9)"
                                        : "rgba(15,23,42,0.85)",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(192,132,252,0.18)"
                                            : "rgba(147,51,234,0.12)",
                                        color: isDark ? "#c084fc" : "#9333ea",
                                        transform: "translateX(3px)",
                                    },
                                }}
                                onClick={() => {
                                    useTM.setOpenCreateTag(true);
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 30,
                                        height: 30,
                                        borderRadius: "8px",
                                    }}
                                >
                                    <LocalOfferRoundedIcon sx={{ fontSize: 18 }} />
                                </Box>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        fontSize: "0.875rem",
                                        color: "inherit",
                                    }}
                                >
                                    New Tag
                                </Typography>
                            </MenuItem>

                            {/* New Project */}
                            <MenuItem
                                sx={{
                                    mx: 0.75,
                                    my: 0.25,
                                    borderRadius: "10px",
                                    gap: 1.5,
                                    minHeight: 40,
                                    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                    color: isDark
                                        ? "rgba(255,255,255,0.9)"
                                        : "rgba(15,23,42,0.85)",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(45,212,191,0.18)"
                                            : "rgba(13,148,136,0.12)",
                                        color: isDark ? "#2dd4bf" : "#0d9488",
                                        transform: "translateX(3px)",
                                    },
                                }}
                                onClick={() => {
                                    usePM.setOpenCreateProject(true);
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 30,
                                        height: 30,
                                        borderRadius: "8px",
                                    }}
                                >
                                    <AddIcon sx={{ fontSize: 18 }} />
                                </Box>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        fontSize: "0.875rem",
                                        color: "inherit",
                                    }}
                                >
                                    New Project
                                </Typography>
                            </MenuItem>

                            {/* Delete */}
                            <Box
                                sx={{
                                    height: "1px",
                                    mx: 1.5,
                                    my: 0.5,
                                    background: isDark
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(0,0,0,0.06)",
                                }}
                            />
                            <MenuItem
                                sx={{
                                    mx: 0.75,
                                    my: 0.25,
                                    borderRadius: "10px",
                                    gap: 1.5,
                                    minHeight: 40,
                                    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                    color: isDark ? "#f87171" : "#dc2626",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(248,113,113,0.18)"
                                            : "rgba(220,38,38,0.12)",
                                        color: isDark ? "#fca5a5" : "#ef4444",
                                        transform: "translateX(3px)",
                                    },
                                }}
                                onClick={async () => {
                                    if (!confirm("Delete this milestone?")) return;
                                    await useSM.removeMilestone(
                                        milestone.milestoneId,
                                        milestone.projectId
                                    );
                                    useTM.setCurrentPreviewKind("task");
                                    useTM.setCurrentPreviewMilestoneId(-1);
                                    useTM.setIsTaskPreviewVisible(false);
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 30,
                                        height: 30,
                                        borderRadius: "8px",
                                    }}
                                >
                                    <DeleteRoundedIcon sx={{ fontSize: 18 }} />
                                </Box>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        fontSize: "0.875rem",
                                        color: "inherit",
                                    }}
                                >
                                    Delete Milestone
                                </Typography>
                            </MenuItem>
                        </Menu>
                    </Dropdown>

                    <Tooltip size="sm" title="Close" variant="outlined">
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={{
                                borderRadius: "8px",
                                color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(239,68,68,0.15)"
                                        : "rgba(239,68,68,0.1)",
                                    color: "#ef4444",
                                },
                            }}
                            onClick={() => {
                                useTM.setIsTaskPreviewVisible(false);
                                useTM.setCurrentPreviewKind("task");
                                useTM.setCurrentPreviewMilestoneId(-1);
                                useTM.setTableMilestoneFilterId(null);
                                if (
                                    useTM.isTaskHomeVisible === false &&
                                    useTM.isSprintBoardVisible === false &&
                                    useTM.isDashboardVisible === false
                                ) {
                                    useTM.setIsTaskHomeVisible(true);
                                }
                            }}
                        >
                            <CancelRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Input
                    size="lg"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    sx={{ fontSize: 18, fontWeight: 600 }}
                />
            </Box>

            {/* Reuses the exact same layout as a normal task. */}
            <Box sx={{ p: 2.5 }}>
                <SectionHeader isDark={isDark}>Milestone Details</SectionHeader>
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
                        reporter={reporter}
                        useCM={useCM}
                        isOpenProjectList={isOpenProjectList}
                        isOpenTagList={isOpenTagList}
                        isOpenTeamMembersList={isOpenTeamMembersList}
                        isPreviewMode={true}
                        myself={myself}
                        projectTags={projectTags}
                        setProjectTags={setProjectTags}
                        setAssignee={setAssignee}
                        setIsOpenProjectList={setIsOpenProjectList}
                        setIsOpenTagList={setIsOpenTagList}
                        setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                        setMyself={setMyself}
                        setReporter={setReporter}
                        setTaskContent={(next) => {
                            setTaskContentLike(next);
                            setTaskUpdated(true);
                        }}
                        setTaskUpdated={setTaskUpdated}
                        socket={socket}
                        taskContent={taskContentLike}
                        useTEM={useTEM}
                        useTM={useTM}
                        useSM={useSM}
                        useUISM={useUISM}
                        usePM={usePM}
                        isMilestone={true}
                    />
                </Box>

                <SectionDivider isDark={isDark} />

                <Stack direction="row">
                    <SectionHeader isDark={isDark}>Description</SectionHeader>
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
                        useCM={useCM}
                        myself={myself}
                        setBody={(next) => {
                            setBodyDraft(next);
                        }}
                        setMyself={setMyself}
                        setTaskBodyEdited={setBodyEdited}
                        setTaskBodySaved={setBodySaved}
                        socket={socket}
                        taskId={milestone.milestoneId}
                        useTEM={useTEM}
                        useUISM={useUISM}
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
                    SectionHeader={SectionHeader}
                    useCM={useCM}
                    useTM={useTM}
                    currentTaskContent={taskContentLike}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                    forceLoad={true}
                    title="Tasks in this milestone"
                    buttonLabel="Task"
                    emptyText="No tasks yet. Create a task and assign it to this milestone."
                />
            </Box>

            {/* Tabs Section — comments / notes / attachments — same as
                a normal task. The milestone's backing task id flows
                through `taskContentLike.id`, so all task-* endpoints
                operate transparently on the milestone. */}
            {milestone.taskId != null && (
                <Box
                    sx={{
                        borderTop: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                    }}
                >
                    <TaskTabBlock
                        useCM={useCM}
                        editTargetComment={editTargetComment}
                        isInEdit={isInEdit}
                        myself={myself}
                        setDeletedAttachmentId={setDeletedAttachmentId}
                        setEditTargetComment={setEditTargetComment}
                        setIsAttachmentDeleted={setIsAttachmentDeleted}
                        setIsInEdit={setIsInEdit}
                        setMyself={setMyself}
                        setTabIndex={setTabIndex}
                        setTaskCommentLines={setTaskCommentLines}
                        setTaskComments={setTaskComments}
                        setTaskContent={setTaskContentLike}
                        setTaskUpdated={setTaskUpdated}
                        setUploadedFiles={setUploadedFiles}
                        socket={socket}
                        tabIndex={tabIndex}
                        taskCommentLines={taskCommentLines}
                        taskComments={taskComments}
                        taskContent={taskContentLike}
                        taskNotes={taskNotes}
                        useTEM={useTEM}
                        useTM={useTM}
                        tmpCurrentTaskContent={taskContentLike}
                        useUISM={useUISM}
                        uploadedFiles={uploadedFiles}
                        useNM={useNM}
                    />
                </Box>
            )}
        </Sheet>
    );
};
