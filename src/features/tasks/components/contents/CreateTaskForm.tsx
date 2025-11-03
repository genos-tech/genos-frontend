import { useEffect, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { Divider, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
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
    chatType: number;
    UIM: UIStateManagementState;
    PM: ProjectManagementState;
    TM: TaskManagementState;
    CM: ChatManagementState;
    NM: NoteManagementState;
};

export const CreateTaskForm = (props: CreateTaskProps) => {
    const { TEM, socket, myself, setMyself, chatType, CM, UIM, PM, TM, NM } = props;
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
                chatId: CM.currentMainChat?.chatId || null,
                threadId: CM.currentThreadChat?.threadId || null,
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
                parentTaskId: TM.isCreatingTask.parentTaskId,
                rootTaskId: TM.isCreatingTask.rootTaskId,
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
                        CM={CM}
                        isPreviewMode={false}
                        myself={myself}
                        PM={PM}
                        setTaskTitle={setTaskTitle}
                        setTitleErrorOpen={setTitleErrorOpen}
                        taskContent={taskContent}
                        taskTitle={taskTitle}
                        NM={NM}
                        titleError={titleError}
                        titleErrorOpen={titleErrorOpen}
                        TM={TM}
                        UIM={UIM}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskMainBlock
                        assignee={assignee}
                        CM={CM}
                        isOpenProjectList={isOpenProjectList}
                        isOpenTagList={isOpenTagList}
                        isOpenTeamMembersList={isOpenTeamMembersList}
                        isPreviewMode={false}
                        myself={myself}
                        projectTags={projectTags}
                        reporter={reporter}
                        setAssignee={setAssignee}
                        setIsOpenProjectList={setIsOpenProjectList}
                        setIsOpenTagList={setIsOpenTagList}
                        setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                        setMyself={setMyself}
                        setReporter={setReporter}
                        setTaskContent={setTaskContent}
                        socket={socket}
                        taskContent={taskContent}
                        TEM={TEM}
                        TM={TM}
                        UIM={UIM}
                        PM={PM}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskCreateBodyBlock
                        body={body}
                        CM={CM}
                        myself={myself}
                        setBody={setBody}
                        setMyself={setMyself}
                        socket={socket}
                        taskId={taskContent.id}
                        TEM={TEM}
                        UIM={UIM}
                    />

                    <Divider sx={{ mt: 2 }} />

                    <TaskCreateAttachmentBlock
                        setTaskContent={setTaskContent}
                        taskContent={taskContent}
                    />

                    <Divider sx={{ m: 2 }} />

                    <TaskCreateFooter
                        accessToken={accessToken}
                        CM={CM}
                        TM={TM}
                        myself={myself}
                        PM={PM}
                        setIsSubmitted={setIsSubmitted}
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
