import axios from "axios";
import { Socket } from "socket.io-client";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { taskMessageTemplate, taskThreadMessageTemplate } from "../utils/TaskMessageTemplate";
import { addTask } from "./addTask";

const base_url = import.meta.env.VITE_API_BASE_URL;

export const sendUpdatedSpecificTask = async (
    socket: Socket | null,
    myself: UserProps,
    updatedTask: TaskProps,
    taskBodyEdited: boolean,
    taskStatusUpdated: boolean,
    accessToken: string | null,
    setErrorMessage?: (value: string) => void
) => {
    try {
        if (!updatedTask.project?.projectName) {
            if (setErrorMessage) {
                setErrorMessage("Project ID is not specified.");
            }
            return [];
        }

        const api = authApi(accessToken);

        if (api) {
            const res = await api.put("/task/", {
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

            if (res && res.data.newly_mentioned_user_ids) {
                const newly_mentioned_user_ids: string[] = res.data.newly_mentioned_user_ids;
                if (socket && newly_mentioned_user_ids.length > 0) {
                    socket.emit("task_body_mention", {
                        task_id: updatedTask.id,
                        task_title: updatedTask.title,
                        project_id: updatedTask.project.projectId,
                        project_name: updatedTask.project.projectName,
                        ts_mentioned_at: res.data.task.ts_updated_at,
                        mentioned_user_ids: newly_mentioned_user_ids,
                    });
                }
            }

            // Send ws message only when task metadata is update, not task body.
            if (res && taskBodyEdited === false) {
                const updatedTaskMessage = taskMessageTemplate(myself, updatedTask);
                const updatedTaskThreadMessage = taskThreadMessageTemplate(myself, updatedTask);
                if (socket) {
                    socket.emit("message", {
                        methodType: "PUT",
                        message: updatedTaskMessage,
                        destCGName: updatedTask.project.projectName,
                        destCGId: updatedTask.project.projectId,
                        chatType: 3,
                        dmPartnerUserId: null,
                        taskId: updatedTask.id,
                        taskStatus: updatedTask.status.status,
                        systemUserId: updatedTask.project.systemUserId,
                        messageIdForPut: null,
                        isPrivate: updatedTask.project.isPrivate,
                    });

                    // Send a thread message only when the task status is updated.
                    // TODO: We can send other messages as well, but need more
                    //       considerations about what kind of content we should send.
                    if (taskStatusUpdated === true) {
                        socket.emit("thread_message", {
                            methodType: "POST",
                            isInit: false,
                            rootMessageTSSent: "",
                            rootMessageSenderId: null,
                            rootMessageReceiverId: null,
                            threadId: 0,
                            threadMessage: updatedTaskThreadMessage,
                            chatType: 3,
                            dmPartnerUserId: null,
                            senderId: updatedTask.project.systemUserId,
                            senderName: updatedTask.project.projectName,
                            destCGName: updatedTask.project.projectName,
                            destCGId: updatedTask.project.projectId,
                            taskId: updatedTask.id,
                            systemUserId: updatedTask.project.systemUserId,
                            messageIdForPut: null,
                        });
                    }
                }

                if (updatedTask) {
                    addTask({
                        id: String(updatedTask.id),
                        title: updatedTask.title,
                        priority: updatedTask.priority.priority,
                        effortLevel: updatedTask.effortLevel.level,
                        createdDate: updatedTask.createdDate || null,
                        updatedAt: updatedTask.updatedAt || null,
                        dueDate: updatedTask.dueDate,
                        daysLeft: updatedTask.daysLeft || null,
                        status: updatedTask.status.status,
                        assigneeId: updatedTask.assignee.userId,
                        assigneeEmail: updatedTask.assignee.userEmail,
                        assigneeName: updatedTask.assignee.userName,
                        assigneeImgPath: updatedTask.assignee.avatarImgPath,
                        parentTaskId: String(updatedTask.parentTaskId),
                        threadId: updatedTask.threadId,
                        tags: updatedTask.tags,
                        concatTags: updatedTask.concatTags || null,
                        teamId: myself.teamId,
                        projectId: updatedTask.project.projectId,
                    });
                }

                let uploadAttachments: any[] = [];
                for (const attachment of updatedTask.attachments) {
                    if (attachment.attachment_id < 0) {
                        const formData = new FormData();
                        formData.append("task", String(updatedTask.id));
                        formData.append("attachment_id", "-1");
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
                        } else if (uploadAttachmentData) {
                            uploadAttachments = [...uploadAttachments, uploadAttachmentData];
                        }
                    }
                }

                return uploadAttachments;
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
