import { useCallback } from "react";
import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { sendUpdatedSpecificTask } from "../../features/tasks/services/sendUpdatedSpecificTask";
import { emitTaskTouched } from "../../features/tasks/services/taskEvents";
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

            const uploadAttachments = await sendUpdatedSpecificTask(
                socket,
                myself,
                baseTaskContent,
                syncCard,
                accessToken
            );

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
            taskEditState,
        ]
    );

    return sendUpdatedTask;
};
