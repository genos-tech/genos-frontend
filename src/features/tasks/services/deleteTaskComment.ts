import type { Socket } from "socket.io-client";

import type { UserProps } from "../../../types/admin";
import { loadTaskComments } from "./loadTaskComments";
import { emitTaskTouched } from "./taskEvents";

// Deleting a task comment (MIP-1274: an Undo toast instead of a confirm).
//
// The real delete is the socket's `task_comment` DELETE: Flask asks Django to
// soft-delete it (a COMMENT_DELETED activity, the PM-thread mirror tombstoned,
// the search chunk purged, the live count returned) and then broadcasts to the
// project room, which is what refreshes every other open list. This is NOT
// called until the Undo window ends (`useUndoableAction`).

/** What the hidden-keys set and the toast key on. */
export const taskCommentKey = (taskId: number | string, commentId: number | string): string =>
    `task-comment:${taskId}:${commentId}`;

const ACK_TIMEOUT_MS = 10_000;

type Args = {
    socket: Socket | null;
    myself: UserProps;
    accessToken: string | null;
    taskId: number;
    commentId: number;
    projectId?: number;
    projectName?: string;
    displayId?: string | null;
};

/**
 * Sends the delete and RESOLVES only when the comment is really gone, so a
 * rejection means "it is still there" and the caller puts it back.
 *
 * The Flask handler cannot say so itself: it `return`s early when Django
 * refuses (404, a network drop) and the emit's ack fires either way, so the ack
 * proves only that the handler ran. Hence the re-read after it: the same list
 * every comment pane loads, with the 15 s cache dropped first (that is also
 * what `emitTaskTouched` does for the deleter's own panes). If the re-read
 * itself fails there is nothing to compare, and a delete that was acked is
 * taken as done.
 */
export const deleteTaskComment = async (args: Args): Promise<void> => {
    const { socket, myself, accessToken, taskId, commentId } = args;
    if (!socket || !socket.connected) throw new Error("The socket is not connected.");
    await new Promise<void>((resolve, reject) => {
        socket.timeout(ACK_TIMEOUT_MS).emit(
            "task_comment",
            {
                method_type: "DELETE",
                project_id: args.projectId,
                project_name: args.projectName,
                task_id: taskId,
                display_id: args.displayId,
                comment_id: commentId,
            },
            (error: Error | null) => (error ? reject(error) : resolve())
        );
    });
    emitTaskTouched(taskId, "comment");
    const live = await loadTaskComments(myself, taskId, accessToken);
    if (live?.some((c) => Number(c.commentId) === Number(commentId))) {
        throw new Error("The server did not delete the comment.");
    }
};

/**
 * The same delete for a page that is going away: Django's own DELETE with a
 * keepalive fetch (a socket emit does not survive the page). Peers are not told
 * live, since only the socket path broadcasts; they see it on their next read.
 */
export const deleteTaskCommentOnExit = (
    accessToken: string | null,
    taskId: number,
    commentId: number
): void => {
    if (!accessToken || typeof fetch !== "function") return;
    try {
        const query = `task_id=${encodeURIComponent(taskId)}&comment_id=${encodeURIComponent(commentId)}`;
        void fetch(`${import.meta.env.VITE_API_BASE_URL}/task/comment/?${query}`, {
            method: "DELETE",
            keepalive: true,
            headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => undefined);
    } catch {
        // Never let this break a page transition.
    }
};
