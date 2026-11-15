import { invalidateCachedFullTask } from "../../db/services/task-full.service";
import type { ToolResultTaskAttachmentRef } from "../../services/agentApi";
import { emitTaskTouched } from "../tasks/services/taskEvents";
import { forgetInFlightTask } from "../tasks/services/taskLoadInFlight";

// What an approved agent write to a task's files changes in the browser, beyond the transcript
// (MIP-1563, genos-api AGENT_PARITY_TOOLS). The tool-result handler in useAgentQA calls
// `emitTaskAttachmentToolResult` once per result.
//
//   delete_task_attachment   the server has already deleted the file. The browser keeps a full copy
//                            of every task it has opened (IndexedDB), and a file delete does not move
//                            the task's `updatedAt`, so that copy would go on listing the file: the
//                            Attachments tab would show a ghost, and a click on its delete would 404
//                            (the page's own delete forgets the copy for the same reason,
//                            `deleteTaskAttachment`). So the copy and any load in flight are
//                            dropped, and the open task is told it was touched so its Activity feed
//                            shows the removal. Nothing here calls the delete endpoint.
//
// Not covered: a task that is OPEN in the preview pane keeps the attachment list it already loaded,
// and if that pane is then edited and saved, the save writes that list (the deleted file still on it)
// back into the cached copy (`sendUpdatedSpecificTask`), so the ghost can return until the task is
// loaded from the server again (a reload). Fixing it needs the open pane to drop the file from its own
// state, which the task pane has no event for.

export const emitTaskAttachmentToolResult = (
    toolName: string,
    ref?: ToolResultTaskAttachmentRef
): void => {
    // The ref comes off the wire: take it only from the tool that sends it, and only with a real id.
    if (toolName !== "delete_task_attachment" || ref?.deleted !== true) return;
    const taskId = Number(ref.task_id);
    if (!Number.isInteger(taskId) || taskId <= 0) return;
    void forgetTaskCopy(taskId);
};

// In the page's own order (`deleteTaskAttachment`): the cached copy goes first, and only then is a
// load already in flight cut loose and the open task told, so nothing that reacts to the event can
// read the old copy. A failing IndexedDB must not leave the rest undone or surface as an unhandled
// rejection: the worst case is the stale copy the call was there to drop.
const forgetTaskCopy = async (taskId: number): Promise<void> => {
    try {
        await invalidateCachedFullTask(taskId);
    } catch (error) {
        console.error("Could not drop the cached task after an agent deleted its file:", error);
    }
    forgetInFlightTask(taskId);
    emitTaskTouched(taskId, "update");
};
