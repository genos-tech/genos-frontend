import { useEffect, useRef, useState } from "react";
import { Box, Divider, Sheet, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useSendUpdatedTask } from "../../../../hooks/tasks/useSendUpdatedTask";
import { useTaskEditState } from "../../../../hooks/tasks/useTaskEditState";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskNoteProps } from "../../../../types/notes";
import { TagListProps, TaskCommentProps, TaskProps } from "../../../../types/tasks";
import { loadTaskNotes } from "../../../notes/task-notes/services/loadTaskNotes";
import { loadTaskComments } from "../../services/loadTaskComments";
import {
    updateProjectOptions,
    updateTagOptions,
    updateTeamMembersOptions,
} from "../../services/updateTaskAutoCompleteOptions";
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
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
};

export const TaskPreview = (props: TaskPreviewProps) => {
    const { socket, myself, setMyself, usePM, useNM, useTM, useUISM, useTEM, useCM } = props;
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

    // Get Task Comments
    const [taskComments, setTaskComments] = useState<TaskCommentProps[]>([]);
    useEffect(() => {
        (async () => {
            const loadedTaskComments: TaskCommentProps[] = await loadTaskComments(
                myself,
                Number(useTM.currentPreviewTask?.id),
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

    // Scroll management
    const [taskCommentLines, setTaskCommentLines] = useState(0);
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
