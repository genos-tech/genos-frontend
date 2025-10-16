import { useEffect } from "react";

import { useChatManagement } from "../chats/useChatManagement";
import { useTaskManagement } from "../tasks/useTaskManagement";

interface UseThreadTaskHandlingProps {
    CM: any;
    TM: any;
}

export const useThreadTaskHandling = ({ CM, TM }: UseThreadTaskHandlingProps) => {
    // Handle thread chat task preview
    useEffect(() => {
        // If the thread chat is visible and has a task id, set the current preview task id.
        // This happens when someone created a task in the thread chat.
        if (
            CM.currentThreadChat &&
            CM.currentThreadChat.taskId !== null &&
            CM.isThreadVisible === true
        ) {
            TM.setCurrentPreviewTaskId(CM.currentThreadChat.taskId);
        }
    }, [CM.currentThreadChat]);
};
