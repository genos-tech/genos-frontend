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
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    chatType: number;
    useUISM: UIStateManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
};

export const CreateTaskForm = (props: CreateTaskProps) => {
    const { useTEM, socket, myself, setMyself, chatType, useCM, useUISM, usePM, useTM, useNM } =
        props;
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
            projectId: usePM.currentProject?.projectId || 0,
            accessToken: accessToken,
            setInitialEmptyTaskId: useTM.setInitialEmptyTaskId,
        });
    }, []);

    useEffect(() => {
        if (useTM.initialEmptyTaskId) {
            setTaskContent({
                id: useTM.initialEmptyTaskId,
                project: usePM.currentProject,
                title: "",
                body: taskContentTemplate,
                assignee: myself,
                reporter: myself,
                chatType: chatType,
                chatId: useCM.currentMainChat?.chatId || null,
                threadId: useCM.currentThreadChat?.threadId || null,
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
                parentTaskId: useTM.isCreatingTask.parentTaskId,
                rootTaskId: useTM.isCreatingTask.rootTaskId,
            });
        }
    }, [useTM.initialEmptyTaskId]);

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
            if (useTM.setIsCreatingTask) {
                useTM.setIsCreatingTask({
                    flag: false,
                    parentTaskId: null,
                    rootTaskId: null,
                });
            }
            if (useTM.setIsNewTaskCreated) {
                setTimeout(() => {
                    useTM.setIsNewTaskCreated(true);
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
            setTeamMembers: useTEM.setTeamMembers,
        });
    }, [myself, isOpenTeamMembersList]);

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
        if (usePM.currentProject) {
            updateTagOptions({
                myself: myself,
                accessToken: accessToken,
                projectId: usePM.currentProject.projectId,
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
                        useCM={useCM}
                        isPreviewMode={false}
                        myself={myself}
                        usePM={usePM}
                        setTaskTitle={setTaskTitle}
                        setTitleErrorOpen={setTitleErrorOpen}
                        taskContent={taskContent}
                        taskTitle={taskTitle}
                        useNM={useNM}
                        titleError={titleError}
                        titleErrorOpen={titleErrorOpen}
                        useTM={useTM}
                        useUISM={useUISM}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskMainBlock
                        assignee={assignee}
                        useCM={useCM}
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
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        usePM={usePM}
                    />

                    <Divider sx={{ mt: 1, mb: 1 }} />

                    <TaskCreateBodyBlock
                        body={body}
                        useCM={useCM}
                        myself={myself}
                        setBody={setBody}
                        setMyself={setMyself}
                        socket={socket}
                        taskId={taskContent.id}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />

                    <Divider sx={{ mt: 2 }} />

                    <TaskCreateAttachmentBlock
                        setTaskContent={setTaskContent}
                        taskContent={taskContent}
                    />

                    <Divider sx={{ m: 2 }} />

                    <TaskCreateFooter
                        accessToken={accessToken}
                        useCM={useCM}
                        useTM={useTM}
                        myself={myself}
                        usePM={usePM}
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
