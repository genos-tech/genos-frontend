import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { getMessages } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import {
    taskCreatedThreadMessageTemplate,
    taskMessageTemplate,
} from "../utils/TaskMessageTemplate";
import { addTask } from "./addTask";

const base_url = import.meta.env.VITE_API_BASE_URL;

type uploadTaskProps = {
    socket: Socket | null;
    myself: UserProps;
    taskContent: TaskProps;
    useCM: ChatManagementState;
    accessToken: string;
    setTitleError: (value: string) => void;
    setTitleErrorOpen: (value: boolean) => void;
    setCurrentPreviewTaskId: (value: number) => void;
};

export const uploadNewTask = async (props: uploadTaskProps) => {
    const {
        socket,
        myself,
        taskContent,
        useCM,
        accessToken,
        setTitleError,
        setTitleErrorOpen,
        setCurrentPreviewTaskId,
    } = props;

    const errMsgs = getMessages().tasks.errors;
    if (taskContent.title === "") {
        setTitleError(errMsgs.taskTitleRequired);
        setTitleErrorOpen(true);
    } else if (taskContent.project === null) {
        setTitleError(errMsgs.targetProjectRequired);
        setTitleErrorOpen(true);
    } else if (taskContent.id === undefined) {
        setTitleError(errMsgs.targetTaskIdRequired);
        setTitleErrorOpen(true);
    } else {
        try {
            const taskCreateResponse = await fetch(`${base_url}/task/`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team: myself.teamId,
                    task_id: taskContent.id,
                    project: taskContent.project.projectId,
                    assignee: taskContent.assignee.userId,
                    reporter: taskContent.reporter.userId,
                    title: taskContent.title,
                    priority:
                        taskContent.priority.priority !== ""
                            ? taskContent.priority.priority
                            : null,
                    effort_level:
                        taskContent.effortLevel.level !== ""
                            ? taskContent.effortLevel.level
                            : null,
                    status: taskContent.status.status !== "" ? taskContent.status.status : null,
                    content: taskContent.body.length !== 0 ? taskContent.body : [],
                    due_date: taskContent.dueDate !== "" ? taskContent.dueDate : null,
                    start_date: taskContent.startDate ?? null,
                    links: taskContent.links,
                    tags: taskContent.tags,
                    chat_type: taskContent.chatType,
                    chat_id: useCM.currentMainChat?.chatId || null,
                    thread_id: useCM.currentThreadChat?.threadId || null,
                    parent_task_id: taskContent.parentTaskId,
                    root_task_id: taskContent.rootTaskId,
                    is_init_task: false,
                    // Persist milestone / sprint linkage on tasks so a
                    // task created inside a milestone (or planned for a
                    // sprint) keeps that link instead of silently
                    // dropping it. Only include the keys when set so a
                    // missing field doesn't get serialized as null and
                    // hit the backend's None-strip behaviour.
                    ...(taskContent.milestoneId != null
                        ? { milestone: taskContent.milestoneId }
                        : {}),
                    ...(taskContent.sprintId != null ? { sprint: taskContent.sprintId } : {}),
                }),
            });

            const taskCreateData = await taskCreateResponse.json();

            if (!taskCreateResponse.ok) {
                throw new Error(errMsgs.createTaskFailed);
            } else {
                if (taskCreateData.newly_mentioned_user_ids) {
                    const newly_mentioned_user_ids: string[] =
                        taskCreateData.newly_mentioned_user_ids;
                    if (socket && newly_mentioned_user_ids.length > 0) {
                        socket.emit("task_body_mention", {
                            task_id: taskContent.id,
                            task_title: taskContent.title,
                            project_id: taskContent.project.projectId,
                            project_name: taskContent.project.projectName,
                            ts_mentioned_at: taskCreateData.task.updatedAt,
                            mentioned_user_ids: newly_mentioned_user_ids,
                        });
                    }
                }

                if (useCM.currentThreadChat) {
                    useCM.setCurrentThreadChat({
                        ...useCM.currentThreadChat,
                        taskId: taskCreateData.task.task_id,
                        taskExist: true,
                    });
                }

                for (const attachment of taskContent.attachments) {
                    const formData = new FormData();
                    formData.append("task", taskCreateData.task.task_id);
                    formData.append("attachment_id", "-1");
                    formData.append("attached_file", attachment.file);
                    formData.append(
                        "attached_type",
                        attachment.file.type || "application/octet-stream"
                    );

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
                            uploadAttachmentData.message || errMsgs.attachmentUploadFailed
                        );
                    }
                }

                setCurrentPreviewTaskId(taskCreateData.task.task_id);

                addTask({
                    id: String(taskCreateData.task.task_id),
                    title: taskContent.title,
                    priority: taskContent.priority.priority,
                    effortLevel: taskContent.effortLevel.level,
                    createdDate: taskContent.createdDate || null,
                    updatedAt: taskCreateData.task.updatedAt || null,
                    dueDate: taskContent.dueDate,
                    daysLeft: taskContent.daysLeft || null,
                    status: taskContent.status.status,
                    assigneeId: taskContent.assignee.userId,
                    assigneeEmail: taskContent.assignee.userEmail,
                    assigneeName: taskContent.assignee.userName,
                    assigneeImgPath: taskContent.assignee.avatarImgPath,
                    parentTaskId: String(taskContent.parentTaskId),
                    threadId: taskContent.threadId,
                    tags: taskContent.tags,
                    concatTags: taskContent.concatTags || null,
                    teamId: myself.teamId,
                    projectId: taskContent.project.projectId,
                    isMilestone: taskContent.isMilestone ?? false,
                    milestoneId: taskContent.milestoneId ?? null,
                    sprintId: taskContent.sprintId ?? null,
                });

                // Send "task created" message
                if (socket) {
                    // 1. join "pm" chat group
                    socket.emit(
                        "join",
                        {
                            joiningCGId: taskContent.project.projectId,
                            joiningCGName: taskContent.project.projectName,
                            chatType: 3,
                            dmPartnerUserId: null,
                        },
                        (ack: any) => {
                            const createTaskMessage = taskMessageTemplate(myself, taskContent);
                            if (taskContent.project !== null && createTaskMessage) {
                                // Send "task created" message to PM
                                socket.emit(
                                    "message",
                                    {
                                        methodType: "POST",
                                        message: createTaskMessage,
                                        destCGName: taskContent.project.projectName,
                                        destCGId: taskContent.project.projectId,
                                        chatType: 3,
                                        dmPartnerUserId: null,
                                        taskId: taskCreateData.task.task_id,
                                        taskStatus: taskCreateData.task.status,
                                        systemUserId: taskContent.project.systemUserId,
                                        messageIdForPut: null,
                                    },
                                    (ack: any) => {
                                        if (taskCreateData.task.task_id && taskContent.project) {
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
                                                senderId: taskContent.project.systemUserId,
                                                senderName: taskContent.project.projectName,
                                                destCGName: taskContent.project.projectName,
                                                destCGId: taskContent.project.projectId,
                                                taskId: taskCreateData.task.task_id,
                                                systemUserId: taskContent.project.systemUserId,
                                                messageIdForPut: null,
                                            });
                                        }
                                    }
                                );

                                // Messaging for a new task from a thread chat
                                if (
                                    useCM.isThreadVisible === true &&
                                    useCM.currentMainChat &&
                                    useCM.currentThreadChat &&
                                    (useCM.currentMainChat.chatType === 1 ||
                                        useCM.currentMainChat.chatType === 2 ||
                                        useCM.currentMainChat.chatType === 4) &&
                                    useCM.currentThreadChat.threadId !== null &&
                                    useCM.currentThreadChat.threadId !== 0
                                ) {
                                    // Not update message_body, just update task_id here.
                                    socket.emit("message", {
                                        methodType: "PUT",
                                        message: null,
                                        destCGName: useCM.currentMainChat.chatName,
                                        destCGId: useCM.currentMainChat.chatId,
                                        chatType: useCM.currentMainChat.chatType,
                                        dmPartnerUserId:
                                            useCM.currentMainChat.dmPartnerUser.userId,
                                        taskId: taskCreateData.task.task_id,
                                        taskStatus: taskCreateData.task.status,
                                        systemUserId: taskContent.project.systemUserId,
                                        messageIdForPut: useCM.currentThreadChat.threadId,
                                        isPrivate: useCM.currentMainChat.isPrivate,
                                    });

                                    socket.emit("thread_message", {
                                        methodType: "POST",
                                        isInit: false,
                                        rootMessageTSSent: "",
                                        rootMessageSenderId: null,
                                        rootMessageReceiverId: null,
                                        threadId: useCM.currentThreadChat.threadId,
                                        threadMessage: createTaskMessage,
                                        chatType: useCM.currentThreadChat.chatType,
                                        dmPartnerUserId:
                                            useCM.currentThreadChat.dmPartnerUser.userId,
                                        senderId: taskContent.project.systemUserId,
                                        senderName: taskContent.project.projectName,
                                        destCGName: useCM.currentThreadChat.chatName,
                                        destCGId: useCM.currentThreadChat.chatId,
                                        taskId: taskCreateData.task.task_id,
                                        taskStatus: taskCreateData.task.status,
                                        systemUserId: taskContent.project.systemUserId,
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
            }
        } catch (error) {
            console.error(error);
            return [];
        }
    }
};
