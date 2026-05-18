import axios from "axios";
import { Socket } from "socket.io-client";

import { cacheFullTask } from "../../../db/services/task-full.service";
import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { taskMessageTemplate, taskThreadMessageTemplate } from "../utils/TaskMessageTemplate";
import { addTask } from "./addTask";
import { uploadTaskAttachments } from "./uploadTaskAttachments";

export const sendUpdatedSpecificTask = async (
    socket: Socket | null,
    myself: UserProps,
    updatedTask: TaskProps,
    taskBodyEdited: boolean,
    taskStatusUpdated: boolean,
    accessToken: string | null,
    setErrorMessage?: (value: string) => void
) => {
    const errMsgs = getMessages().tasks.errors;
    try {
        if (!updatedTask.project?.projectName) {
            if (setErrorMessage) {
                setErrorMessage(errMsgs.projectIdNotSpecified);
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
                links: updatedTask.links,
                tags: updatedTask.tags,
                // Always send `milestone` (even when null) so the
                // backend can distinguish "key absent" (no change)
                // from "explicit clear". The PUT handler's milestone
                // bridge runs after `serializer.save()` and uses the
                // key's presence to decide whether to update
                // `parent_task_id` / `root_task_id` and cascade
                // `milestone_id` to descendant sub-tasks.
                //
                // `sprint` keeps its conditional spread because the
                // backend's None-strip still owns sprint clearing
                // semantics (no bridge needed there).
                milestone: updatedTask.milestoneId ?? null,
                ...(updatedTask.sprintId != null ? { sprint: updatedTask.sprintId } : {}),
            });

            if (res) {
                // Mirror the freshly-PUT task into the full-task IDB
                // cache so the next `loadSpecificTask` reflects the
                // edit without a network refetch. Covers both
                // metadata-only and body-edit paths.
                await cacheFullTask(updatedTask);
            }

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
                            sendActivity: false, // Do not send activity for task status update.
                        });
                    }
                }

                if (updatedTask) {
                    // When the user clears the due date (TBD), the
                    // local `daysLeft` is whatever the previous due
                    // date computed to (e.g. -1 for a row that was
                    // already expired). Persisting that into IDB makes
                    // the table flash "Expired" on next render until a
                    // fresh fetch overwrites it. Treat empty/null due
                    // date as "no days-left" so the cached row matches
                    // what the backend will later return.
                    const hasDueDate = !!updatedTask.dueDate;
                    addTask({
                        id: String(updatedTask.id),
                        title: updatedTask.title,
                        priority: updatedTask.priority.priority,
                        effortLevel: updatedTask.effortLevel.level,
                        createdDate: updatedTask.createdDate || null,
                        updatedAt: updatedTask.updatedAt || null,
                        dueDate: updatedTask.dueDate,
                        daysLeft: hasDueDate ? updatedTask.daysLeft || null : null,
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
                        isMilestone: updatedTask.isMilestone ?? false,
                        milestoneId: updatedTask.milestoneId ?? null,
                        sprintId: updatedTask.sprintId ?? null,
                    });
                }

                // `TaskProps.id` is typed as optional, but by this point
                // we've already issued a `PUT /task/` against it and
                // mirrored the row into IndexedDB, so a missing id here
                // would mean we sent a malformed request upstream. Bail
                // out instead of forwarding `undefined` to the upload
                // helper (whose signature requires a real task id).
                if (updatedTask.id == null) return [];

                const uploadAttachments = await uploadTaskAttachments(
                    updatedTask.id,
                    updatedTask.attachments,
                    accessToken
                );

                return uploadAttachments;
            }
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage(errMsgs.unauthorizedNoToken);
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage(errMsgs.messageIdExists);
                }
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage(errMsgs.unauthorizedPleaseLogin);
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
