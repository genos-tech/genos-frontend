import { tasksChannel } from "../../../db/workers/channels";
import { getProjectScope, primeProjectScope } from "../state/projectStatusScopeStore";

/**
 * Tell the main thread which statuses a project's STORED rows hold, before any load has
 * answered this session (MIP-2000). After a reload, or when the first load fails (offline),
 * the table paints from IndexedDB; without this the views could not tell that those rows are
 * only the ongoing statuses, and would count them as the whole project.
 *
 * A project with no watermark has nothing stored to describe and stays unknown: its first
 * load answers. A failed read is no reason to block the table.
 */
export const primeProjectScopeFromStore = async (projectId: number): Promise<void> => {
    if (getProjectScope(projectId).loaded !== undefined) return;
    try {
        const { known, statuses } = await tasksChannel.request("readProjectTaskScope", {
            projectId,
        });
        if (known) primeProjectScope(projectId, statuses);
    } catch {
        /* unknown stays unknown */
    }
};
