import type { HashMentionData } from "../../context/HashMentionDataContext";
import { searchTasks } from "../../features/tasks/services/searchTasks";
import { SearchTeamTasksResponse } from "../../types/tasks";

/** Typing must pause this long before a `#` query is sent to the server. */
export const HASH_SEARCH_DEBOUNCE_MS = 200;
/** Rows asked for per `#` query: the menu is a picker, not a list view. */
export const HASH_SEARCH_LIMIT = 20;
const hashSearchCtl = new WeakMap<object, AbortController>();

/** Server task search for one `#` query: debounced per editor, the previous
 *  in-flight query is cancelled. Resolves to no rows when superseded or failed. */
export const searchHashTasks = async (
    editor: object,
    myself: HashMentionData["myself"],
    accessToken: string | null,
    query: string
): Promise<SearchTeamTasksResponse[]> => {
    hashSearchCtl.get(editor)?.abort();
    const q = query.trim();
    if (!myself || !q) return [];
    const ctl = new AbortController();
    hashSearchCtl.set(editor, ctl);
    await new Promise((resolve) => setTimeout(resolve, HASH_SEARCH_DEBOUNCE_MS));
    if (ctl.signal.aborted) return [];
    try {
        const page = await searchTasks(
            myself,
            accessToken,
            { q, limit: HASH_SEARCH_LIMIT },
            ctl.signal
        );
        return ctl.signal.aborted ? [] : page.results;
    } catch {
        return [];
    }
};
