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
import { TaskRelatedTasksBlock } from "./base/TaskRelatedTasksBlock";
import { sendUpdatedSpecificTask } from "../../services/sendUpdatedSpecificTask";
import { loadTaskComments } from "../../services/loadTaskComments";
import { wsTaskHandleHook } from "../../hooks/WSTaskHooks";
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
    setIsCreatingTask: (value: any) => void;
    setIsTaskContentVisible: (value: boolean) => void;
    setCurrentPreviewTask: (value: TaskProps) => void;
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    isTaskUpdated?: boolean;
    setIsTaskUpdated?: (value: boolean) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentPreviewTaskId: (value: number) => void;
};

export const TaskPreview = (props: TaskPreviewProps) => {
    const {
        socket,
        myself,
        setCurrentProject,
        currentPreviewTask,
        setIsCreatingTask,
        setIsTaskContentVisible,
        setCurrentPreviewTask,
        setOpenCreateProject,
        setOpenCreateTag,
        isTaskUpdated,
        setIsTaskUpdated,
        setOpeningService,
        setCurrentMainChat,
        setCurrentPreviewTaskId,
    } = props;
    const { accessToken } = useAuth();
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
    const [isCommentUpdated, setIsCommentUpdated] = useState(false);
    const [currentTaskId, setCurrentTaskId] = useState(tmpCurrentTaskContent.id);

    // Save initial task title to restore it when use input empty title
    const [initTaskTitle, setInitTaskTitle] = useState<string>(currentPreviewTask.title);

    // Web Socket handler
    wsTaskHandleHook({ socket, setIsCommentUpdated });

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
            setTmpCurrentTaskContent(currentPreviewTask);
            setCurrentTaskId(currentPreviewTask.id);
            setBody(currentPreviewTask.body || []);
            setTaskBodyUpdated(false);
        } else {
            setTmpCurrentTaskContent(newTaskContent);
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
    // This runs after the above useEffect runs (i.e., after `setCurrentTaskId` executed)
    useEffect(() => {
        setTaskTitle(currentPreviewTask.title);
        setInitTaskTitle(currentPreviewTask.title);
        setUploadedFiles(currentPreviewTask.attachments);
    }, [currentTaskId]);

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
                setIsTaskContentVisible={setIsTaskContentVisible}
                setTaskUpdated={setTaskUpdated}
                isPreviewMode={true}
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

            <TaskRelatedTasksBlock
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
