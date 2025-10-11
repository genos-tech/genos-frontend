import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
import { Sheet, Divider } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { TaskTitleBlock } from "./base/TaskTitleBlock";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskCreateBodyBlock } from "./base/TaskCreateBodyBlock";
import { TaskCreateFooter } from "./base/TaskCreateFooter";
import { TaskCreateAttachmentBlock } from "./base/TaskCreateAttachmentBlock";
import {
    updateTeamMembersOptions,
    updateProjectOptions,
    updateTagOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { useAuth } from "../../../../context/AuthContext";
import { getFormattedTodayDateStr } from "../../../../utils/dateUtils";
import { UserProps } from "../../../../types/admin";
import { TaskProps, ProjectProps, TagListProps } from "../../../../types/tasks";
import { ChatProps, ThreadProps } from "../../../../types/chat";
import { createEmptyTask } from "../../services/createEmptyTask";

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
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    currentMainChat?: ChatProps;
    currentThreadChat?: ThreadProps;
    chatType: number;
    setIsMainChatVisible?: (value: boolean) => void;
    isThreadVisible?: boolean;
    setIsTaskPreviewVisible?: (value: boolean) => void;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
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
    isTaskPreviewVisible?: boolean;
    teamProjects: ProjectProps[];
    setTeamProjects: (value: ProjectProps[]) => void;
    initialEmptyTaskId?: number;
    setInitialEmptyTaskId: (value: number | undefined) => void;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean
    ) => void;
    openingService: number;
};

export const CreateTaskForm = (props: CreateTaskProps) => {
    const {
        teamMembers,
        setTeamMembers,
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        currentMainChat,
        currentThreadChat,
        chatType,
        setIsMainChatVisible,
        isThreadVisible,
        setIsTaskPreviewVisible,
        isCreatingTask,
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
        isTaskPreviewVisible,
        teamProjects,
        setTeamProjects,
        initialEmptyTaskId,
        setInitialEmptyTaskId,
        moveToSpecificChat,
        openingService,
    } = props;
    const { accessToken } = useAuth();

    // Init task contents
    const [taskContents, setTaskContents] = useState<TaskProps>();
    const [taskTitle, setTaskTitle] = useState<string>("");
    const [body, setBody] = useState<PartialBlock[]>(taskContentTemplate);
    const [assignee, setAssignee] = useState<UserProps>(myself);
    const [reporter, setReporter] = useState<UserProps>(myself);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        createEmptyTask({
            myself: myself,
            projectId: currentProject?.projectId || 0,
            accessToken: accessToken,
            setInitialEmptyTaskId: setInitialEmptyTaskId,
        });
    }, []);

    useEffect(() => {
        if (initialEmptyTaskId) {
            setTaskContents({
                id: initialEmptyTaskId,
                project: currentProject,
                title: "",
                body: taskContentTemplate,
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
        }
    }, [initialEmptyTaskId]);

    // Update task title when it changes
    useEffect(() => {
        if (taskContents && taskTitle !== "") {
            setTaskContents({
                ...taskContents,
                title: taskTitle,
            });
        }
    }, [taskTitle]);

    // Update task body when it changes
    useEffect(() => {
        if (taskContents && body.length > 0) {
            setTaskContents({
                ...taskContents,
                body: body,
            });
        }
    }, [body]);

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
                setTimeout(() => {
                    setIsNewTaskCreated(true);
                }, 500); // wait 500ms to show the new task
            }
        }
    }, [isSubmitted]);

    const [titleErrorOpen, setTitleErrorOpen] = useState(false);
    const [titleError, setTitleError] = useState("");

    // Get team members
    const [isOpenTeamMembersList, setIsOpenTeamMembersList] = useState(false);
    useEffect(() => {
        updateTeamMembersOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamMembers: setTeamMembers,
        });
    }, [myself, isOpenTeamMembersList]);

    // Get team projects
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
        <>
            {taskContents && taskContents.id && (
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
                        myself={myself}
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
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                        isTaskPreviewVisible={isTaskPreviewVisible}
                        isCreatingTask={isCreatingTask}
                        setInitialEmptyTaskId={setInitialEmptyTaskId}
                        moveToSpecificChat={moveToSpecificChat}
                        openingService={openingService}
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

                    <TaskCreateBodyBlock
                        teamMemberProfiles={teamMemberProfiles}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        teamMembers={teamMembers}
                        taskId={taskContents.id}
                        body={body}
                        setBody={setBody}
                        setCurrentChat={setCurrentMainChat}
                        setOpeningService={setOpeningService}
                    />

                    <Divider sx={{ m: 2 }} />

                    <TaskCreateAttachmentBlock
                        taskContents={taskContents}
                        setTaskContents={setTaskContents}
                    />

                    <Divider sx={{ m: 2 }} />

                    <TaskCreateFooter
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
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        setIsCreatingTask={setIsCreatingTask}
                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                        setCurrentProject={setCurrentProject}
                        setInitialEmptyTaskId={setInitialEmptyTaskId}
                    />
                </Sheet>
            )}
        </>
    );
};
