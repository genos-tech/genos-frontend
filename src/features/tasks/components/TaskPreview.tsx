import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Sheet, Divider } from '@mui/joy';
import { PartialBlock } from "@blocknote/core";

import { AttachmentBlock } from './base/AttachmentBlock';
import { TaskTitleBlock } from './base/TaskTitleBlock';
import { TaskMainBlock } from './base/TaskMainBlock';
import { TaskBodyPreviewBlock } from './base/TaskBodyPreviewBlock';
import { TaskPreviewCustomBar } from './base/TaskPreviewCustomBar';
import { TaskCommentBlock } from './base/TaskCommentBlock'
import { updateSpecificTask } from '../services/updateSpecificTask';
import { loadTaskComments } from '../services/loadTaskComments';
import { wsTaskHandleHook } from '../hooks/WSTaskHooks';
import {
    updateTeamMembersOptions,
    updateProjectOptions,
    updateTagOptions
} from '../services/updateTaskAutoCompleteOptions';
import { UserProps } from '../../../types/admin';
import { AttachmentFileProps } from "../../../types/tasks";
import { useAuth } from "../../../context/AuthContext";
import {
    TaskProps,
    ProjectProps,
    TagListProps,
    TaskCommentProps
} from "../../../types/tasks";

type TaskPreviewProps = {
    socket: Socket | null;
    myself: UserProps;
    setCurrentProject: (value: ProjectProps) => void;
    currentPreviewTask: TaskProps;
    setIsCreatingTask: (value: boolean) => void;
    setIsTaskContentVisible: (value: boolean) => void;
    setCurrentPreviewTask: (value: TaskProps) => void;
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    isTaskUpdated?: boolean;
    setIsTaskUpdated?: (value: boolean) => void;
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
        setIsTaskUpdated
    } = props
    const { accessToken } = useAuth();
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>(currentPreviewTask.attachments);
    const [taskUpdated, setTaskUpdated] = useState(false);
    const [tmpCurrentTaskContent, setTmpCurrentTaskContent] = useState<TaskProps>(currentPreviewTask);
    const [taskTitle, setTaskTitle] = useState<string>(currentPreviewTask.title);
    const [body, setBody] = useState<PartialBlock[]>(currentPreviewTask.body);
    const [assigneeName, setAssigneeName] = useState<string>(tmpCurrentTaskContent.assignee.userName);
    const [reporterName, setReporterName] = useState<string>(tmpCurrentTaskContent.reporter.userName);
    const [isCommentUpdated, setIsCommentUpdated] = useState(false);
    const [currentTaskId, setCurrentTaskId] = useState(tmpCurrentTaskContent.id);

    // Save initial task title to restore it when use input empty title
    const [initTaskTitle, setInitTaskTitle] = useState<string>(currentPreviewTask.title);

    // Web Socket handler
    wsTaskHandleHook({ socket, setIsCommentUpdated });

    // Set the current preview task when the component is mounted
    useEffect(() => {
        setTmpCurrentTaskContent(currentPreviewTask)
    }, [])

    // Update variables when an user change the target task
    useEffect(() => {
        setTmpCurrentTaskContent(currentPreviewTask)
        setCurrentTaskId(currentPreviewTask.id);
        setBody(currentPreviewTask.body || []);
    }, [currentPreviewTask])

    // Update task title/attachments when the visible task Id is changed
    useEffect(() => {
        setTaskTitle(currentPreviewTask.title)
        setInitTaskTitle(currentPreviewTask.title)
        setUploadedFiles(currentPreviewTask.attachments)
    }, [currentTaskId])

    // Send updated task to the backend when task is updated
    useEffect(() => {
        if (taskUpdated === true) {
            const newTaskContent: TaskProps = {
                ...tmpCurrentTaskContent,
                title: taskTitle === "" ? initTaskTitle : taskTitle,
                body: body
            };
            (async () => {
                setTmpCurrentTaskContent(newTaskContent)
                await updateSpecificTask({
                    myself: myself,
                    updatedData: newTaskContent,
                    accessToken: accessToken || ""
                });
            })();

            setTaskUpdated(false)
        }
    }, [taskUpdated])

    // Update attachments 
    useEffect(() => {
        if (tmpCurrentTaskContent !== null && tmpCurrentTaskContent !== undefined && uploadedFiles.length > 0) {
            (async () => {
                setTmpCurrentTaskContent(prevState => ({
                    ...prevState,
                    attachments: uploadedFiles
                }));
            })();
        }
    }, [uploadedFiles])

    useEffect(() => {
        if (setIsTaskUpdated && isTaskUpdated === false) {
            setCurrentPreviewTask(tmpCurrentTaskContent)
            setIsTaskUpdated(true)
        }
    }, [tmpCurrentTaskContent])

    // Get Task Comments
    const [taskComments, setTaskComments] = useState<TaskCommentProps[]>([]);
    useEffect(() => {
        (async () => {
            const loadedTaskComments: TaskCommentProps[] = await loadTaskComments({
                taskId: Number(currentPreviewTask.id), accessToken: accessToken || ""
            });
            if (loadedTaskComments.length > 0) {
                setTaskComments(loadedTaskComments);
            } else {
                setTaskComments([]);
            }
        })();
    }, [isCommentUpdated])

    // Get team members
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [isOpenTeamMembersList, setIsOpenTeamMembersList] = useState(false);
    useEffect(() => {
        updateTeamMembersOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamMembers: setTeamMembers
        })
    }, [isOpenTeamMembersList]);

    // Get team projects
    const [teamProjects, setTeamProjects] = useState<ProjectProps[]>([]);
    const [isOpenProjectList, setIsOpenProjectList] = useState(false);
    useEffect(() => {
        updateProjectOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamProjects: setTeamProjects
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
                setProjectTags: setProjectTags
            });
        }
    }, [isOpenTagList]);

    return (
        <Sheet
            className="custom-scrollbar"
            variant="outlined"
            sx={{
                minHeight: 500,
                borderRadius: 'sm',
                p: 2,
                overflowY: 'scroll',
                overflowX: 'hidden'
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
                taskContents={tmpCurrentTaskContent}
                setTaskContents={setTmpCurrentTaskContent}
                teamMembers={teamMembers}
                teamProjects={teamProjects}
                projectTags={projectTags}
                myself={myself}
                assigneeName={assigneeName}
                setAssigneeName={setAssigneeName}
                reporterName={reporterName}
                setReporterName={setReporterName}
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
                setTaskUpdated={setTaskUpdated}
            />

            <Divider sx={{ mt: 2 }} />

            <AttachmentBlock
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                setTaskUpdated={setTaskUpdated}
            />

            <Divider sx={{ m: 2 }} />

            <TaskCommentBlock
                myself={myself}
                socket={socket}
                projectId={tmpCurrentTaskContent.project?.projectId ? tmpCurrentTaskContent.project?.projectId : -1}
                taskId={Number(tmpCurrentTaskContent.id)}
                setTaskUpdated={setTaskUpdated}
                taskComments={taskComments}
                setTaskComments={setTaskComments}
                isCommentUpdated={isCommentUpdated}
                setIsCommentUpdated={setIsCommentUpdated}
            />

        </Sheet >
    );
}
