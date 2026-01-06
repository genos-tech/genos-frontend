import { useEffect, useState } from "react";

import { UserProps } from "../../../../types/admin";
import { TaskProps } from "../../../../types/tasks";
import { loadSpecificTask } from "../../../tasks/services/loadSpecificTask";

interface UseTaskPreviewProps {
    currentTaskNote: { projectId: number; taskId: number } | null;
    myself: UserProps;
    accessToken: string;
    setCurrentPreviewTask: (task: TaskProps) => void;
}

export const useTaskPreview = ({
    currentTaskNote,
    myself,
    accessToken,
    setCurrentPreviewTask,
}: UseTaskPreviewProps) => {
    const [currentTask, setCurrentTask] = useState<TaskProps | undefined>();

    const setPreviewTask = async (projectId: number, taskId: number) => {
        try {
            const loadedTask: TaskProps[] = await loadSpecificTask(
                myself,
                projectId,
                taskId,
                accessToken
            );
            if (loadedTask.length === 1) {
                setCurrentPreviewTask(loadedTask[0]);
                setCurrentTask(loadedTask[0]);
            }
        } catch (error) {
            console.error("Failed to load task:", error);
        }
    };

    useEffect(() => {
        if (currentTaskNote) {
            setPreviewTask(currentTaskNote.projectId, currentTaskNote.taskId);
        }
    }, [currentTaskNote]);

    return {
        currentTask,
        setPreviewTask,
    };
};
