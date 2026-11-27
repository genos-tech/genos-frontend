import { useCallback, useEffect, useRef } from "react";
import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { reloadStoredTask } from "../../features/tasks/services/reloadStoredTask";
import { sendUpdatedSpecificTask } from "../../features/tasks/services/sendUpdatedSpecificTask";
import { emitTaskTouched } from "../../features/tasks/services/taskEvents";
import { TaskSaveRefusedError } from "../../features/tasks/services/taskSaveRefusedError";
import {
    trackTaskBodySave,
    unsavedBodyRepairOf,
} from "../../features/tasks/services/unsavedTaskBody";
import { ASSIGNEE_NOT_ON_DESTINATION } from "../../features/tasks/utils/moveRefusal";
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

    /** Writes what the editor holds NOW into `bodyRef` (its sync to the host is debounced).
     *  Called before a save is built, and after it to see whether words were typed that it did
     *  not carry (MIP-2443). */
    flushBody?: () => void;

    /** Called when there is nothing more to do with a body that was sent: the server stored it,
     *  or refused it in a way that sending it again cannot change. */
    onBodySettled?: (
        taskId: number,
        body: PartialBlock[],
        save: { stored: boolean; startedAt: number }
    ) => void;

    /** Called when a save stored nothing and is worth sending again. */
    onBodyNotStored?: () => void;

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
    const flushBody = params.flushBody;
    const onBodySettled = params.onBodySettled;
    const onBodyNotStored = params.onBodyNotStored;
    const onStoredTaskRestored = params.onStoredTaskRestored;

    // The id of the task the preview shows RIGHT NOW. A refused save puts the
    // working copy back only after an awaited reload, and the person may have
    // opened another task by then; the closure's `tmpCurrentTaskContent` is
    // from when the save started, so it cannot answer that.
    const shownTaskIdRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        shownTaskIdRef.current = tmpCurrentTaskContent?.id;
    }, [tmpCurrentTaskContent?.id]);

    // Files a save is uploading right now (`<task id>:<attachment id>`). A second save made
    // meanwhile (leaving the preview, MIP-2443) must not upload them again.
    const uploadingRef = useRef(new Set<string>());

    const sendUpdatedTask = useCallback(
        // `syncCard` = "this is a metadata save; rebuild the PM task-card +
        // broadcast." Passed true only by the metadata-save effect in
        // TaskPreview; body autosaves / switch-persist / close saves leave it
        // false so the card isn't rewritten with identical content. See the
        // `syncCard` note in `sendUpdatedSpecificTask`.
        async (taskSwitched: boolean, syncCard: boolean = false) => {
            flushBody?.();
            // An unsaved-body repair of this task goes first: it carries older text (MIP-2455).
            const repair = unsavedBodyRepairOf(Number(tmpCurrentTaskContent?.id));
            if (repair) await repair;
            const startedAt = Date.now();
            const baseTaskContent: TaskProps = {
                ...tmpCurrentTaskContent,
                title: taskTitle === "" ? initTaskTitle : taskTitle,
                body: bodyRef ? bodyRef.current : body,
            };
            const uploadKey = (id: number) => `${baseTaskContent.id}:${id}`;
            if (baseTaskContent.attachments?.some((a) => a.attachment_id < 0)) {
                baseTaskContent.attachments = baseTaskContent.attachments.filter(
                    (a) => !uploadingRef.current.has(uploadKey(a.attachment_id))
                );
            }

            // Snapshot of negative-id rows being sent up — anything
            // *not* in this set is either already-saved (positive id) or
            // a brand-new file the user added during the round-trip and
            // must NOT be dropped from the merged result.
            const sentNegativeIds = new Set(
                (baseTaskContent.attachments ?? [])
                    .filter((a) => a.attachment_id < 0)
                    .map((a) => a.attachment_id)
            );

            // A project move makes the server drop the collaborators who cannot
            // open the task in the destination (MIP-1587). The working copy
            // and the preview task still list them, and the next save would
            // send them again and be refused, so take them off here. Only the
            // ones this save SENT and the server no longer holds: a
            // collaborator added while it was in flight stays. Not a refusal,
            // so nothing is marked dirty (and nothing is sent). Skipped when
            // the person has opened another task meanwhile: the cache row was
            // already written right by the service.
            const dropPrunedCollaborators = (kept: UserProps[]) => {
                if (Number(shownTaskIdRef.current) !== Number(baseTaskContent.id)) return;
                const id = (c: { userId: string }) => String(c.userId).toLowerCase();
                const keptIds = new Set(kept.map(id));
                const sentIds = new Set((baseTaskContent.collaborators ?? []).map(id));
                const stay = (c: { userId: string }) => keptIds.has(id(c)) || !sentIds.has(id(c));
                setTmpCurrentTaskContent((prev) => ({
                    ...prev,
                    collaborators: (prev.collaborators ?? []).filter(stay),
                }));
                setCurrentPreviewTask((prev) =>
                    prev
                        ? { ...prev, collaborators: (prev.collaborators ?? []).filter(stay) }
                        : prev
                );
            };

            let uploadAttachments: Awaited<ReturnType<typeof sendUpdatedSpecificTask>>;
            // Set when the PUT stored nothing: whether it is worth sending again.
            let notSaved: { retry: boolean } | null = null;
            sentNegativeIds.forEach((id) => uploadingRef.current.add(uploadKey(id)));
            const endBodySave = trackTaskBodySave(
                Number(baseTaskContent.id),
                baseTaskContent.body ?? []
            );
            try {
                uploadAttachments = await sendUpdatedSpecificTask(
                    socket,
                    myself,
                    baseTaskContent,
                    syncCard,
                    accessToken,
                    undefined,
                    {
                        onCollaboratorsPruned: dropPrunedCollaborators,
                        onNotSaved: (retry) => {
                            notSaved = { retry };
                        },
                    }
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
                //
                // One refusal is narrower: a collaborator who cannot open the
                // task (MIP-1567; the picker does not offer such people, so
                // this is a race with a member being removed). Nothing else in
                // the save was at fault, and putting the WHOLE copy back would
                // throw away the other edits sent with it. So only that person
                // comes off the collaborators and the rest is sent again. The
                // list gets shorter each round, so it cannot go on forever; a
                // refusal of anything else, or of someone not in the list,
                // takes the full path below.
                let collaboratorsPutBack = false;
                const refusedId = error.refusedCollaboratorId?.toLowerCase();
                if (!taskSwitched && refusedId) {
                    const sent = baseTaskContent.collaborators ?? [];
                    const isRefused = (c: { userId: string }) =>
                        String(c.userId).toLowerCase() === refusedId;
                    if (sent.some(isRefused)) {
                        // Functional, so a collaborator added while the save
                        // was in flight stays.
                        setTmpCurrentTaskContent((prev) => ({
                            ...prev,
                            collaborators: (prev.collaborators ?? []).filter((c) => !isRefused(c)),
                        }));
                        setCurrentPreviewTask((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      collaborators: (prev.collaborators ?? []).filter(
                                          (c) => !isRefused(c)
                                      ),
                                  }
                                : prev
                        );
                        collaboratorsPutBack = true;
                    }
                }
                // Another narrow one: a project MOVE refused because an assignee
                // in the moved set is not on the destination (MIP-1597). The
                // server changed nothing and the rest of the save was fine, so
                // only what the project pick set comes back to what is stored
                // (the project, the tags and the milestone / sprint / parent the
                // pick cleared); every other edit stays and is sent again. The
                // move is gone from that save, so it cannot be refused the same
                // way twice. Without a stored copy to put back (the reload
                // failed, or another task is open now) it takes the full path.
                let movePutBack = false;
                if (
                    !taskSwitched &&
                    !collaboratorsPutBack &&
                    error.code === ASSIGNEE_NOT_ON_DESTINATION
                ) {
                    const storedTask = await reloadStoredTask(
                        myself,
                        Number(baseTaskContent.id),
                        baseTaskContent.project?.projectId,
                        accessToken
                    );
                    // Only a copy that is NOT in the destination: a reload that
                    // handed the destination back (a stale cache row) would
                    // "put back" the move and send it again, to be refused the
                    // same way forever.
                    if (
                        storedTask &&
                        storedTask.project?.projectId != null &&
                        storedTask.project.projectId !== baseTaskContent.project?.projectId &&
                        Number(shownTaskIdRef.current) === Number(storedTask.id)
                    ) {
                        const projectBack = (prev: TaskProps): TaskProps => ({
                            ...prev,
                            project: storedTask.project,
                            tags: storedTask.tags,
                            milestoneId: storedTask.milestoneId,
                            sprintId: storedTask.sprintId,
                            parentTaskId: storedTask.parentTaskId,
                            rootTaskId: storedTask.rootTaskId,
                        });
                        setTmpCurrentTaskContent((prev) => projectBack(prev));
                        setCurrentPreviewTask((prev) => (prev ? projectBack(prev) : prev));
                        movePutBack = true;
                    }
                }
                if (!taskSwitched && !collaboratorsPutBack && !movePutBack) {
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
                // Same resets as a finished save, minus "saved". The exceptions
                // are the two put-backs above (a collaborator, a refused
                // move): their remaining edits are still unsent, so the task
                // stays dirty and goes out again. That covers the body and
                // status flags too (MIP-1586): cleared here, a close or an
                // autosave before the retry has landed would see nothing to
                // save, and a retry that then fails would leave the edits
                // looking saved. The retry's own end clears them.
                const sendAgain = collaboratorsPutBack || movePutBack;
                if (!sendAgain) {
                    onBodySettled?.(Number(baseTaskContent.id), baseTaskContent.body ?? [], {
                        stored: false,
                        startedAt,
                    });
                }
                setTaskUpdated(sendAgain);
                if (!sendAgain) {
                    setTaskStatusUpdated(false);
                    setTaskBodyEdited(false);
                }
                setStartIntervalUpdatingTask(false);
                return;
            } finally {
                endBodySave();
                sentNegativeIds.forEach((id) => uploadingRef.current.delete(uploadKey(id)));
            }

            // The PUT wrote new activity rows (field/description edits) —
            // tell the open preview to refresh its Activity feed. Scoped
            // by task id, so a save fired while switching away doesn't
            // refetch anything for the newly-opened task.
            const failed = notSaved as { retry: boolean } | null;
            if (!failed) emitTaskTouched(Number(baseTaskContent.id), "update");

            const persistedAttachments: AttachmentFileProps[] =
                uploadAttachments && uploadAttachments.length > 0
                    ? uploadAttachments
                          .filter((a) => a.attachment_id)
                          .map((a) => ({
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
            setTaskStatusUpdated(false);
            setStartIntervalUpdatingTask(false);

            // The two body flags describe the task on screen. A save that finishes after the
            // person moved on must not clear them for the next task.
            const stillShown =
                !taskSwitched && Number(shownTaskIdRef.current) === Number(baseTaskContent.id);
            if (failed) {
                // Not saved: the body stays marked as edited, so the autosave sends it again.
                if (failed.retry) onBodyNotStored?.();
                else
                    onBodySettled?.(Number(baseTaskContent.id), baseTaskContent.body ?? [], {
                        stored: false,
                        startedAt,
                    });
                if (stillShown) {
                    setTaskBodySaved(false);
                    if (!failed.retry) setTaskBodyEdited(false);
                }
                return;
            }
            // Words typed while the PUT was in flight (or still waiting in the editor's
            // debounce) are not in what was sent. Clearing "edited" for them is how a task kept
            // half a sentence (MIP-2443).
            if (stillShown) flushBody?.();
            const unsent =
                stillShown &&
                !!bodyRef &&
                JSON.stringify(bodyRef.current) !== JSON.stringify(baseTaskContent.body);
            onBodySettled?.(Number(baseTaskContent.id), baseTaskContent.body ?? [], {
                stored: true,
                startedAt,
            });
            if (stillShown) {
                setTaskBodySaved(!unsent);
                setTaskBodyEdited(unsent);
            }
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
            flushBody,
            onBodySettled,
            onBodyNotStored,
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
