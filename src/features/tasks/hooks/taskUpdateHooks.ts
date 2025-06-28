import { useEffect } from "react";
import { PartialBlock } from "@blocknote/core";

import { TaskProps, AttachmentFileProps } from "../../../types/tasks";

// update task title
type UpdateTaskTitleProps = {
    taskTitle: string;
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
};
export const updateTaskTitle = (props: UpdateTaskTitleProps) => {
    const { taskTitle, taskContents, setTaskContents } = props;
    if (taskContents) {
        useEffect(() => {
            if (taskTitle !== "") {
                setTaskContents({
                    ...taskContents,
                    title: taskTitle,
                });
            }
        }, [taskTitle]);
    }
};

// update task body
type UpdateTaskBodyProps = {
    body: PartialBlock[];
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
};
export const updateTaskBody = (props: UpdateTaskBodyProps) => {
    const { body, taskContents, setTaskContents } = props;
    if (taskContents) {
        useEffect(() => {
            if (body.length > 0) {
                setTaskContents({
                    ...taskContents,
                    body: body,
                });
            }
        }, [body]);
    }
};

// update uploaded files
type UpdateTaskAttachmentsProps = {
    uploadedFiles: AttachmentFileProps[];
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
};
export const updateTaskAttachments = (props: UpdateTaskAttachmentsProps) => {
    const { uploadedFiles, taskContents, setTaskContents } = props;
    if (taskContents) {
        useEffect(() => {
            if (uploadedFiles.length > 0) {
                setTaskContents({
                    ...taskContents,
                    attachments: uploadedFiles,
                });
            }
        }, [uploadedFiles]);
    }
};
