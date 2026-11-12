import { useEffect } from "react";

interface UseThreadTaskHandlingProps {
    useCM: any;
    useTM: any;
}

export const useThreadTaskHandling = ({ useCM, useTM }: UseThreadTaskHandlingProps) => {
    // Handle thread chat task preview
    useEffect(() => {
        // If the thread chat is visible and has a task, make that task the preview's
        // selection. This happens when someone created a task in the thread chat.
        //
        // It only SELECTS; it never opens the pane. On the chat page the pane opens
        // only from an explicit click (see `useSurfaceTaskPreviewVisible`), so a
        // selection made here shows only in a pane that is already open (MIP-1422).
        //
        // A real task id only: task ids are positive. A thread with no task can
        // carry 0 (the v3 activity adapter maps a missing task id to 0), and 0
        // used to pass `!== null`, so it was copied in as a task to show: a pane
        // that waited for task 0 and spun "Loading task..." for good.
        const taskId = Number(useCM.currentThreadChat?.taskId);
        if (useCM.currentThreadChat && taskId > 0 && useCM.isThreadVisible === true) {
            useTM.setCurrentPreviewTaskId(taskId);
        }
    }, [useCM.currentThreadChat]);
};
