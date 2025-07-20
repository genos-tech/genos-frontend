import { Socket } from "socket.io-client";
import axios from "axios";

import { taskMessageTemplate, taskThreadMessageTemplate } from "../utils/TaskMessageTemplate";
import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";

const base_url = import.meta.env.VITE_API_BASE_URL;

export const sendUpdatedSpecificTask = async (
    socket: Socket | null,
    myself: UserProps,
    updatedTask: TaskProps,
    accessToken: string | null,
    setErrorMessage?: (value: string) => void
) => {
    try {
        if (updatedTask.project === null) {
            if (setErrorMessage) {
                setErrorMessage("Project ID is not specified.");
            }
            return [];
        }

        const api = authApi(accessToken);

        if (api) {
            const res = await api.put("/task/updateTask/", {
                task_id: updatedTask.id,
                team: myself.teamId,
                project: updatedTask.project.projectId,
                thread_id: updatedTask.threadId,
                parent_task_id: updatedTask.parentTaskId,
                assignee: updatedTask.assignee.userId,
                reporter: updatedTask.reporter.userId,
                title: updatedTask.title,
                priority: updatedTask.priority !== null ? updatedTask.priority.priority : null,
                effort_level:
                    updatedTask.effortLevel !== null ? updatedTask.effortLevel.level : null,
                status: updatedTask.status.status !== null ? updatedTask.status.status : null,
                content: updatedTask.body.length !== 0 ? updatedTask.body : null,
                due_date: updatedTask.dueDate !== "" ? updatedTask.dueDate : null,
                github_url: updatedTask.githubLink.url !== "" ? updatedTask.githubLink.url : null,
                github_url_title:
                    updatedTask.githubLink.title !== "" ? updatedTask.githubLink.title : null,
                general_url:
                    updatedTask.generalLink.url !== "" ? updatedTask.generalLink.url : null,
                general_url_title:
                    updatedTask.generalLink.title !== "" ? updatedTask.generalLink.title : null,
                tags: updatedTask.tags,
            });

            if (res) {
                const updatedTaskMessage = taskMessageTemplate(updatedTask);
                const updatedTaskThreadMessage = taskThreadMessageTemplate(updatedTask);
                if (socket) {
                    socket.emit("message", {
                        methodType: "PUT",
                        message: updatedTaskMessage,
                        destCGName: updatedTask.project.projectName,
                        destCGId: updatedTask.project.projectId,
                        isDm: false,
                        chatType: 3,
                        dmPartnerUserId: null,
                        taskId: updatedTask.id,
                        taskStatus: updatedTask.status.status,
                        systemUserId: updatedTask.project.systemUserId,
                        messageIdForPut: null,
                    });

                    socket.emit("thread_message", {
                        methodType: "POST",
                        isInit: false,
                        rootMessageTSSent: "",
                        rootMessageSenderId: null,
                        rootMessageReceiverId: null,
                        threadId: null,
                        threadMessage: updatedTaskThreadMessage,
                        isDm: false,
                        chatType: 3,
                        dmPartnerUserId: null,
                        senderId: updatedTask.project.systemUserId,
                        senderName: updatedTask.project.projectName,
                        destCGName: updatedTask.project.projectName,
                        destCGId: updatedTask.project.projectId,
                        taskId: updatedTask.id,
                        taskStatus: updatedTask.status.status,
                        systemUserId: updatedTask.project.systemUserId,
                        messageIdForPut: null,
                    });
                }

                for (const attachment of updatedTask.attachments) {
                    const formData = new FormData();
                    formData.append("task", String(updatedTask.id));
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
                    } else {
                        return uploadAttachmentData;
                    }
                }

                return res.data;
            }
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage("Unauthorized. Auth toke is not found.");
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("Message Id already exists.");
                }
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("Unauthorized. Please log in again.");
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
