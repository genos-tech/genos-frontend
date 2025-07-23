import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Sheet, Divider } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { TaskAttachmentBlock } from "./base/TaskAttachmentBlock";
import { TaskTitleBlock } from "./base/TaskTitleBlock";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskBodyPreviewBlock } from "./base/TaskBodyPreviewBlock";
import { TaskPreviewCustomBar } from "./base/TaskPreviewCustomBar";
import { TaskCommentBlock } from "./base/TaskCommentBlock";
import { TaskSubTasksBlock } from "./base/TaskSubTasksBlock";
import { sendUpdatedSpecificTask } from "../../services/sendUpdatedSpecificTask";
import { loadTaskComments } from "../../services/loadTaskComments";
import {
    updateTeamMembersOptions,
    updateProjectOptions,
    updateTagOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { UserProps } from "../../../../types/admin";
import { AttachmentFileProps } from "../../../../types/tasks";
import { useAuth } from "../../../../context/AuthContext";
import { TaskProps, ProjectProps, TagListProps, TaskCommentProps } from "../../../../types/tasks";
import { ChatProps } from "../../../../types/chat";

type TaskPreviewProps = {
    socket: Socket | null;
    myself: UserProps;
    setCurrentProject: (value: ProjectProps) => void;
    currentPreviewTask: TaskProps;
    setIsMainChatVisible?: (value: boolean) => void;
    setIsThreadVisible?: (value: boolean) => void;
    isThreadVisible?: boolean;
    setIsCreatingTask: (value: any) => void;
    setIsTaskPreviewVisible?: (value: boolean) => void;
    setIsTaskCreationVisible?: (value: boolean) => void;
    setCurrentPreviewTask: (value: TaskProps) => void;
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    isTaskUpdated?: boolean;
    setIsTaskUpdated?: (value: boolean) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    isCommentUpdated: boolean;
    setIsCommentUpdated: (value: boolean) => void;
    setIsTaskHomeVisible?: (value: boolean) => void;
    isTaskContentVisible?: boolean;
    isCreatingTask?: boolean;
};

export const TaskPreview = (props: TaskPreviewProps) => {
    const {
        socket,
        myself,
        setCurrentProject,
        currentPreviewTask,
        setIsCreatingTask,
        setIsMainChatVisible,
        setIsThreadVisible,
        isThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskCreationVisible,
        setCurrentPreviewTask,
        setOpenCreateProject,
        setOpenCreateTag,
        isTaskUpdated,
        setIsTaskUpdated,
        setOpeningService,
        setCurrentMainChat,
        setCurrentPreviewTaskId,
        isCommentUpdated,
        setIsCommentUpdated,
        setIsTaskHomeVisible,
        isTaskContentVisible,
        isCreatingTask,
    } = props;
    const { accessToken } = useAuth();
    const [taskClosed, setTaskClosed] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>(
        currentPreviewTask.attachments
    );
    const [taskUpdated, setTaskUpdated] = useState(false);
    const [taskBodyUpdated, setTaskBodyUpdated] = useState(false);
    const [isAttachmentDeleted, setIsAttachmentDeleted] = useState(false);
    const [deletedAttachmentId, setDeletedAttachmentId] = useState<number>(-1);
    const [uploadedSingleAttachment, setUploadedSingleAttachment] =
        useState<AttachmentFileProps>();
    const [tmpCurrentTaskContent, setTmpCurrentTaskContent] =
        useState<TaskProps>(currentPreviewTask);
    const [taskTitle, setTaskTitle] = useState<string>(currentPreviewTask.title);
    const [body, setBody] = useState<PartialBlock[]>(currentPreviewTask.body);
    const [assignee, setAssignee] = useState<UserProps>(tmpCurrentTaskContent.assignee);
    const [reporter, setReporter] = useState<UserProps>(tmpCurrentTaskContent.reporter);
    const [currentTaskId, setCurrentTaskId] = useState<number | undefined>(
        tmpCurrentTaskContent.id
    );

    // Save initial task title to restore it when use input empty title
    const [initTaskTitle, setInitTaskTitle] = useState<string>(currentPreviewTask.title);

    // Set the current preview task when the component is mounted
    useEffect(() => {
        setTmpCurrentTaskContent(currentPreviewTask);
    }, []);

    // Send updated task to the backend when task is updated
    const sendUpdatedTask = async (taskChanged: boolean) => {
        const newTaskContent: TaskProps = {
            ...tmpCurrentTaskContent,
            title: taskTitle === "" ? initTaskTitle : taskTitle,
            body: body,
        };

        const uploadedAttachmentData = await sendUpdatedSpecificTask(
            socket,
            myself,
            newTaskContent,
            accessToken
        );

        if (uploadedAttachmentData.attachment_id > 0) {
            setUploadedSingleAttachment({
                attachment_id: uploadedAttachmentData.attachment_id,
                file: uploadedAttachmentData.attached_file,
                file_base64: uploadedAttachmentData.file_base64,
                name: uploadedAttachmentData.name,
                type: uploadedAttachmentData.attached_type,
            });
        } else {
            setUploadedSingleAttachment(undefined);
        }

        if (taskChanged) {
            // Initialize the following variable when use changes the previewing task
            setTmpCurrentTaskContent(currentPreviewTask);
            setCurrentPreviewTask(currentPreviewTask);
            setCurrentTaskId(currentPreviewTask.id);
            setBody(currentPreviewTask.body || []);
            setTaskBodyUpdated(false);
        } else {
            // Update only the tmpCurrentTaskContent when use updated the task content
            // (Not changed the previewing task)
            setTmpCurrentTaskContent(newTaskContent);
            setCurrentPreviewTask(newTaskContent);
        }
        setTaskUpdated(false);
    };
    useEffect(() => {
        if (taskUpdated === true) {
            sendUpdatedTask(false);
        }
    }, [taskUpdated]);

    // Update variables when an user change the target task
    useEffect(() => {
        if (taskBodyUpdated) {
            sendUpdatedTask(true);
        } else {
            setTmpCurrentTaskContent(currentPreviewTask);
            setCurrentTaskId(currentPreviewTask.id);
            setBody(currentPreviewTask.body || []);
        }
    }, [currentPreviewTask]);

    // Update task title/attachments when the visible task Id is changed
    // This will be executed after the above useEffect is executed
    //  (i.e., after `setCurrentTaskId` is executed)
    useEffect(() => {
        if (currentTaskId) {
            setTaskTitle(currentPreviewTask.title);
            setInitTaskTitle(currentPreviewTask.title);
            setUploadedFiles(currentPreviewTask.attachments);
        }
    }, [currentTaskId]);

    useEffect(() => {
        // Save task before the opening task preview is closed.
        if (taskClosed)
            if (taskBodyUpdated) {
                const execute = async () => {
                    await sendUpdatedTask(false);
                    if (setIsTaskPreviewVisible) {
                        setIsTaskPreviewVisible(false);
                    }
                };
                execute();
            } else {
                if (setIsTaskPreviewVisible) {
                    setIsTaskPreviewVisible(false);
                }
            }
    }, [taskClosed]);

    // Update attachments
    useEffect(() => {
        if (
            tmpCurrentTaskContent !== null &&
            tmpCurrentTaskContent !== undefined &&
            uploadedFiles.length > 0
        ) {
            (async () => {
                setTmpCurrentTaskContent((prevState) => ({
                    ...prevState,
                    attachments: uploadedFiles,
                }));
                setAssignee(tmpCurrentTaskContent.assignee);
                setReporter(tmpCurrentTaskContent.reporter);
            })();
        }
    }, [uploadedFiles]);

    useEffect(() => {
        if (uploadedSingleAttachment !== undefined) {
            setUploadedFiles([...uploadedFiles, uploadedSingleAttachment]);
        }
    }, [uploadedSingleAttachment]);

    useEffect(() => {
        if (setIsTaskUpdated && isTaskUpdated === false) {
            setCurrentPreviewTask(tmpCurrentTaskContent);
            setIsTaskUpdated(true);
            setAssignee(tmpCurrentTaskContent.assignee);
            setReporter(tmpCurrentTaskContent.reporter);
        }
    }, [tmpCurrentTaskContent]);

    useEffect(() => {
        if (deletedAttachmentId !== -1 && isAttachmentDeleted === true) {
            setUploadedFiles((prev) =>
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
                Number(currentPreviewTask.id),
                accessToken
            );
            if (loadedTaskComments.length > 0) {
                setTaskComments(loadedTaskComments);
            } else {
                setTaskComments([]);
            }
        })();
    }, [isCommentUpdated, currentTaskId]);

    // Get team members
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [isOpenTeamMembersList, setIsOpenTeamMembersList] = useState(false);
    useEffect(() => {
        updateTeamMembersOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamMembers: setTeamMembers,
        });
    }, [isOpenTeamMembersList]);

    // Get team projects
    const [teamProjects, setTeamProjects] = useState<ProjectProps[]>([]);
    const [isOpenProjectList, setIsOpenProjectList] = useState(false);
    useEffect(() => {
        updateProjectOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamProjects: setTeamProjects,
        });
    }, [isOpenProjectList]);

    // Get Project tags
    const [projectTags, setProjectTags] = useState<TagListProps[]>([]);
    const [isOpenTagList, setIsOpenTagList] = useState(false);
    useEffect(() => {
        if (tmpCurrentTaskContent.project) {
            updateTagOptions({
                myself: myself,
                accessToken: accessToken,
                projectId: tmpCurrentTaskContent.project.projectId,
                setProjectTags: setProjectTags,
            });
        }
    }, [isOpenTagList]);

    return (
        <Sheet
            className="custom-scrollbar"
            variant="outlined"
            sx={{
                minHeight: 500,
                borderRadius: "sm",
                p: 2,
                overflowY: "scroll",
                overflowX: "hidden",
            }}
        >
            <TaskTitleBlock
                taskContents={tmpCurrentTaskContent}
                taskTitle={taskTitle}
                setTaskTitle={setTaskTitle}
                setIsCreatingTask={setIsCreatingTask}
                setOpenCreateProject={setOpenCreateProject}
                setOpenCreateTag={setOpenCreateTag}
                setTaskClosed={setTaskClosed}
                setTaskUpdated={setTaskUpdated}
                isPreviewMode={true}
                setIsMainChatVisible={setIsMainChatVisible}
                setIsThreadVisible={setIsThreadVisible}
                isThreadVisible={isThreadVisible}
                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                setIsTaskCreationVisible={setIsTaskCreationVisible}
                setIsTaskHomeVisible={setIsTaskHomeVisible}
                isTaskContentVisible={isTaskContentVisible}
                isCreatingTask={isCreatingTask}
            />

            <Divider sx={{ mt: 1, mb: 1 }} />

            <TaskMainBlock
                socket={socket}
                taskContents={tmpCurrentTaskContent}
                setTaskContents={setTmpCurrentTaskContent}
                teamMembers={teamMembers}
                teamProjects={teamProjects}
                projectTags={projectTags}
                myself={myself}
                assignee={assignee}
                setAssignee={setAssignee}
                reporter={reporter}
                setReporter={setReporter}
                isOpenTeamMembersList={isOpenTeamMembersList}
                setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                isOpenProjectList={isOpenProjectList}
                setIsOpenProjectList={setIsOpenProjectList}
                isOpenTagList={isOpenTagList}
                setIsOpenTagList={setIsOpenTagList}
                setOpenCreateTag={setOpenCreateTag}
                setCurrentProject={setCurrentProject}
                isPreviewMode={true}
                setTaskUpdated={setTaskUpdated}
                setOpeningService={setOpeningService}
                setCurrentMainChat={setCurrentMainChat}
                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
            />

            <Divider sx={{ mt: 1, mb: 1 }} />

            <TaskPreviewCustomBar
                currentTaskContent={tmpCurrentTaskContent}
                setCurrentTaskContent={setTmpCurrentTaskContent}
                setTaskUpdated={setTaskUpdated}
                setIsCreatingTask={setIsCreatingTask}
            />

            <TaskBodyPreviewBlock
                key={tmpCurrentTaskContent.id}
                body={body}
                setBody={setBody}
                setTaskBodyUpdated={setTaskBodyUpdated}
            />

            <Divider sx={{ mt: 2 }} />

            <TaskSubTasksBlock
                socket={socket}
                myself={myself}
                currentTaskContent={tmpCurrentTaskContent}
                setCurrentProject={setCurrentProject}
                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                setOpeningService={setOpeningService}
                setCurrentMainChat={setCurrentMainChat}
            />

            <TaskAttachmentBlock
                uploadedFiles={uploadedFiles}
                taskContents={tmpCurrentTaskContent}
                setTaskContents={setTmpCurrentTaskContent}
                setTaskUpdated={setTaskUpdated}
                setIsAttachmentDeleted={setIsAttachmentDeleted}
                setDeletedAttachmentId={setDeletedAttachmentId}
            />

            <Divider sx={{ m: 2 }} />

            <TaskCommentBlock
                myself={myself}
                socket={socket}
                projectId={
                    tmpCurrentTaskContent.project?.projectId
                        ? tmpCurrentTaskContent.project?.projectId
                        : -1
                }
                taskId={Number(tmpCurrentTaskContent.id)}
                taskComments={taskComments}
                setTaskComments={setTaskComments}
                isCommentUpdated={isCommentUpdated}
                setIsCommentUpdated={setIsCommentUpdated}
            />
        </Sheet>
    );
};
