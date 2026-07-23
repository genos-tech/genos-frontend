import { PartialBlock } from "@blocknote/core";

import { AttachmentFileProps, TaskProps } from "./tasks";

/**
 * Consolidated state for task editing operations
 * This interface groups all the state variables needed for editing and updating tasks
 */
export interface TaskEditState {
    uploadedFiles: AttachmentFileProps[];
    taskUpdated: boolean;
    /**
     * Monotonic counter bumped by every `setTaskUpdated(true)` call.
     *
     * `taskUpdated` alone is an unreliable save trigger: React coalesces a
     * `setState(true)` while the value is ALREADY true, so an edit made
     * while a previous save is still in flight produces no state change,
     * no effect re-run, and is silently never sent. Effects that mean
     * "a save was requested" must key on this instead of the boolean.
     */
    taskUpdateSeq: number;
    startIntervalUpdatingTask: boolean;
    taskStatusUpdated: boolean;
    taskBodyEdited: boolean;
    taskBodySaved: boolean;
    tmpCurrentTaskContent: TaskProps;
    taskTitle: string;
    body: PartialBlock[];
    currentTaskId: number | undefined;
    initTaskTitle: string;
}

/**
 * Setter functions for TaskEditState
 */
export interface TaskEditStateSetters {
    setUploadedFiles: (
        value: AttachmentFileProps[] | ((prev: AttachmentFileProps[]) => AttachmentFileProps[])
    ) => void;
    setTaskUpdated: (value: boolean) => void;
    setStartIntervalUpdatingTask: (value: boolean) => void;
    setTaskStatusUpdated: (value: boolean) => void;
    setTaskBodyEdited: (value: boolean) => void;
    setTaskBodySaved: (value: boolean) => void;
    setTmpCurrentTaskContent: (value: TaskProps | ((prev: TaskProps) => TaskProps)) => void;
    setTaskTitle: (value: string) => void;
    setBody: (value: PartialBlock[]) => void;
    setCurrentTaskId: (value: number | undefined) => void;
    setInitTaskTitle: (value: string) => void;
}

/**
 * Combined interface with both state and setters
 */
export interface TaskEditStateManagement extends TaskEditState, TaskEditStateSetters {}
