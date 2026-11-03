import axios from "axios";
import { Socket } from "socket.io-client";

import { cacheFullTask, invalidateCachedFullTask } from "../../../db/services/task-full.service";
import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";
import { channelService } from "../../../services/channel/channelService";
import { emitRequestError } from "../../../services/requestErrorNotifier";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { toServerTimestamp } from "../utils/serverTimestamp";
import { taskMessageTemplate } from "../utils/TaskMessageTemplate";
import { addTask } from "./addTask";
import { emitTaskMetadataSaved, emitTasksBulkChanged } from "./taskEvents";
import { TaskSaveRefusedError } from "./taskSaveRefusedError";
import { uploadTaskAttachments } from "./uploadTaskAttachments";

// PUT the task. The server's HTTP 400 is a REFUSAL: it read the request and
// declined it, so nothing was stored and any copy of the task that already
// shows the new value is wrong. That is the one outcome the callers cannot
// ignore, so it leaves here as a `TaskSaveRefusedError` after the reason has
// been shown. Scoped to this one call on purpose: a 400 from anything later
// in the save (the attachment upload, the PM card sync) says nothing about
// whether the task was stored.
//
// What the person reads, in order of preference:
//   1. the translated sub-task message, for that one `code` (kept from
//      before: it explains the rule better than the raw sentence);
//   2. the server's own `error` sentence, shown as-is (English, whatever the
//      UI language: it names the exact field and id, which is what makes it
//      useful);
//   3. nothing extra, when the body has no single sentence (the serializer's
//      field -> [messages] map). The response interceptor has already raised
//      the generic "couldn't complete" toast for every 400, so they are not
//      left without a signal, and the caller still puts its state back.
// A reason is emitted AFTER that generic toast, and the snackbar keeps only
// the newest, so the reason is what stays on screen.
const putTask = async (
    api: NonNullable<ReturnType<typeof authApi>>,
    body: Record<string, unknown>,
    setErrorMessage?: (value: string) => void
) => {
    try {
        return await api.put("/task/", body);
    } catch (error: unknown) {
        if (!axios.isAxiosError(error) || error.response?.status !== 400) throw error;
        console.error("HTTP 400 error:", error.response?.data);
        const data = error.response?.data as { error?: unknown; code?: unknown } | undefined;
        const code = typeof data?.code === "string" ? data.code : null;
        const serverText = typeof data?.error === "string" && data.error ? data.error : null;
        const reason =
            code === "subtask_project_move_forbidden"
                ? getMessages().tasks.errors.subTaskProjectMoveForbidden
                : serverText;
        if (reason) emitRequestError("serverMessage", reason);
        // A 400 with nothing to say keeps the callback's old fallback text.
        setErrorMessage?.(reason ?? getMessages().tasks.errors.messageIdExists);
        throw new TaskSaveRefusedError(reason, code);
    }
};

export const sendUpdatedSpecificTask = async (
    socket: Socket | null,
    myself: UserProps,
    updatedTask: TaskProps,
    // Sync the PM task-card header (rebuild its body + broadcast) ONLY on a
    // metadata save — status / title / assignee / priority / effort / due —
    // NOT on body autosaves or switch-persist saves, whose card fields are
    // unchanged so the rewrite would be identical churn. The CALLER knows
    // which path it is. This deliberately replaces the old
    // `taskBodyEdited === false` proxy: `taskBodyEdited` is unreliable — the
    // collaborative editor's Yjs initial-sync `onChange` spuriously flips it
    // true after every task load, which skipped the card sync on the FIRST
    // metadata edit after opening a task (the "PM card stays stale" bug).
    syncCard: boolean,
    accessToken: string | null,
    setErrorMessage?: (value: string) => void,
    options?: {
        // False when this save does not edit the start date (a table / board
        // inline edit), so the PUT must not mention it at all. Defaults to
        // true: a save from the open task sends whatever the working copy
        // holds (see `start_date` below).
        sendStartDate?: boolean;
    }
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
            const taskBody = {
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
                // Three states, and the server treats them differently:
                //   - a date string  -> set it;
                //   - `null`         -> the user CLEARED it, and the PUT
                //                       clears the stored date (MIP-912);
                //   - `undefined`    -> this object does not carry the
                //                       field (a pre-field IndexedDB entry,
                //                       a partial task): OMIT the key so
                //                       the stored date is left alone.
                // This used to be `startDate ?? null`, which sent null for
                // both of the last two. That was harmless only while the
                // backend dropped every null; now that a null clears the
                // date, collapsing "cleared" and "not loaded" would wipe a
                // real date on any save from an object that never had it.
                ...(options?.sendStartDate !== false && updatedTask.startDate !== undefined
                    ? { start_date: updatedTask.startDate }
                    : {}),
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
                // Include the custom-field value map ONLY when the
                // working copy actually carries one. `undefined` means
                // "never loaded" (a pre-deploy IDB cache entry, a
                // caller that built a partial TaskProps) — sending {}
                // in that state would CLEAR the server-side values.
                // The backend treats an absent key as "no change" and
                // a dict as a wholesale replace (mirroring tags).
                ...(updatedTask.customFieldValues != null
                    ? { custom_field_values: updatedTask.customFieldValues }
                    : {}),
                // Collaborators (user-id array). Same omit-when-undefined
                // guard as custom fields: `undefined` means a partial
                // TaskProps that never loaded the field, so we OMIT the
                // key (absent = no change) rather than send `[]` (which
                // the backend reads as an explicit clear).
                ...(updatedTask.collaborators != null
                    ? { collaborators: updatedTask.collaborators.map((c) => c.userId) }
                    : {}),
            };
            const res = await putTask(api, taskBody, setErrorMessage);

            // The save's own updated time, in the form the caches use. The
            // working copy's `updatedAt` is from BEFORE the save, so it is
            // only the fallback for an answer that carries no readable time.
            const savedAt = toServerTimestamp(res?.data?.task?.ts_updated_at);

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
                    // The time the server stamped on THIS save (MIP-948);
                    // `updatedTask.updatedAt` is from when the task was
                    // opened. Both caches below carry the same one.
                    ...(savedAt ? { updatedAt: savedAt } : {}),
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

            // Notify the PM channel only on a metadata save (`syncCard`).
            // Attachments and the IDB row mirror live OUTSIDE this guard —
            // they must always run, including for body-edit saves and saves
            // where the editor's Yjs initial-sync onChange spuriously marked
            // the body dirty even though the user only dropped a file.
            // Scoping the upload to this guard caused the "file disappears
            // with no POST in backend" bug: the PUT succeeded but
            // `uploadTaskAttachments` was skipped, then `useSendUpdatedTask`'s
            // post-save merge stripped the now-orphaned negative-id rows.
            if (res && syncCard) {
                emitTaskMetadataSaved();
                const updatedTaskMessage = taskMessageTemplate(myself, updatedTask);
                // Rewrite the PM task-card header so the status / title /
                // priority / assignee change fans out to every viewer of the
                // PM channel (and this editor's own pane) in real time. The
                // server rewrites the stored card body and broadcasts
                // `message.updated`; the returned row is also applied locally
                // by `updateTaskCard` for an instant self-update.
                //
                // Replaces the pre-v3 `socket.emit("message", {methodType:
                // "PUT"})`, whose Flask handler was removed in the v3
                // migration — leaving the card frozen at creation time.
                // Fire-and-forget: a failure here must not block the save
                // (the task PUT already persisted; the next PM-channel delta
                // sync reconciles the card).
                if (updatedTask.id != null) {
                    void channelService
                        .updateTaskCard(updatedTask.id, updatedTaskMessage, updatedTask.title, {
                            taskId: updatedTask.id,
                            displayId: updatedTask.displayId,
                            taskStatus: updatedTask.status.status,
                            systemUserId: updatedTask.project.systemUserId,
                        })
                        .catch((e) => {
                            console.error(
                                "[sendUpdatedSpecificTask] PM task-card sync failed:",
                                e
                            );
                        });
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
                    updatedAt: savedAt ?? (updatedTask.updatedAt || null),
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
                    // Null stays null: `String(null)` is the text "null", and
                    // the table finds root rows with `parentTaskId == null`, so
                    // that row showed nowhere until a sync replaced it. A sync
                    // that ran while this PUT was in flight has already moved
                    // the checkpoint past the save, so none ever would
                    // (MIP-943).
                    parentTaskId:
                        updatedTask.parentTaskId != null ? String(updatedTask.parentTaskId) : null,
                    threadId: updatedTask.threadId,
                    tags: updatedTask.tags,
                    concatTags: updatedTask.concatTags || null,
                    teamId: myself.teamId,
                    projectId: updatedTask.project.projectId,
                    isMilestone: updatedTask.isMilestone ?? false,
                    milestoneId: updatedTask.milestoneId ?? null,
                    sprintId: updatedTask.sprintId ?? null,
                    // Mirror custom-field values into the IDB row so
                    // the table keeps showing a fresh edit across a
                    // cache read (same rationale as startDate above).
                    customFieldValues: updatedTask.customFieldValues,
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

                // A project move rewrote more than the row above: the task's
                // sub-tasks came along, every moved row got a fresh
                // `<CODE>-<n>`, and both projects' tables are now short or
                // long a sub-tree. Re-pull both rather than trying to mirror
                // a server-side cascade into IndexedDB from here. The
                // response is the only place the SOURCE project id survives.
                const movedFromProjectId: number | null = res.data?.movedFromProjectId ?? null;
                if (movedFromProjectId != null) {
                    emitTasksBulkChanged(movedFromProjectId);
                    emitTasksBulkChanged(updatedTask.project.projectId);
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
        // The refusal has been reported (see `putTask`); callers put their
        // own state back.
        if (error instanceof TaskSaveRefusedError) throw error;
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
