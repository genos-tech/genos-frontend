import { Socket } from "socket.io-client";

import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { taskMessageTemplate } from "../utils/TaskMessageTemplate";

const base_url = import.meta.env.VITE_API_BASE_URL;

type uploadTaskProps = {
    socket: Socket | null;
    myself: UserProps;
    taskContents: TaskProps;
    isDm: boolean | null;
    chatType: number | null;
    chatId: number | null;
    threadId: number | null;
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
        isDm,
        chatType,
        chatId,
        threadId,
        accessToken,
        setIsSubmitted,
        setTitleError,
        setTitleErrorOpen,
        setCurrentPreviewTaskId,
    } = props;

    if (taskContents.title === "") {
        setTitleError("Task title is required !!!");
        setTitleErrorOpen(true);
    } else {
        try {
            if (taskContents.project !== null) {
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
                        status:
                            taskContents.status.status !== "" ? taskContents.status.status : null,
                        content: taskContents.body.length !== 0 ? taskContents.body : [],
                        due_date: taskContents.dueDate !== "" ? taskContents.dueDate : null,
                        github_url:
                            taskContents.githubLink.url !== ""
                                ? taskContents.githubLink.url
                                : null,
                        github_url_title:
                            taskContents.githubLink.title !== ""
                                ? taskContents.githubLink.title
                                : null,
                        general_url:
                            taskContents.generalLink.url !== ""
                                ? taskContents.generalLink.url
                                : null,
                        general_url_title:
                            taskContents.generalLink.title !== ""
                                ? taskContents.generalLink.title
                                : null,
                        tags: taskContents.tags,
                        chat_type: isDm === null || isDm === undefined ? null : isDm ? 1 : 2,
                        chat_id: chatId || null,
                        thread_id: threadId || null,
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
                        formData.append("attached_file", attachment.file);
                        formData.append("attached_type", attachment.file.type);

                        const uploadAttachmentResponse = await fetch(
                            `${base_url}/task/attachment/`,
                            {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${accessToken}`,
                                },
                                body: formData,
                            }
                        );

                        const uploadAttachmentData = await uploadAttachmentResponse.json();

                        if (!uploadAttachmentResponse.ok) {
                            throw new Error(
                                uploadAttachmentData.message || "Attachment Upload Failed"
                            );
                        }
                    }

                    // Send "task created" message
                    if (socket) {
                        // 1. join "pm" chat group
                        socket.emit(
                            "join",
                            {
                                joiningCGId: taskContents.project.projectId,
                                joiningCGName: taskContents.project.projectName,
                                isDm: false,
                                chatType: 3,
                                dmPartnerUserId: null,
                            },
                            (ack: any) => {
                                const createTaskMessage = taskMessageTemplate(taskContents);
                                if (taskContents.project !== null && createTaskMessage) {
                                    socket.emit("message", {
                                        methodType: "POST",
                                        message: createTaskMessage,
                                        destCGName: taskContents.project.projectName,
                                        destCGId: taskContents.project.projectId,
                                        isDm: false,
                                        chatType: 3,
                                        dmPartnerUserId: null,
                                        taskId: taskCreateData.task_id,
                                        taskStatus: taskCreateData.status,
                                        systemUserId: taskContents.project.systemUserId,
                                        messageIdForPut: null,
                                    });
                                } else {
                                    console.error(
                                        "Failed to send 'task created message' due to taskContents.project is NULL."
                                    );
                                }
                            }
                        );
                    } else {
                        console.error("socket not found");
                    }

                    setIsSubmitted(true);
                }
            } else {
                console.error("taskContents.project is null:", taskContents.project);
            }
        } catch (error) {
            console.error(error);
            return [];
        }
    }
};
