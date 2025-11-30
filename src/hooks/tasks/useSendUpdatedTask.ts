import { useCallback } from "react";
import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { sendUpdatedSpecificTask } from "../../features/tasks/services/sendUpdatedSpecificTask";
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
    setCurrentPreviewTask: (value: TaskProps) => void;

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
    setTmpCurrentTaskContent?: (value: TaskProps) => void;
    setCurrentTaskId?: (value: number | undefined) => void;
    setBody?: (value: PartialBlock[]) => void;
    setTaskUpdated?: (value: boolean) => void;
    setTaskBodySaved?: (value: boolean) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
    setTaskBodyEdited?: (value: boolean) => void;
    setStartIntervalUpdatingTask?: (value: boolean) => void;

    // Option 2: Provide consolidated state (recommended)
    taskEditState?: TaskEditStateManagement;
}

/**
 * Custom hook that provides a function to send updated task data to the backend
 * @param params - Object containing all necessary state and setter functions
 * @returns sendUpdatedTask - Async function that sends the updated task
 */
export const useSendUpdatedTask = (params: UseSendUpdatedTaskParams) => {
    const {
        socket,
        myself,
        accessToken,
        currentPreviewTask,
        setCurrentPreviewTask,
        taskEditState,
    } = params;

    // Support both individual parameters and consolidated taskEditState
    const tmpCurrentTaskContent =
        taskEditState?.tmpCurrentTaskContent ?? params.tmpCurrentTaskContent!;
    const taskTitle = taskEditState?.taskTitle ?? params.taskTitle!;
    const initTaskTitle = taskEditState?.initTaskTitle ?? params.initTaskTitle!;
    const body = taskEditState?.body ?? params.body!;
    const taskBodyEdited = taskEditState?.taskBodyEdited ?? params.taskBodyEdited!;
    const taskStatusUpdated = taskEditState?.taskStatusUpdated ?? params.taskStatusUpdated!;
    const uploadedFiles = taskEditState?.uploadedFiles ?? params.uploadedFiles!;
    const setUploadedFiles = taskEditState?.setUploadedFiles ?? params.setUploadedFiles!;
    const setTmpCurrentTaskContent =
        taskEditState?.setTmpCurrentTaskContent ?? params.setTmpCurrentTaskContent!;
    const setCurrentTaskId = taskEditState?.setCurrentTaskId ?? params.setCurrentTaskId!;
    const setBody = taskEditState?.setBody ?? params.setBody!;
    const setTaskUpdated = taskEditState?.setTaskUpdated ?? params.setTaskUpdated!;
    const setTaskBodySaved = taskEditState?.setTaskBodySaved ?? params.setTaskBodySaved!;
    const setTaskStatusUpdated =
        taskEditState?.setTaskStatusUpdated ?? params.setTaskStatusUpdated!;
    const setTaskBodyEdited = taskEditState?.setTaskBodyEdited ?? params.setTaskBodyEdited!;
    const setStartIntervalUpdatingTask =
        taskEditState?.setStartIntervalUpdatingTask ?? params.setStartIntervalUpdatingTask!;

    const sendUpdatedTask = useCallback(
        async (taskSwitched: boolean) => {
            const newTaskContent: TaskProps = {
                ...tmpCurrentTaskContent,
                title: taskTitle === "" ? initTaskTitle : taskTitle,
                body: body,
            };

            const uploadAttachments = await sendUpdatedSpecificTask(
                socket,
                myself,
                newTaskContent,
                taskBodyEdited,
                taskStatusUpdated,
                accessToken
            );

            if (uploadAttachments && uploadAttachments.length > 0) {
                let uploadedAttachments: AttachmentFileProps[] = [];
                uploadAttachments.map((attachment: any) => {
                    if (attachment.attachment_id) {
                        uploadedAttachments = [
                            ...uploadedAttachments,
                            {
                                attachment_id: attachment.attachment_id,
                                file: attachment.attached_file,
                                file_base64: attachment.file_base64,
                                name: attachment.name,
                                type: attachment.attached_type,
                            },
                        ];
                    }
                });
                setUploadedFiles([...uploadedFiles, ...uploadedAttachments]);
            }

            if (taskSwitched && currentPreviewTask) {
                // Initialize the following variable when user switches the previewing task
                setTmpCurrentTaskContent(currentPreviewTask);
                setCurrentPreviewTask(currentPreviewTask);
                setCurrentTaskId(currentPreviewTask.id);
                setBody(currentPreviewTask.body || []);
            } else {
                // Update only the tmpCurrentTaskContent when user updated the task content
                // (Not switched the previewing task)
                setTmpCurrentTaskContent(newTaskContent);
                setCurrentPreviewTask(newTaskContent);
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
            taskBodyEdited,
            taskStatusUpdated,
            uploadedFiles,
            currentPreviewTask,
            setUploadedFiles,
            setTmpCurrentTaskContent,
            setCurrentPreviewTask,
            setCurrentTaskId,
            setBody,
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
