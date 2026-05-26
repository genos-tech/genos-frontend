import axios from "axios";
import { Socket } from "socket.io-client";

import { cacheFullTask, invalidateCachedFullTask } from "../../../db/services/task-full.service";
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
                // Nullable per `TaskProps.assignee: UserProps | null`.
                assignee: updatedTask.assignee?.userId ?? null,
                reporter: updatedTask.reporter.userId,
                title: updatedTask.title,
                priority: updatedTask.priority !== null ? updatedTask.priority.priority : null,
                effort_level:
                    updatedTask.effortLevel !== null ? updatedTask.effortLevel.level : null,
                status: updatedTask.status.status !== null ? updatedTask.status.status : null,
                content: updatedTask.body.length !== 0 ? updatedTask.body : null,
                due_date: updatedTask.dueDate !== "" ? updatedTask.dueDate : null,
                // Always include `start_date` so a fresh value lands
                // on the row and an explicit clear (null) survives the
                // backend's None-strip via partial=True. Without this,
                // the "+ Start Date" affordance on TaskMainBlock never
                // persisted — the PUT payload omitted the field
                // entirely so the next refetch wiped the optimistic
                // local update.
                start_date: updatedTask.startDate ?? null,
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
                //
                // CRITICAL: strip negative-id (in-flight) attachments
                // before caching. They're client-side constructs with
                // `File` payloads, not server-side rows; persisting
                // them causes a vicious cycle — `loadSpecificTask`
                // returns the stale negative-id row from cache, the
                // user's next drop appends to that array, and the
                // subsequent save's `uploadTaskAttachments` loop POSTs
                // BOTH the stale row and the new file (two POSTs per
                // drop). The negative-id rows survive only in
                // `tmpCurrentTaskContent` for the duration of the
                // upload round-trip — that's correct in-memory
                // behaviour, but they must never leak into IDB.
                const cacheableTask = {
                    ...updatedTask,
                    attachments: (updatedTask.attachments ?? []).filter(
                        (a) => a.attachment_id >= 0
                    ),
                };
                await cacheFullTask(cacheableTask);
            }

            if (res) {
                const newly_mentioned_user_ids: string[] = res.data.newly_mentioned_user_ids ?? [];
                const all_mentioned_user_ids: string[] =
                    res.data.all_mentioned_user_ids ?? newly_mentioned_user_ids;
                const removed_user_ids: string[] = res.data.removed_user_ids ?? [];
                if (
                    socket &&
                    (newly_mentioned_user_ids.length > 0 || removed_user_ids.length > 0)
                ) {
                    socket.emit("task_body_mention", {
                        task_id: updatedTask.id,
                        task_title: updatedTask.title,
                        project_id: updatedTask.project.projectId,
                        project_name: updatedTask.project.projectName,
                        display_id: updatedTask.displayId,
                        ts_mentioned_at: res.data.task.ts_updated_at,
                        // `newly_*` drives the real-time per-user toast,
                        // `all_*` is written to the ActivityFact row so
                        // prior recipients keep their feed entry, and
                        // `removed_*` triggers a DELETE when the body
                        // has zero mentions left.
                        newly_mentioned_user_ids,
                        all_mentioned_user_ids,
                        removed_user_ids,
                    });
                }
            }

            // Send ws message only when task metadata is updated, not
            // task body. Attachments and the IDB row mirror live OUTSIDE
            // this guard — they must always run, including for
            // body-edit saves and saves where the BlockNote editor's
            // Yjs initial-sync onChange flipped `taskBodyEdited` to
            // true even though the user only dropped a file. Scoping
            // the upload to this guard caused the "file disappears
            // with no POST in backend" bug: when `taskBodyEdited` was
            // true the PUT succeeded but `uploadTaskAttachments` was
            // skipped, then `useSendUpdatedTask`'s post-save merge
            // stripped the now-orphaned negative-id rows.
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
                        displayId: updatedTask.displayId,
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
                            displayId: updatedTask.displayId,
                            systemUserId: updatedTask.project.systemUserId,
                            messageIdForPut: null,
                            sendActivity: false, // Do not send activity for task status update.
                        });
                    }
                }
            }

            if (res && updatedTask) {
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
                    // Preserve the human-readable displayId on the
                    // cached row so a subsequent re-render of
                    // DraggableTaskRow keeps showing "<code>-<n>"
                    // instead of falling back to "#<id>".
                    displayId: updatedTask.displayId ?? null,
                    title: updatedTask.title,
                    priority: updatedTask.priority.priority,
                    effortLevel: updatedTask.effortLevel.level,
                    createdDate: updatedTask.createdDate || null,
                    updatedAt: updatedTask.updatedAt || null,
                    dueDate: updatedTask.dueDate,
                    // Mirror start_date into the IDB row so the
                    // optimistic local update survives the next
                    // cache read (without this, the freshly-set
                    // value would disappear on re-render).
                    startDate: updatedTask.startDate ?? null,
                    daysLeft: hasDueDate ? updatedTask.daysLeft || null : null,
                    status: updatedTask.status.status,
                    assigneeId: updatedTask.assignee?.userId ?? null,
                    assigneeEmail: updatedTask.assignee?.userEmail ?? null,
                    assigneeName: updatedTask.assignee?.userName ?? null,
                    assigneeImgPath: updatedTask.assignee?.avatarImgPath ?? null,
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

            if (res) {
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

                // The cache write at line 80 happened BEFORE the upload,
                // so for in-flight rows it persisted the negative-id
                // File-bearing version. Invalidate after upload so the
                // next `loadSpecificTask` refetches the persisted shape
                // (positive ids, server paths, base64) — otherwise
                // reopening the task would render File-backed previews
                // for already-saved rows and a subsequent save would
                // try to re-upload them.
                if (uploadAttachments.length > 0) {
                    await invalidateCachedFullTask(updatedTask.id);
                }

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
