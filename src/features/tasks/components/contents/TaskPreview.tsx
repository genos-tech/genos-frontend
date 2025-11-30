import { useEffect, useRef, useState } from "react";
import { Divider, Sheet } from "@mui/joy";
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

        // setUploadedFiles(currentPreviewTask.attachments);
    }, [useTM.currentPreviewTask]);

    // Update task title/attachments when the visible task Id is changed
    // This will be executed after the above useEffect is executed
    //  (i.e., after `setCurrentTaskId` is executed)
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

    // This is for auto scrolling to the bottom when an user writes comment.
    const [taskCommentLines, setTaskCommentLines] = useState(0);
    const sheetRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const sheet = sheetRef.current;
        if (sheet && taskCommentLines > 1) {
            sheet.scrollTop = sheet.scrollHeight; // always scroll to bottom
        }
    }, [taskCommentLines]); // re-run whenever content changes

    // This is for auto scrolling to the bottom when an user switches the tab.
    useEffect(() => {
        const sheet = sheetRef.current;
        if (sheet) {
            sheet.scrollTop = sheet.scrollHeight; // scroll to bottom
        }
    }, [tabIndex]); // re-run whenever content changes

    return (
        <>
            {taskEditState.tmpCurrentTaskContent?.id && (
                <Sheet
                    ref={sheetRef}
                    className="custom-scrollbar"
                    variant="outlined"
                    sx={{
                        minHeight: 500,
                        borderRadius: "sm",
                        p: 2,
                        overflowY: "auto",
                        overflowX: "hidden",
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

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskMainBlock
                        assignee={assignee}
                        useCM={useCM}
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

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskCustomBarBlock
                        setTaskContent={taskEditState.setTmpCurrentTaskContent}
                        setTaskStatusUpdated={taskEditState.setTaskStatusUpdated}
                        setTaskUpdated={taskEditState.setTaskUpdated}
                        taskBodySaved={taskEditState.taskBodySaved}
                        taskContent={taskEditState.tmpCurrentTaskContent}
                    />

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

                    <Divider sx={{ mt: 2 }} />

                    <TaskSubTasksBlock
                        useCM={useCM}
                        useTM={useTM}
                        currentTaskContent={taskEditState.tmpCurrentTaskContent}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />

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
                </Sheet>
            )}
        </>
    );
};
