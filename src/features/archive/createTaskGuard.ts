import { useEffect } from "react";

import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { emitRequestError } from "../../services/requestErrorNotifier";
import { isChatArchived, useIsProjectArchived } from "./archiveState";

/**
 * "Create task" from a chat entry point (MIP-1934). An archived project is read-only, so the
 * entry refuses with the same one-line message the API's 409 shows (`archived`) instead of
 * opening a form that can only fail on save. True when it refused.
 */
export const refuseCreateTaskInArchivedChat = (chat: {
    chatId: string;
    project?: { projectId?: number | null } | null;
}): boolean => {
    if (!isChatArchived({ chatId: chat.chatId, projectId: chat.project?.projectId ?? null })) {
        return false;
    }
    emitRequestError("archived");
    return true;
};

/**
 * Whether the open project (the one a new task would go to) is archived, and a stale "creating a
 * task" intent dropped while it is: the form is not mounted for an archived project, and the flag
 * must not stay set, or the form would pop up by itself when the project is unarchived.
 */
export const useCreateTaskBlockedByArchive = (
    projectId: number | null | undefined,
    flag: boolean,
    setIsCreatingTask: TaskManagementState["setIsCreatingTask"]
): boolean => {
    const archived = useIsProjectArchived(projectId);
    useEffect(() => {
        if (archived && flag) {
            setIsCreatingTask((prev) => ({ ...prev, flag: false }));
        }
        // the setter is a stable useState setter
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [archived, flag]);
    return archived;
};
