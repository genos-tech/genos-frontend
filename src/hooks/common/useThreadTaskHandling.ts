import { useEffect } from "react";

import { useChatManagement } from "../chats/useChatManagement";
import { useTaskManagement } from "../tasks/useTaskManagement";

interface UseThreadTaskHandlingProps {
    useCM: any;
    useTM: any;
}

export const useThreadTaskHandling = ({ useCM, useTM }: UseThreadTaskHandlingProps) => {
    // Handle thread chat task preview
    useEffect(() => {
        // If the thread chat is visible and has a task id, set the current preview task id.
        // This happens when someone created a task in the thread chat.
        if (
            useCM.currentThreadChat &&
            useCM.currentThreadChat.taskId !== null &&
            useCM.isThreadVisible === true
        ) {
            useTM.setCurrentPreviewTaskId(useCM.currentThreadChat.taskId);
        }
    }, [useCM.currentThreadChat]);
};
