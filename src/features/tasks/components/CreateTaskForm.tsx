import { useState, useEffect } from "react";
import { Sheet, Divider } from '@mui/joy';
import { PartialBlock } from "@blocknote/core";

import { TaskTitleBlock } from './base/TaskTitleBlock';
import { TaskMainBlock } from './base/TaskMainBlock';
import { TaskBodyEditBlock } from './base/TaskBodyEditBlock'
import { CreateTaskFooter } from './base/CreateTaskFooter';
import { AttachmentBlock } from './base/AttachmentBlock'
import {
    updateTaskTitle,
    updateTaskBody,
    updateTaskAttachments
} from '../hooks/taskUpdateHooks';
import {
    updateTeamMembersOptions,
    updateProjectOptions,
    updateTagOptions
} from '../services/updateTaskAutoCompleteOptions'
import { useAuth } from "../../../context/AuthContext";
import { getFormattedTodayDateStr } from '../../../components/utils/dateUtils';
import { UserProps } from '../../../types/admin';
import { AttachmentFileProps } from "../../../types/tasks";
import { TaskProps, ProjectProps, TagListProps } from "../../../types/tasks";

type CreateTaskProps = {
    myself: UserProps,
    isDm: boolean | null,
    chatId: number | null,
    threadId: number | null,
    setIsTaskContentVisible: (value: boolean) => void,
    setIsCreatingTask: (value: boolean) => void,
    setIsOpeningTask?: (value: boolean) => void,
    setOpenCreateProject: (value: boolean) => void,
    setOpenCreateTag: (value: boolean) => void,
    currentProject: ProjectProps | null,
    setCurrentProject: (value: ProjectProps) => void,
    setCurrentPreviewTaskId: (value: number) => void,
    isNewProjectCreated: boolean,
    isNewTagCreated: boolean,
    setIsNewTaskCreated?: (value: boolean) => void,
};

export const CreateTaskForm = (props: CreateTaskProps) => {
    const {
        myself,
        isDm,
        chatId,
        threadId,
        setIsOpeningTask,
        setIsCreatingTask,
        setOpenCreateProject,
        setOpenCreateTag,
        currentProject,
        setCurrentProject,
        setCurrentPreviewTaskId,
        setIsNewTaskCreated
    } = props
    const { accessToken } = useAuth();
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>([]);

    // Init task contents
    const [taskContents, setTaskContents] = useState<TaskProps>({
        project: currentProject,
        title: "",
        body: [],
        assignee: myself,
        reporter: myself,
        chatType: (isDm === null || isDm === undefined) ? null : (isDm ? "dm" : "gm"),
        chatId: chatId,
        threadId: threadId,
        dueDate: getFormattedTodayDateStr(),
        status: { code: 0, status: 'Open', color: '#0044c2', textColor: 'white' },
        priority: { code: -1, priority: '', color: '', textColor: '' },
        effortLevel: { code: -1, level: '', color: '', textColor: '' },
        tags: [],
        githubLink: { url: '', title: '' },
        generalLink: { url: '', title: '' },
        attachments: []
    });
    const [taskTitle, setTaskTitle] = useState<string>("");
    const [body, setBody] = useState<PartialBlock[]>([]);
    const [assigneeName, setAssigneeName] = useState<string>(myself.userName);
    const [reporterName, setReporterName] = useState<string>(myself.userName);
    const [isSubmitted, setIsSubmitted] = useState(false);

    updateTaskTitle({ taskTitle, taskContents, setTaskContents });
    updateTaskBody({ body, taskContents, setTaskContents });
    updateTaskAttachments({ uploadedFiles, taskContents, setTaskContents });

    // Update status once task is created
    useEffect(() => {
        if (isSubmitted) {
            setIsCreatingTask(false)
            if (setIsOpeningTask) {
                setIsOpeningTask(true)
            }
            if (setIsNewTaskCreated) {
                setIsNewTaskCreated(true)
            }
        }
    }, [isSubmitted])

    const [titleErrorOpen, setTitleErrorOpen] = useState(false);
    const [titleError, setTitleError] = useState("");


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
        if (currentProject) {
            updateTagOptions({
                myself: myself,
                accessToken: accessToken,
                projectId: currentProject.projectId,
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
                taskContents={taskContents}
                taskTitle={taskTitle}
                setTaskTitle={setTaskTitle}
                setIsCreatingTask={setIsCreatingTask}
                setOpenCreateProject={setOpenCreateProject}
                setOpenCreateTag={setOpenCreateTag}
                titleError={titleError}
                titleErrorOpen={titleErrorOpen}
                setTitleErrorOpen={setTitleErrorOpen}
                isPreviewMode={false}
            />

            <Divider sx={{ mt: 1, mb: 1 }} />

            <TaskMainBlock
                taskContents={taskContents}
                setTaskContents={setTaskContents}
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
                isPreviewMode={false}
            />

            <Divider sx={{ mt: 1, mb: 1 }} />

            <TaskBodyEditBlock setBody={setBody} />

            <Divider sx={{ m: 2 }} />

            <AttachmentBlock
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                taskContents={taskContents}
                setTaskContents={setTaskContents}
            />

            <Divider sx={{ m: 2 }} />

            <CreateTaskFooter
                myself={myself}
                accessToken={accessToken}
                isDm={isDm}
                chatId={chatId}
                threadId={threadId}
                taskContents={taskContents}
                taskTitle={taskTitle}
                setIsSubmitted={setIsSubmitted}
                setTitleError={setTitleError}
                setTitleErrorOpen={setTitleErrorOpen}
                setIsCreatingTask={setIsCreatingTask}
                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
            />

        </Sheet>
    );
}
