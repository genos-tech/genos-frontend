import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
import { Sheet, Divider } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { TaskTitleBlock } from "./base/TaskTitleBlock";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskBodyEditBlock } from "./base/TaskBodyEditBlock";
import { CreateTaskFooter } from "./base/CreateTaskFooter";
import { CreateTaskAttachmentBlock } from "./base/CreateTaskAttachmentBlock";
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
import { ChatProps, ThreadProps } from "../../../../types/chat";

const taskContentTemplate: PartialBlock[] = [
    {
        type: "heading",
        props: {
            level: 3,
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [{ text: "🧾 Description", type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [{ text: "What needs to be done?", type: "text", styles: { code: true } }],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [],
        children: [],
    },
    {
        type: "heading",
        props: {
            level: 3,
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [{ text: "🪜 Motivation", type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [{ text: "Why is this task needed?", type: "text", styles: { code: true } }],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [],
        children: [],
    },
    {
        type: "heading",
        props: {
            level: 3,
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [{ text: "🎯 Further Context", type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [{ text: "Any other sharing?", type: "text", styles: { code: true } }],
        children: [],
    },
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [],
        children: [],
    },
];

type CreateTaskProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    currentMainChat?: ChatProps;
    currentThreadChat?: ThreadProps;
    chatType: number;
    setIsMainChatVisible?: (value: boolean) => void;
    setIsThreadVisible?: (value: boolean) => void;
    isThreadVisible?: boolean;
    setIsTaskPreviewVisible?: (value: boolean) => void;
    setIsTaskCreationVisible?: (value: boolean) => void;
    setIsCreatingTask?: (value: any) => void;
    setIsOpeningTask?: (value: boolean) => void;
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    currentProject: ProjectProps | null;
    setCurrentProject: (value: ProjectProps) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    isNewTagCreated: boolean;
    setIsNewTaskCreated?: (value: boolean) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    parentTaskId: number | null;
    rootTaskId: number | null;
    setIsTaskHomeVisible?: (value: boolean) => void;
    isTaskContentVisible?: boolean;
    isCreatingTask?: boolean;
};

export const CreateTaskForm = (props: CreateTaskProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        currentMainChat,
        currentThreadChat,
        chatType,
        setIsMainChatVisible,
        setIsThreadVisible,
        isThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskCreationVisible,
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
        rootTaskId,
        setIsTaskHomeVisible,
        isTaskContentVisible,
        isCreatingTask,
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
        chatType: chatType,
        chatId: currentMainChat?.chatId || null,
        threadId: currentThreadChat?.threadId || null,
        dueDate: getFormattedTodayDateStr(),
        status: { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
        priority: { code: -1, priority: "", color: "", textColor: "" },
        effortLevel: { code: -1, level: "", color: "", textColor: "" },
        tags: [],
        githubLink: { url: "", title: "" },
        generalLink: { url: "", title: "" },
        attachments: [],
        parentTaskId: parentTaskId,
        rootTaskId: rootTaskId,
    });
    const [taskTitle, setTaskTitle] = useState<string>("");
    const [body, setBody] = useState<PartialBlock[]>(taskContentTemplate);
    const [assignee, setAssignee] = useState<UserProps>(myself);
    const [reporter, setReporter] = useState<UserProps>(myself);
    const [isSubmitted, setIsSubmitted] = useState(false);

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
                    rootTaskId: null,
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
    }, [myself, isOpenTeamMembersList]);
    useEffect(() => {
        updateTeamMembersOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamMembers: setTeamMembers,
        });
    }, []);

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
                setIsMainChatVisible={setIsMainChatVisible}
                isThreadVisible={isThreadVisible}
                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                setIsTaskCreationVisible={setIsTaskCreationVisible}
                setIsTaskHomeVisible={setIsTaskHomeVisible}
                isTaskContentVisible={isTaskContentVisible}
                isCreatingTask={isCreatingTask}
            />

            <Divider sx={{ mt: 1, mb: 1 }} />

            <TaskMainBlock
                teamMemberProfiles={teamMemberProfiles}
                socket={socket}
                taskContents={taskContents}
                setTaskContents={setTaskContents}
                teamMembers={teamMembers}
                teamProjects={teamProjects}
                projectTags={projectTags}
                myself={myself}
                setMyself={setMyself}
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
                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
            />

            <Divider sx={{ mt: 1, mb: 1 }} />

            <TaskBodyEditBlock
                teamMemberProfiles={teamMemberProfiles}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                teamMembers={teamMembers}
                body={body}
                setBody={setBody}
                setCurrentChat={setCurrentMainChat}
                setOpeningService={setOpeningService}
            />

            <Divider sx={{ m: 2 }} />

            <CreateTaskAttachmentBlock
                taskContents={taskContents}
                setTaskContents={setTaskContents}
            />

            <Divider sx={{ m: 2 }} />

            <CreateTaskFooter
                socket={socket}
                myself={myself}
                accessToken={accessToken}
                currentMainChat={currentMainChat}
                currentThreadChat={currentThreadChat}
                isThreadVisible={isThreadVisible}
                taskContents={taskContents}
                taskTitle={taskTitle}
                setIsSubmitted={setIsSubmitted}
                setTitleError={setTitleError}
                setTitleErrorOpen={setTitleErrorOpen}
                setIsMainChatVisible={setIsMainChatVisible}
                setIsThreadVisible={setIsThreadVisible}
                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                setIsTaskCreationVisible={setIsTaskCreationVisible}
                setIsCreatingTask={setIsCreatingTask}
                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                setCurrentProject={setCurrentProject}
            />
        </Sheet>
    );
};
