import {
    beginScopeWidening,
    endScopeWidening,
    getProjectScope,
} from "../state/projectStatusScopeStore";
import { scopeCovers, type StatusScope } from "../utils/projectStatusScope";

/**
 * Make sure a project's rows hold the statuses a view needs (MIP-2000), calling `fetchMore`
 * only when they do not. `fetchMore` loads the missing statuses into the local store and reads
 * them into the table.
 *
 * - Nothing happens while the project's first load has not answered (`loaded` unknown): that
 *   load asks for the statuses the table opens on, and the views check again once it has.
 * - Nothing happens when the rows are already held, or when a widening that covers them is
 *   already on its way. So turning a status off and on again, or two views asking at once,
 *   fetch once.
 * - The skeleton (`isWidening`) is up from the moment the fetch starts until it ends, landed
 *   or failed; a failure is logged, never left as a stuck skeleton (the sync status already
 *   reports it).
 */
export const ensureProjectStatuses = async (
    projectId: number,
    need: StatusScope,
    fetchMore: () => Promise<unknown>
): Promise<void> => {
    const state = getProjectScope(projectId);
    if (state.loaded === undefined) return;
    if (scopeCovers(state.loaded, need)) return;
    if (state.pending !== undefined && scopeCovers(state.pending, need)) return;
    beginScopeWidening(projectId, need);
    try {
        await fetchMore();
    } catch (error) {
        console.error(`Failed to load more tasks of project ${projectId}`, error);
    } finally {
        endScopeWidening(projectId);
    }
};
