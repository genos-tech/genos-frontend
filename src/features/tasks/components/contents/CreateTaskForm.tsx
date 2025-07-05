import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
import { Sheet, Divider } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { TaskTitleBlock } from "./base/TaskTitleBlock";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskBodyEditBlock } from "./base/TaskBodyEditBlock";
import { CreateTaskFooter } from "./base/CreateTaskFooter";
import { TaskAttachmentBlock } from "./base/TaskAttachmentBlock";
import {
    updateTaskTitle,
    updateTaskBody,
    updateTaskAttachments,
} from "../../hooks/taskUpdateHooks";
import {
    updateTeamMembersOptions,
    updateProjectOptions,
    updateTagOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { useAuth } from "../../../../context/AuthContext";
import { getFormattedTodayDateStr } from "../../../../utils/dateUtils";
import { UserProps } from "../../../../types/admin";
import {
    AttachmentFileProps,
    TaskProps,
    ProjectProps,
    TagListProps,
} from "../../../../types/tasks";
import { ChatProps } from "../../../../types/chat";

type CreateTaskProps = {
    socket: Socket | null;
    myself: UserProps;
    isDm: boolean | null;
    chatId: number | null;
    threadId: number | null;
    setIsTaskContentVisible: (value: boolean) => void;
    setIsCreatingTask?: (value: any) => void;
    setIsOpeningTask?: (value: boolean) => void;
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    currentProject: ProjectProps | null;
    setCurrentProject: (value: ProjectProps) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    isNewProjectCreated: boolean;
    isNewTagCreated: boolean;
    setIsNewTaskCreated?: (value: boolean) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    parentTaskId: number | null;
};

export const CreateTaskForm = (props: CreateTaskProps) => {
    const {
        socket,
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
        setIsNewTaskCreated,
        setOpeningService,
        setCurrentMainChat,
        parentTaskId,
    } = props;
    const { accessToken } = useAuth();
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>([]);

    // Init task contents
    const [taskContents, setTaskContents] = useState<TaskProps>({
        project: currentProject,
        title: "",
        body: [],
        assignee: myself,
        reporter: myself,
        chatType: isDm === null || isDm === undefined ? null : isDm ? "dm" : "gm",
        chatId: chatId,
        threadId: threadId,
        dueDate: getFormattedTodayDateStr(),
        status: { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
        priority: { code: -1, priority: "", color: "", textColor: "" },
        effortLevel: { code: -1, level: "", color: "", textColor: "" },
        tags: [],
        githubLink: { url: "", title: "" },
        generalLink: { url: "", title: "" },
        attachments: [],
        parentTaskId: parentTaskId,
    });
    const [taskTitle, setTaskTitle] = useState<string>("");
    const [body, setBody] = useState<PartialBlock[]>([]);
    const [assignee, setAssignee] = useState<UserProps>(myself);
    const [reporter, setReporter] = useState<UserProps>(myself);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isAttachmentDeleted, setIsAttachmentDeleted] = useState(false);

    updateTaskTitle({ taskTitle, taskContents, setTaskContents });
    updateTaskBody({ body, taskContents, setTaskContents });
    updateTaskAttachments({ uploadedFiles, taskContents, setTaskContents });

    // Update status once task is created
    useEffect(() => {
        if (isSubmitted) {
            if (setIsCreatingTask) {
                setIsCreatingTask({
                    flag: false,
                    parentTaskId: null,
                });
            }

            if (setIsOpeningTask) {
                setIsOpeningTask(true);
            }

            if (setIsNewTaskCreated) {
                setIsNewTaskCreated(true);
            }
        }
    }, [isSubmitted]);

    const [titleErrorOpen, setTitleErrorOpen] = useState(false);
    const [titleError, setTitleError] = useState("");

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
        if (currentProject) {
            updateTagOptions({
                myself: myself,
                accessToken: accessToken,
                projectId: currentProject.projectId,
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
                socket={socket}
                taskContents={taskContents}
                setTaskContents={setTaskContents}
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
                isPreviewMode={false}
                setOpeningService={setOpeningService}
                setCurrentMainChat={setCurrentMainChat}
            />

            <Divider sx={{ mt: 1, mb: 1 }} />

            <TaskBodyEditBlock setBody={setBody} />

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
};
