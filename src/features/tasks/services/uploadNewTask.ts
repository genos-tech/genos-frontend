import { Socket } from "socket.io-client";

import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { ChatProps, ThreadProps } from "../../../types/chat";
import {
    taskMessageTemplate,
    taskCreatedThreadMessageTemplate,
} from "../utils/TaskMessageTemplate";
import { addTask } from "./addTask";

const base_url = import.meta.env.VITE_API_BASE_URL;

type uploadTaskProps = {
    socket: Socket | null;
    myself: UserProps;
    taskContents: TaskProps;
    currentMainChat?: ChatProps;
    currentThreadChat?: ThreadProps;
    isThreadVisible?: boolean;
    accessToken: string;
    setIsSubmitted: (value: boolean) => void;
    setTitleError: (value: string) => void;
    setTitleErrorOpen: (value: boolean) => void;
    setCurrentPreviewTaskId: (value: number) => void;
};

export const uploadNewTask = async (props: uploadTaskProps) => {
    const {
        socket,
        myself,
        taskContents,
        currentMainChat,
        currentThreadChat,
        isThreadVisible,
        accessToken,
        setIsSubmitted,
        setTitleError,
        setTitleErrorOpen,
        setCurrentPreviewTaskId,
    } = props;

    if (taskContents.title === "") {
        console.error("Target title is required !!!");
        setTitleError("Task title is required !!!");
        setTitleErrorOpen(true);
    } else if (taskContents.project === null) {
        console.error("Target project is required !!!");
        setTitleError("Target project is required !!!");
        setTitleErrorOpen(true);
    } else {
        try {
            const taskCreateResponse = await fetch(`${base_url}/task/create/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team: myself.teamId,
                    project: taskContents.project.projectId,
                    assignee: taskContents.assignee.userId,
                    reporter: taskContents.reporter.userId,
                    title: taskContents.title,
                    priority:
                        taskContents.priority.priority !== ""
                            ? taskContents.priority.priority
                            : null,
                    effort_level:
                        taskContents.effortLevel.level !== ""
                            ? taskContents.effortLevel.level
                            : null,
                    status: taskContents.status.status !== "" ? taskContents.status.status : null,
                    content: taskContents.body.length !== 0 ? taskContents.body : [],
                    due_date: taskContents.dueDate !== "" ? taskContents.dueDate : null,
                    github_url:
                        taskContents.githubLink.url !== "" ? taskContents.githubLink.url : null,
                    github_url_title:
                        taskContents.githubLink.title !== ""
                            ? taskContents.githubLink.title
                            : null,
                    general_url:
                        taskContents.generalLink.url !== "" ? taskContents.generalLink.url : null,
                    general_url_title:
                        taskContents.generalLink.title !== ""
                            ? taskContents.generalLink.title
                            : null,
                    tags: taskContents.tags,
                    chat_type: taskContents.chatType,
                    chat_id: currentMainChat?.chatId || null,
                    thread_id: currentThreadChat?.threadId || null,
                    parent_task_id: taskContents.parentTaskId,
                    root_task_id: taskContents.rootTaskId,
                }),
            });

            const taskCreateData = await taskCreateResponse.json();

            if (!taskCreateResponse.ok) {
                throw new Error("Failed to create a task");
            } else {
                setCurrentPreviewTaskId(taskCreateData.task_id);

                for (const attachment of taskContents.attachments) {
                    const formData = new FormData();
                    formData.append("task", taskCreateData.task_id);
                    formData.append("attachment_id", "-1");
                    formData.append("attached_file", attachment.file);
                    formData.append("attached_type", attachment.file.type);

                    const uploadAttachmentResponse = await fetch(`${base_url}/task/attachment/`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                        body: formData,
                    });

                    const uploadAttachmentData = await uploadAttachmentResponse.json();

                    if (!uploadAttachmentResponse.ok) {
                        throw new Error(
                            uploadAttachmentData.message || "Attachment Upload Failed"
                        );
                    }
                }

                addTask({
                    id: String(taskCreateData.task_id),
                    title: taskContents.title,
                    priority: taskContents.priority.priority,
                    effortLevel: taskContents.effortLevel.level,
                    createdDate: taskContents.createdDate || null,
                    updatedAt: taskCreateData.updatedAt || null,
                    dueDate: taskContents.dueDate,
                    daysLeft: taskContents.daysLeft || null,
                    status: taskContents.status.status,
                    assigneeId: taskContents.assignee.userId,
                    assigneeEmail: taskContents.assignee.userEmail,
                    assigneeName: taskContents.assignee.userName,
                    assigneeImgPath: taskContents.assignee.avatarImgPath,
                    parentTaskId: String(taskContents.parentTaskId),
                    threadId: taskContents.threadId,
                    tags: taskContents.tags,
                    concatTags: taskContents.concatTags || null,
                    teamId: myself.teamId,
                    projectId: taskContents.project.projectId,
                });

                // Send "task created" message
                if (socket) {
                    // 1. join "pm" chat group
                    socket.emit(
                        "join",
                        {
                            joiningCGId: taskContents.project.projectId,
                            joiningCGName: taskContents.project.projectName,
                            chatType: 3,
                            dmPartnerUserId: null,
                        },
                        (ack: any) => {
                            const createTaskMessage = taskMessageTemplate(taskContents);
                            if (taskContents.project !== null && createTaskMessage) {
                                // Send "task created" message to PM
                                socket.emit(
                                    "message",
                                    {
                                        methodType: "POST",
                                        message: createTaskMessage,
                                        destCGName: taskContents.project.projectName,
                                        destCGId: taskContents.project.projectId,
                                        chatType: 3,
                                        dmPartnerUserId: null,
                                        taskId: taskCreateData.task_id,
                                        taskStatus: taskCreateData.status,
                                        systemUserId: taskContents.project.systemUserId,
                                        messageIdForPut: null,
                                    },
                                    (ack: any) => {
                                        if (taskCreateData.task_id && taskContents.project) {
                                            const newTaskCreatedThreadMessage =
                                                taskCreatedThreadMessageTemplate(myself);
                                            socket.emit("thread_message", {
                                                methodType: "POST",
                                                isInit: false,
                                                rootMessageTSSent: "",
                                                rootMessageSenderId: null,
                                                rootMessageReceiverId: null,
                                                threadId: null,
                                                threadMessage: newTaskCreatedThreadMessage,
                                                chatType: 3,
                                                dmPartnerUserId: null,
                                                senderId: taskContents.project.systemUserId,
                                                senderName: taskContents.project.projectName,
                                                destCGName: taskContents.project.projectName,
                                                destCGId: taskContents.project.projectId,
                                                taskId: taskCreateData.task_id,
                                                systemUserId: taskContents.project.systemUserId,
                                                messageIdForPut: null,
                                            });
                                        }
                                    }
                                );

                                // Messaging for a new task from a thread chat
                                if (
                                    isThreadVisible === true &&
                                    currentMainChat &&
                                    currentThreadChat &&
                                    (currentMainChat.chatType === 1 ||
                                        currentMainChat.chatType === 2) &&
                                    currentThreadChat.threadId !== null &&
                                    currentThreadChat.threadId !== -1
                                ) {
                                    console.log("here");
                                    // Not update message_body, just update task_id here.
                                    socket.emit("message", {
                                        methodType: "PUT",
                                        message: null,
                                        destCGName: currentMainChat.chatName,
                                        destCGId: currentMainChat.chatId,
                                        chatType: currentMainChat.chatType,
                                        dmPartnerUserId: currentMainChat.dmPartnerUser?.userId,
                                        taskId: taskCreateData.task_id,
                                        taskStatus: taskCreateData.status,
                                        systemUserId: taskContents.project.systemUserId,
                                        messageIdForPut: currentThreadChat.threadId,
                                    });

                                    socket.emit("thread_message", {
                                        methodType: "POST",
                                        isInit: false,
                                        rootMessageTSSent: "",
                                        rootMessageSenderId: null,
                                        rootMessageReceiverId: null,
                                        threadId: currentThreadChat.threadId,
                                        threadMessage: createTaskMessage,
                                        chatType: currentThreadChat.chatType,
                                        dmPartnerUserId: currentThreadChat.dmPartnerUser?.userId,
                                        senderId: taskContents.project.systemUserId,
                                        senderName: taskContents.project.projectName,
                                        destCGName: currentThreadChat.chatName,
                                        destCGId: currentThreadChat.chatId,
                                        taskId: taskCreateData.task_id,
                                        taskStatus: taskCreateData.status,
                                        systemUserId: taskContents.project.systemUserId,
                                        messageIdForPut: null,
                                    });
                                }
                            } else {
                                console.error(
                                    "Failed to send 'task created message from a thread chat'."
                                );
                            }
                        }
                    );
                } else {
                    console.error("socket not found");
                }

                setIsSubmitted(true);
            }
        } catch (error) {
            console.error(error);
            return [];
        }
    }
};
