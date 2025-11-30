import { useState } from "react";
import { PartialBlock } from "@blocknote/core";

import { TaskEditStateManagement } from "../../types/taskEditState";
import { AttachmentFileProps, TaskProps } from "../../types/tasks";

/**
 * Custom hook to manage task edit state
 * Consolidates all task editing state into a single object for easier management
 *
 * @param currentTask - The task to initialize the state with
 * @returns Object containing all state values and setter functions
 */
export const useTaskEditState = (
    currentTask: TaskProps | null | undefined
): TaskEditStateManagement => {
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>(
        currentTask?.attachments || []
    );
    const [taskUpdated, setTaskUpdated] = useState(false);
    const [startIntervalUpdatingTask, setStartIntervalUpdatingTask] = useState(false);
    const [taskStatusUpdated, setTaskStatusUpdated] = useState(false);
    const [taskBodyEdited, setTaskBodyEdited] = useState(false);
    const [taskBodySaved, setTaskBodySaved] = useState(false);
    const [tmpCurrentTaskContent, setTmpCurrentTaskContent] = useState<TaskProps>(
        currentTask || ({} as TaskProps)
    );
    const [taskTitle, setTaskTitle] = useState<string>(currentTask?.title || "");
    const [body, setBody] = useState<PartialBlock[]>(currentTask?.body || []);
    const [currentTaskId, setCurrentTaskId] = useState<number | undefined>(currentTask?.id);
    const [initTaskTitle, setInitTaskTitle] = useState<string>(currentTask?.title || "");

    return {
        // State values
        uploadedFiles,
        taskUpdated,
        startIntervalUpdatingTask,
        taskStatusUpdated,
        taskBodyEdited,
        taskBodySaved,
        tmpCurrentTaskContent,
        taskTitle,
        body,
        currentTaskId,
        initTaskTitle,

        // Setter functions
        setUploadedFiles,
        setTaskUpdated,
        setStartIntervalUpdatingTask,
        setTaskStatusUpdated,
        setTaskBodyEdited,
        setTaskBodySaved,
        setTmpCurrentTaskContent,
        setTaskTitle,
        setBody,
        setCurrentTaskId,
        setInitTaskTitle,
    };
};
