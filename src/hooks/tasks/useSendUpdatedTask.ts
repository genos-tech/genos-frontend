import { useCallback, useEffect, useRef } from "react";
import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { reloadStoredTask } from "../../features/tasks/services/reloadStoredTask";
import { sendUpdatedSpecificTask } from "../../features/tasks/services/sendUpdatedSpecificTask";
import { emitTaskTouched } from "../../features/tasks/services/taskEvents";
import { TaskSaveRefusedError } from "../../features/tasks/services/taskSaveRefusedError";
import { UserProps } from "../../types/admin";
import { TaskEditStateManagement } from "../../types/taskEditState";
import { AttachmentFileProps, TaskProps } from "../../types/tasks";

/**
 * Parameters for the useSendUpdatedTask hook
 * Can be provided either as individual parameters OR using taskEditState for convenience
 */
export interface UseSendUpdatedTaskParams {
    socket: Socket | null;
    myself: UserProps;
    accessToken: string | null;
    currentPreviewTask: TaskProps | null | undefined;
    setCurrentPreviewTask: (
        value: TaskProps | undefined | ((prev: TaskProps | undefined) => TaskProps | undefined)
    ) => void;

    // Option 1: Provide individual parameters (for backward compatibility)
    tmpCurrentTaskContent?: TaskProps;
    taskTitle?: string;
    initTaskTitle?: string;
    body?: PartialBlock[];
    taskBodyEdited?: boolean;
    taskStatusUpdated?: boolean;
    uploadedFiles?: AttachmentFileProps[];
    setUploadedFiles?: (
        value: AttachmentFileProps[] | ((prev: AttachmentFileProps[]) => AttachmentFileProps[])
    ) => void;
    setTmpCurrentTaskContent?: (value: TaskProps | ((prev: TaskProps) => TaskProps)) => void;
    setCurrentTaskId?: (value: number | undefined) => void;
    setBody?: (value: PartialBlock[]) => void;
    setTaskUpdated?: (value: boolean) => void;
    setTaskBodySaved?: (value: boolean) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
    setTaskBodyEdited?: (value: boolean) => void;
    setStartIntervalUpdatingTask?: (value: boolean) => void;

    // Option 2: Provide consolidated state (recommended)
    taskEditState?: TaskEditStateManagement;

    /** Live body source, read at CALL time. When provided it wins over the
     *  render-captured `body` / `taskEditState.body`. TaskPreview routes the
     *  editor's debounced body sync into a ref instead of state (a state
     *  write re-rendered the whole preview subtree on every sync while
     *  typing), so the PUT must read the ref for the freshest content. */
    bodyRef?: { current: PartialBlock[] };

    /** Called with the task as the server holds it after a REFUSED save has
     *  put the working copy back to it, so a host that keeps a mirror of some
     *  fields outside the edit state (TaskPreview's assignee / reporter chips)
     *  can re-read them. Not called for a save fired while switching tasks. */
    onStoredTaskRestored?: (task: TaskProps) => void;
}

/**
 * Custom hook that provides a function to send updated task data to the backend
 * @param params - Object containing all necessary state and setter functions
 * @returns sendUpdatedTask - Async function that sends the updated task
 */
export const useSendUpdatedTask = (params: UseSendUpdatedTaskParams) => {
    const { socket, myself, accessToken, setCurrentPreviewTask, taskEditState } = params;

    // Support both individual parameters and consolidated taskEditState
    const tmpCurrentTaskContent =
        taskEditState?.tmpCurrentTaskContent ?? params.tmpCurrentTaskContent!;
    const taskTitle = taskEditState?.taskTitle ?? params.taskTitle!;
    const initTaskTitle = taskEditState?.initTaskTitle ?? params.initTaskTitle!;
    const body = taskEditState?.body ?? params.body!;
    const setUploadedFiles = taskEditState?.setUploadedFiles ?? params.setUploadedFiles!;
    const setTmpCurrentTaskContent =
        taskEditState?.setTmpCurrentTaskContent ?? params.setTmpCurrentTaskContent!;
    const setTaskUpdated = taskEditState?.setTaskUpdated ?? params.setTaskUpdated!;
    const setTaskBodySaved = taskEditState?.setTaskBodySaved ?? params.setTaskBodySaved!;
    const setTaskStatusUpdated =
        taskEditState?.setTaskStatusUpdated ?? params.setTaskStatusUpdated!;
    const setTaskBodyEdited = taskEditState?.setTaskBodyEdited ?? params.setTaskBodyEdited!;
    const setStartIntervalUpdatingTask =
        taskEditState?.setStartIntervalUpdatingTask ?? params.setStartIntervalUpdatingTask!;

    const bodyRef = params.bodyRef;
    const onStoredTaskRestored = params.onStoredTaskRestored;

    // The id of the task the preview shows RIGHT NOW. A refused save puts the
    // working copy back only after an awaited reload, and the person may have
    // opened another task by then; the closure's `tmpCurrentTaskContent` is
    // from when the save started, so it cannot answer that.
    const shownTaskIdRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        shownTaskIdRef.current = tmpCurrentTaskContent?.id;
    }, [tmpCurrentTaskContent?.id]);

    const sendUpdatedTask = useCallback(
        // `syncCard` = "this is a metadata save; rebuild the PM task-card +
        // broadcast." Passed true only by the metadata-save effect in
        // TaskPreview; body autosaves / switch-persist / close saves leave it
        // false so the card isn't rewritten with identical content. See the
        // `syncCard` note in `sendUpdatedSpecificTask`.
        async (taskSwitched: boolean, syncCard: boolean = false) => {
            const baseTaskContent: TaskProps = {
                ...tmpCurrentTaskContent,
                title: taskTitle === "" ? initTaskTitle : taskTitle,
                body: bodyRef ? bodyRef.current : body,
            };

            // Snapshot of negative-id rows being sent up — anything
            // *not* in this set is either already-saved (positive id) or
            // a brand-new file the user added during the round-trip and
            // must NOT be dropped from the merged result.
            const sentNegativeIds = new Set(
                (baseTaskContent.attachments ?? [])
                    .filter((a) => a.attachment_id < 0)
                    .map((a) => a.attachment_id)
            );

            let uploadAttachments: Awaited<ReturnType<typeof sendUpdatedSpecificTask>>;
            try {
                uploadAttachments = await sendUpdatedSpecificTask(
                    socket,
                    myself,
                    baseTaskContent,
                    syncCard,
                    accessToken
                );
            } catch (error) {
                if (!(error instanceof TaskSaveRefusedError)) throw error;

                // The server refused this save (the reason is already on
                // screen). Nothing was stored, so the working copy now holds
                // values that exist nowhere else: put it back to what the
                // server holds. This must NOT mark the task dirty
                // (`setTaskUpdated(true)`): the save effects would send the
                // same refused values again and loop for as long as the
                // preview is open. It must not reject either: callers fire
                // this without awaiting it (a switch save) or close the pane
                // after it (the close save).
                //
                // A save fired while SWITCHING away is the outgoing task's;
                // the incoming one is already on screen (see the note on
                // `taskSwitched` below), so the reason is all there is to do.
                if (!taskSwitched) {
                    // Files that were never uploaded (the upload runs only
                    // after the PUT succeeds) cannot stay in the list: the
                    // pending-attachment effect would re-send them as soon as
                    // the flag below falls, and a refusal about the STORED
                    // task would then repeat forever. Files dropped while
                    // this save was in flight are not in `sentNegativeIds`
                    // and stay for the next one.
                    const withoutSent = <T extends { attachment_id: number }>(rows: T[]): T[] =>
                        rows.filter((a) => !sentNegativeIds.has(a.attachment_id));
                    //
                    // The preview task too, not just the working copy: the
                    // host mirrors the working copy into it on every change,
                    // so it holds the same rows, and TaskPreview's same-task
                    // sync (no longer suppressed once the round trip has taken
                    // more than 5 s) copies the preview task BACK into the
                    // working copy, which would resurrect the file. Done here,
                    // before the awaited reload, so it also covers a reload
                    // that fails.
                    setUploadedFiles((prev) => withoutSent(prev));
                    setTmpCurrentTaskContent((prev) => ({
                        ...prev,
                        attachments: withoutSent(prev.attachments ?? []),
                    }));
                    setCurrentPreviewTask((prev) =>
                        prev ? { ...prev, attachments: withoutSent(prev.attachments ?? []) } : prev
                    );

                    const storedTask = await reloadStoredTask(
                        myself,
                        Number(baseTaskContent.id),
                        baseTaskContent.project?.projectId,
                        accessToken
                    );
                    if (storedTask && Number(shownTaskIdRef.current) === Number(storedTask.id)) {
                        // Picked values only. The body belongs to the
                        // collaborative editor (body autosaves come through
                        // here too, and a revert would eat what was typed),
                        // and the attachment list keeps its persisted rows and
                        // any newer drop. The TITLE is the person's own words,
                        // not a pick from a list, and the refusal is almost
                        // never about it, so it stays as typed (Ken's call on
                        // MIP-925). It goes into the working copy and the
                        // preview task as well as the input: TaskPreview's
                        // same-task sync copies the preview task's title back
                        // into the input once its 5 s local-edit window has
                        // passed, which would put the stored title back anyway.
                        // `baseTaskContent.title` is what was sent: the typed
                        // title, or the old one if the box was emptied.
                        const putBack = (prev: TaskProps): TaskProps => ({
                            ...storedTask,
                            title: baseTaskContent.title,
                            body: prev.body,
                            attachments: prev.attachments,
                        });
                        setTmpCurrentTaskContent((prev) => putBack(prev));
                        setCurrentPreviewTask((prev) => (prev ? putBack(prev) : prev));
                        onStoredTaskRestored?.(storedTask);
                    }
                }
                // Same resets as a finished save, minus "saved".
                setTaskUpdated(false);
                setTaskStatusUpdated(false);
                setTaskBodyEdited(false);
                setStartIntervalUpdatingTask(false);
                return;
            }

            // The PUT wrote new activity rows (field/description edits) —
            // tell the open preview to refresh its Activity feed. Scoped
            // by task id, so a save fired while switching away doesn't
            // refetch anything for the newly-opened task.
            emitTaskTouched(Number(baseTaskContent.id), "update");

            const persistedAttachments: AttachmentFileProps[] =
                uploadAttachments && uploadAttachments.length > 0
                    ? uploadAttachments
                          .filter((a: any) => a.attachment_id)
                          .map((a: any) => ({
                              attachment_id: a.attachment_id,
                              file: a.attached_file,
                              file_base64: a.file_base64,
                              name: a.name,
                              type: a.attached_type,
                          }))
                    : [];

            if (persistedAttachments.length > 0) {
                // Functional updater so any files added during the
                // upload survive: we only strip the negative ids we
                // actually persisted (`sentNegativeIds`); newer
                // negative ids stay put and ride the next save cycle.
                setUploadedFiles((prev) => [
                    ...prev.filter((a) => a.attachment_id >= 0),
                    ...persistedAttachments,
                ]);
            }

            const mergeAttachments = (prev: TaskProps): TaskProps => ({
                ...prev,
                attachments: [
                    ...(prev.attachments ?? []).filter(
                        (a) => !sentNegativeIds.has(a.attachment_id)
                    ),
                    ...persistedAttachments,
                ],
            });

            // On a SWITCH (taskSwitched=true, fired by TaskPreview's switch
            // effect to persist the OUTGOING task) we intentionally do NOT
            // touch preview / working state here. The switch effect already
            // initialized the INCOMING task's working state synchronously;
            // re-asserting it from this stale post-PUT closure — the `await`
            // above means the user may have switched again by now — was the
            // fuel for the a→b→a→b preview oscillation (and a stray PUT loop):
            // a late save would write a no-longer-selected task back into
            // currentPreviewTask / tmpCurrentTaskContent, re-arming the switch
            // + mirror effects. So on a switch we only persist (the PUT above)
            // and reset the flags below. The merge-attachments writeback runs
            // ONLY on the save-CURRENT path (the user edited the open task).
            // Pure body autosaves (no attachments persisted, title
            // unchanged) skip the writeback entirely: the merged values
            // would be identity-churn only — body/title already live in
            // local state and Yjs is the authoritative body store — but
            // `setCurrentPreviewTask` is App-ROOT state, so each autosave
            // was re-rendering the whole App mid-typing-session.
            const writebackNeeded =
                persistedAttachments.length > 0 ||
                baseTaskContent.title !== tmpCurrentTaskContent.title;
            if (!taskSwitched && writebackNeeded) {
                // Use a functional updater so files the user added during
                // the upload round-trip aren't clobbered by our stale
                // closure on `tmpCurrentTaskContent`.
                setTmpCurrentTaskContent((prev) =>
                    mergeAttachments({
                        ...prev,
                        title: baseTaskContent.title,
                        body: baseTaskContent.body,
                    })
                );
                setCurrentPreviewTask((prev) =>
                    prev
                        ? mergeAttachments({
                              ...prev,
                              title: baseTaskContent.title,
                              body: baseTaskContent.body,
                          })
                        : baseTaskContent
                );
            }
            setTaskUpdated(false);
            setTaskBodySaved(true);
            setTaskStatusUpdated(false);
            setTaskBodyEdited(false);
            setStartIntervalUpdatingTask(false);
        },
        [
            socket,
            myself,
            accessToken,
            tmpCurrentTaskContent,
            taskTitle,
            initTaskTitle,
            body,
            bodyRef,
            setUploadedFiles,
            setTmpCurrentTaskContent,
            setCurrentPreviewTask,
            setTaskUpdated,
            setTaskBodySaved,
            setTaskStatusUpdated,
            setTaskBodyEdited,
            setStartIntervalUpdatingTask,
            onStoredTaskRestored,
            taskEditState,
        ]
    );

    return sendUpdatedTask;
};
