import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { getMessages } from "../../../i18n";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { ChannelKind } from "../../../types/channel";
import { TaskProps } from "../../../types/tasks";
import {
    taskCreatedThreadMessageTemplate,
    taskMessageTemplate,
} from "../utils/TaskMessageTemplate";
import { addTask } from "./addTask";
import { findPmChannelForProject } from "./findPmChannel";

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
                    // `assignee` is now nullable — a fresh task starts
                    // unassigned. Django's TaskMaster.assignee FK is
                    // already `null=True`, so passing null is valid.
                    assignee: taskContent.assignee?.userId ?? null,
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
                        ts_mentioned_at: taskCreateData.task.updatedAt,
                        // Per-user real-time toast goes to `newly_*`; the
                        // activity row stores `all_*` so prior recipients
                        // keep their feed entry across edits. Handler
                        // DELETEs the row when `all_*` is empty.
                        newly_mentioned_user_ids,
                        all_mentioned_user_ids,
                        removed_user_ids,
                    });
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
                    // Persist the backend-computed displayId into the
                    // IDB table-row cache. Without this the next render
                    // of `DraggableTaskRow` falls back to "#<id>" because
                    // `formatTaskDisplayId` has no displayId to use.
                    displayId: taskCreateData.task.displayId ?? null,
                    title: taskContent.title,
                    priority: taskContent.priority.priority,
                    effortLevel: taskContent.effortLevel.level,
                    createdDate: taskContent.createdDate || null,
                    updatedAt: taskCreateData.task.updatedAt || null,
                    dueDate: taskContent.dueDate,
                    daysLeft: taskContent.daysLeft || null,
                    status: taskContent.status.status,
                    assigneeId: taskContent.assignee?.userId ?? null,
                    assigneeEmail: taskContent.assignee?.userEmail ?? null,
                    assigneeName: taskContent.assignee?.userName ?? null,
                    assigneeImgPath: taskContent.assignee?.avatarImgPath ?? null,
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

                // Post "task created" messages via v3 channelService.
                // The legacy `socket.emit("join" / "message" / "thread_message")`
                // path went to the deleted `/` namespace handlers; the v3
                // replacement is `channelService.send(channelUuid, body,
                // { bodyText, parentId, metadata })`. PM channel UUID is
                // looked up by scanning the channelService snapshot for
                // `kind=PM` + matching `projectId`.
                const createTaskMessage = taskMessageTemplate(myself, taskContent);
                if (taskContent.project && createTaskMessage) {
                    const projectId = taskContent.project.projectId;
                    let pmChannel = findPmChannelForProject(
                        channelService.getSnapshot().channels.values(),
                        projectId
                    );
                    // PM channels for the snapshot are seeded once on app boot
                    // (useChatManagement → loadV3Chats) and from IDB, so the
                    // snapshot can be stale — the project's PM channel may have
                    // been created/joined after that load, or the boot fetch
                    // raced/failed. Re-fetch the channel list once, register the
                    // PM row we need, and retry before giving up. Capture the
                    // API's PM rows so a surviving failure is self-diagnosing.
                    let pmChannelsFromApi: Array<{ id: string; projectId: number | null }> | null =
                        null;
                    if (!pmChannel) {
                        try {
                            const fresh = await channelService.listChannels();
                            pmChannelsFromApi = fresh
                                .filter((ch) => ch.kind === ChannelKind.PM)
                                .map((ch) => ({ id: ch.id, projectId: ch.projectId }));
                            const freshPm = findPmChannelForProject(fresh, projectId);
                            if (freshPm) {
                                channelService.handleChannelCreated(freshPm);
                                pmChannel = freshPm;
                            }
                        } catch (e) {
                            console.error(
                                "uploadNewTask: failed to refresh channels for PM lookup",
                                e
                            );
                        }
                    }

                    if (!pmChannel) {
                        // Still nothing after a fresh fetch → the user genuinely
                        // has no PM channel for this project in their channel
                        // list (not a member, or the row carries a null
                        // projectId). The dump distinguishes that from a
                        // transient miss.
                        console.error(
                            "uploadNewTask: PM channel not found in channelService snapshot",
                            {
                                projectId,
                                projectIdType: typeof projectId,
                                pmChannelsFromApi,
                            }
                        );
                    } else {
                        const taskMetadata = {
                            taskId: taskCreateData.task.task_id,
                            displayId: taskCreateData.task.displayId,
                            taskStatus: taskCreateData.task.status,
                            systemUserId: taskContent.project.systemUserId,
                        };
                        // Top-level "task created" message in the PM channel.
                        try {
                            const sent = await channelService.send(
                                pmChannel.id,
                                createTaskMessage,
                                {
                                    bodyText: taskContent.title,
                                    metadata: taskMetadata,
                                }
                            );
                            // First thread reply on the task message —
                            // legacy posted a follow-up that lives in the
                            // task's thread pane. `parentId = sent.id`
                            // turns it into a thread reply.
                            const threadFollowup = taskCreatedThreadMessageTemplate(myself);
                            if (threadFollowup && sent?.id) {
                                await channelService.send(pmChannel.id, threadFollowup, {
                                    bodyText: taskContent.title,
                                    parentId: sent.id,
                                    metadata: taskMetadata,
                                });
                            }
                        } catch (e) {
                            console.error("uploadNewTask: failed to post PM task message", e);
                        }
                    }
                }

                // When the user creates a task FROM an open thread in a
                // DM/GM/MDM, also post the task summary as a reply in
                // that thread so the conversation has a trail back to
                // the task. `currentMainChat.chatId` / `currentThreadChat.
                // threadId` already carry v3 UUIDs post-migration.
                if (
                    useCM.isThreadVisible === true &&
                    useCM.currentMainChat &&
                    useCM.currentThreadChat &&
                    (useCM.currentMainChat.chatType === 1 ||
                        useCM.currentMainChat.chatType === 2 ||
                        useCM.currentMainChat.chatType === 4) &&
                    useCM.currentThreadChat.threadId !== null &&
                    useCM.currentThreadChat.threadId !== 0 &&
                    taskContent.project &&
                    createTaskMessage
                ) {
                    try {
                        await channelService.send(
                            String(useCM.currentMainChat.chatId),
                            createTaskMessage,
                            {
                                bodyText: taskContent.title,
                                parentId: String(useCM.currentThreadChat.threadId),
                                metadata: {
                                    taskId: taskCreateData.task.task_id,
                                    displayId: taskCreateData.task.displayId,
                                    taskStatus: taskCreateData.task.status,
                                    systemUserId: taskContent.project.systemUserId,
                                },
                            }
                        );
                    } catch (e) {
                        console.error(
                            "uploadNewTask: failed to post task summary into open thread",
                            e
                        );
                    }
                }
                void socket;
            }
        } catch (error) {
            console.error(error);
            return [];
        }
    }
};
