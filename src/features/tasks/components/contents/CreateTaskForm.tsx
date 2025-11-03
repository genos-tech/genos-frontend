import { useEffect, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { Divider, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps, ThreadProps } from "../../../../types/chat";
import { TagListProps, TaskProps } from "../../../../types/tasks";
import { getFormattedTodayDateStr } from "../../../../utils/dateUtils";
import { createEmptyTask } from "../../services/createEmptyTask";
import {
    updateProjectOptions,
    updateTagOptions,
    updateTeamMembersOptions,
} from "../../services/updateTaskAutoCompleteOptions";
import { TaskCreateAttachmentBlock } from "./base/TaskCreateAttachmentBlock";
import { TaskCreateBodyBlock } from "./base/TaskCreateBodyBlock";
import { TaskCreateFooter } from "./base/TaskCreateFooter";
import { TaskMainBlock } from "./base/TaskMainBlock";
import { TaskTitleBlock } from "./base/TaskTitleBlock";

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
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [{ text: "What needs to be done?", type: "text", styles: { code: true } }],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
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
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [
            {
                text: "Why is this task needed?",
                type: "text",
                styles: { code: true },
            },
        ],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
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
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [{ text: "Any other sharing?", type: "text", styles: { code: true } }],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    },
];

type CreateTaskProps = {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    currentMainChat?: ChatProps;
    currentThreadChat?: ThreadProps;
    chatType: number;
    setIsMainChatVisible?: (value: boolean) => void;
    isThreadVisible?: boolean;
    setIsTaskPreviewVisible?: (value: boolean) => void;
    UIM: UIStateManagementState;
    setCurrentMainChat: (chat: ChatProps) => void;
    parentTaskId: number | null;
    rootTaskId: number | null;
    setIsTaskHomeVisible?: (value: boolean) => void;
    isTaskPreviewVisible?: boolean;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => void;
    PM: ProjectManagementState;
    TM: TaskManagementState;
};

export const CreateTaskForm = (props: CreateTaskProps) => {
    const {
        TEM,
        socket,
        myself,
        setMyself,
        currentMainChat,
        currentThreadChat,
        chatType,
        setIsMainChatVisible,
        isThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskHomeVisible,
        setCurrentMainChat,
        UIM,
        parentTaskId,
        rootTaskId,
        moveToSpecificChat,
        PM,
        TM,
    } = props;
    const { accessToken } = useAuth();

    // Init task contents
    const [taskContent, setTaskContent] = useState<TaskProps>();
    const [taskTitle, setTaskTitle] = useState<string>("");
    const [body, setBody] = useState<PartialBlock[]>(taskContentTemplate);
    const [assignee, setAssignee] = useState<UserProps>(myself);
    const [reporter, setReporter] = useState<UserProps>(myself);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        createEmptyTask({
            myself: myself,
            projectId: PM.currentProject?.projectId || 0,
            accessToken: accessToken,
            setInitialEmptyTaskId: TM.setInitialEmptyTaskId,
        });
    }, []);

    useEffect(() => {
        if (TM.initialEmptyTaskId) {
            setTaskContent({
                id: TM.initialEmptyTaskId,
                project: PM.currentProject,
                title: "",
                body: taskContentTemplate,
                assignee: myself,
                reporter: myself,
                chatType: chatType,
                chatId: currentMainChat?.chatId || null,
                threadId: currentThreadChat?.threadId || null,
                dueDate: getFormattedTodayDateStr(),
                status: {
                    code: 0,
                    status: "Open",
                    color: "#0044c2",
                    textColor: "white",
                },
                priority: { code: -1, priority: "", color: "", textColor: "" },
                effortLevel: { code: -1, level: "", color: "", textColor: "" },
                tags: [],
                links: [],
                attachments: [],
                parentTaskId: parentTaskId,
                rootTaskId: rootTaskId,
            });
        }
    }, [TM.initialEmptyTaskId]);

    // Update task title when it changes
    useEffect(() => {
        if (taskContent && taskTitle !== "") {
            setTaskContent({
                ...taskContent,
                title: taskTitle,
            });
        }
    }, [taskTitle]);

    // Update task body when it changes
    useEffect(() => {
        if (taskContent && body.length > 0) {
            setTaskContent({
                ...taskContent,
                body: body,
            });
        }
    }, [body]);

    // Update status once task is created
    useEffect(() => {
        if (isSubmitted) {
            if (TM.setIsCreatingTask) {
                TM.setIsCreatingTask({
                    flag: false,
                    parentTaskId: null,
                    rootTaskId: null,
                });
            }
            if (TM.setIsNewTaskCreated) {
                setTimeout(() => {
                    TM.setIsNewTaskCreated(true);
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
            setTeamMembers: TEM.setTeamMembers,
        });
    }, [myself, isOpenTeamMembersList]);

    // Get team projects
    const [isOpenProjectList, setIsOpenProjectList] = useState(false);
    useEffect(() => {
        updateProjectOptions({
            myself: myself,
            accessToken: accessToken,
            setTeamProjects: PM.setTeamProjects,
        });
    }, [isOpenProjectList]);

    // Get Project tags
    const [projectTags, setProjectTags] = useState<TagListProps[]>([]);
    const [isOpenTagList, setIsOpenTagList] = useState(false);
    useEffect(() => {
        if (PM.currentProject) {
            updateTagOptions({
                myself: myself,
                accessToken: accessToken,
                projectId: PM.currentProject.projectId,
                setProjectTags: setProjectTags,
            });
        }
    }, [isOpenTagList]);

    return (
        <>
            {taskContent && taskContent.id && (
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
                        handleCreateNewTaskNote={async () => {}}
                        isPreviewMode={false}
                        moveToSpecificChat={moveToSpecificChat}
                        myself={myself}
                        setCurrentProject={PM.setCurrentProject}
                        setCurrentTaskNote={() => {}}
                        setIsMainChatVisible={setIsMainChatVisible}
                        setOpenCreateProject={PM.setOpenCreateProject}
                        setOpenCreateTag={TM.setOpenCreateTag}
                        UIM={UIM}
                        setTaskTitle={setTaskTitle}
                        setTitleErrorOpen={setTitleErrorOpen}
                        taskContent={taskContent}
                        taskNotes={[]}
                        taskTitle={taskTitle}
                        titleError={titleError}
                        titleErrorOpen={titleErrorOpen}
                        TM={TM}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskMainBlock
                        assignee={assignee}
                        isOpenProjectList={isOpenProjectList}
                        isOpenTagList={isOpenTagList}
                        isOpenTeamMembersList={isOpenTeamMembersList}
                        isPreviewMode={false}
                        myself={myself}
                        projectTags={projectTags}
                        reporter={reporter}
                        setAssignee={setAssignee}
                        setCurrentMainChat={setCurrentMainChat}
                        setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                        setCurrentProject={PM.setCurrentProject}
                        setIsOpenProjectList={setIsOpenProjectList}
                        setIsOpenTagList={setIsOpenTagList}
                        setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                        setMyself={setMyself}
                        setOpenCreateTag={TM.setOpenCreateTag}
                        UIM={UIM}
                        setReporter={setReporter}
                        setTaskContent={setTaskContent}
                        socket={socket}
                        taskContent={taskContent}
                        TEM={TEM}
                        teamProjects={PM.teamProjects}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskCreateBodyBlock
                        body={body}
                        myself={myself}
                        setBody={setBody}
                        setCurrentChat={setCurrentMainChat}
                        setMyself={setMyself}
                        UIM={UIM}
                        socket={socket}
                        taskId={taskContent.id}
                        TEM={TEM}
                    />

                    <Divider sx={{ mt: 2 }} />

                    <TaskCreateAttachmentBlock
                        setTaskContent={setTaskContent}
                        taskContent={taskContent}
                    />

                    <Divider sx={{ m: 2 }} />

                    <TaskCreateFooter
                        accessToken={accessToken}
                        currentMainChat={currentMainChat}
                        currentThreadChat={currentThreadChat}
                        isThreadVisible={isThreadVisible}
                        myself={myself}
                        setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                        setCurrentProject={PM.setCurrentProject}
                        setInitialEmptyTaskId={TM.setInitialEmptyTaskId}
                        setIsCreatingTask={TM.setIsCreatingTask}
                        setIsSubmitted={setIsSubmitted}
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        setTitleError={setTitleError}
                        setTitleErrorOpen={setTitleErrorOpen}
                        socket={socket}
                        taskContent={taskContent}
                        taskTitle={taskTitle}
                    />
                </Sheet>
            )}
        </>
    );
};
