import { getMessages } from "../../../i18n";
import { UserProps } from "../../../types/admin";

const base_url = import.meta.env.VITE_API_BASE_URL;

type deleteEmptyTaskProps = {
    myself: UserProps;
    taskId: number;
    accessToken: string | null;
    setInitialEmptyTaskId?: (value: number | undefined) => void;
};

/**
 * Discard the empty-task scaffold when a create form is cancelled/closed.
 *
 * Idempotent: a **404 counts as success**. The row being gone (already
 * deleted, or never a live init-task) is exactly the state this function
 * exists to reach, so throwing there just produced a scary
 * "Uncaught (in promise) Failed to delete the empty task" for a no-op —
 * the call sites are fire-and-forget cleanup, not something a user waits on.
 * Real failures (403, 500, offline) still throw so callers can log them.
 */
export const deleteEmptyTask = async (props: deleteEmptyTaskProps) => {
    const { myself, taskId, accessToken, setInitialEmptyTaskId } = props;

    if (!accessToken) return;

    const taskDeleteResponse = await fetch(
        `${base_url}/task/?team_id=${myself.teamId}&task_id=${taskId}&is_init_task_boolean=1`,
        {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    if (!taskDeleteResponse.ok && taskDeleteResponse.status !== 404) {
        throw new Error(getMessages().tasks.errors.deleteEmptyTaskFailed);
    }
    // Clear the global on 404 too — a stale id is precisely what we don't
    // want left pointing at a row that isn't there.
    if (setInitialEmptyTaskId) {
        setInitialEmptyTaskId(undefined);
    }
};
