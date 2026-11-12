import { handleV3ActivitiesRead } from "./handleV3ActivitiesRead";

/**
 * Land the activity ids the server marked read because a task or note was OPENED
 * (MIP-1421): `readActivityIds` on the answers of `POST /task/recent/open/` and
 * `POST /note/recent/`.
 *
 * Opening a task used to leave its comment, mention and inline-comment activity unread, so
 * the sidebar dot and the app badge stayed up after the person had read them. The server now
 * marks them read when the client says the task or note is SHOWN, and names them; this flips
 * them in the activity store and refreshes the sidebar, the same path a chat read-cursor clear
 * takes (`handleV3ActivitiesRead`).
 *
 * Fire and forget. An older server sends no field, and anything that is not a list of ids is
 * ignored: the next activity load reconciles from the server anyway.
 */
export const landReadActivityIds = (data: unknown): void => {
    const raw = (data as { readActivityIds?: unknown } | null | undefined)?.readActivityIds;
    if (!Array.isArray(raw)) return;
    const ids = raw.filter((id): id is string => typeof id === "string" && id.length > 0);
    if (ids.length === 0) return;
    void handleV3ActivitiesRead(ids);
};
