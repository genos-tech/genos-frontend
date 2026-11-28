import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { getMessages } from "../../../i18n";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { ASSIGNEE_NOT_ON_DESTINATION } from "../utils/moveRefusal";
import { toServerTimestamp } from "../utils/serverTimestamp";
import { taskMessageTemplate } from "../utils/TaskMessageTemplate";
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

/** The "task created" reply in the origin thread is a live-sync extra: `channelService.send` only
 *  settles on the realtime socket's ack, and while the socket is down it
 *  stays queued (flushed on reconnect) and never resolves. The task is
 *  already saved by the PUT, so finishing the create must not wait on it.
 *  Failures are logged, never thrown. */
const postCardWithoutWaiting = (sent: Promise<unknown>, errorLabel: string): void => {
    sent.catch((e) => {
        console.error(errorLabel, e);
    });
};

/** Did the task actually land? The caller tears the create form down (and
 *  wipes the draft) on success, so this MUST NOT be optimistic — every
 *  failure path returns `ok: false` and leaves the reason on screen in the
 *  form's error snackbar via `setTitleError` / `setTitleErrorOpen`. */
export type UploadNewTaskResult = { ok: true; taskId: number } | { ok: false };

/**
 * Finalize the create form's scaffold row into a real task: PUT the user's
 * content over it, upload the staged attachments, then reply with the task's
 * summary in the DM or group thread it was made from. The project chat's card
 * is posted by the api.
 *
 * **Failure keeps the form open.** The reason goes to the error snackbar
 * and `ok: false` tells `TaskCreateFooter` to leave the draft alone, so a
 * retry is just the Create button again — the PUT targets the same
 * `task_id`, so it rewrites that one row rather than creating a second.
 *
 * Retrying PAST a successful PUT (i.e. an attachment failed) does re-run
 * the attachment uploads, so an already-uploaded file can duplicate. That's the accepted
 * cost of not silently discarding the user's staged files; the alternative
 * — closing the form on a partial failure — loses them outright.
 */
export const uploadNewTask = async (props: uploadTaskProps): Promise<UploadNewTaskResult> => {
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

    // Every "this didn't work" exit goes through here: show the reason in
    // the create form's snackbar (rendered by `TaskTitleBlock`) AND tell
    // the caller not to tear the form down.
    const fail = (message: string): UploadNewTaskResult => {
        setTitleError(message);
        setTitleErrorOpen(true);
        return { ok: false };
    };

    if (taskContent.title === "") {
        return fail(errMsgs.taskTitleRequired);
    } else if (taskContent.project === null) {
        return fail(errMsgs.targetProjectRequired);
    } else if (taskContent.id === undefined) {
        return fail(errMsgs.targetTaskIdRequired);
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
                    // `assignee` is now nullable — a fresh task starts
                    // unassigned. Django's TaskMaster.assignee FK is
                    // already `null=True`, so passing null is valid.
                    assignee: taskContent.assignee?.userId ?? null,
                    reporter: taskContent.reporter?.userId ?? null,
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
                    // Chat linkage comes from taskContent ONLY — seeded
                    // from the create intent's `fromThread` context
                    // captured at click time. Reading useCM here (the
                    // old behavior) sniffed whatever chat/thread state
                    // was left over at SUBMIT time: chat_id from the
                    // current main chat but thread_id from the last
                    // open thread — which survives the thread pane
                    // closing — so tasks created from the tasks page or
                    // the PM header inherited an unrelated thread's ids.
                    chat_type: taskContent.chatType,
                    chat_id: taskContent.chatId != null ? String(taskContent.chatId) : null,
                    thread_id: taskContent.threadId != null ? String(taskContent.threadId) : null,
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
                    // Custom-field values picked in the create form.
                    // Key included only when the form actually holds a
                    // map (see sendUpdatedSpecificTask for the
                    // undefined-means-omit contract).
                    ...(taskContent.customFieldValues != null
                        ? { custom_field_values: taskContent.customFieldValues }
                        : {}),
                    // Collaborators picked in the create form (user-id
                    // array). Same omit-when-undefined contract as the
                    // custom-field map above.
                    ...(taskContent.collaborators != null
                        ? { collaborators: taskContent.collaborators.map((c) => c.userId) }
                        : {}),
                }),
            });

            const taskCreateData = await taskCreateResponse.json();

            if (!taskCreateResponse.ok) {
                // Nothing was created and no side effect below has run, so
                // the form's scaffold row is still a clean retry target.
                // The body is logged (not shown) because a DRF validation
                // error is developer-ese; the user gets the localized line.
                console.error(
                    "[uploadNewTask] task PUT failed:",
                    taskCreateResponse.status,
                    taskCreateData
                );
                // Server-side one-task-per-thread guard: this thread got a
                // task since the menu was rendered (another member, another
                // session). Tell the user why instead of the generic line.
                // A project switch in the create form is a move of the scaffold
                // row: if its assignee is not on the destination the server
                // changed nothing and names why. The form stays open, so the
                // person can pick another project or assignee.
                if (
                    taskCreateData?.code === ASSIGNEE_NOT_ON_DESTINATION &&
                    typeof taskCreateData?.error === "string" &&
                    taskCreateData.error
                ) {
                    return fail(taskCreateData.error);
                }
                return fail(
                    taskCreateData?.code === "thread_already_has_task"
                        ? errMsgs.threadAlreadyHasTask
                        : errMsgs.createTaskFailed
                );
            } else {
                const newly_mentioned_user_ids: string[] =
                    taskCreateData.newly_mentioned_user_ids ?? [];
                const all_mentioned_user_ids: string[] =
                    taskCreateData.all_mentioned_user_ids ?? newly_mentioned_user_ids;
                const removed_user_ids: string[] = taskCreateData.removed_user_ids ?? [];
                if (
                    socket &&
                    (newly_mentioned_user_ids.length > 0 || removed_user_ids.length > 0)
                ) {
                    socket.emit("task_body_mention", {
                        task_id: taskContent.id,
                        task_title: taskContent.title,
                        project_id: taskContent.project.projectId,
                        project_name: taskContent.project.projectName,
                        // Surfaced on the task PUT response so the live
                        // mention activity broadcast can render
                        // "<code>-<n>" without waiting for a refetch.
                        display_id: taskCreateData.task.displayId,
                        // The response is a DRF model serialisation, so the
                        // time is `ts_updated_at` (there is no `updatedAt`).
                        // The sockets service reads this key as required.
                        ts_mentioned_at: taskCreateData.task.ts_updated_at,
                        // Per-user real-time toast goes to `newly_*`; the
                        // activity row stores `all_*` so prior recipients
                        // keep their feed entry across edits. Handler
                        // DELETEs the row when `all_*` is empty.
                        newly_mentioned_user_ids,
                        all_mentioned_user_ids,
                        removed_user_ids,
                    });
                }

                // Mark the ORIGIN thread as having a task — but only when
                // the currently-open thread IS that thread. currentThreadChat
                // can point at a different (or long-closed) thread by submit
                // time; stamping it unconditionally mislabeled that thread
                // as task-linked and hid its "Create task" action.
                if (
                    useCM.currentThreadChat &&
                    taskContent.threadId != null &&
                    String(useCM.currentThreadChat.threadId) === String(taskContent.threadId)
                ) {
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
                        // The task row itself is already saved by this point,
                        // so this is a partial failure — but the staged files
                        // only exist in this form, and closing it would drop
                        // them with no way back. Keep the form up with the
                        // reason; see the retry caveat in the docstring above.
                        console.error(
                            "[uploadNewTask] attachment upload failed:",
                            uploadAttachmentResponse.status,
                            uploadAttachmentData
                        );
                        return fail(
                            uploadAttachmentData.message || errMsgs.attachmentUploadFailed
                        );
                    }
                }

                setCurrentPreviewTaskId(taskCreateData.task.task_id);

                addTask({
                    id: String(taskCreateData.task.task_id),
                    // Persist the backend-computed displayId into the
                    // IDB table-row cache. Without this the next render
                    // of `DraggableTaskRow` falls back to "#<id>" because
                    // `formatTaskDisplayId` has no displayId to use.
                    displayId: taskCreateData.task.displayId ?? null,
                    title: taskContent.title,
                    priority: taskContent.priority.priority,
                    effortLevel: taskContent.effortLevel.level,
                    createdDate: taskContent.createdDate || null,
                    // `ts_updated_at`, not `updatedAt` (MIP-948): the create
                    // response is a DRF serialisation and has no `updatedAt`,
                    // so this was always null. Written in the form a project
                    // sync writes, see `toServerTimestamp`.
                    updatedAt: toServerTimestamp(taskCreateData.task.ts_updated_at),
                    dueDate: taskContent.dueDate,
                    daysLeft: taskContent.daysLeft || null,
                    status: taskContent.status.status,
                    assigneeId: taskContent.assignee?.userId ?? null,
                    assigneeEmail: taskContent.assignee?.userEmail ?? null,
                    assigneeName: taskContent.assignee?.userName ?? null,
                    assigneeImgPath: taskContent.assignee?.avatarImgPath ?? null,
                    // Null stays null, see `sendUpdatedSpecificTask` (MIP-943).
                    parentTaskId:
                        taskContent.parentTaskId != null ? String(taskContent.parentTaskId) : null,
                    threadId: taskContent.threadId,
                    tags: taskContent.tags,
                    concatTags: taskContent.concatTags || null,
                    teamId: myself.teamId,
                    projectId: taskContent.project.projectId,
                    isMilestone: taskContent.isMilestone ?? false,
                    milestoneId: taskContent.milestoneId ?? null,
                    sprintId: taskContent.sprintId ?? null,
                });

                // The project chat's card is the api's (it posts one for every
                // create, MIP-2483): the app sends only the reply into the thread
                // the task was made from.
                const createTaskMessage = taskMessageTemplate(myself, taskContent);

                // When the task was created FROM a DM/GM/MDM thread, post
                // the task summary as a reply in THAT thread so the
                // conversation has a trail back to the task. The target
                // comes from taskContent's captured linkage — this card is
                // also what marks the thread as task-linked for everyone
                // else (the thread-side `taskExist` scan reads its
                // metadata), so it must land in the origin thread even if
                // the user closed the pane or switched chats before
                // submitting (the old ambient-state gate skipped or
                // misrouted it in those cases).
                if (
                    taskContent.chatId != null &&
                    taskContent.threadId != null &&
                    (taskContent.chatType === 1 ||
                        taskContent.chatType === 2 ||
                        taskContent.chatType === 4) &&
                    taskContent.project &&
                    createTaskMessage
                ) {
                    postCardWithoutWaiting(
                        channelService.send(String(taskContent.chatId), createTaskMessage, {
                            bodyText: taskContent.title,
                            parentId: String(taskContent.threadId),
                            metadata: {
                                taskId: taskCreateData.task.task_id,
                                displayId: taskCreateData.task.displayId,
                                taskStatus: taskCreateData.task.status,
                                systemUserId: taskContent.project.systemUserId,
                            },
                        }),
                        "uploadNewTask: failed to post task summary into open thread"
                    );
                }
                void socket;
                return { ok: true, taskId: taskCreateData.task.task_id };
            }
        } catch (error) {
            // Unexpected throws only — a network TypeError, a non-JSON error
            // page. Their messages aren't presentable (or localized), so the
            // user gets the generic line and the console gets the detail.
            console.error("[uploadNewTask] unexpected failure:", error);
            return fail(errMsgs.createTaskFailed);
        }
    }
};
