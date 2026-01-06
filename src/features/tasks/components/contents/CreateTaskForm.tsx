import { useEffect, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { Box, Divider, Sheet, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
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

// Section divider component
const SectionDivider = ({ isDark }: { isDark: boolean }) => (
    <Divider
        sx={{
            my: 2,
            opacity: isDark ? 0.08 : 0.12,
        }}
    />
);

// Section header component
const SectionHeader = ({ children, isDark }: { children: React.ReactNode; isDark: boolean }) => (
    <Typography
        level="body-xs"
        sx={{
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: 10,
            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
            mb: 1,
        }}
    >
        {children}
    </Typography>
);

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

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
                }, 500);
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
                    sx={{
                        minHeight: 500,
                        borderRadius: "16px",
                        p: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        background: isDark
                            ? "linear-gradient(180deg, rgba(22,22,28,0.98) 0%, rgba(18,18,24,1) 100%)"
                            : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,252,255,1) 100%)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                        boxShadow: isDark
                            ? "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)"
                            : "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
                        position: "relative",
                        animation: "slideIn 0.3s ease-out",
                        "@keyframes slideIn": {
                            from: { opacity: 0, transform: "translateY(8px)" },
                            to: { opacity: 1, transform: "translateY(0)" },
                        },
                    }}
                >
                    {/* Gradient accent at top - purple for new task */}
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "3px",
                            background: isDark
                                ? "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)"
                                : "linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)",
                            borderRadius: "16px 16px 0 0",
                            opacity: 0.8,
                        }}
                    />

                    {/* Header with "New Task" badge */}
                    <Box
                        sx={{
                            p: 2.5,
                            pt: 3,
                            borderBottom: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        }}
                    >
                        <Box
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 1,
                                px: 1.5,
                                py: 0.5,
                                mb: 1.5,
                                borderRadius: "8px",
                                background: isDark
                                    ? "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)"
                                    : "linear-gradient(135deg, rgba(79,70,229,0.1) 0%, rgba(124,58,237,0.06) 100%)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(139,92,246,0.2)"
                                    : "rgba(124,58,237,0.15)",
                            }}
                        >
                            <Box
                                sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: isDark
                                        ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                                        : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                                    animation: "pulse 2s infinite",
                                    "@keyframes pulse": {
                                        "0%, 100%": { opacity: 1 },
                                        "50%": { opacity: 0.5 },
                                    },
                                }}
                            />
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "0.7rem",
                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}
                            >
                                New Task
                            </Typography>
                        </Box>

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
                    </Box>

                    {/* Main Content Section */}
                    <Box sx={{ p: 2.5 }}>
                        <SectionHeader isDark={isDark}>Task Details</SectionHeader>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: "12px",
                                background: isDark
                                    ? "rgba(255,255,255,0.02)"
                                    : "rgba(0,0,0,0.015)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.04)"
                                    : "rgba(0,0,0,0.04)",
                            }}
                        >
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
                        </Box>

                        <SectionDivider isDark={isDark} />

                        {/* Body Section */}
                        <SectionHeader isDark={isDark}>Description</SectionHeader>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: "12px",
                                background: isDark
                                    ? "rgba(255,255,255,0.02)"
                                    : "rgba(0,0,0,0.015)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.04)"
                                    : "rgba(0,0,0,0.04)",
                                minHeight: 200,
                            }}
                        >
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
                        </Box>

                        <SectionDivider isDark={isDark} />

                        {/* Attachments Section */}
                        <SectionHeader isDark={isDark}>Attachments</SectionHeader>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: "12px",
                                background: isDark
                                    ? "rgba(255,255,255,0.02)"
                                    : "rgba(0,0,0,0.015)",
                                border: "1px dashed",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.08)",
                                minHeight: 100,
                            }}
                        >
                            <TaskCreateAttachmentBlock
                                setTaskContent={setTaskContent}
                                taskContent={taskContent}
                            />
                        </Box>
                    </Box>

                    {/* Footer Section */}
                    <Box
                        sx={{
                            p: 2.5,
                            borderTop: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                            background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                        }}
                    >
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
                    </Box>
                </Sheet>
            )}
        </>
    );
};
